<template>
  <div class="container">
    <!-- 顶部控制栏 -->
    <div class="top-bar glass-effect">
      <div class="top-bar-content">
        <el-dropdown>
          <h2>{{MenuLabel}}</h2>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="item in networkStore.shareMenu" @click="go(item)">{{item.label}}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div class="controls">
          <div class="button-fun" >
            <el-button
                class="settings-btn"
                @click="settingsVisible=true"
                type="primary"
                :icon="Setting"
                circle
            />
            <el-button
                v-if="isElectron"
                class="settings-btn"
                @click="shareVisible=true"
                type="success"
                :icon="Share"
                circle
            />
          </div>
        </div>
      </div>
      <div  class="search-box" style="margin-top: 30px">
        <el-input
            v-model="searchQuery"
            placeholder="搜索..."
            clearable
            :suffix-icon="Search"
            class="search-input"
        />
      </div>
    </div>

    <!-- 媒体列表 -->
    <div class="media-container glass-effect">
      <ul  class="music-items">
        <li v-for="item in filteredMusicList"
            @click="change(item,1)"
            :class="{ active: item.Url === playingData.Url }"
            class="music-item">
          <div class="music-item-content">
            <img v-if="item.info?.picture" :src="item.info.picture" class="music-cover" alt="封面">
            <img v-else src="../assets/icons8-mp3-64.png" class="music-cover" alt="封面">
            <div class="music-info">
              <div class="music-name" :data-content="item.Name">
                <div class="scroll-wrapper">
                  {{item.Name}}
                </div>
              </div>
              <div class="music-details" v-if="item.info">
                <span v-if="item.info.artist" :data-content="`作者: ${item.info.artist}`">作者: {{item.info.artist}}</span>
                <span v-if="item.info.album" :data-content="`专辑: ${item.info.album}`">专辑: {{item.info.album}}</span>
                <span v-if="item.Duration">时长: {{formatDuration(item.Duration)}}</span>
                <span class="file-size">大小: {{formatFileSize(item.Size)}}</span>
                <span class="quality-tag" :class="getQualityClass(item.info.quality)">
                  {{item.info.quality}}
                </span>
                <span v-if="item.info.resolution" class="quality-tag" :class="getQualityVideoClass(item.info.resolution)">
                  {{item.info.resolution}}
                </span>
              </div>
            </div>
          </div>
        </li>
      </ul>
      <div v-if="searchQuery && !filteredMusicList.length" class="no-results">
        未找到匹配的媒体
      </div>
    </div>
    <!-- 添加播放器组件 -->
    <MediaPlayer
      v-model="showPlayer"
      :current-media="playingData"
      @previous="playPrevious"
      @next="playNext"
      @error="handlePlayError"
      ref="MediaChildRef"
    />

    <el-button @click="parse" :icon="settingsStore.isPlaying ? VideoPause : VideoPlay" class="frosted-glass-btn"></el-button>
    <!-- 设置弹窗 -->
    <SettingsDialog
        v-model="settingsVisible"
        @callParentMethod="update"
    />
    <share-dialog
        v-if="isElectron"
        v-model="shareVisible"
    />
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, reactive, ref} from 'vue'
import {reqFileData, reqShare} from "../api/medium";
import {FileInter} from "../api/medium/type.ts";
import {Search, Setting, Share, VideoPause, VideoPlay} from '@element-plus/icons-vue'
import SettingsDialog from "../components/SettingsDialog.vue";
import {loading} from "../util/loadIng.ts";
import type MediaPlayer from "../components/MediaPlayer.vue";
import {useNetwork, useSettings} from "../store";
import ShareDialog from "../components/ShareDialog.vue";
import {useRouter} from "vue-router";

const { file } =window;
// const UserEquipment= navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i)
const isElectron:boolean= navigator.userAgent.includes("Electron")
const settingsStore=useSettings()
const networkStore=useNetwork()
const router=useRouter()
let resData=reactive<FileInter[]>([])
let playingData=reactive<FileInter>({
  Name:"",
  Url:"",
  Suffix:"",
  Size:0,
  Duration:0,
})
let MenuLabel=ref("全部媒体")
const searchQuery = ref('')
// 添加播放器控制
const showPlayer = ref(false)
// 修改设置相关的响应式变量
const settingsVisible = ref(false)
//共享相关响应式变量
const shareVisible = ref(false)
let count:number=0//计数器
const MediaChildRef=ref<typeof MediaPlayer>()//定义组件的ref

onMounted(() => {
  const key:string= router.currentRoute.value.query.key?router.currentRoute.value.query.key.toString():'all';
  update(key)
  load()
  window.addEventListener("beforeunload", handleBeforeUnload, { passive: false });//挂载方法
})

//刷新页面时候
onBeforeUnmount(()=>{
  window.removeEventListener("beforeunload", handleBeforeUnload);//卸载方法
})

// 页面刷新时，保存时间
const handleBeforeUnload = () => {
  pauseFunction();
};

