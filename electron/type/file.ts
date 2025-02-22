
export interface fileType {
    loadFileCache:Function,
    saveFile:Function,
    readFile:Function,
    searchFile:Function,
    startScan:Function,
    selectDirectory:Function,
    saveSettings:Function,
    loadSettings:Function,
}
export interface configType {
    getConfig:Function,
    start:Function,
    theme:Function,
    copy:Function,
    getLoadNet:Function
}
export interface searchFileType {
    path:string,
    type:string[],
}
