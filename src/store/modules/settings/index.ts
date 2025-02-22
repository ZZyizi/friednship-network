import { defineStore } from 'pinia';
import {Settings} from "../../../type/SettingsType.ts";
import {reactive, ref} from "vue";

export const useSettings = defineStore(
    // 唯一ID
    'UseSettings',
    {
        state: () => {
            let settings=reactive<Settings>(localStorage.getItem('settings') ? JSON.parse(localStorage.getItem('settings') as string):{
                port:3000,// 端口
                theme: 'light',// 主题
                scanOnStartup: false,// 扫描启动
                scanInterval: 30,// 30分钟刷新
                autoPlay: false,          // 自动播放
                defaultVolume: 80,       // 默认音量
                rememberLastPlayed: false, // 记住上次播放位置
                scanPaths: []// 扫描路径列表
            })
            let currentTime:number=0
            let isPlaying=ref<boolean>(false) //按钮状态
            let isOpen=ref(JSON.parse(localStorage.getItem('start')||'false'))
            return ({
                settings,currentTime,isPlaying,isOpen
            });
        },
        getters: {},
        actions: {
            updateSettings(data: Settings) {
               Object.assign(this.settings, data)
                localStorage.setItem('settings', JSON.stringify(this.settings))
            }
        },
    },
);
