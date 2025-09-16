<template>
  <el-dialog
    v-model="dialogVisible"
    title="设置"
    width="75%"
    :before-close="handleClose"
    class="custom-dialog"
    align-center
  >
    <div class="settings-container glass-effect">
      <div class="settings-layout">
        <!-- 左侧导航 -->
        <div class="settings-nav">
          <el-menu
              :default-active="activeSection"
              class="settings-menu"
              @select="scrollToSection"
          >
            <div v-for="item in menuItem">
              <el-menu-item v-if="!item.isElectron||isElectron"  :index="item.index">
                <el-icon>
                  <component :is="getIconComponent(item.icon)" />
                </el-icon>
                <span>{{item.title}}</span>
              </el-menu-item>
            </div>
          </el-menu>
        </div>
        <!-- 右侧设置内容 -->
        <div class="settings-content" ref="settingsContent">
          <div v-for="menu in menuItem">
            <div class="settings-section" v-if="!menu.isElectron||isElectron"  :id="menu.index">
              <h2>{{menu.title}}</h2>
              <el-form>
                <el-form-item
                    v-for="item in menu.child"
                    :key="item.key"
                    :label="item.label"
                    @change="item.event"
                >
                  <component
                      :is="item.component"
                      v-model="settings[item.key as keyof Settings]"
                      v-bind="item.props"
                  >
                    <!-- 处理 options 选项 -->
                    <template v-if="item.options&&item.component === ElSelect">
                      <el-option v-for="opt in item.options" :key="opt.value" :label="opt.label" :value="opt.value" />
                    </template>
                  </component>

                </el-form-item>

                <!-- 仅在 Electron 环境显示 -->
                <el-form-item v-if="isElectron&&menu.title==='扫描设置'">
                  <div class="scan-paths-container">
                    <div class="scan-paths-header">
                      <div class="path-input-group">
                        <el-input
                            v-model="newPath"
                            placeholder="点击添加选择扫描路径"
                            class="path-input"
                            @keyup.enter="addManualPath"
                            clearable
                        >
                          <template #prefix>
                            <el-icon><Folder /></el-icon>
                          </template>
                        </el-input>
                        <el-button type="primary" @click="addManualPath">
                          <el-icon><Plus /></el-icon>
                          添加
                        </el-button>
                      </div>
                      <el-button type="success" @click="startScan">
                        <el-icon><RefreshRight /></el-icon>
                        开始扫描
                      </el-button>
                    </div>

                    <!-- 扫描路径表格 -->
                    <div class="scan-paths-list">
                      <el-empty v-if="settings.scanPaths.length === 0" :image-size="100" class="custom-empty">
                        <template #description>
                          <div class="empty-text">
                            <p>暂无扫描路径</p>
                            <p class="sub-text">点击上方"添加"或输入路径来添加</p>
                          </div>
                        </template>
                      </el-empty>
                      <el-table v-else :data="settings.scanPaths" style="width: 100%" height="300">
                        <el-table-column label="序号" type="index" width="80" align="center" />
                        <el-table-column label="路径" min-width="200">
                          <template #default="{ row }">
                            <div class="path-cell">
                              <el-icon><Folder /></el-icon>
                              <span class="path-text">{{ row }}</span>
                            </div>
                          </template>
                        </el-table-column>
                        <el-table-column label="操作" width="120" align="center" fixed="right">
                          <template #default="{ $index }">
                            <el-button type="danger" link @click="removeScanPath($index)">
                              <el-icon><Delete /></el-icon>
                              删除
                            </el-button>
                          </template>
                        </el-table-column>
                      </el-table>
                    </div>
                  </div>
                </el-form-item>

                <el-form-item v-if="menu.title==='主题设置'" label="主题设置">
                  <el-radio-group v-model="settings.theme">
                    <div v-for="option in themeOptions" style="margin-left: 5px">
                      <el-radio v-if="!option.isElectron||isElectron"  :key="option.value" :value="option.value"  @change="toggleTheme">
                        {{option.label}}
                      </el-radio>
                    </div>
                  </el-radio-group>
                </el-form-item>

                <!-- 数据库状态显示 -->
                <div v-if="menu.title==='数据库状态'" class="database-status-container">
                  <el-card class="status-card" shadow="hover">
                    <template #header>
                      <div class="card-header">
                        <el-icon><DataBoard /></el-icon>
                        <span>数据库状态</span>
                      </div>
                    </template>
                    
                    <div class="status-grid">
                      <div class="status-item">
                        <span class="status-label">存储模式:</span>
                        <el-tag :type="settingsStore.isUsingDatabase ? 'success' : 'info'">
                          {{ settingsStore.isUsingDatabase ? '数据库模式' : '文件模式' }}
                        </el-tag>
                      </div>
                      
                      <div class="status-item">
                        <span class="status-label">数据库状态:</span>
                        <el-tag :type="settingsStore.isDatabaseReady ? 'success' : 'warning'">
                          {{ settingsStore.isDatabaseReady ? '就绪' : '未就绪' }}
                        </el-tag>
                      </div>
                      
                      <div class="status-item" v-if="settingsStore.migrationStatus">
                        <span class="status-label">迁移状态:</span>
                        <el-tag :type="settingsStore.isMigrationCompleted ? 'success' : 'processing'">
                          {{ settingsStore.isMigrationCompleted ? '已完成' : '需要迁移' }}
                        </el-tag>
                      </div>
                      
                      <div class="status-item" v-if="settingsStore.migrationStatus?.lastMigration">
                        <span class="status-label">最后迁移:</span>
                        <span class="status-value">
                          {{ new Date(settingsStore.migrationStatus.lastMigration).toLocaleString() }}
                        </span>
                      </div>
                    </div>
                    
                    <!-- 错误显示 -->
                    <el-alert
                      v-if="settingsStore.hasSettingsError"
                      :title="settingsStore.settingsError?.message || '未知错误'"
                      type="error"
                      :closable="false"
                      show-icon
                      class="error-alert"
                    />
                    
                    <!-- 操作按钮 -->
                    <div class="action-buttons">
                      <el-button 
                        v-if="settingsStore.needsMigration"
                        type="primary" 
                        @click="triggerMigration"
                        :loading="migrationLoading"
                      >
                        <el-icon><Refresh /></el-icon>
                        开始迁移
                      </el-button>
                      
                      <el-button 
                        @click="refreshDatabaseStatus"
                        :loading="statusLoading"
                      >
                        <el-icon><RefreshRight /></el-icon>
                        刷新状态
                      </el-button>
                    </div>
                  </el-card>
                </div>

              </el-form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import {ref, reactive, computed, onMounted, watch, markRaw} from 'vue'
