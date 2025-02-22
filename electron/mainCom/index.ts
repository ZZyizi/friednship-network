import {ipcMain} from "electron";
import {
    readFile,
    writeFile,
    selectDirectory,
    loadSettings,
    saveSettings,
    loadFileCache,
    startScan,
    searchFile
} from "./flie/index.js";
import {copy, getIp, getLoadNet, start, theme} from "./config/index.js";

function file() {
    ipcMain.on('file-save', writeFile) // 保存文件
    ipcMain.handle('file-read',readFile)// 读取文件
    ipcMain.handle('load-file-cache',loadFileCache)// 加载文件缓存
    ipcMain.handle('select-directory', selectDirectory) // 选择目录
    ipcMain.handle('save-settings', saveSettings) // 保存设置
    ipcMain.handle('load-settings', loadSettings) // 读取设置
    ipcMain.handle('start-scan', startScan) // 扫描文件
    ipcMain.handle('search-file',searchFile )//搜索文件
}
function config() {
    ipcMain.handle('config-get',getIp)
    ipcMain.handle('start-server',start)
    ipcMain.handle('copy',copy)
    ipcMain.handle('get-load-net',getLoadNet)
}
function Theme(){
    ipcMain.handle('theme-changed',theme)
}

export function mainCom(){
    file()
    config()
    Theme()
}

