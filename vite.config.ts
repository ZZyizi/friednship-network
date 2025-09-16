import { defineConfig } from 'vite'
import { resolve } from 'path';
import path ,{ join } from 'node:path'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'
import os from "node:os";
import {fileURLToPath} from "node:url";
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
// 获取网络接口信息
const networkInterfaces = os.networkInterfaces();
let Ip=""
const __dirname = path.dirname(fileURLToPath(import.meta.url))
try{
  // port=JSON.parse(fs.readFileSync(configPath, 'utf8')).port?JSON.parse(fs.readFileSync(configPath, 'utf8')).port:8080
  // 遍历网络接口信息，找到 IPv4 地址
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName]?.forEach(interfaceInfo => {
      if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal) {
        Ip=`${interfaceInfo.address}`
      }
    });
  });
}catch (e){
  console.log(e)
}

export default defineConfig({
  base:'./',

  build: {
    manifest: true,
    rollupOptions: {
      input:{
        index:resolve(__dirname, 'index.html'), //渲染进程入口
        main: join(__dirname, 'electron/main.ts') // 主进程入口
      },
      output: {
        entryFileNames: '[name].js', // 输出文件名，保持主进程和服务代码分开
        format: 'es', // es 格式
      }
    },
    outDir: 'dist'
  },
  esbuild: {
    loader: 'ts', // 使用 TypeScript 加载器
    target: 'esnext', // 目标环境为最新版本的 JavaScript
  },
  server: {
    port: 8080,
    host: Ip
  },
  preview:{
    port: 8080,
    host: Ip
  },
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'es'
              }
            }
          },
          esbuild: {
            target: 'node18'
          }
        }
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            outDir: 'dist',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'es'
              }
            }
          },
          esbuild: {
            target: 'node18'
          }
        }
      },
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    })
  ],

})