import {ElInput, ElInputNumber, ElMessage, ElSelect, ElSlider, ElSwitch} from "element-plus";
import * as Icons from "@element-plus/icons-vue";
import {Folder, Plus, RefreshRight, Delete, DataBoard, Refresh} from '@element-plus/icons-vue'
import {Settings, MenuItem} from "../type/SettingsType.ts"
import {loading} from "../util/loadIng.ts";
import {useTheme} from "../util/theme.ts"
import {useSettings} from "../store";
import md5 from "md5";

const props = defineProps<{
  modelValue: boolean
}>()
// 添加新的响应式变量
const newPath = ref('')
const migrationLoading = ref(false)
const statusLoading = ref(false)
const { file } = window;
const emit = defineEmits(['update:modelValue', 'scan-complete','callParentMethod'])
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const settingsStore=useSettings()
const isElectron:boolean= navigator.userAgent.includes("Electron")// 判断是否在electron中
let settings = reactive<Settings>({
  port: 3000,// 端口
  theme: 'light',// 主题
  scanOnStartup: false,// 扫描启动
  scanInterval: 30,// 30分钟刷新
  autoPlay: false,          // 自动播放
  defaultVolume: 80,       // 默认音量
  rememberLastPlayed: false, // 记住上次播放位置
  scanPaths: [], // 扫描路径列表
  showTray:true, //是否启动托盘
  minimization:true, //是否关闭页面最小化
  isRole:false, //是否启用密码
  password:"" //密码
})
const { setTheme } = useTheme(); //深色模式
const toggleTheme = () => {
  setTheme(settings.theme);
};

