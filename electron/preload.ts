import { ipcRenderer, contextBridge } from 'electron'
import {
  readFile,
  saveFile,
  searchFile,
  saveSettings,
  loadSettings,
  selectDirectory,
  loadFileCache, startScan
} from "./preload/file";
import {getConfig, start, theme, copy, getLoadNet} from "./preload/config";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
      const [channel, listener] = args
      return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
      const [channel, ...omit] = args
      return ipcRenderer.off(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
      const [channel, ...omit] = args
      return ipcRenderer.send(channel, ...omit)
    },
    invoke: (channel: string, ...args: any[]) => {
      return ipcRenderer.invoke(channel, ...args)
    }
  }
)

contextBridge.exposeInMainWorld('file', {
  saveFile,
  readFile,
  searchFile,
  saveSettings,
  loadSettings,
  loadFileCache,
  selectDirectory,
  startScan
})
contextBridge.exposeInMainWorld('config', {
  getConfig,
  start,
  theme,
  copy,
  getLoadNet
})

