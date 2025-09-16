import { defineStore } from 'pinia';
import { reactive, ref } from "vue";
import { FileInter, MediaStats, DatabaseStatus, ApiError } from "../../../api/medium/type.ts";
import { reqFileData, safeApiCall, retryApiCall, reqImageStats } from "../../../api/medium";

export const useMedia = defineStore("useMedia", {
    state: () => {
        let MediaData = reactive<FileInter[]>([])
        let index = ref(0)
        let searchQuery = ref("")
        let playingData = reactive<FileInter>({
            Name: "",
            Url: "",
            Suffix: "",
            Size: 0
        })
        let mediaLi = ref<any>(null)
        let loading = ref(false)
        let error = ref<ApiError | null>(null)
        let mediaStats = ref<MediaStats | null>(null)
        let databaseStatus = ref<DatabaseStatus | null>(null)
        const isElectron: boolean = navigator.userAgent.includes("Electron")

        return {
            MediaData,
            index,
            isElectron,
            searchQuery,
            playingData,
            mediaLi,
            loading,
            error,
            mediaStats,
            databaseStatus
        }
    },
    
    getters: {
        // 过滤后的媒体数据
        filteredMediaData: (state) => {
            const query = state.searchQuery.toLowerCase().trim()
            if (!query) return state.MediaData
            
            return state.MediaData.filter(item =>
                item.Name.toLowerCase().includes(query) ||
                item.info?.artist?.toLowerCase().includes(query) ||
                item.info?.album?.toLowerCase().includes(query)
            )
        },
        
        // 媒体统计信息
        mediaStatistics: (state) => {
            const total = state.MediaData.length
            const music = state.MediaData.filter(item => 
                ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma'].includes(item.Suffix.toLowerCase())
            ).length
            const video = state.MediaData.filter(item => 
                ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.rmvb'].includes(item.Suffix.toLowerCase())
            ).length
            const totalSize = state.MediaData.reduce((sum, item) => sum + item.Size, 0)
            
            return { total, music, video, totalSize }
        },
        
        // 是否有错误
        hasError: (state) => !!state.error,
        
        // 是否正在加载
        isLoading: (state) => state.loading
    },
    
    actions: {
        // 设置媒体数据
        setMediaData(data: FileInter[]) {
            this.MediaData.splice(0, this.MediaData.length, ...data)
            this.clearError()
        },
        
        // 设置正在播放的数据
        setPlayingData(data: FileInter) {
            Object.assign(this.playingData, data)
        },
        
        // 设置加载状态
        setLoading(loading: boolean) {
            this.loading = loading
        },
        
        // 设置错误
        setError(error: ApiError | string | null) {
            if (typeof error === 'string') {
                this.error = {
                    code: 'UNKNOWN_ERROR',
                    message: error,
                    timestamp: new Date()
                }
            } else {
                this.error = error
            }
        },
        
        // 清除错误
        clearError() {
            this.error = null
        },
        
        // 更新媒体统计
        async updateMediaStats() {
            try {
                if (!this.isElectron) {
                    const response = await safeApiCall(() => reqImageStats())
                    if (response?.success) {
                        this.mediaStats = response.data
                    }
                }
            } catch (error) {
                console.warn('获取媒体统计失败:', error)
            }
        },
        
        // 路由更新文件 (增强错误处理)
        async routerUpdateFile(label: string) {
            this.setLoading(true)
            this.clearError()
            
            try {
                const { file } = window;
                let resD: FileInter[] = [];
                
                if (this.isElectron) {
                    // Electron环境：使用文件API
                    resD = await file.loadFileCache(label)
                    if (!resD) {
                        throw new Error('无法从本地缓存加载数据')
                    }
                } else {
                    // Web环境：使用HTTP API，带重试机制
                    const response = await retryApiCall(
                        () => reqFileData(label),
                        3,
                        1000
                    )
                    
                    if (!response?.success) {
                        throw new Error(response?.error || '获取媒体数据失败')
                    }
                    
                    resD = response.data || []
                }
                
                // 验证数据格式
                if (!Array.isArray(resD)) {
                    throw new Error('接收到的数据格式不正确')
                }
                
                this.setMediaData(resD)
                
                // 更新统计信息
                await this.updateMediaStats()
                
            } catch (error: any) {
                console.error('更新媒体文件失败:', error)
                this.setError(error.message || '更新媒体文件失败')
            } finally {
                this.setLoading(false)
            }
        },
        
        // 搜索媒体文件
        searchMedia(query: string) {
            this.searchQuery = query
        },
        
        // 清空搜索
        clearSearch() {
            this.searchQuery = ""
        },
        
        // 添加媒体文件
        addMediaFile(file: FileInter) {
            this.MediaData.push(file)
        },
        
        // 删除媒体文件
        removeMediaFile(url: string) {
            const index = this.MediaData.findIndex(item => item.Url === url)
            if (index > -1) {
                this.MediaData.splice(index, 1)
            }
        },
        
        // 更新媒体文件
        updateMediaFile(url: string, updates: Partial<FileInter>) {
            const index = this.MediaData.findIndex(item => item.Url === url)
            if (index > -1) {
                Object.assign(this.MediaData[index], updates)
            }
        },
        
        // 重置store
        reset() {
            this.MediaData.splice(0)
            this.searchQuery = ""
            this.playingData = {
                Name: "",
                Url: "",
                Suffix: "",
                Size: 0
            }
            this.loading = false
            this.error = null
            this.mediaStats = null
        }
    },
});