//加载动画
let menuItem=reactive<MenuItem[]>([
  {
    title: '基础设置',
    icon: "Setting",
    index: "basic",
    isElectron:true,
    child:[
      {
        key: "showTray",
        label: "启动系统托盘",
        component: markRaw(ElSwitch),
        props: {},
      },
      {
        key: "minimization",
        label: "启动窗口最小化",
        component: markRaw(ElSwitch),
        props: {},
      },
    ]
  },
  {
    title: '播放设置',
    icon: "VideoPlay",
    index: "broadcast",
    isElectron:false,
    child:[
      {
        key: "autoPlay",
        label: "自动播放",
        component: markRaw(ElSwitch),
        props: {},
      },
      {
        key: "defaultVolume",
        label: "默认音量",
        component: markRaw(ElSlider),
        props: { min: 0, max: 100, step: 1, "show-input": false },
      },
      {
        key: "rememberLastPlayed",
        label: "记住播放位置",
        component: markRaw(ElSwitch),
        props: {},
      }
    ]
  },
  {
    title: '扫描设置',
    icon: "Files",
    index: "scan",
    isElectron:true,
    child:[
      {
        key: "scanOnStartup",
        label: "启动时扫描",
        component: markRaw(ElSwitch),
      },
      {
        key: "scanInterval",
        label: "定时扫描",
        component: markRaw(ElSelect),
        options: [
          { label: "10分钟", value: 10 },
          { label: "30分钟", value: 30 },
          { label: "60分钟", value: 60 },
        ],
      }
    ]
  },
  {
    title: '主题设置',
    icon: "RefreshRight",
    index: "theme",
    isElectron:false,
  },
  {
    title: "共享设置",
    icon: "Share",
    index: "share",
    isElectron: true,
    child: [
      {
        key: "port",
        label: "服务端口",
        component: markRaw(ElInputNumber),
        props: { min: 1000, max: 65535, "controls-position": "right" }
      },
      {
        key: "isRole",
        label: "是否启用密码",
        component: markRaw(ElSwitch),
        props: {},
      },
      {
        key:"password",
        label:"密码",
        component: markRaw(ElInput),
        event:updatePass,
        props:{
          placeholder:"请输入密码",
          type:"password"
        }
      }
    ]
  },
  {
    title: "数据库状态",
    icon: "DataBoard",
    index: "database",
    isElectron: true,
  }
])
const themeOptions=reactive([
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'auto' ,isElectron:true },
])


// 自动保存设置
watch(settings, () => {
    handleVolumeChange()
})

onMounted(() => {
  loading()
  if(isElectron){
    loadSettings()
  }
  loading().close()
})

//防抖
function debounce(fn:Function, delay:number) {
  let timer: any | null;
  return function () {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fn();
    }, delay);
  };
}
const handleVolumeChange = debounce(() => {
  saveSettings(false)
}, 500);


const handleClose = () => {
  dialogVisible.value = false
}
function updatePass(){
  saveSettings(true)
}

// 解析字符串为组件
const getIconComponent = (iconName: string) => {
  return Icons[iconName as keyof typeof Icons] || null;
};

// 修改添加路径的方法
const addScanPath = async (path?: string) => {
  try {
    let pathToAdd = path || newPath.value

    if (!path) {
      // 如果没有传入路径参数，说明是通过选择框添加
      const result = await file.selectDirectory()
      if (result.canceled) return
      pathToAdd = result.filePaths[0]
    }

    // 验证路径
    if (!pathToAdd) {
      ElMessage.warning('请输入或选择有效路径')
      return
    }

    // 检查路径是否已存在
    if (settings.scanPaths.includes(pathToAdd)) {
      ElMessage.warning('该路径已存在')
      return
    }

    // 添加路径
    settings.scanPaths.push(pathToAdd)
    newPath.value = '' // 清空输入框
    ElMessage.success('添加路径成功')
  } catch (error: any) {
    console.error('添加路径失败：', error)
    ElMessage.error('添加路径失败：' + error?.message)
  }
}

// 添加手动添加路径的方法
const addManualPath = () => {
  addScanPath(newPath.value)
}

// 删除扫描路径
const removeScanPath = (index: number) => {
  settings.scanPaths.splice(index, 1)
}

// 修改扫描方法
const startScan = async () => {
  if (settings.scanPaths.length === 0) {
    ElMessage.warning('请先添加扫描路径')
    return
  }
  loading()
  const status=await file.startScan(JSON.stringify(settings.scanPaths))
  if(status){
    //调用父组件的方法
    setTimeout(()=>{
      emit('callParentMethod','all');
    },1000)
    ElMessage.success(status.message)
  }else {
    ElMessage.error(status.message)
  }
  loading().close();
}

