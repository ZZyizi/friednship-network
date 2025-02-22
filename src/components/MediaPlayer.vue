<template>
  <el-dialog
    v-model="dialogVisible"
    :title="currentMedia?.Name || '未选择媒体'"
    width="70%"
    class="media-player-dialog"
    :close-on-click-modal="false"
    :show-close="true"
    align-center
  >
    <div class="player-container">
      <div class="player-content"  v-show="isVideo">
        <video
            ref="mediaRef"
            class="media-element"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @ended="onEnded"
            @error="onError"
            :src="broadcast_url"
            :poster="currentMedia?.info?.picture?currentMedia.info.picture:''"
        ></video>
      </div>

      <div class="media-info" v-if="!isVideo">
        <img v-if="currentMedia?.info?.picture" :src="currentMedia.info.picture" class="media-cover" alt="封面">
        <div class="info-text">
          <p v-if="currentMedia?.info?.artist">作者：{{ currentMedia.info.artist }}</p>
          <p v-if="currentMedia?.info?.album">专辑：{{ currentMedia.info.album }}</p>
          <p v-if="currentMedia?.info?.quality">品质：{{ currentMedia.info.quality }}</p>
        </div>
      </div>

      <div class="player-controls">
        <div class="progress-bar">
          <div class="time">{{ formatTime(currentTime) }}</div>
          <el-slider
              v-model="currentTime"
              :max="duration"
              @input="onSeek"
              :format-tooltip="formatTime"
          />
          <div class="time">{{ formatTime(duration) }}</div>
        </div>

        <div class="control-buttons">
          <el-button circle :icon="Back" @click="onPrevious"/>
          <el-button
              circle
              :icon="settingsStore.isPlaying ? VideoPause : VideoPlay"
              @click="togglePlay"
              type="primary"
          />
          <el-button circle :icon="Back" class="forward" @click="onNext"/>
          <div class="volume-control">
            <el-button
                circle
                :icon="volume === 0 ? Mute : Microphone"
                @click="toggleMute"
            />
            <el-slider
                v-model="volume"
                :max="100"
                :step="10"
                @change="onVolumeChange"
            />
            <el-button
                v-if="isVideo"
                @click="toggleFullScreen"
                circle
                :icon="FullScreen"
            />
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import {ref, computed, watch, onMounted, nextTick} from 'vue'
import {Back, VideoPlay, VideoPause, Mute, FullScreen, Microphone} from '@element-plus/icons-vue'
import type { FileInter } from '../api/medium/type'
import {useSettings} from "../store";
// import {FileUrl} from "../api/medium";

const props = defineProps<{
  currentMedia: FileInter,
  modelValue: boolean
}>()
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
const emit = defineEmits(['previous', 'next', 'error','update:modelValue'])
const settingsStore=useSettings()
const mediaRef = ref<HTMLVideoElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(settingsStore.settings.defaultVolume)
const previousVolume = ref(settingsStore.settings.defaultVolume)
const isElectron:boolean= navigator.userAgent.includes("Electron")
const lastTime=localStorage.getItem("currentTime")?JSON.parse(localStorage.getItem("currentTime") as string):0
const broadcast_url=computed(() => {
  // const IP=window.location.hostname
  if (isElectron){
    return props.currentMedia?.Url
  }else {
    // const encodedValue = encodeURIComponent(props.currentMedia?.Url);
    // return FileUrl(IP,props.currentMedia?.Name,encodedValue);
    return props.currentMedia?.Url
  }
})
const isVideo = computed(() => {
  return props.currentMedia?.Suffix.toLowerCase().match(/\.(mp4|webm|ogg)$/)
})


onMounted( async ()=>{
  await nextTick();// 等待组件渲染完成
  if (mediaRef.value) {
    // 这里可以执行你的逻辑
    if(settingsStore.settings.autoPlay && settingsStore.settings.rememberLastPlayed){
      if (!(lastTime>=mediaRef.value.duration))
        onSeek(lastTime);
    }
  }
})
watch(() => props.currentMedia, async () => {
  if (mediaRef.value && props.currentMedia) {
    currentTime.value = 0
    duration.value = 0
    mediaRef.value.load()
    if (settingsStore.settings.autoPlay&&settingsStore.isPlaying) {
      await mediaRef.value.play()
    }
  }
})
const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
const togglePlay =  () :any=> {
  if (!mediaRef.value) return
  const media = mediaRef.value
  if (media.paused) {
    media.play()
  } else {
    media.pause()
  }
  settingsStore.isPlaying=!settingsStore.isPlaying
}
defineExpose({ togglePlay });//暴露给父组件该方法

const onTimeUpdate = () => {
  if (!mediaRef.value) return
  currentTime.value = mediaRef.value.currentTime
  settingsStore.currentTime=currentTime.value
}

const onLoadedMetadata = () => {
  if (!mediaRef.value) return
  duration.value = mediaRef.value.duration
  if (settingsStore.settings.autoPlay) {
    settingsStore.isPlaying=true
    mediaRef.value.play()
    return;
  }
  settingsStore.isPlaying=false
}

const onSeek = (value: number) => {
  if (!mediaRef.value) return
  mediaRef.value.currentTime = value
}

const toggleMute = () => {
  if (volume.value === 0) {
    volume.value =previousVolume.value
  } else {
    previousVolume.value = volume.value
    volume.value = 0
  }
  onVolumeChange(volume.value)
}

const onVolumeChange = (value: number) => {
  if (!mediaRef.value) return
  mediaRef.value.volume = value/100
}

const onPrevious = () => emit('previous')
const onNext = () => emit('next')
const onError = (error: any) => emit('error', error)
const onEnded = () => onNext()

//全屏
const toggleFullScreen=()=>{
  const video=mediaRef.value as HTMLVideoElement
  if (video) {
    if (video.requestFullscreen) {
      video.requestFullscreen();
    }
  }
}
</script>

<style lang="scss" scoped>
// 修改样式以适应对话框
:deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;

  .el-dialog__header {
    margin: 0;
    padding: 1rem 1.5rem;
    background: var(--glass-effect-bg);
    border-bottom: 1px solid var(--border-color-effect);
  }

  .el-dialog__body {
    padding: 0;
  }
}

.player-container {
  background: var(--bg-container);
  padding: 1.5rem;
}

.player-content {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--player-bg);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1.5rem;

  &.video-active {
    background: #000;
  }

  .media-element {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.media-info {
  display: flex;
  gap: 1.5rem;
  padding: 1rem;
  background: var(--glass-effect-bg);
  border-radius: 12px;
  margin-bottom: 1.5rem;

  .media-cover {
    width: 100px;
    height: 100px;
    border-radius: 8px;
    object-fit: cover;
  }

  .info-text {
    flex: 1;
    p {
      margin: 0.5rem 0;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
  }
}

.player-controls {
  .progress-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;

    .time {
      font-size: 0.8rem;
      color: var(--text-secondary);
      min-width: 45px;
    }

    :deep(.el-slider) {
      flex: 1;
    }
  }

  .control-buttons {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;

    .forward {
      transform: rotate(180deg);
    }

    .volume-control {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      margin-left: 2rem;

      :deep(.el-slider) {
        width: 100px;
      }
    }
  }
}

@media (max-width: 768px) {
  :deep(.el-dialog) {
    width: 100% !important;
  }
  .player-container {
    padding: 1rem;
    width: 93%;
  }

  .media-info {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .control-buttons {
    flex-wrap: wrap;
    gap: 1rem;

    .volume-control {
      width: 100%;
      margin: 1rem 0 0;
      justify-content: center;
    }
  }
}
</style>
