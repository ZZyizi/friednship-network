<template>
  <el-dialog
      v-model="dialogVisible"
      title="共享"
      width="75%"
      class="custom-dialog"
      align-center
  >
    <div class="container">
      <div style="display: flex">
        <div style="justify-content: center;align-content: center;">
          <span v-if="settingsStore.isOpen" style="color:green;">服务已启动</span>
          <span v-else style="color: red">服务已关闭</span>
        </div>
        <div style="margin-left: 10px; justify-content: center;align-items: center;">
          <el-button v-if="!settingsStore.isOpen" type="success" :icon="SwitchButton"  circle  @click="send(3000)"></el-button>
          <el-button v-else type="danger" :icon="SwitchButton" circle  @click="send(0)"></el-button>
        </div>
      </div>

      <el-table :data="tableData" @cell-click="copy" style="width: 100%">
        <el-table-column prop="label" label="信息" width="160"></el-table-column>
        <el-table-column prop="value" label="详情" style="width: 100%"></el-table-column>
      </el-table>
      <div style="margin-top: 10px" v-if="settingsStore.isOpen">
        <div style="display: flex;justify-items: center;align-items: center;">
          <h3>数据互通</h3>
          <el-button type="primary" :icon="Refresh" style="margin-left: 10px" @click="getShare()" circle></el-button>
        </div>
        <el-table :data="shareData"  style="width: 100%" v-loading="loadingShare">
          <el-table-column prop="label" label="设备" width="70"></el-table-column>
          <el-table-column prop="ip" label="Ip地址" width="150"></el-table-column>
          <el-table-column prop="name" label="备注" width="100">
            <template #default="scope">
              <el-input type="text"  v-model="scope.row.name" />
            </template>
          </el-table-column>
          <el-table-column label="端口" width="110">
            <template #default="scope">
              <el-input  v-model="scope.row.port" :min="1000" :max="65535"  type="number" />
            </template>
          </el-table-column>
          <el-table-column label="密码" width="80">
            <template #default="scope">
              <el-input  v-model="scope.row.pass"  type="password" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="scope">
              <el-button type="success" @click="link(scope.row)">连接</el-button>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="40">
            <template #default="scope">
              <el-icon v-if="scope.row.status" color="green"><Check /></el-icon>
              <el-icon v-else color="red"><Close /></el-icon>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

  </el-dialog>
</template>

<script setup lang="ts">
import {computed, onMounted, reactive, ref, watch,onBeforeUnmount} from "vue";
import {ElMessage} from "element-plus";
import {useNetwork, useSettings} from "../store";
import { SwitchButton,Refresh,Check,Close } from '@element-plus/icons-vue'
import {linkTest} from "../api/network";
import {loading} from "../util/loadIng.ts";
import {shareDataType} from "../type/ShereType.ts";

const props = defineProps<{
  modelValue: boolean
}>()
const emit = defineEmits(['update:modelValue'])
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
const loadingShare=ref(false)//数据互通表格加载中
const settingsStore=useSettings()
const networkStore=useNetwork()
let port=ref(settingsStore.settings.port)
let Ip= ref('127.0.0.1')
let tableData = reactive([
      { label: '共享IP地址',value:Ip },
      { label: '端口', value: port },
    ])
let shareData=reactive<shareDataType[]>([])

onMounted(async ()=>{
  // 检查 Electron API 是否就绪
  if (!window.config || !window.ipcRenderer) {
    console.warn('[ShareDialog] Electron API 未就绪')
    return;
  }

  Ip.value=await window.config.getConfig()
  settingsStore.isOpen=await window.config.getStartServer()
  addLocal()
  window.addEventListener("beforeunload", handleBeforeUnload,{ passive: false });//挂载方法
})

//监听主进程
if (window.ipcRenderer) {
  window.ipcRenderer.on("update-start-server", (_, data) => {
    settingsStore.isOpen=data.isServerRunning
  });
}

//刷新页面时候
onBeforeUnmount(()=>{
  window.removeEventListener("beforeunload", handleBeforeUnload);//卸载方法
})

