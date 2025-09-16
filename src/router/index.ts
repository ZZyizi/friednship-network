import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import index from '../views/data.vue'
import {reqLink} from "../api/medium";
import service from "../api";
import {ElMessage} from "element-plus";

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'start',
    component: () => import('../views/start.vue'),
    meta: {
      requiresPort: false
    }
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('../views/data.vue'),
    meta: {
      requiresPort: true
    }
  },
  {
    path: '/wall',
    name: 'wall',
    component: () => import('../views/wall.vue'),
    meta: {
      requiresPort: true
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => index
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 添加路由守卫
router.beforeEach( async (to, _, next) => {
  // 检查路由是否需要端口号
  const isElectron: boolean = navigator.userAgent.includes("Electron")
  if (to.meta.requiresPort && !isElectron) {
    // 读取设置检查是否已配置端口
    const key = localStorage.getItem('key')|| ''
    try {
      service.defaults.baseURL = `http://${window.location.hostname}:${window.location.port}`;
      const licence = await reqLink(key);
      if (licence && licence.data) {
        next();
      } else {
        next('/');
        ElMessage.error("连接失败")
      }
    } catch (error) {
      console.error('读取设置失败：', error)
      next('/')
      ElMessage.error("连接失败")
      return
    }
  }else {
    next()
  }
})

export default router
