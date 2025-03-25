// 创建托盘
import {BrowserWindow, clipboard, Menu, nativeImage, Tray, Notification,app} from "electron";
import path from "node:path";
import os from "node:os";
import {startServer} from "../../services.ts";
import {CACHE_FILE_PATH, SETTINGS_FILE_PATH, win} from "../../main.ts";
import {configData} from "../../common/file/searchFile.ts";
import fs from "fs";
import {setServerRunning} from "../../mainCom/config";

// 获取网络接口信息
const networkInterfaces = os.networkInterfaces();
let Ip=""
try{
    // 遍历网络接口信息，找到 IPv4 地址
    Object.keys(networkInterfaces).forEach(interfaceName => {
        networkInterfaces[interfaceName]?.forEach(interfaceInfo => {
            if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal) {
                Ip=`${interfaceInfo.address}`
            }
        });
    });
}catch (e){
    console.log(e)
}
let expressServer:any=null;//服务
export let isServerRunning = false;//获取服务是否启动
let tray: Tray|null=null;

export function setIsServerRunning(state:boolean,expressServerT:any){
    isServerRunning=state;
    expressServer=expressServerT
    destroyTray();
    createTray(win as any,app)
}

export function createTray(win: BrowserWindow, app: Electron.App) {
    if(!configData?.showTray) return;
    // 创建托盘图标
    const trayIcon = nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC!, 'favicon.ico')).resize({ width: 16, height: 16 });
    tray = new Tray(trayIcon);
    // 动态生成菜单模板
    const getMenuTemplate = ():any => {
        return [
            {
                label: '显示窗口',
                click: () => win?.show(),
            },
            { type: 'separator' },
            {
                type: 'submenu',
                label: isServerRunning?'局域网(已启动)':'局域网',
                submenu: [
                    {
                        label: 'ip:' + Ip,
                        click: () => {
                            clipboard.writeText(Ip);
                            new Notification({
                                title: '通知',
                                body: '成功复制到粘贴板',
                                icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
                            }).show();
                        },
                    },
                    {
                        label: isServerRunning ? '停止服务' : '启动服务', // 动态标签
                        click: async () => {
                            try {
                                if (isServerRunning) {
                                    await expressServer.close();
                                    expressServer = null;
                                    isServerRunning = false;
                                    setServerRunning(expressServer)
                                    new Notification({
                                        title: '通知',
                                        body: '服务已停止',
                                        icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
                                    }).show();
                                } else {
                                    expressServer = await startServer(configData?.port || 3000, CACHE_FILE_PATH);
                                    isServerRunning = true;
                                    setServerRunning(expressServer)
                                    new Notification({
                                        title: '启动成功',
                                        body: `${Ip}:${configData?.port || 3000}`,
                                        icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
                                    }).show();
                                }
                                // 更新菜单
                                tray?.setContextMenu(Menu.buildFromTemplate(getMenuTemplate()));
                            } catch (error) {
                                new Notification({
                                    title: '错误',
                                    body: isServerRunning ? '停止服务失败' : '启动失败（端口被占用）',
                                    icon: path.join(process.env.VITE_PUBLIC!, 'favicon.ico'),
                                }).show();
                            }finally {
                                win.webContents.send("update-start-server", { isServerRunning });
                            }
                        },
                    },
                ],
            },
            {
                label: '端口映射',
                click: () => app.quit(),
            },
            { type: 'separator' },
            {
                label: '退出',
                click: () => app.quit(),
            },
        ];
    };
    // 初始化菜单
    const updateTrayMenu = () => {
        const contextMenu = Menu.buildFromTemplate(getMenuTemplate());
        tray?.setContextMenu(contextMenu);
    };
    // 设置托盘提示
    tray.setToolTip('friendship-network');
    // 点击托盘图标切换窗口显示
    tray.on('click', () => {
        win?.isVisible() ? win?.hide() : win?.show();
    });
    // 初始化菜单
    updateTrayMenu();
}

export function destroyTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}

// 监听文件变化
export function watchConfig(win: BrowserWindow, app: Electron.App) {
    fs.watch(SETTINGS_FILE_PATH, (eventType) => {
        if (eventType === 'change') {
            destroyTray()//销毁托盘
            if(configData?.showTray){
                createTray(win,app);//创建托盘
            }else {
                destroyTray()//销毁托盘
            }
        }
    });
}
