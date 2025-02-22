# LAN Media Share Desktop App

这是一个基于**ES语法**、**Vite**、**Electron**、**Typescript** 和 **Vue 3** 实现的桌面应用程序，旨在通过局域网（LAN）实现媒体文件的共享。用户可以在同一网络下轻松访问和共享 视频、音频等媒体资源。

## 功能特性

- **媒体文件共享**：支持视频、音频文件共享。
- **局域网访问**：通过局域网内的 IP 地址，允许其他设备访问共享内容。
- **实时预览**：支持媒体文件的实时预览（音乐播放,视频播放等）。
- **用户友好界面**：基于 Vue 3 构建的现代化 UI，操作简单直观。
- **路径管理**：支持自定义扫描磁盘路径,设置自动扫描。
- **缓存机制**：缓存媒体文件，提高访问速度。
- **web服务**：支持开启web服务，通过浏览器获取本机媒体文件
- **文件搜索**：支持搜索文件
- **跨平台**： 支持 Windows、macOS 和 Linux。


## 技术栈

- **[Vite](https://vitejs.dev/)**：前端构建工具，提供快速的开发体验和高效的生产构建。
- **[Electron](https://www.electronjs.org/)**：用于构建跨平台的桌面应用程序。
- **[Vue 3](https://vuejs.org/)**：渐进式 JavaScript 框架，负责前端界面开发。
- **[Node.js](https://nodejs.org/)**：后端运行时，用于文件管理和网络服务。
- **其他依赖**：
   - `express`：用于搭建局域网文件共享服务。
   - `ip`：获取本地 IP 地址。
   - `axios`：用于网络请求。
   - `pinia`：状态管理库。
   - `uuid`：生成唯一标识符。
   - `element-plus`：基于 Vue 3 的 UI 组件库。
   - `fluent-ffmpeg`：处理媒体文件。
   - `iconv-lite`：处理字符编码。
   - `local-devices`：获取局域网内的设备信息。
   - `music-metadata`：解析音乐文件的元数据。

## 安装与运行

### 前提条件

- [Node.js](https://nodejs.org/)（建议版本 v16 或以上）
- [cnpm](https://www.cnpmjs.com/) 或 [yarn](https://yarnpkg.com/)

### 安装步骤

1. 克隆仓库到本地：
   ```bash
   git clone https://github.com/ZZyizi/friednship-network.git
   cd friednship-network
2. 安装依赖：
   ```bash
    npm install
   ```
3. 开发模式运行：
   ```bash
   npm run dev
   ```
4. 编译应用：
   ```bash
   npm run build
   ```
这一步要将完成后要将libs/ffmpeg.exe的ffmpeg.exe复制到dist目录下
5. 打包应用：
   ```bash
   npm run pack
   ```
打包完成后，可在 friendship-network 目录下找到可执行文件。  

## 使用说明

1.启动应用程序后，先在设置里面配置一下，并且扫描需要扫描的磁盘路径。

2.通过共享功能开启服务，并通过浏览器输入 http://[本机IP]:[端口号]/index.html（如 http://192.168.1.100:3000/index.html ）即可访问共享页面，播放本机的媒体文件

3.互联功能，需要开启共享服务后才可使用，使用前点击刷新按钮即可刷新当前连接在局域网的所有设备，配置端口号。连接成功后通过切换菜单栏即可访问。

## 项目结构
```markdown
friendship-network/
├── public/               # 静态资源
├── electron/             # Electron 相关代码
│   ├── mainCom/          # Electron 主进程代码
│   ├── preload/          # Electron 渲染进程代码
│   ├── services/         # Electron 提供的express服务代码
│   ├── type/             # Electron 类型定义
│   ├── common/           # Electron 通用的工具函数
│   ├── cors/             # express服务解决跨域代码
│   ├── main.ts           # electron 主进程文件
│   ├── preload.ts        # electron 渲染进程文件
│   └── services.ts       # Electron 渲染进程代码
├── src/                  # 源代码
│   ├── main/             # Electron 主进程代码
│   ├── renderer/         # Vue 前端渲染进程代码
│   ├── assets/           # 静态资源（图片、样式等）
│   ├── api/              # axios封装代码
│   ├── components/       # Vue 组件
│   ├── store/            # Pinia 状态管理
│   ├── utils/            # 工具函数
│   ├── views/            # Vue 路由视图
│   ├── App.vue           # Vue 根组件
│   ├── main.ts           # Vue 入口文件
│   └── router/           # Vue 路由配置
├── build/                 # 编译的静态资源
├── libs/                 # 使用ES改写的ffmpeg-static模块
│   └── ffmpeg-static/    
│       └── ffmpeg.exe    # ffmpeg 可执行文件
├── package.json          # 项目配置文件
├── vite.config.js        # Vite 配置文件
└── README.md             # 项目说明文档
```