watch(() => settingsStore.settings.port, (newPort) => {
  port.value = newPort
})
watch(() => settingsStore.isOpen, () => {
  addLocal()
})

async function send(port:number){
  // 检查 Electron API 是否就绪
  if (!window.config) {
    ElMessage.error('Electron API 未就绪')
    return;
  }

  const data= await window.config.start(port)//启动web服务
  settingsStore.isOpen=data.success
  if(data.success){
    ElMessage.success(data.message)
  }else {
    ElMessage.error(data.message)
  }
}
function addLocal(){
  if (settingsStore.isOpen){
    //如果不存在，则添加
    if (tableData.length < 3) {
      tableData.push({
        label: '访问服务地址',
        value: `http://${Ip.value}:${port.value}`
      })
      tableData.push({
        label: '访问web共享地址',
        value: `http://${Ip.value}:${port.value}/index.html`
      })
    }
  }else {
    //如果存在，则删除
    if (tableData.length > 2) {
      tableData.pop()
      tableData.pop()
    }
  }
}
//复制
async function copy(row:any){
  //复制
  try {
    if (!window.config) {
      ElMessage.error('Electron API 未就绪');
      return;
    }
    await window.config.copy(row.value);
    ElMessage.success('复制成功');
  } catch (err) {
    ElMessage.error('复制失败');
    console.log(err)
  }
}
//关闭服务
const handleBeforeUnload = async () => {
  if (settingsStore.isOpen) {
    if (!window.config) {
      console.warn('[ShareDialog] Electron API 未就绪，无法关闭服务');
      return;
    }
    const data= await window.config.start(0)
    settingsStore.isOpen=data.success
  }
}
//互联功能
async function getShare(){
  loadingShare.value=true
  const shareDataLocal=localStorage.getItem(`shareData`)?JSON.parse(localStorage.getItem(`shareData`)||'[]'):[]
  shareData.splice(0,shareData.length)
  if (!window.config) {
    ElMessage.error('Electron API 未就绪');
    loadingShare.value=false
    return;
  }
  const data:{ip:string,mac:string}[]=await window.config.getLoadNet()
  data.forEach((item, index) => {
    // 查找是否在 shareDataLocal 里已有相同 mac
    const oldDevice = shareDataLocal.find((d:shareDataType) => d.mac === item.mac);
    if (oldDevice){
      shareData.push({
        label: `设备${index + 1}`,
        ip: item.ip,
        name: oldDevice.name, // 复制 name（如果存在）
        port: oldDevice.port, // 复制 port（如果存在）
        pass:"",
        status: false,
        mac: item.mac,
      });
    }else {
      shareData.push({
        label: `设备${index + 1}`,
        ip: item.ip,
        name: "", // 复制 name（如果存在）
        port: 3000, // 复制 port（如果存在）
        status: false,
        mac: item.mac,
      })
    }
  });
  loadingShare.value=false
  shareData.push({
    label: `本机`,
    ip: Ip.value,
    name: "", // 复制 name（如果存在）
    port: port.value, // 复制 port（如果存在）
    status: false
  });
}

async function link(item:shareDataType){
  try{
    loading()
    const data:any=await linkTest(item.ip,item.port,item.pass)
    if(data.data){
      // 在 shareData 里找到对应的 item（基于 mac）
      const index = shareData.findIndex((d) => d.mac === item.mac);
      if (index !== -1) {
        shareData[index].status = data.data; // 更新 status
      }
      // 可选：如果是 Vue 响应式数组，手动触发更新
      shareData = [...shareData];
      networkStore.addShareMenu(item)
      ElMessage.success(data.msg)
    }
  }catch (err:any){
    ElMessage.error("连接失败")
  }finally {
    loading().close()
  }
}
</script>
<style scoped lang="scss">
.container{
  width: 100%;
  height: 300px;
  overflow-y: auto;
  .el-table{
    margin-top: 10px;
  }
}
.container {
  /* 菜单滚动条 */
  &::-webkit-scrollbar {
    width: 5px;
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
</style>
