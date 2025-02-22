import {ElLoading} from "element-plus";

export function loading(){
    return ElLoading.service({fullscreen: true, text: '加载中...'});
}

