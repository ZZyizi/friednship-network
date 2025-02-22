import { createApp } from 'vue'
import './style.css'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import App from './App.vue'
import router from './router'
import piniaStore from './store';
// import {zhCn} from "element-plus/lib/locale";

const app = createApp(App)

// 配置 Element Plus
app.use(ElementPlus, {
  // locale: zhCn
})
app.use(router)
app.use(piniaStore)
const { ipcRenderer }=window
app.mount('#app').$nextTick(() => {
  // Use contextBridge
 const isElectron:boolean= navigator.userAgent.includes("Electron")
 if (!isElectron) return;
 ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
})