// 修改保存设置方法
const saveSettings = async (state:boolean) => {
  try {
    let newPass=state?md5(settings.password):settings.password
    // 确保传递的数据是可序列化的
    const updateSettings = {
      theme: settings.theme,
      scanOnStartup: settings.scanOnStartup,
      scanInterval: settings.scanInterval,
      port: settings.port,
      autoPlay: settings.autoPlay,
      defaultVolume: settings.defaultVolume,
      rememberLastPlayed: settings.rememberLastPlayed,
      scanPaths: settings.scanPaths?.slice() || [],
      minimization: settings.minimization,
      showTray: settings.showTray,
      isRole: settings.isRole
    };

    const settingsToSave = {
      ...updateSettings,
      password: newPass, // 保留原来的 password
    };
    settingsStore.updateSettings(settingsToSave)
    if(isElectron){
      await file.saveSettings(settingsToSave)
      settings.password=newPass
    }
  } catch (error) {
    console.error('保存设置失败：', error)
    ElMessage.error('保存设置失败')
  }
}

// 获取加载设置方法
const loadSettings = async () => {
  try {
    const savedSettings = await file.loadSettings()
    if (savedSettings) {
      Object.assign(settings,savedSettings)
      settingsStore.updateSettings(savedSettings)
    }else {
      const saveLocal =localStorage.getItem('settings')?JSON.parse(localStorage.getItem('settings') as string):null;
      Object.assign(settings,saveLocal)
      settingsStore.updateSettings(saveLocal)
    }
  } catch (error) {
    console.error('加载设置失败：', error)
    ElMessage.error('加载设置失败')
  }
}
const activeSection = ref('basic')
const settingsContent = ref<HTMLElement | null>(null)

// 滚动到指定部分
const scrollToSection = (sectionId: string) => {
  activeSection.value = sectionId
  const element = document.getElementById(sectionId)
  if (element && settingsContent.value) {
    settingsContent.value.scrollTo({
      top: element.offsetTop - 20,
      behavior: 'smooth'
    })
  }
}

// 数据库相关方法
const triggerMigration = async () => {
  if (!isElectron) return;
  
  migrationLoading.value = true;
  try {
    // 这里调用Electron的迁移API
    const result = await file.triggerMigration?.();
    if (result?.success) {
      ElMessage.success('迁移完成');
      await refreshDatabaseStatus();
    } else {
      ElMessage.error(result?.message || '迁移失败');
    }
  } catch (error: any) {
    console.error('迁移失败:', error);
    ElMessage.error('迁移失败: ' + error.message);
  } finally {
    migrationLoading.value = false;
  }
};

const refreshDatabaseStatus = async () => {
  if (!isElectron) return;
  
  statusLoading.value = true;
  try {
    // 获取数据库状态
    const dbStatus = await file.getDatabaseStatus?.();
    if (dbStatus) {
      settingsStore.setDatabaseStatus(dbStatus);
    }
    
    // 获取迁移状态
    const migrationStatus = await file.getMigrationStatus?.();
    if (migrationStatus) {
      settingsStore.setMigrationStatus(migrationStatus);
    }
    
    ElMessage.success('状态更新成功');
  } catch (error: any) {
    console.error('获取状态失败:', error);
    ElMessage.error('获取状态失败: ' + error.message);
  } finally {
    statusLoading.value = false;
  }
};
</script>

<style lang="scss" scoped>

.settings-container {
  height: 500px; /* 固定高度 */
  border-radius: 16px;
  overflow: hidden;
  background: var(--bg-color);
  backdrop-filter: blur(10px);
  max-width: 100%;
  display: flex;
  flex-direction: column;
}

.settings-layout {
  display: flex;
  height: 100%;
}

.settings-nav {
  width: 130px;
  border-right: 1px solid var(--border-color-effect);
  background: var(--glass-effect-bg);
  overflow-y: auto; /* 添加垂直滚动 */
}

.settings-menu {
  border-right: none;
  background: var(--glass-effect-bg);
}

.settings-menu :deep(.el-menu-item) {
  height: 50px;
  line-height: 50px;
  margin: 4px 0;
  position: relative; /* 修改定位方式 */
}

.settings-menu :deep(.el-menu-item.is-active) {
  background: rgba(var(--bg-color), 0.1);
  border-right: 3px solid var(--el-color-primary);
}

.settings-content {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
  max-width: 100%;
  overflow-x: hidden;
  background: var(--glass-effect-bg);
}

.settings-section {
  margin-bottom: 40px;
  scroll-margin-top: 1rem;
}

.settings-section h2 {
  font-size: 1.5rem;
  color: var(--el-text-color-primary);
  font-weight: 600;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

:deep(.el-form-item) {
  margin-bottom: 24px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--el-text-color-regular);
  padding-bottom: 8px;
}

