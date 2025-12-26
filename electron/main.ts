import {app, BrowserWindow} from 'electron'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {mainCom} from "./mainCom";
import {
    cleanCache,
    createDir, ensureFileExistsData,
    findAllMediaFiles,
    saveCacheToFile
} from './common/file'
import { imageManager } from './common/image'
import { errorHandler, ErrorType } from './common/util/ErrorHandler'
import { performanceMonitor } from './common/util/PerformanceMonitor'
import {createTray, watchConfig} from "./main/tray";
import {eventHandling} from "./main/event";
import { initializeDatabaseSystem, shutdownDatabaseSystem } from './common/database';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.__dirname = __dirname;
global.__filename = __filename;
process.env.LANG = 'en_US.UTF-8';
process.env.APP_ROOT = path.join(__dirname, '..')
export const cache_build= path.join(app.getPath('userData'), 'media_data');//缓存文件夹路径
// export const cache_data_build= path.join(app.getPath('userData'), 'media_data/data');//data路径
// export const ffmpeg_build= path.join(__dirname,'..','app.asar.unpacked','node_modules','ffmpeg-static','ffmpeg.exe');//ffmpeg路径
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
// 生成 ffmpeg.exe 的路径
export const ffmpeg_asar_path = path.join(process.resourcesPath, '../ffmpeg.exe');
export const ffmpeg_asar_path_dev = path.join(__dirname,'..', 'libs/ffmpeg-static/ffmpeg');
export const ffmpeg_path=VITE_DEV_SERVER_URL?ffmpeg_asar_path_dev:ffmpeg_asar_path
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// 数据库路径 - 开发和生产环境都使用持久化的 userData 目录
// 这样确保数据库数据在重新构建和刷新后不会丢失
export const DATABASE_DIR = path.join(app.getPath('userData'), 'media_data');

