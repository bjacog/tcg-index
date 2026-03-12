/* global Headers, Request, fetch, setInterval, clearInterval, console */

import { app, BrowserWindow, ipcMain } from 'electron'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'

const isDev = !app.isPackaged
const rendererUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:3000'
const pollIntervalMs = Number(process.env.ELECTRON_POLL_INTERVAL_MS || 1200)
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientDistDirectory = path.resolve(currentDirectory, '../dist/client')

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {import('node:http').Server | null} */
let localServer = null
/** @type {string | null} */
let localServerUrl = null
/** @type {NodeJS.Timeout | null} */
let pollTimer = null
/** @type {boolean} */
let pollInFlight = false
/** @type {string | null} */
let lastPollFingerprint = null

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

function emitPollingStatus(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  mainWindow.webContents.send('runtime:poll-status', {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...payload,
  })
}

async function tryServeStaticAsset(req, res) {
  if (!req.url) {
    return false
  }

  const requestUrl = new URL(req.url, 'http://localhost')
  const assetPath = decodeURIComponent(requestUrl.pathname)

  if (assetPath === '/' || assetPath === '') {
    return false
  }

  const relativePath = assetPath.replace(/^\//, '')
  const filePath = path.resolve(clientDistDirectory, relativePath)
  const relativeToClient = path.relative(clientDistDirectory, filePath)

  if (relativeToClient.startsWith('..') || path.isAbsolute(relativeToClient)) {
    return false
  }

  if (!existsSync(filePath)) {
    return false
  }

  const fileStats = await stat(filePath)
  if (!fileStats.isFile()) {
    return false
  }

  const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
  res.statusCode = 200
  res.setHeader('content-type', contentType)
  res.setHeader('content-length', fileStats.size)
  res.setHeader('cache-control', 'public, max-age=31536000, immutable')

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('end', resolve)
    stream.pipe(res)
  })

  return true
}

async function startEmbeddedServer() {
  if (localServer && localServerUrl) {
    return localServerUrl
  }

  const serverModule = await import(new URL('../dist/server/server.js', import.meta.url).href)
  const serverEntry = serverModule.default

  if (!serverEntry?.fetch) {
    throw new Error('Built server entry does not expose fetch()')
  }

  localServer = createServer(async (req, res) => {
    try {
      if (await tryServeStaticAsset(req, res)) {
        return
      }

      const origin = localServerUrl || 'http://localhost'
      const requestUrl = new URL(req.url || '/', origin)
      const headers = new Headers()

      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) headers.append(key, item)
        } else if (value !== undefined) {
          headers.set(key, value)
        }
      }

      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : req
      const request = new Request(requestUrl, {
        method: req.method,
        headers,
        body,
        duplex: body ? 'half' : undefined,
      })

      const response = await serverEntry.fetch(request)
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))

      if (!response.body) {
        res.end()
        return
      }

      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(Buffer.from(value))
      }
      res.end()
    } catch (error) {
      console.error('Embedded server request failed', error)
      res.statusCode = 500
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      res.end(error instanceof Error ? error.message : 'Embedded server failed')
    }
  })

  await new Promise((resolve, reject) => {
    localServer.once('error', reject)
    localServer.listen(0, 'localhost', () => {
      localServer?.off('error', reject)
      resolve(undefined)
    })
  })

  const address = localServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine embedded server address')
  }

  localServerUrl = `http://localhost:${address.port}`
  return localServerUrl
}

async function stopEmbeddedServer() {
  if (!localServer) return

  await new Promise((resolve) => {
    localServer?.close(() => resolve(undefined))
  })

  localServer = null
  localServerUrl = null
}

async function pollOnce() {
  if (!localServerUrl || pollInFlight) {
    return
  }

  pollInFlight = true
  try {
    const response = await fetch(new URL('/api/delver-poll', localServerUrl), { method: 'POST' })
    const payload = await response.json()
    const fingerprint = JSON.stringify(payload)

    if (fingerprint !== lastPollFingerprint) {
      emitPollingStatus({ ok: response.ok, ...payload })
      lastPollFingerprint = fingerprint
    }
  } catch (error) {
    emitPollingStatus({
      ok: false,
      message: error instanceof Error ? error.message : 'Electron runtime polling failed',
    })
  } finally {
    pollInFlight = false
  }
}

function startPollingLoop() {
  if (pollTimer) return

  pollTimer = setInterval(() => {
    void pollOnce()
  }, pollIntervalMs)

  void pollOnce()
}

function stopPollingLoop() {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

async function createMainWindow() {
  const startUrl = isDev ? rendererUrl : await startEmbeddedServer()

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    autoHideMenuBar: true,
    webPreferences: {
      preload: new URL('./preload.mjs', import.meta.url).pathname,
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'TCG Index',
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  await mainWindow.loadURL(startUrl)

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  startPollingLoop()
}

ipcMain.handle('runtime:is-electron', () => true)
ipcMain.handle('runtime:get-server-origin', () => localServerUrl)

app.whenReady().then(async () => {
  await createMainWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  stopPollingLoop()
  await stopEmbeddedServer()
})
