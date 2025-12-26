<template>
  <div class="container">
    <router-view></router-view>
  </div>
  <!-- 设置弹窗 -->
  <SettingsDialog
      v-model="useSwitchStore.settingsVisible"
      @callParentMethod="mediaStore.routerUpdateFile"
  />
  <share-dialog
      v-if="isElectron"
      v-model="useSwitchStore.shareVisible"
  />
  <!-- 添加播放器组件 -->
  <MediaPlayer
      v-model="useSwitchStore.showPlayerVisible"
      :current-media="mediaStore.playingData"
      @previous="playPrevious"
      @next="playNext"
      @error="handlePlayError"
      ref="MediaChildRef"
  />
  <div class="frosted-glass">
    <el-button @click="parse" :icon="settingsStore.isPlaying ? VideoPause : VideoPlay" class="frosted-glass-btn play-media"></el-button>
    <el-button @click="useSwitchStore.showPlayerVisible=true" :icon="View" class="frosted-glass-btn open-media"></el-button>
    <el-button @click="local" :icon="LocationInformation" class="frosted-glass-btn open-media"></el-button>
  </div>
</template>
<script setup lang="ts">
import SettingsDialog from "./components/SettingsDialog.vue";
import ShareDialog from "./components/ShareDialog.vue";
import {useMedia, useSettings, useSwitch} from "./store";
import {LocationInformation, VideoPause, VideoPlay, View} from "@element-plus/icons-vue";
import type MediaPlayer from "./components/MediaPlayer.vue";
import {ref, onMounted, onBeforeUnmount} from "vue";
import {FileInter} from "./api/medium/type.ts";


const isElectron:boolean= navigator.userAgent.includes("Electron")
const useSwitchStore=useSwitch()
const settingsStore=useSettings()
const mediaStore=useMedia()
const MediaChildRef=ref<typeof MediaPlayer>()//定义组件的ref
const lastTime=localStorage.getItem("currentTime")?JSON.parse(localStorage.getItem("currentTime") as string):0

// 从后端加载设置
const loadSettingsFromBackend = async () => {
  if (!isElectron) return;

  try {
    const { file } = window;
    const savedSettings = await file.loadSettings();
    if (savedSettings) {
      // 静默模式更新设置（不输出日志）
      settingsStore.updateSettings(savedSettings, true);
      console.log('[App] 从后端加载设置成功:', savedSettings);
    }
  } catch (error) {
    console.warn('[App] 从后端加载设置失败，使用本地缓存:', error);
  }
};

onMounted( async ()=>{
  // 先从后端加载设置，再执行其他初始化
  // await loadSettingsFromBackend();
  load();
  window.addEventListener("beforeunload", handleBeforeUnload, { passive: false });//挂载方法
})
//刷新页面时候
onBeforeUnmount(()=>{
  window.removeEventListener("beforeunload", handleBeforeUnload);//卸载方法
})

//播放暂停
function parse(){
  if (MediaChildRef.value) {
    MediaChildRef.value.togglePlay();//暴露给父组件该方法; // 调用子组件的方法
  }
}
//播放事件
const playPrevious = () => {
  const currentIndex = mediaStore.MediaData.findIndex(item => item.Name === mediaStore.playingData.Name)
  if (currentIndex > 0) {
    change(mediaStore.MediaData[currentIndex - 1])
  }
}
const playNext = () => {
  const currentIndex = mediaStore.MediaData.findIndex(item => item.Name === mediaStore.playingData.Name)
  if (currentIndex < mediaStore.MediaData.length - 1) {
    change(mediaStore.MediaData[currentIndex + 1])
  }

}
const handlePlayError = (_: any) => {
  playNext()
}
async function change(item:FileInter,status:number=0){
  mediaStore.setPlayingData(item)
  //主动打开
  if (status===1){
    useSwitchStore.showPlayerVisible = true
  }
  // 保存播放记录
  if (settingsStore.settings.rememberLastPlayed) {
    localStorage.setItem('lastPlayed', JSON.stringify(item))
  }
}
// 加载记录播放功能
function load(){
  const lastPlayed = localStorage.getItem('lastPlayed');
  if(settingsStore.settings.autoPlay&&settingsStore.settings.rememberLastPlayed&&lastPlayed){
    change(JSON.parse(lastPlayed as string),1)
    MediaChildRef.value?.onSeek(lastTime);
  }
}
// 定位正在播放中
const local=()=>{
  if (mediaStore.mediaLi){
    const activeElement = mediaStore.mediaLi?.find((el:any) =>
        el.classList.contains('active')
    );
    if (activeElement) {
      // 滚动到该元素
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// 页面刷新时，保存时间
const handleBeforeUnload = () => {
  pauseFunction();
};
const pauseFunction = () =>{
  localStorage.setItem("currentTime",JSON.stringify(settingsStore.currentTime))
}
</script>
<style scoped>
.container {
  position: relative;
  min-height: 100vh;
  height: 100vh;
  padding: 2rem;
  background: var(--bg-container);
  color: var(--color-container);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-sizing: border-box;
}
.frosted-glass{
  position: absolute; /* 绝对定位 */
  right: 10%; /* 固定在父容器的右侧边界 */
  top: 70%; /* 垂直居中 */
  width: 100px;
  height: 100px;
}
.frosted-glass-btn {
  /* 圆形 */
  border-radius: 50%;
  background: rgba(0, 123, 255, 0.2); /* 蓝色半透明背景 */
  border: none;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  /* 毛玻璃效果 */
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px); /* 为兼容性添加 */
  transition: transform 0.3s ease, opacity 0.3s ease;
  opacity: 0;
  pointer-events: none;
}

/* 悬停效果 */
.frosted-glass-btn:hover {
  background: rgba(0, 123, 255, 0.7);
}
.play-media{
  /* 居中 */
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 50px;
  opacity: 1;
  pointer-events: auto;
}
.open-media{
  width: 30px;
  height: 30px;
  padding: 15px 10px;
}
.frosted-glass:hover .open-media:nth-child(2) {
  transform: translate(50px, 0); /* 向右移动 */
  opacity: 1;
  pointer-events: auto;
}
.frosted-glass:hover .open-media:nth-child(3) {
  transform: translate(25px, 30px); /* 向右下移动 */
  opacity: 1;
  pointer-events: auto;
}

</style>