async function go(item:any) {
  loading()
  MenuLabel.value=item.label
  await router.replace(item.router)
  if (item.local){
    await update(item.key)
  }else {
    resData.splice(0,resData.length)
    const data:FileInter[]=await (await reqShare(item.ip,item.port,item.key)).data
    resData.push(...uniqueArray(data));
  }
  loading().close();
}
async function update(label:string){
  loading()
  let resD:FileInter[];
  resData.splice(0,resData.length)
  if(isElectron){
    resD=await file.loadFileCache(label)
  }else {
    resD= (await reqFileData(label)).data
  }
    // 将去重后的数据添加到 resData
  resData.push(...uniqueArray(resD));
  loading().close();
}
//去重
function uniqueArray(arr:FileInter[]) {
  if (arr){
    // 使用 Set 去重，基于文件的 URL 和名称
    const uniqueFiles = new Set();
    return arr.filter(item => {
      const key = `${item.Url}`;
      if (!uniqueFiles.has(key)) {
        uniqueFiles.add(key);
        return true;
      }
      return false;
    });
  }else {
    return []
  }
}
// 加载记录播放功能
function load(){
  const lastPlayed = localStorage.getItem('lastPlayed');
  if(settingsStore.settings.autoPlay&&settingsStore.settings.rememberLastPlayed&&lastPlayed){
    change(JSON.parse(lastPlayed as string),1)
  }
}
//播放暂停
function parse(){
  if (MediaChildRef.value) {
    MediaChildRef.value.togglePlay();//暴露给父组件该方法; // 调用子组件的方法
  }
}
async function change(item:FileInter,status:number=0){
  count++;
  Object.assign(playingData,item)
  //主动打开
  if (status===1){
    showPlayer.value = true
  }
  // 保存播放记录
  if (settingsStore.settings.rememberLastPlayed) {
    localStorage.setItem('lastPlayed', JSON.stringify(item))
  }
}

const pauseFunction = () =>{
  localStorage.setItem("currentTime",JSON.stringify(settingsStore.currentTime))
}
// 添加计算属性用于过滤媒体列表
const filteredMusicList = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return resData

  return resData.filter(item =>
    item.Name.toLowerCase().includes(query)
  )
})

const formatDuration = (duration: number): string => {
  if (!duration) return '未知';
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// 添加音质标签样式类
const getQualityClass = (quality: string): string => {
  switch (quality) {
    case '无损': return 'quality-lossless';
    case '极高': return 'quality-very-high';
    case '高': return 'quality-high';
    case '标准': return 'quality-standard';
    case '低': return 'quality-low';
    default: return 'quality-unknown';
  }
};
const getQualityVideoClass=(quality:string):string=>{
  switch (quality) {
    case '8K': return 'quality-lossless';
    case '4K': return 'quality-very-high';
    case '2K': return 'quality-very-high';
    case '1080P': return 'quality-very-high';
    case '720P': return 'quality-low';
    case '标清' : return 'quality-low';
    default: return 'quality-low';
  }
}
// 在 script setup 中添加文件大小格式化函数
const formatFileSize = (bytes: number): string => {
  if (!bytes) return '未知';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const playPrevious = () => {
  const currentIndex = resData.findIndex(item => item.Name === playingData.Name)
  if (currentIndex > 0) {
    change(resData[currentIndex - 1])
  }
}

const playNext = () => {
  const currentIndex = resData.findIndex(item => item.Name === playingData.Name)
  if (currentIndex < resData.length - 1) {
    change(resData[currentIndex + 1])
  }
}

const handlePlayError = (_: any) => {
  playNext()
}
</script>

<style lang="scss" scoped>
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

.top-bar {
  position: sticky;
  top: 2rem;
  z-index: 100;
  padding: 1.5rem;

  .top-bar-content {

    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2rem;

    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color);
      margin: 0;
    }

    .controls {
      position: relative;
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
      max-width: 600px;


      .settings-btn {
        flex-shrink: 0;
      }
    }
  }
}
.button-fun {
  position: absolute; /* 绝对定位 */
  right: 0; /* 固定在父容器的右侧边界 */
  top: 50%; /* 垂直居中 */
  transform: translateY(-50%); /* 根据高度调整垂直位置 */
  display: flex;
  gap: 10px; /* 按钮之间的间距 */
}
.media-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
}

.glass-effect {
  background: var(--glass-effect-bg);
  backdrop-filter: blur(12px);
  border-radius: 20px;
  padding: 2rem;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 1px 2px rgba(255, 255, 255, 0.1);
  border: 1px solid var(--border-color-effect);
}

.music-items {
  padding: 0;
  margin: 0;
  overflow-y: scroll;
  flex: 1;
  &::-webkit-scrollbar {
    width: 3px;
  }

  &::-webkit-scrollbar-track {
    background: var(--scrollbar-bg);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background:var(--scrollbar-thumb);
    border-radius: 4px;

    &:hover {
      background: rgba(0, 0, 0, 0.15);
    }
  }
}

