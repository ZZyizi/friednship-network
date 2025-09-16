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

// 新增：数据库操作 API
function getDatabaseStatus() {
    return ipcRenderer.invoke('db-get-status')
}

function getMigrationStatus() {
    return ipcRenderer.invoke('db-get-migration-status')
}

function initializeDatabase() {
    return ipcRenderer.invoke('db-initialize')
}

function performMigration() {
    return ipcRenderer.invoke('db-perform-migration')
}

function rollbackMigration() {
    return ipcRenderer.invoke('db-rollback-migration')
}

function setDatabaseMode(enabled: boolean) {
    return ipcRenderer.invoke('db-set-mode', enabled)
}

function getMediaStats() {
    return ipcRenderer.invoke('db-get-media-stats')
}

function searchMediaFiles(searchTerm: string, type?: string) {
    return ipcRenderer.invoke('db-search-media', searchTerm, type)
}

function getImageStats() {
    return ipcRenderer.invoke('db-get-image-stats')
}

function cleanImageCache() {
    return ipcRenderer.invoke('db-clean-image-cache')
}

function getVersionCompatibility() {
    return ipcRenderer.invoke('db-get-version-compatibility')
}

export {
    saveFile, readFile, searchFile, loadFileCache,
    saveSettings, loadSettings, selectDirectory, startScan,
    // 新增的数据库操作
    getDatabaseStatus, getMigrationStatus, initializeDatabase,
    performMigration, rollbackMigration, setDatabaseMode,
    getMediaStats, searchMediaFiles, getImageStats,
    cleanImageCache, getVersionCompatibility
}

