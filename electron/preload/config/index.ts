import {ipcRenderer} from "electron";

function getConfig() {
    return ipcRenderer.invoke('config-get')
}
function start(port:number){
    return  ipcRenderer.invoke('start-server',port);
}
function theme(){
    return  ipcRenderer.invoke('theme-changed');
}
function copy(text:string){
    return ipcRenderer.invoke('copy',text);
}
function getLoadNet(){
    return ipcRenderer.invoke('get-load-net');
}
function getStartServer(){
    return ipcRenderer.invoke('get-start-server');
}

export { getConfig, start, theme, copy, getLoadNet, getStartServer }
