import electron, {dialog} from "electron";
import {FileInter} from "../../../src/api/medium/type.ts";
import {
    findAllMusicFiles,
    loadCacheFromFile,
    saveCacheToFile, saveConfigData,
} from "../../common/file/searchFile.ts";
import fs from "fs/promises";
import {CACHE_FILE_PATH, SETTINGS_FILE_PATH} from "../../main.ts";

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
            const data=await findAllMusicFiles(JSON.parse(scanPaths))
            saveCacheToFile(CACHE_FILE_PATH,data)
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
    return await loadCacheFromFile(CACHE_FILE_PATH,key);
}
async function saveSettings(_:electron.Event,data:any){
    try {
        await saveConfigData(data)
        return { success: true }
    } catch (error) {
        console.error('保存设置失败:', error)
        return { success: false }
    }
}
async function loadSettings(){
    try {
        const data = await fs.readFile(SETTINGS_FILE_PATH, 'utf-8')
        return JSON.parse(data)
    } catch (error) {
        // 如果文件不存在，返回默认设置
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null
        }
        console.error('读取设置失败:', error)
        return null
    }
}
export {
    writeFile, readFile, startScan, searchFile,
    selectDirectory, loadSettings, saveSettings,
    loadFileCache
}
