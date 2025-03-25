import {app, BrowserWindow} from 'electron'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {mainCom} from "./mainCom";
import {
    cleanCache,
    configData,
    createDir, ensureFileExistsData,
    findAllMusicFiles,
    getConfigData,
    saveCacheToFile
} from './common/file/searchFile.ts'
import {createTray, watchConfig} from "./main/tray/index";
import {eventHandling} from "./main/event/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url))
global.__dirname = __dirname;
process.env.LANG = 'en_US.UTF-8';
process.env.APP_ROOT = path.join(__dirname, '..')
export const cache_build= path.join(app.getPath('userData'), 'media_data');//缓存文件夹路径
export const cache_cache_build= path.join(app.getPath('userData'), 'media_data/cache.json');//缓存文件路径
export const cache_data_build= path.join(app.getPath('userData'), 'media_data/data');//data路径
export const cache_file_path_build= path.join(app.getPath('userData'), 'media_data/fileCache.json');//file路径
// export const ffmpeg_build= path.join(__dirname,'..','app.asar.unpacked','node_modules','ffmpeg-static','ffmpeg.exe');//ffmpeg路径
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
// 生成 ffmpeg.exe 的路径
export const ffmpeg_asar_path = path.join(process.resourcesPath, '../ffmpeg.exe');
export const ffmpeg_asar_path_dev = path.join(__dirname,'..', 'libs/ffmpeg-static/ffmpeg');
export const ffmpeg_path=VITE_DEV_SERVER_URL?ffmpeg_asar_path_dev:ffmpeg_asar_path
export const SETTINGS_FILE_PATH =VITE_DEV_SERVER_URL ? path.join(__dirname, 'cache/config.json'):cache_cache_build;//配置文件路径
// export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST
// JSON 文件路径，用于保存缓存
export const CACHE_FILE_PATH =VITE_DEV_SERVER_URL? path.join(__dirname, 'cache/fileCache.json'):cache_file_path_build;//缓存文件路径
export const CACHE_FILE=VITE_DEV_SERVER_URL? path.join(__dirname, 'cache'):cache_build;//缓存文件夹路径
export const CACHE_DATA=VITE_DEV_SERVER_URL? path.join(__dirname, 'cache/data'):cache_data_build;//data路径

export let win: BrowserWindow | null
export let isQuitting:boolean = false; // 手动定义退出标记

async function createWindow() {
     win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
        autoHideMenuBar: true, //菜单栏
        webPreferences: {
            nodeIntegration: true,  // 允许使用 Node.js API
            preload: path.join(__dirname, 'preload.mjs'),
            webSecurity: false, // 禁用 Web 安全性（允许加载本地资源）
            // devTools: false // 禁用开发者工具
        }
    })
    await getConfigData()
    eventHandling(win)//事件处理(钩子)
    createTray(win, app)//创建托窗
    watchConfig(win, app)//监听是否启动托窗
    await createDir(CACHE_FILE)//创建cache文件夹
    await ensureFileExistsData(CACHE_DATA)//创建cache/data文件夹
    mainCom()//主进程通讯
    await cleanCache()//清理缓存
    win.setMenuBarVisibility(false);//隐藏窗口菜单栏


    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'));
    }
}

//状态事件
app.on('ready',  () => {
    app.setAboutPanelOptions({
        applicationName: 'friendship-network',
        applicationVersion: '0.0.1',
        iconPath: path.join(process.env.VITE_PUBLIC,'favicon.ico') // 设置图标
    });
    if (process.platform === "darwin") {
        app.dock.setIcon(path.join(process.env.VITE_PUBLIC,'favicon.ico')); // macOS Dock 图标
    }
    update().then()//每五分钟更新缓存
})
app.on('window-all-closed', (e:Event) => {
    e.preventDefault();
  if (process.platform !== 'darwin') {
      app.quit()
      win = null
  }
})

// 监听退出事件
app.on('before-quit', () => {
    isQuitting = true; // 确保退出时标记为 true
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
app.whenReady().then(createWindow)


// 定时任务：每隔 time 分钟更新一次缓存
  async function update() {
      await getConfigData()
      if (configData?.scanOnStartup){
          findAllMusicFiles(configData?.scanPaths)
              .then((Files) => {
                  console.log('找到的对应文件:');
                  saveCacheToFile(CACHE_FILE_PATH, Files)
              })
              .catch((err) => {
                  console.error('扫描失败:', err);
              });
      }

      setInterval(async () => {
          await getConfigData()
          findAllMusicFiles(configData?.scanPaths)
              .then((Files) => {
                  console.log('找到的对应文件:');
                  saveCacheToFile(CACHE_FILE_PATH, Files)
              })
              .catch((err) => {
                  console.error('扫描失败:', err);
              });
      }, configData?.scanInterval?configData.scanInterval * 60 * 1000:10*60*1000);
  }
