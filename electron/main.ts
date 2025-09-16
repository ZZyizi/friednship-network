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
} from './common/file'
import { imageManager } from './common/image'
import { errorHandler, ErrorType } from './common/util/ErrorHandler'
import { performanceMonitor } from './common/util/PerformanceMonitor'
import {createTray, watchConfig} from "./main/tray";
import {eventHandling} from "./main/event";



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.__dirname = __dirname;
global.__filename = __filename;
process.env.LANG = 'en_US.UTF-8';
process.env.APP_ROOT = path.join(__dirname, '..')
export const cache_build= path.join(app.getPath('userData'), 'media_data');//缓存文件夹路径
export const cache_cache_build= path.join(app.getPath('userData'), 'media_data/cache.json');//缓存文件路径
export const cache_data_build= path.join(app.getPath('userData'), 'media_data/data');//data路径
export const cache_file_path_build= path.join(app.getPath('userData'), 'media_data/fileCache.json');//file路径
export const cache_file_type_build= path.join(app.getPath('userData'), 'media_data/classifyType.json');//fileType路径
// export const ffmpeg_build= path.join(__dirname,'..','app.asar.unpacked','node_modules','ffmpeg-static','ffmpeg.exe');//ffmpeg路径
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
// 生成 ffmpeg.exe 的路径
export const ffmpeg_asar_path = path.join(process.resourcesPath, '../ffmpeg.exe');
export const ffmpeg_asar_path_dev = path.join(__dirname,'..', 'libs/ffmpeg-static/ffmpeg');
export const ffmpeg_path=VITE_DEV_SERVER_URL?ffmpeg_asar_path_dev:ffmpeg_asar_path
export const SETTINGS_FILE_PATH =VITE_DEV_SERVER_URL ? path.join(__dirname, 'cache/config.json'):cache_cache_build;//配置文件路径
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST
// JSON 文件路径，用于保存缓存
export const CACHE_FILE_TYPE=VITE_DEV_SERVER_URL? path.join(__dirname, 'cache/classifyType.json'):cache_file_type_build;//缓存分类文件路径
export const CACHE_FILE_PATH =VITE_DEV_SERVER_URL? path.join(__dirname, 'cache/fileCache.json'):cache_file_path_build;//缓存文件路径
export const CACHE_FILE=VITE_DEV_SERVER_URL? path.join(__dirname, 'cache'):cache_build;//缓存文件夹路径
export const CACHE_DATA=VITE_DEV_SERVER_URL? path.join(__dirname, 'cache/data'):cache_data_build;//data路径

export let win: BrowserWindow | null
export let isQuitting:boolean = false; // 手动定义退出标记