// 缓存文件夹路径（用于存储图片等静态资源）
// 图片缓存使用持久化目录，避免重新构建时丢失
export const CACHE_FILE = DATABASE_DIR;
// export const CACHE_DATA=VITE_DEV_SERVER_URL? path.join(__dirname, 'cache/data'):cache_data_build;//data路径

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

        // 初始化数据库系统和基础配置
        await performanceMonitor.measureFileOperation('init_config', async () => {
            // 初始化SQLite数据库系统
            await initializeDatabaseSystem(CACHE_FILE);

            await createDir(CACHE_FILE)//创建cache文件夹
            // await ensureFileExistsData(CACHE_DATA)//创建cache/data文件夹
        });

        // 使用SQLite数据库存储
        errorHandler.info(ErrorType.UNKNOWN, 'DATABASE_MODE', '使用SQLite数据库存储数据');

        // 从数据库加载配置并启动定时任务
        await performanceMonitor.measureFileOperation('load_config', async () => {
            const { getConfigDataWithUpdate, configData } = await import('./common/file');
            await getConfigDataWithUpdate();
            console.log('[Main] 配置加载完成:', configData);

            // 启动定时扫描任务
            startPeriodicScan(configData);

            // 执行启动时扫描（如果配置了）
            await performStartupScan(configData);
        });

        // 初始化UI和服务
        await performanceMonitor.measureFunction('init_ui_services', async () => {
            eventHandling(win as BrowserWindow)//事件处理(钩子)
            createTray(win as BrowserWindow, app)//创建托窗
            watchConfig(win as BrowserWindow, app)//监听是否启动托窗
            mainCom()//主进程通讯
            await cleanCache()//清理缓存
            win?.setMenuBarVisibility(false);//隐藏窗口菜单栏
        }, 'ui');

        // 加载页面
        await performanceMonitor.measureFunction('load_page', async () => {
            if (VITE_DEV_SERVER_URL) {
                await win?.loadURL(VITE_DEV_SERVER_URL)
            } else {
                await win?.loadFile(path.join(RENDERER_DIST, 'index.html'));
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

    // 关闭数据库系统
    try {
        await shutdownDatabaseSystem();
        errorHandler.info(ErrorType.UNKNOWN, 'DATABASE_SHUTDOWN', '数据库系统已关闭');
    } catch (error) {
        errorHandler.warn(ErrorType.UNKNOWN, 'DATABASE_SHUTDOWN_ERROR', '关闭数据库系统失败', error);
    }

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


// 定时扫描任务的定时器引用
let scanInterval: NodeJS.Timeout | null = null;

/**
 * 启动定时扫描任务
 */
function startPeriodicScan(configData: any) {
    // 清除已存在的定时器
    if (scanInterval) {
        clearInterval(scanInterval);
    }

    // 获取扫描间隔（默认10分钟）
    const scanIntervalMinutes = configData?.scanInterval || 10;
    const scanIntervalMs = scanIntervalMinutes * 60 * 1000;

    console.log(`[Main] 启动定时扫描任务，间隔: ${scanIntervalMinutes} 分钟`);

    // 创建新的定时器
    scanInterval = setInterval(async () => {
        try {
            const { getConfigDataWithUpdate, configData: currentConfig } = await import('./common/file');
            await getConfigDataWithUpdate();

            console.log(`[Main] 执行定时扫描，路径:`, currentConfig?.scanPaths);
            const files = await findAllMediaFiles(currentConfig?.scanPaths);
            console.log(`[Main] 定时扫描找到 ${files.length} 个媒体文件`);
            await saveCacheToFile(files);

            // 定期数据库维护
            await performDatabaseMaintenance();
        } catch (err) {
            console.error('[Main] 定时扫描失败:', err);
        }
    }, scanIntervalMs);
}

/**
 * 执行启动时扫描
 */
async function performStartupScan(configData: any) {
    if (!configData?.scanOnStartup) {
        console.log('[Main] 未启用启动时扫描');
        return;
    }

    try {
        console.log('[Main] 执行启动时扫描，路径:', configData.scanPaths);
        const files = await findAllMediaFiles(configData.scanPaths);
        console.log(`[Main] 找到 ${files.length} 个媒体文件`);
        await saveCacheToFile(files);

        // 数据库维护任务
        await performDatabaseMaintenance();
    } catch (err) {
        console.error('[Main] 启动时扫描失败:', err);
    }
}

  // 数据库维护任务
  async function performDatabaseMaintenance() {
      try {
          const { databaseService } = await import('./common/database');

          console.log('执行数据库维护任务...');

          // 清理无效文件记录
          const cleanedFiles = await databaseService.cleanupInvalidFiles();
          if (cleanedFiles > 0) {
              console.log(`清理了 ${cleanedFiles} 个无效文件记录`);
          }

          // 清理无效分类
          const cleanedClassifications = await databaseService.cleanupUnusedCategories();
          if (cleanedClassifications > 0) {
              console.log(`清理了 ${cleanedClassifications} 个无效分类`);
          }

          // 每小时执行一次图片缓存检查
          const now = Date.now();
          const lastImageCleanup = await databaseService.getSetting('last_image_cleanup') || 0;
          const oneHour = 60 * 60 * 1000;

          if (now - lastImageCleanup > oneHour) {
              console.log('执行图片缓存检查...');
              await imageManager.checkAndCleanCache();
              await databaseService.setSetting('last_image_cleanup', now);
          }

          // 每天执行一次数据库优化
          const lastOptimization = await databaseService.getSetting('last_db_optimization') || 0;
          const oneDay = 24 * 60 * 60 * 1000;

          if (now - lastOptimization > oneDay) {
              console.log('执行数据库优化...');
              await databaseService.optimize();
              await databaseService.setSetting('last_db_optimization', now);
          }

          // 更新数据库统计信息
          await databaseService.updateStats();

      } catch (error) {
          console.error('数据库维护任务失败:', error);
      }
  }