.music-items li {
  margin: 0.8rem 0;
  border-radius: 12px;
  background: var(--item-bg);
  cursor: pointer;
  list-style: none;
}
.music-items li:hover {
  background: var(--item-hover-bg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.music-items li.active {
  background: rgba(64, 158, 255, 0.15);
  border-left: 4px solid #409EFF;

  .music-item-content {
    border-color: #409EFF;
  }

  .music-name {
    color: #409EFF;
    font-weight: 600;
  }
}

.music-item-content {
  padding: 1rem;
  gap: 1.2rem;
  display: flex;
  align-items: center;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;

  &:hover {
    border-color: var(--item-hover-bg);
  }
}

.music-cover {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #ffffff;
}

.music-info {
  flex: 1;
  overflow: hidden;

  .music-name {
    font-size: 1.1rem;
    font-weight: 500;
    margin-bottom: 0.6rem;
    color: var(--text-color);
    width: 200px;
    white-space: nowrap;
    overflow: hidden;
    position: relative;
    text-overflow: ellipsis;

    &:hover {
      text-overflow: clip;
      overflow: hidden;

      .scroll-wrapper {
        color: var(--text-color);
        display: inline-block;
        animation: textScroll 8s linear infinite;
        width: 100%;
      }
    }
  }

  .music-details {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    align-items: center;

    span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0.3rem 0.8rem;
      border-radius: 6px;
      font-size: 0.85rem;
      background: var(--music-details-span);
      color: var(--music-details-span-color);
      &:hover {
        background: rgba(0, 0, 0, 0.06);
      }

      &.quality-tag {
        font-weight: 500;
        max-width: none;
      }

      &.file-size {
        max-width: none;
      }
    }
  }
}

.search-input {
  width: 100%;
  :deep(.el-input__wrapper){
    border-radius: 12px;
    padding: 8px 16px;
    background:var(--search-input-bg);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);

    &:hover, &.is-focus {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }

    .el-input__inner {
      font-size: 0.95rem;
    }
  }
}
.frosted-glass-btn {
  /* 圆形 */
  position: absolute; /* 绝对定位 */
  right: 10%; /* 固定在父容器的右侧边界 */
  top: 70%; /* 垂直居中 */
  transform: translateY(-10%); /* 根据高度调整垂直位置 */
  display: flex;
  gap: 10px; /* 按钮之间的间距 */
  border-radius: 50%;
  width: 50px;
  height: 50px;
  /* 基础样式 */
  background: rgba(0, 123, 255, 0.2); /* 蓝色半透明背景 */
  border: none;
  color: #fff;
  padding: 15px 20px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;

  /* 毛玻璃效果 */
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px); /* 为兼容性添加 */
}

/* 悬停效果 */
.frosted-glass-btn:hover {
  background: rgba(0, 123, 255, 0.7);
  transform: scale(1.05);
}
@media (max-width: 768px) {
  .container {
    padding: 1rem;
    height: 100vh;
  }
  .media-container {
    padding: 0.5rem;
  }

  .music-info {
    .music-name {
      font-size: 1rem;
    }

    .music-details {
      span {
        font-size: 0.75rem;
      }
    }
  }
  .media-container {
    padding: 1rem;
  }
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.quality-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.quality-lossless {
  background-color: #f0f5ff;
  color: #2f54eb;
  border: 1px solid #adc6ff;
}

.quality-very-high {
  background-color: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.quality-high {
  background-color: #fff7e6;
  color: #fa8c16;
  border: 1px solid #ffd591;
}

.quality-standard {
  background-color: #f5f5f5;
  color: #595959;
  border: 1px solid #d9d9d9;
}

.quality-low {
  background-color: #fff1f0;
  color: #f5222d;
  border: 1px solid #ffa39e;
}

.quality-unknown {
  background-color: #f5f5f5;
  color: #8c8c8c;
  border: 1px solid #d9d9d9;
}

.file-size {
  color: var(--text-secondary);
  background-color: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
}

@keyframes textScroll {
  0%, 10% {
    transform: translateX(0);
  }
  90%, 100% {
    transform: translateX(min(-50%, -100px));
  }
}
@media(prefers-color-scheme: dark) {
  .quality-tag {
    &.quality-lossless {
      background-color: rgba(47, 84, 235, 0.2);
      color: #91a7ff;
      border-color: rgba(173, 198, 255, 0.3);
    }

    &.quality-very-high {
      background-color: rgba(82, 196, 26, 0.2);
      color: #95de64;
      border-color: rgba(183, 235, 143, 0.3);
    }

    &.quality-high {
      background-color: rgba(250, 140, 22, 0.2);
      color: #ffc069;
      border-color: rgba(255, 213, 145, 0.3);
    }

    &.quality-standard {
      background-color: rgba(89, 89, 89, 0.2);
      color: #bfbfbf;
      border-color: rgba(217, 217, 217, 0.3);
    }

    &.quality-low {
      background-color: rgba(245, 34, 45, 0.2);
      color: #ff7875;
      border-color: rgba(255, 163, 158, 0.3);
    }
  }

}

// 添加播放器部分样式
.player-section {
  margin-top: auto;
}
</style>
