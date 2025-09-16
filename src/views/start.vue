<script setup lang="ts">
import { ref,onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
// import service from "../api";
import {reqLink} from "../api/medium";
import {loading} from "../util/loadIng.ts";

const router = useRouter()
const key = ref<string>("")
let isElectron:boolean=navigator.userAgent.includes("Electron")

onMounted(async ()=>{
  if(isElectron){
    await router.replace('/home')
  }
})
const handleStart = async () => {
  if (isElectron){
    await router.replace('/')
    return;
  }
  try {
    loading()
    // service.defaults.baseURL = `http://${window.location.hostname}:${3000}`;
    const licence = await reqLink(key.value)
    if (licence.data){
      localStorage.setItem("key", key.value)
      await router.push('/home')
      ElMessage.success("连接成功")
    }else {
      ElMessage.error("连接失败")
    }
    // 导航到主页
  } catch (error: any) {
    console.error('启动失败：', error.message)
    ElMessage.error('错误')
  }finally {
    loading().close()
  }
}
</script>

<template>
  <div class="start-container">
    <div class="start-content glass-effect">
      <img src="/favicon.ico" alt="logo" class="logo">
      <h1>friendship-network</h1>
      <div class="port-input">
        <h5>请输入密码</h5>
        <el-input
          v-model="key"
          placeholder="请输入密码"
          type="text"
          @keyup.enter="handleStart"
        >
          <template #append>
            <el-button type="primary" @click="handleStart">
              连接
            </el-button>
          </template>
        </el-input>
        <p class="tip">密码将用于验证权限，没有则直接点击连接</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.start-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg-container);
  padding: 1rem;
}

.start-content {
  text-align: center;
  padding: 3rem;
  border-radius: 24px;
  max-width: 90%;
  width: 400px;
}

.glass-effect {
  background: var(--glass-effect-bg);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color-effect);
}

.logo {
  width: 100px;
  height: 100px;
  margin-bottom: 1.5rem;
  animation: float 3s ease-in-out infinite;
}

h1 {
  color: var(--text-color);
  font-size: 2rem;
  margin-bottom: 2rem;
  font-weight: 500;
}

.port-input {
  max-width: 300px;
  margin: 0 auto;
}

.tip {
  margin-top: 1rem;
  color: #909399;
  font-size: 0.9rem;
}

@keyframes float {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
  }
}

@media (max-width: 768px) {
  .start-content {
    padding: 2rem;
  }

  .logo {
    width: 80px;
    height: 80px;
  }

  h1 {
    font-size: 1.5rem;
  }
}
</style>