.scan-paths-container {
  background: var(--bg-color);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  max-width: 100%;
  overflow-x: hidden;
}

.scan-paths-header {
  display: flex;
  gap: 13px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.path-input-group {
  display: flex;
  gap: 12px;
  flex: 1;
  min-width: 280px;
  flex-wrap: wrap; /* 允许按钮在小屏幕下换行 */
}

.path-input {
  flex: 1;
  min-width: 200px; /* 确保输入框有最小宽度 */
}

.scan-paths-list {
  background: var(--bg-container);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  max-height: 300px;
  overflow: hidden;
}

.scan-paths-list :deep(.el-table) {
  height: 100%;
  width: 100% !important;
  overflow-x: hidden;
}

.scan-paths-list :deep(.el-table__body-wrapper) {
  overflow-y: auto;
  max-height: 250px;
  width: 100% !important;
}

.scan-paths-list :deep(.el-table__empty-block) {
  min-height: 160px;
}

.path-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.path-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: calc(100% - 40px); /* 减去图标和间距的宽度 */
}

.dialog-footer {
  padding: 16px 32px;
  background: var(--bg-color);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

/* 响应式设计优化 */
@media (max-width: 500px) {
  .settings-container {
    height: 80vh; /* 在移动端使用视口高度 */
    max-height: 700px; /* 设置最大高度 */
  }
  .settings-layout {
    flex-direction: column;
  }

  .settings-nav {
    width: 100%;
    overflow-y: hidden; /* 在移动端禁用垂直滚动 */
    overflow-x: auto !important; /* 启用水平滚动 */

    /* 菜单滚动条 */
    &::-webkit-scrollbar {
      height: 3px;
      background: var(--scrollbar-bg);
    }

    &::-webkit-scrollbar-track {
      background: var(--scrollbar-bg);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.15);
    }
  }

  .settings-menu {
    display: flex;
    padding: 8px;
    white-space: nowrap;
  }

  .settings-menu :deep(.el-menu-item) {
    flex: 1;
    min-width: 120px;
    text-align: center;
  }

  .settings-content {
    padding: 16px;
  }

  .scan-paths-header {
    flex-direction: column;
    gap: 12px;
  }

  .path-input-group {
    width: 100%;
    gap: 8px;
  }

  .path-input {
    width: 100%;
    min-width: 100%;
  }

  /* 让按钮在小屏幕下占满宽度 */
  .scan-paths-header :deep(.el-button) {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .scan-paths-container {
    padding: 12px;
  }

  .scan-paths-list {
    max-height: 200px;
  }

  .scan-paths-list :deep(.el-table__body-wrapper) {
    max-height: 150px;
  }

  .scan-paths-list :deep(.el-table__header) th {
    padding: 8px 4px;
  }

  .scan-paths-list :deep(.el-table__cell) {
    padding: 4px;
  }

  .path-cell {
    font-size: 0.85em;
  }

  :deep(.el-button) {
    padding: 8px 12px;
    font-size: 0.9em;
  }

  .scan-paths-header {
    gap: 8px;
  }

  .path-input-group {
    gap: 6px;
  }
}

@media (max-height: 700px) {
  .settings-container {
    height: 85vh; /* 在较小屏幕高度下适应 */
  }
}

.glass-effect {
  background: var(--glass-effect-bg);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color-effect);
}

/* 菜单滚动条 */
.settings-nav::-webkit-scrollbar {
  width: 6px;
  background: var(--scrollbar-bg);
}

.settings-nav::-webkit-scrollbar-track {
  background: var(--scrollbar-bg);
  border-radius: 3px;
}

.settings-nav::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}

.settings-nav::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.15);
}
/* 设置滚动条 */
.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.settings-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.15);
}
.custom-dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 数据库状态样式 */
.database-status-container {
  margin-top: 1rem;
}

.status-card {
  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }
}

.status-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 1rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color-effect);

  &:last-child {
    border-bottom: none;
  }

  .status-label {
    font-weight: 500;
    color: var(--text-color);
  }

  .status-value {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
}

.error-alert {
  margin: 1rem 0;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color-effect);
}

@media (max-width: 768px) {
  .status-grid {
    gap: 0.5rem;
  }
  
  .status-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.3rem;
  }
  
  .action-buttons {
    flex-direction: column;
    
    .el-button {
      width: 100%;
    }
  }
}
</style>
