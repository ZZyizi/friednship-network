/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Global variables for ES modules compatibility
declare global {
  var __filename: string;
  var __dirname: string;
}

// Used in Renderer process, expose in `index.ts`
interface Window {
  api:any,
  file: import('./type/file').fileType,
  config:import('./type/file').configType,
  ipcRenderer: import('electron').IpcRenderer
}
