import { defineStore } from 'pinia'
import {ref} from "vue";

export const useSwitch = defineStore('useSwitch', {
    state:()=>{
        let settingsVisible=ref(false)//设置弹窗开关
        let shareVisible= ref(false)//共享弹窗开关
        let showPlayerVisible=ref(false)//播放器弹窗开关
        return {
            settingsVisible,shareVisible,showPlayerVisible
        }
    },
    actions:{

    }
})
