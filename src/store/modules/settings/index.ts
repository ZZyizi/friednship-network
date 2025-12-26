import { defineStore } from 'pinia';
import { Settings } from "../../../type/SettingsType.ts";
import { DatabaseStatus, MigrationStatus, ApiError } from "../../../api/medium/type.ts";
import { reactive, ref, computed } from "vue";

export const useSettings = defineStore(
    // 唯一ID
    'UseSettings',
    {
        state: () => {
            // 安全地从 localStorage 解析设置
            let parsedSettings: Settings | null = null;
            const storedSettings = localStorage.getItem('settings');

            if (storedSettings) {
                try {
                    parsedSettings = JSON.parse(storedSettings);
                } catch (error) {
                    console.warn('[SettingsStore] localStorage 中的设置数据无效，使用默认值:', error);
                    // 清除无效数据
                    localStorage.removeItem('settings');
                }
            }

            let settings = reactive<Settings>(parsedSettings || {
                port: 3000,// 端口
                theme: 'light',// 主题
                scanOnStartup: false,// 扫描启动
                scanInterval: 30,// 30分钟刷新
                autoPlay: false,          // 自动播放
                defaultVolume: 80,       // 默认音量
                rememberLastPlayed: false, // 记住上次播放位置
                scanPaths: [], // 扫描路径列表
                showTray: true, //是否启动托盘
                minimization: true, //是否关闭页面最小化
                isRole: false, //是否启用密码
                password: "" //密码
            })
            const UserEquipment = navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i)
            let currentTime: number = 0
            let isPlaying = ref<boolean>(false) //按钮状态
            let isOpen = false
            
            // 数据库相关状态
            let databaseStatus = ref<DatabaseStatus | null>(null)
            let migrationStatus = ref<MigrationStatus | null>(null)
            let settingsError = ref<ApiError | null>(null)
            let isLoading = ref(false)

            return {
                settings,
                currentTime,
                isPlaying,
                isOpen,
                UserEquipment,
                databaseStatus,
                migrationStatus,
                settingsError,
                isLoading
            };
        },
        
        getters: {
            // 是否为移动设备
            isMobile: (state) => !!state.UserEquipment,
            
            // 是否使用数据库模式
            isUsingDatabase: (state) => state.databaseStatus?.useDatabase || false,
            
            // 数据库是否就绪
            isDatabaseReady: (state) => state.databaseStatus?.dbReady || false,
            
            // 是否需要迁移
            needsMigration: (state) => state.migrationStatus?.needsMigration || false,
            
            // 迁移是否完成
            isMigrationCompleted: (state) => state.migrationStatus?.completed || false,
            
            // 是否有设置错误
            hasSettingsError: (state) => !!state.settingsError,
            
            // 格式化的设置摘要
            settingsSummary(): string {
                const s = this.settings;
                return `端口: ${s.port}, 主题: ${s.theme}, 扫描路径: ${s.scanPaths.length}个`;
            }
        },
        
        actions: {
            // 更新设置 (增强版)
            updateSettings(data: Settings | null, silent: boolean = false) {
                if (!data) return;

                try {
                    // 验证设置数据
                    this.validateSettings(data);

                    // 更新状态
                    Object.assign(this.settings, data);

                    // 持久化到本地存储
                    localStorage.setItem('settings', JSON.stringify(this.settings));

                    // 清除错误
                    this.clearSettingsError();

                    // 只在非静默模式下输出日志
                    if (!silent) {
                        console.log('设置更新成功');
                    }
                } catch (error: any) {
                    console.error('更新设置失败:', error);
                    this.setSettingsError(error.message || '更新设置失败');
                }
            },
            
            // 验证设置数据
            validateSettings(data: Settings) {
                if (data.port && (data.port < 1000 || data.port > 65535)) {
                    throw new Error('端口号必须在 1000-65535 之间');
                }
                
                if (data.scanInterval && data.scanInterval < 1) {
                    throw new Error('扫描间隔必须大于 0');
                }
                
                if (data.defaultVolume && (data.defaultVolume < 0 || data.defaultVolume > 100)) {
                    throw new Error('音量必须在 0-100 之间');
                }
                
                if (data.scanPaths && !Array.isArray(data.scanPaths)) {
                    throw new Error('扫描路径必须是数组');
                }
            },
            
            // 重置设置到默认值
            resetSettings() {
                const defaultSettings: Settings = {
                    port: 3000,
                    theme: 'light',
                    scanOnStartup: false,
                    scanInterval: 30,
                    autoPlay: false,
                    defaultVolume: 80,
                    rememberLastPlayed: false,
                    scanPaths: [],
                    showTray: true,
                    minimization: true,
                    isRole: false,
                    password: ""
                };
                
                this.updateSettings(defaultSettings);
            },
            
            // 导出设置
            exportSettings(): string {
                return JSON.stringify(this.settings, null, 2);
            },
            
            // 导入设置
            importSettings(settingsJson: string) {
                try {
                    const importedSettings = JSON.parse(settingsJson);
                    this.updateSettings(importedSettings);
                } catch (error: any) {
                    throw new Error('设置格式无效: ' + error.message);
                }
            },
            
            // 设置数据库状态
            setDatabaseStatus(status: DatabaseStatus) {
                this.databaseStatus = status;
            },
            
            // 设置迁移状态
            setMigrationStatus(status: MigrationStatus) {
                this.migrationStatus = status;
            },
            
            // 设置错误
            setSettingsError(error: string | ApiError | null) {
                if (typeof error === 'string') {
                    this.settingsError = {
                        code: 'SETTINGS_ERROR',
                        message: error,
                        timestamp: new Date()
                    };
                } else {
                    this.settingsError = error;
                }
            },
            
            // 清除错误
            clearSettingsError() {
                this.settingsError = null;
            },
            
            // 设置加载状态
            setLoading(loading: boolean) {
                this.isLoading = loading;
            },
            
            // 添加扫描路径
            addScanPath(path: string) {
                if (!path || this.settings.scanPaths.includes(path)) {
                    return false;
                }
                this.settings.scanPaths.push(path);
                this.updateSettings(this.settings);
                return true;
            },
            
            // 删除扫描路径
            removeScanPath(path: string) {
                const index = this.settings.scanPaths.indexOf(path);
                if (index > -1) {
                    this.settings.scanPaths.splice(index, 1);
                    this.updateSettings(this.settings);
                    return true;
                }
                return false;
            },
            
            // 清空扫描路径
            clearScanPaths() {
                this.settings.scanPaths = [];
                this.updateSettings(this.settings);
            },
            
            // 切换主题
            toggleTheme() {
                const themes = ['light', 'dark', 'auto'];
                const currentIndex = themes.indexOf(this.settings.theme);
                const nextIndex = (currentIndex + 1) % themes.length;
                this.settings.theme = themes[nextIndex];
                this.updateSettings(this.settings);
            }
        },
    },
);
