<template>
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
              @click="useSwitchStore.settingsVisible=true"
              type="primary"
              :icon="Setting"
              circle
          />
          <el-button
              v-if="mediaStore.isElectron"
              class="settings-btn"
              @click="useSwitchStore.shareVisible=true"
              type="success"
              :icon="Share"
              circle
          />
        </div>
      </div>
    </div>
    <div  class="search-box" style="margin-top: 30px">
      <el-input
          v-model="mediaStore.searchQuery"
          placeholder="搜索..."
          clearable
          :suffix-icon="Search"
          class="search-input"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import {Search, Setting, Share} from "@element-plus/icons-vue";
import {ref} from "vue";
import {useMedia, useNetwork, useSwitch} from "../../store";
import {useRouter} from "vue-router";
import {FileInter} from "../../api/medium/type.ts";
import {reqShare} from "../../api/medium";
import {loading} from "../../util/loadIng.ts";

let MenuLabel=ref("全部媒体")
const networkStore=useNetwork()
const useSwitchStore=useSwitch()
const router=useRouter()
const mediaStore=useMedia()


async function go(item:any) {
  MenuLabel.value=item.label
  await router.replace(item.router)
  const include=item.router.includes('/home')
  if(!include) return;
  loading()
  if (item.local){
    await mediaStore.routerUpdateFile(item.key)
  }else {
    const data:FileInter[]=await (await reqShare(item.ip,item.port,item.key)).data
    mediaStore.setMediaData(data)
  }
  loading().close()
}

</script>
<style scoped lang="scss">
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
.button-fun {
  position: absolute; /* 绝对定位 */
  right: 0; /* 固定在父容器的右侧边界 */
  top: 50%; /* 垂直居中 */
  transform: translateY(-50%); /* 根据高度调整垂直位置 */
  display: flex;
  gap: 10px; /* 按钮之间的间距 */
}
</style>
