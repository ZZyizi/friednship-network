<template>
  <HeadLayout/>
    <!-- 媒体列表 -->
    <div class="media-container glass-effect">
      <ul class="music-items">
        <li v-for="item in filteredMusicList"
            @click="change(item,1)"
            :class="{ active: item.Url === mediaStore.playingData.Url }"
            class="music-item"
            ref="mediaLi"
        >
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
                <span v-if="item.info.duration">时长: {{formatDuration(item.info.duration)}}</span>
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
</template>

<script setup lang="ts">
import {computed, nextTick, onMounted, ref} from 'vue'
import {FileInter} from "../api/medium/type.ts";
import {useMedia, useSettings, useSwitch} from "../store";
import HeadLayout from "../components/layout/HeadLayout.vue";
import {useRouter} from "vue-router";

const settingsStore=useSettings()
const mediaStore=useMedia()
const router=useRouter()
const useSwitchStore=useSwitch()
const searchQuery = ref('')
let count:number=0//计数器
const mediaLi=ref<any>(null)//获取媒体li的ref

onMounted(async () => {
  const key:string= router.currentRoute.value.query.key?router.currentRoute.value.query.key.toString():'all';
  // 检查 Electron API 是否就绪
  const isElectron: boolean = navigator.userAgent.includes("Electron")
  if (isElectron && !window.file) {
    console.warn('[data.vue] Electron API 未就绪，等待加载...')
    // 等待一小段时间后重试
    setTimeout(async () => {
      if (window.file) {
        await mediaStore.routerUpdateFile(key)
        await nextTick()
        mediaStore.mediaLi=mediaLi.value
      } else {
        console.error('[data.vue] Electron API 加载超时')
      }
    }, 100)
  } else {
    await mediaStore.routerUpdateFile(key)
    await nextTick()
    mediaStore.mediaLi=mediaLi.value
  }
})

async function change(item:FileInter,status:number=0){
  count++;
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

// 添加计算属性用于过滤媒体列表
const filteredMusicList = computed(() => {
  const query = mediaStore.searchQuery.toLowerCase().trim()
  if (!query) return mediaStore.MediaData

  return mediaStore.MediaData.filter(item =>
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


</script>

<style lang="scss" scoped>

.media-container {
  min-height: 0;
  display: flex;
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
.frosted-glass-local-btn {
  /* 圆形 */
  position: absolute; /* 绝对定位 */
  right: 10%; /* 固定在父容器的右侧边界 */
  top: 65%; /* 垂直居中 */
  transform: translateY(-30%); /* 根据高度调整垂直位置 */
  display: flex;
  gap: 20px; /* 按钮之间的间距 */
  border-radius: 50%;
  width: 30px;
  height: 30px;
  /* 基础样式 */
  background: rgba(0, 123, 255, 0.2); /* 蓝色半透明背景 */
  border: none;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.6s ease;

  /* 毛玻璃效果 */
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px); /* 为兼容性添加 */
}

/* 悬停效果 */
.frosted-glass-local-btn:hover {
  background: rgba(0, 123, 255, 0.7);
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
