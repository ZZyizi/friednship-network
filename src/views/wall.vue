<template>
  <HeadLayout/>
  <div class="wall-container">
    <div class="wall-content">
      <div class="wall-grid">
        <div v-for="item in filteredItems"
             :key="item.picture"
             class="wall-card glass-effect"
             @click="handleCardClick(item)">
          <div class="card-image">
            <img :src="item.picture" :alt="item.prepose">
          </div>
          <div class="card-info">
            <h3>{{ item.prepose }}</h3>
            <p class="date">{{ item.year }}-{{ item.month }}-{{ item.day }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed,onMounted } from 'vue'
import {useMedia} from "../store";
import HeadLayout from "../components/layout/HeadLayout.vue";
import {WallItem} from "../type/willType.ts";

const useMediaStore=useMedia()
const items = ref<WallItem[]>([
  {
    year: "2025",
    month: "02",
    day: "28",
    prepose: "miracle竹夭",
    picture: "D:\\project\\final\\friendship\\friendship-network\\dist\\cache\\data\\e88899adef883baee8f10a9846167f27475c79c7bb453ec3d9b9a60acaca6755.jpg"
  },
  {
    year: "2025",
    month: "02",
    day: "09",
    prepose: "Sugar爱吃糖",
    picture: "D:\\project\\final\\friendship\\friendship-network\\dist\\cache\\data\\92b8dc25f338038d832e6a6f1be946cb1034bd4cb61845da2237115cf5fa083d.jpg"
  }
])

const filteredItems = computed(() => {
  const query = useMediaStore.searchQuery.toLowerCase().trim()
  if (!query) return items.value
  return items.value.filter(item =>
    item.prepose.toLowerCase().includes(query)
  )
})

onMounted(async ()=>{
  await useMediaStore.routerUpdateFile('all')
})

const handleCardClick = (item: WallItem) => {
  // 处理卡片点击事件
  console.log('Clicked item:', item)
}
</script>

<style lang="scss" scoped>

.wall-container {
  background: var(--bg-container);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.wall-header {
  padding: 2rem;
  border-radius: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  flex-shrink: 0;

  h1 {
    font-size: 2rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
  }

  .search-box {
    flex: 1;
    max-width: 400px;
  }
}

.wall-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.wall-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
  padding: 1rem;
  height: 100%;
  overflow-y: auto;

  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--scrollbar-bg);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
    transition: background 0.3s ease;

    &:hover {
      background: var(--scrollbar-thumb-hover);
    }
  }
}

.wall-card {
  margin: 10px;
  border-radius: 16px;
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  background: var(--glass-effect-bg);
  height: fit-content;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .card-image {
    width: 100%;
    aspect-ratio: 16/9;
    overflow: hidden;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.1));
      pointer-events: none;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .card-info {
    padding: 1.5rem;
    background: var(--glass-effect-bg);

    h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.2rem;
      color: var(--text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .date {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-secondary);
    }
  }
}

.glass-effect {
  background: var(--glass-effect-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color-effect);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

@media (max-width: 768px) {
  .wall-container {
    padding: 1rem;
    height: 100vh;
  }

  .wall-header {
    flex-direction: column;
    padding: 1.5rem;
    gap: 1rem;

    h1 {
      font-size: 1.5rem;
    }

    .search-box {
      max-width: 100%;
    }
  }

  .wall-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
    padding: 0.5rem;
  }

  .wall-card {
    .card-info {
      padding: 1rem;

      h3 {
        font-size: 1rem;
      }

      .date {
        font-size: 0.8rem;
      }
    }
  }
}
/* 添加暗色模式支持 */
@media (prefers-color-scheme: dark) {
  .wall-card {
    .card-image::after {
      background: linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.2));
    }
  }
}
</style>
