# LAN Media Share Desktop App

这是一个基于**ES语法**、**Vite**、**Electron**、**Typescript** 和 **Vue 3** 实现的桌面应用程序，旨在通过局域网（LAN）实现媒体文件的共享。用户可以在同一网络下轻松访问和共享 视频、音频等媒体资源，将闲置windows打造为nas。

##  新版本特性 (v0.0.2+)

- ** SQLite 数据库存储**：从 JSON 文件迁移到 SQLite 数据库，提升数据管理效率
- ** 自动数据迁移**：首次启动时自动检测并迁移现有数据，无缝升级体验
- ** 智能图片管理**：优化图片缓存机制，支持自动清理和去重
- ** 性能大幅提升**：数据查询速度提升 3-5 倍，支持更大数据量
- ** 数据安全保障**：事务支持确保数据完整性，完整的备份和恢复机制
- ** 监控和日志**：完整的错误处理和性能监控系统

## 功能特性

- **媒体文件共享**：支持视频、音频文件共享。
- **局域网访问**：通过局域网内的 IP 地址，允许其他设备访问共享内容。
- **实时预览**：支持媒体文件的实时预览（音乐播放,视频播放等）。
- **用户友好界面**：基于 Vue 3 构建的现代化 UI，操作简单直观。
- **路径管理**：支持自定义扫描磁盘路径,设置自动扫描。
- **高效缓存机制**：SQLite 数据库 + 文件系统混合存储，提供最佳性能。
- **web服务**：支持开启web服务，通过浏览器获取本机媒体文件
- **智能文件搜索**：支持快速搜索和过滤文件
- **跨平台**： 支持 Windows、macOS 和 Linux。
- **数据迁移**：自动检测和迁移现有数据，无需手动操作。


## 技术栈

