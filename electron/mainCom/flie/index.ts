import electron, {dialog, app} from "electron";
import {FileInter} from "../../../src/api/medium/type.ts";
import {
    cleanClassify,
    findAllMediaFiles,
    loadCacheFromFile,
    saveCacheToFile,
    saveConfigData,
    getConfigData,
    configData
} from "../../common/file";
import { imageManager } from "../../common/image";
import { databaseService } from "../../common/database";
import { createTray, destroyTray } from "../../main/tray";
import { win } from "../../main";

function writeFile(_:electron.IpcMainEvent,data:string){
    console.log(data)
}
function readFile(){
    return "asdads";
}
async function searchFile(_: electron.Event) {

}
async function startScan(_: electron.Event,scanPaths:string){
    console.log("开始扫描",scanPaths)
    if (scanPaths && scanPaths.length > 0) {
        try{
            const data=await findAllMediaFiles(JSON.parse(scanPaths))
            await saveCacheToFile(data)
            await cleanClassify()
            return { success: true ,message:`扫描到了${data.length}个媒体文件` }
        }catch (error) {
            console.error('扫描失败:', error)
            return { success: false,message:"扫描失败" }
        }
    }else return {success:false,message:"文件目录不能为空"}
}
async function selectDirectory(){
    try {
        return await dialog.showOpenDialog({
            properties: ['openDirectory'], // 只允许选择文件夹
            title: '选择文件夹',
            buttonLabel: '选择此文件夹',
            message: '请选择不为空的文件夹'
        })
    } catch (error) {
        console.error('选择目录失败:', error)
        throw error
    }
}
async function loadFileCache(_: electron.Event,key:string): Promise<FileInter[] | null>{
    if (!key) return null;
    return await loadCacheFromFile(key);
}
async function saveSettings(_:electron.Event,data:any){
    try {
        // 保存旧的 showTray 值，用于比较
        const oldShowTray = configData?.showTray;

        await saveConfigData(data)

        // 检查 showTray 是否发生变化
        const newShowTray = configData?.showTray;

        // 如果值发生了变化，或者之前没有 configData
        if (oldShowTray !== newShowTray) {
            console.log(`[IPC] showTray 设置已更改: ${oldShowTray} -> ${newShowTray}`);

            // 更新托盘状态
            if (newShowTray) {
                // 显示托盘
                if (win && app) {
                    destroyTray(); // 先销毁旧的（如果存在）
                    createTray(win, app);
                    console.log('[IPC] 托盘已显示');
                }
            } else {
                // 隐藏托盘
                destroyTray();
                console.log('[IPC] 托盘已隐藏');
            }
        }

        return { success: true }
    } catch (error) {
        console.error('保存设置失败:', error)
        return { success: false }
    }
}
async function loadSettings(){
    try {
        console.log('[IPC] 开始从数据库加载设置...');

        // 从数据库加载配置
        await getConfigData();

        // 获取各个设置项
        const port = await databaseService.getSetting('port');
        const scanPaths = await databaseService.getSetting('scanPaths');
        const theme = await databaseService.getSetting('theme');
        const showTray = await databaseService.getSetting('showTray');
        const autoPlay = await databaseService.getSetting('autoPlay');
        const defaultVolume = await databaseService.getSetting('defaultVolume');
        const scanOnStartup = await databaseService.getSetting('scanOnStartup');
        const scanInterval = await databaseService.getSetting('scanInterval');
        const minimization = await databaseService.getSetting('minimization');
        const isRole = await databaseService.getSetting('isRole');
        const password = await databaseService.getSetting('password');
        const rememberLastPlayed = await databaseService.getSetting('rememberLastPlayed');

        // 兼容处理：如果 scanPaths 是字符串（历史数据），尝试解析
        let processedScanPaths = scanPaths;
        if (typeof scanPaths === 'string') {
            try {
                processedScanPaths = JSON.parse(scanPaths);
                // 如果解析成功，自动修复数据库中的数据
                await databaseService.setSetting('scanPaths', processedScanPaths);
                console.log('[IPC] 已修复 scanPaths 数据格式');
            } catch {
                processedScanPaths = [];
            }
        }
        const result = {
            port: port ?? 3000,
            scanPaths: processedScanPaths ?? [],
            theme: theme ?? 'light',
            showTray: showTray ?? true,
            autoPlay: autoPlay ?? false,
            defaultVolume: defaultVolume ?? 80,
            scanOnStartup: scanOnStartup ?? false,
            scanInterval: scanInterval ?? 10,
            minimization: minimization ?? true,
            isRole: isRole ?? false,
            password: password ?? "",
            rememberLastPlayed: rememberLastPlayed ?? false
        };

        console.log('[IPC] 最终返回的设置:', result);
        return result;
    } catch (error) {
        console.error('[IPC] 读取设置失败:', error)
        return null
    }
}


export {
    writeFile, readFile, startScan, searchFile,
    selectDirectory, loadSettings, saveSettings,
    loadFileCache
}
