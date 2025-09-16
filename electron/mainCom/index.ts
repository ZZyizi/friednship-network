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
} from "./flie";
import {copy, getIp, getLoadNet, getStartServer, start, theme} from "./config";

function file() {
    // 原有的文件操作
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
    ipcMain.handle('config-get',getIp)//获取ip
    ipcMain.handle('start-server',start)//启动/停止服务
    ipcMain.handle('copy',copy)//复制
    ipcMain.handle('get-load-net',getLoadNet)//获取本地文件
    ipcMain.handle('get-start-server',getStartServer)//获取服务是否启动
}

function Theme(){
    ipcMain.handle('theme-changed',theme)//获取主题
}

export function mainCom(){
    file()
    config()
    Theme()
}

