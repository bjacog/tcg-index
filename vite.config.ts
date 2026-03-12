import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const certDirectory = path.resolve(process.cwd(), 'certs')
const httpsKeyPath = path.join(certDirectory, 'localhost-key.pem')
const httpsCertPath = path.join(certDirectory, 'localhost-cert.pem')
const useHttps = process.env.VITE_DEV_HTTPS === 'true'

const httpsConfig =
  useHttps && existsSync(httpsKeyPath) && existsSync(httpsCertPath)
    ? {
        key: readFileSync(httpsKeyPath),
        cert: readFileSync(httpsCertPath),
      }
    : undefined

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: httpsConfig
    ? {
        https: httpsConfig,
      }
    : undefined,
})

export default config
