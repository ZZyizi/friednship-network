import {BrowserWindow, nativeTheme} from "electron";
import {isQuitting} from "../../main.ts";
import {configData, getConfigData} from "../../common/file";

export function eventHandling(win: BrowserWindow){
    //程序事件
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
        win?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
    })
    // 监听窗口关闭事件（点击关闭按钮时触发）
    win.on('close',  (event) => {
        getConfigData()
        if (!configData?.showTray) return;
        if (!isQuitting && configData?.minimization) {
            event.preventDefault(); // 阻止默认关闭行为
            win.hide(); // 隐藏窗口
        }
    });

    // 禁用模块
    win.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && (input.key === 'F5' || (input.control && input.key === 'r'))) {
            event.preventDefault();
        }
        if (input.type === 'keyDown' && input.key === 'Alt') {
            event.preventDefault();
        }
        if (input.type === 'keyDown' && input.control && input.key === 'w') {
            event.preventDefault(); // 阻止窗口关闭
        }
    });
    //更新时发生
    nativeTheme.on('updated', () => {
        win?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
    });
}