### 核心框架
- **[Vite](https://vitejs.dev/)**：前端构建工具，提供快速的开发体验和高效的生产构建。
- **[Electron](https://www.electronjs.org/)**：用于构建跨平台的桌面应用程序。
- **[Vue 3](https://vuejs.org/)**：渐进式 JavaScript 框架，负责前端界面开发。
- **[Node.js](https://nodejs.org/)**：后端运行时，用于文件管理和网络服务。

### 数据存储
- **[SQLite](https://www.sqlite.org/)**：轻量级关系型数据库，提供高效的数据存储和查询。
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)**：Node.js SQLite 驱动，提供同步 API 和更好的性能。

### 测试框架
- **[Vitest](https://vitest.dev/)**：快速的单元测试框架，支持 TypeScript 和 ES 模块。
- **[@vitest/ui](https://vitest.dev/guide/ui.html)**：Vitest 的可视化测试界面。
- **[@vitest/coverage-v8](https://vitest.dev/guide/coverage.html)**：基于 V8 的代码覆盖率工具。

### 其他依赖
- `express`：用于搭建局域网文件共享服务。
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
- [pnpm](https://pnpm.io/)（推荐）或 [npm](https://www.npmjs.com/)

### 安装步骤

1. 克隆仓库到本地：
   ```bash
   git clone https://github.com/ZZyizi/friednship-network.git
   cd friednship-network
   ```

2. 安装依赖：
   ```bash
   pnpm install
   # 或者使用 npm
   npm install
   ```

3. 开发模式运行：
   ```bash
   pnpm dev
   # 或者使用 npm
   npm run dev
   ```

4. 编译应用：
   ```bash
   pnpm build
   # 或者使用 npm
   npm run build
   ```
   编译完成后要将 `libs/ffmpeg-static/ffmpeg.exe` 复制到 `dist` 目录下

5. 运行测试（可选）：
   ```bash
   # 运行所有测试
   pnpm test
   
   # 运行单元测试
   pnpm test:unit
   
   # 查看测试覆盖率
   pnpm test:coverage
   
   # 启动测试 UI
   npx vitest --ui
   ```

6. 打包应用：
   ```bash
   # Windows 平台
   pnpm packW
   
   # macOS 平台  
   pnpm packM
   
   # 仅打包不安装
   pnpm pack
   ```
   打包完成后，可在 `friendship-network` 目录下找到可执行文件。  

## 使用说明

### 首次启动

1. **自动数据迁移**：如果您是从旧版本升级，应用会自动检测并迁移您的数据到新的 SQLite 数据库。
   - 迁移过程会在后台自动进行
   - 原始 JSON 文件会被备份，确保数据安全
   - 迁移完成后会在设置页面显示状态

2. **初始配置**：启动应用程序后，在设置页面进行基础配置：
   - 配置媒体文件扫描路径
   - 设置自动扫描选项
   - 查看数据库状态和迁移信息

### 基本功能

3. **媒体共享**：通过共享功能开启服务，并通过浏览器访问：
   - 访问地址：`http://[本机IP]:[端口号]/index.html`
   - 例如：`http://192.168.1.100:3000/index.html`
   - 支持在线播放本机的媒体文件

4. **设备互联**：
   - 需要先开启共享服务
   - 点击刷新按钮扫描局域网内的设备
   - 配置端口号并连接其他设备
   - 通过菜单栏切换访问不同设备

### 数据库管理

5. **数据库状态监控**：
   - 在设置页面查看数据库连接状态
   - 监控数据迁移进度
   - 查看媒体文件统计信息

6. **手动操作**（如需要）：
   - 手动触发数据迁移
   - 刷新数据库状态
   - 查看错误日志和性能统计

## 项目结构
```
friendship-network/
├── public/                          # 静态资源
├── electron/                        # Electron 相关代码
│   ├── common/                      # Electron 通用工具函数
│   │   ├── database/                # 数据库管理模块
│   │   │   ├── index.ts             # DatabaseManager 主类
│   │   │   ├── schema.sql           # 数据库表结构
│   │   │   ├── migration.ts         # 数据迁移脚本
│   │   │   └── types.ts             # 数据库类型定义
│   │   ├── image/                   # 图片管理模块
│   │   │   ├── ImageManager.ts      # 图片管理器
│   │   │   ├── types.ts             # 图片类型定义
│   │   │   └── index.ts             # 统一导出
│   │   ├── util/                    # 工具函数
│   │   │   ├── ErrorHandler.ts      # 错误处理器
│   │   │   └── PerformanceMonitor.ts # 性能监控器
│   │   └── file/                    # 文件操作工具
│   ├── mainCom/                     # Electron 主进程通信
│   ├── preload/                     # Electron 预加载脚本
│   ├── services/                    # Express 服务代码
│   ├── type/                        # Electron 类型定义
│   ├── cors/                        # 跨域解决方案
│   ├── main.ts                      # Electron 主进程文件
│   ├── preload.ts                   # Electron 预加载文件
│   └── services.ts                  # Electron 服务文件
├── src/                             # Vue 前端源代码
│   ├── api/                         # API 接口封装
│   │   └── medium/                  # 媒体相关 API
│   │       ├── index.ts             # API 方法定义
│   │       └── type.ts              # API 类型定义
│   ├── components/                  # Vue 组件
│   │   ├── layout/                  # 布局组件
│   │   ├── MediaPlayer.vue          # 媒体播放器
│   │   ├── SettingsDialog.vue       # 设置对话框
│   │   └── ShareDialog.vue          # 共享对话框
│   ├── store/                       # Pinia 状态管理
│   │   └── modules/                 # 状态模块
│   │       ├── media/               # 媒体状态管理
│   │       ├── settings/            # 设置状态管理
│   │       ├── network/             # 网络状态管理
│   │       └── switch/              # UI 开关状态
│   ├── views/                       # Vue 路由视图
│   │   ├── data.vue                 # 数据列表视图
│   │   ├── wall.vue                 # 瀑布流视图
│   │   └── start.vue                # 启动视图
│   ├── router/                      # Vue 路由配置
│   ├── assets/                      # 静态资源
│   ├── utils/                       # 前端工具函数
│   ├── App.vue                      # Vue 根组件
│   └── main.ts                      # Vue 入口文件
├── tests/                           # 测试文件
│   ├── unit/                        # 单元测试
│   │   ├── DatabaseManager.test.ts  # 数据库管理器测试
│   │   ├── ImageManager.test.ts     # 图片管理器测试
│   │   └── BasicTest.test.ts        # 基础功能测试
│   ├── integration/                 # 集成测试
│   │   └── BasicIntegration.simple.test.ts # 基础集成测试
│   ├── utils/                       # 测试工具
│   │   └── TestUtils.ts             # 测试数据生成工具
│   ├── setup.ts                     # 测试环境配置
│   └── run-tests.js                 # 测试运行脚本
├── build/                           # 编译后的静态资源
├── libs/                            # 第三方库
│   └── ffmpeg-static/               # FFmpeg 静态库
│       └── ffmpeg.exe               # FFmpeg 可执行文件
├── docs/                            # 文档目录 (待创建)
│   ├── MIGRATION_GUIDE.md           # 迁移指南
│   └── DATABASE_SCHEMA.md           # 数据库结构文档
├── package.json                     # 项目配置文件
├── vite.config.js                   # Vite 配置文件
├── vitest.config.ts                 # Vitest 测试配置
├── tsconfig.json                    # TypeScript 配置
├── MIGRATION_TASKS.md               # 迁移任务清单
└── README.md                        # 项目说明文档
```

##  从旧版本升级

### 自动升级
- 应用会在启动时自动检测旧版本数据
- 自动将 JSON 文件数据迁移到 SQLite 数据库
- 保留原始文件作为备份，确保数据安全

### 手动操作（如需要）
如果自动迁移失败，可以尝试以下步骤：

1. **检查数据库状态**：
   - 打开设置页面
   - 查看"数据库状态"部分
   - 点击"刷新数据库状态"

2. **手动触发迁移**：
   - 在设置页面点击"手动迁移"
   - 等待迁移完成
   - 查看迁移日志

3. **数据恢复**（如果需要）：
   - 原始 JSON 文件会保存在 `cache/backup/` 目录
   - 可以通过重新安装旧版本来恢复数据

##  故障排除

### 常见问题

**Q: 应用启动后数据为空？**
- A: 检查数据迁移是否完成，在设置页面查看数据库状态

**Q: 迁移过程中出错？**
- A: 查看应用日志文件，通常在用户数据目录的 `logs/` 文件夹中

**Q: 性能变慢？**
- A: 新版本初次启动可能需要重建索引，请耐心等待

**Q: 找不到媒体文件？**
- A: 重新扫描媒体路径，或检查文件路径是否发生变化

### 调试模式

启用调试模式获取更多信息：
```bash
# 开发模式（显示详细日志）
pnpm dev

# 查看 Electron 控制台
# 在应用中按 Ctrl+Shift+I (Windows) 或 Cmd+Option+I (Mac)
```

## 📝 更新日志

### v0.0.2 (当前版本)
-  新增 SQLite 数据库支持
-  自动数据迁移功能
-  智能图片管理系统
-  性能监控和错误处理
-  完整的测试框架
-  改进的用户界面

### v0.0.1
- 基础媒体共享功能
- JSON 文件存储
- 局域网设备发现
- 基本的媒体播放功能

##  贡献指南

我们欢迎各种形式的贡献！

### 开发环境设置
1. Fork 项目
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 安装依赖：`pnpm install`
4. 运行测试：`pnpm test`
5. 提交更改：`git commit -m 'Add amazing feature'`
6. 推送分支：`git push origin feature/amazing-feature`
7. 创建 Pull Request

### 代码规范
- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 编写单元测试
- 更新相关文档

##  许可证

本项目采用 [MIT 许可证](LICENSE)。

##  致谢

感谢以下开源项目：
- [Electron](https://www.electronjs.org/)
- [Vue.js](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [SQLite](https://www.sqlite.org/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Element Plus](https://element-plus.org/)

---

如果您觉得这个项目有用，请给我们一个  Star！

