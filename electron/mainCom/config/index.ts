import os from 'node:os'
import electron, {nativeTheme,clipboard } from "electron";
import {startServer} from "../../services.ts";
import {configData, getConfigData} from "../../common/file";
import {getLocalDevices} from "../../common/network";
import {isServerRunning, setIsServerRunning} from "../../main/tray";

let expressServer:any=null

export function setServerRunning(expressServerT:any){
    expressServer=expressServerT
}

function getIp(){
    // 获取网络接口信息
    const networkInterfaces = os.networkInterfaces();
    let Ip=""
// 遍历网络接口信息，找到 IPv4 地址
    Object.keys(networkInterfaces).forEach(interfaceName => {
        networkInterfaces[interfaceName]?.forEach(interfaceInfo => {
            if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal) {
                Ip=`${interfaceInfo.address}`
            }
        });
    });
    return Ip;
}

async function start(_: electron.Event,data:number) {
    // 监听渲染进程的请求
    try {
        if(data===0){
            //关闭服务
            if(expressServer){
                expressServer.close()
                expressServer = null
                setIsServerRunning(false,expressServer)
                return {success:false, message:"服务已关闭"}
            }
           return {success:false, message:"服务未启动"}
        }
        await getConfigData()
        const port=configData?.port
        if (!port){
            return {success:false, message:"请先设置端口"}
        }
        if (!expressServer){
            expressServer = await startServer(port)
            setIsServerRunning(true,expressServer)
            return {success:true, message:`启动成功 port:${expressServer.address().port}`}
        }
        return {success:true, message:`服务已经启动 port:${expressServer.address().port}`}
    } catch (error) {
        console.log(error)
        return {success:false, message:"启动失败"}
    }
}
async function theme(){
    return nativeTheme.shouldUseDarkColors
}
async function getLoadNet(){
    return await getLocalDevices()
}
async function getStartServer(){
    return isServerRunning;
}
// 写入剪贴板
function copy(_: electron.Event, textToCopy:string){
    clipboard.writeText(textToCopy.toString());
}
export { getIp, start, theme, copy,getLoadNet,getStartServer }