async function createWindow() {
    const measureId = performanceMonitor.startMeasure('app_startup', 'application');
    
    try {
        errorHandler.info(ErrorType.UNKNOWN, 'APP_START', '开始启动应用程序');

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

        // 初始化基础配置和目录
        await performanceMonitor.measureFileOperation('init_config', async () => {
            await getConfigData()
            await createDir(CACHE_FILE)//创建cache文件夹
            await ensureFileExistsData(CACHE_DATA)//创建cache/data文件夹
        });
        
        // 使用文件模式存储
        errorHandler.info(ErrorType.UNKNOWN, 'FILE_MODE', '使用文件模式存储数据');
        
        // 初始化UI和服务
        await performanceMonitor.measureFunction('init_ui_services', async () => {
            eventHandling(win)//事件处理(钩子)
            createTray(win, app)//创建托窗
            watchConfig(win, app)//监听是否启动托窗
            mainCom()//主进程通讯
            await cleanCache()//清理缓存
            win.setMenuBarVisibility(false);//隐藏窗口菜单栏
        }, 'ui');

        // 加载页面
        await performanceMonitor.measureFunction('load_page', async () => {
            if (VITE_DEV_SERVER_URL) {
                await win.loadURL(VITE_DEV_SERVER_URL)
            } else {
                await win.loadFile(path.join(RENDERER_DIST, 'index.html'));
            }
        }, 'ui');

        performanceMonitor.endMeasure(measureId, true);
        errorHandler.info(ErrorType.UNKNOWN, 'APP_START_SUCCESS', '应用程序启动完成');

    } catch (error) {
        performanceMonitor.endMeasure(measureId, false);
        errorHandler.error(ErrorType.UNKNOWN, 'APP_START_ERROR', '应用程序启动失败', 
            error instanceof Error ? error : new Error(String(error)));
        throw error;
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
app.on('before-quit', async () => {
    isQuitting = true; // 确保退出时标记为 true
    
    errorHandler.info(ErrorType.UNKNOWN, 'APP_QUIT_START', '开始关闭应用程序');
    
    // 文件模式无需特殊关闭操作
    errorHandler.info(ErrorType.UNKNOWN, 'FILE_MODE_CLOSE', '文件模式关闭');
    
    // 生成性能报告
    try {
        const report = performanceMonitor.generateReport();
        errorHandler.info(ErrorType.UNKNOWN, 'PERF_REPORT', '性能报告', {
            totalOperations: report.summary.totalMetrics,
            categories: report.summary.categories,
            slowOperations: report.slowOperations.length,
            errorOperations: report.errorOperations.length
        });
    } catch (error) {
        errorHandler.warn(ErrorType.UNKNOWN, 'PERF_REPORT_ERROR', '生成性能报告失败', error);
    }
    
    // 关闭日志系统
    errorHandler.info(ErrorType.UNKNOWN, 'APP_QUIT_SUCCESS', '应用程序关闭完成');
    errorHandler.close();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow()
  }
})
app.whenReady().then(createWindow)


// 定时任务：更新缓存和数据库维护
  async function update() {
      await getConfigData()
      
      // 首次启动时的扫描
      if (configData?.scanOnStartup){
          try {
              const files = await findAllMusicFiles(configData?.scanPaths);
              console.log(`找到 ${files.length} 个媒体文件`);
              await saveCacheToFile(CACHE_FILE_PATH, files);
              
              // 数据库维护任务
              await performDatabaseMaintenance();
          } catch (err) {
              console.error('扫描失败:', err);
          }
      }

      // 定时扫描任务
      setInterval(async () => {
          try {
              await getConfigData();
              const files = await findAllMusicFiles(configData?.scanPaths);
              console.log(`定时扫描找到 ${files.length} 个媒体文件`);
              await saveCacheToFile(CACHE_FILE_PATH, files);
              
              // 定期数据库维护
              await performDatabaseMaintenance();
          } catch (err) {
              console.error('定时扫描失败:', err);
          }
      }, configData?.scanInterval ? configData.scanInterval * 60 * 1000 : 10*60*1000);
  }

  // 数据库维护任务
  async function performDatabaseMaintenance() {
      try {
          // 检查数据库状态
          if (dbManager.isReady()) {
              console.log('执行数据库维护任务...');
              
              // 清理无效文件记录
              const cleanedFiles = dbManager.cleanupNonExistentFiles();
              if (cleanedFiles > 0) {
                  console.log(`清理了 ${cleanedFiles} 个无效文件记录`);
              }
              
              // 清理无效分类
              const cleanedClassifications = dbManager.cleanupUnusedClassifications();
              if (cleanedClassifications > 0) {
                  console.log(`清理了 ${cleanedClassifications} 个无效分类`);
              }
              
              // 每小时执行一次图片缓存检查
              const now = Date.now();
              const lastImageCleanup = dbManager.getSetting('last_image_cleanup') || 0;
              const oneHour = 60 * 60 * 1000;
              
              if (now - lastImageCleanup > oneHour) {
                  console.log('执行图片缓存检查...');
                  await imageManager.checkAndCleanCache();
                  dbManager.setSetting('last_image_cleanup', now, 'timestamp');
              }
              
              // 每天执行一次数据库优化
              const lastOptimization = dbManager.getSetting('last_db_optimization') || 0;
              const oneDay = 24 * 60 * 60 * 1000;
              
              if (now - lastOptimization > oneDay) {
                  console.log('执行数据库优化...');
                  dbManager.optimize();
                  dbManager.setSetting('last_db_optimization', now, 'timestamp');
              }
          }
      } catch (error) {
          console.error('数据库维护任务失败:', error);
      }
  }
