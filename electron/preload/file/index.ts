import {ipcRenderer} from "electron";

function saveFile(data:string) {
    return ipcRenderer.send('file-save',data);
}
function readFile() {
    return ipcRenderer.invoke('file-read')
}
function loadFileCache(key:string){
    return ipcRenderer.invoke('load-file-cache',key)
}
function saveSettings(data:object){
    return ipcRenderer.invoke('save-settings',data)
}
function loadSettings(){
    return ipcRenderer.invoke('load-settings')
}
function selectDirectory(){
    return ipcRenderer.invoke('select-directory')
}
function searchFile(scanPaths:string[]){
    return ipcRenderer.invoke('search-file',scanPaths)
}
function startScan(scanPaths:string[]){
    return ipcRenderer.invoke('start-scan',scanPaths)
}
export {
    saveFile, readFile, searchFile,  loadFileCache,
    saveSettings, loadSettings, selectDirectory, startScan
}

