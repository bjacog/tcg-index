import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('tcgIndexDesktop', {
  isElectron: true,
  getServerOrigin: () => ipcRenderer.invoke('runtime:get-server-origin'),
  onPollingStatus: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('runtime:poll-status', listener)
    return () => ipcRenderer.removeListener('runtime:poll-status', listener)
  },
})
