import server from "../index.ts";
import { FileInter, ApiResponse, MediaStats, ImageInfo } from "./type.ts";

enum API{
    FILE_DATA_URL = "/file",
    GET_FILE='/file/get',
    LINK='/link',
    IMG='/img',
    IMG_INFO='/img/:name/info',
    IMG_STATS='/img/stats'
}

// 基础媒体文件API
export const reqFileData = (key: string): Promise<ApiResponse<FileInter[]>> => 
    server.get<ApiResponse<FileInter[]>>(API.FILE_DATA_URL + `?key=${key}`)

export const reqGetFile = (path: string): Promise<any> => 
    server.get<any>(API.GET_FILE + `?path=${path}`)

export const reqLink = (key: string): Promise<ApiResponse<boolean>> => 
    server.get<ApiResponse<boolean>>(`${API.LINK}?key=${key}`)

export const reqShare = (Ip: string, port: string, path: string): Promise<ApiResponse<FileInter[]>> => 
    server.get<ApiResponse<FileInter[]>>(`http://${Ip}:${port}` + API.FILE_DATA_URL + `?key=${path}`)

// 图片相关API (新增数据库模式支持)
export const reqImageInfo = (name: string): Promise<ApiResponse<ImageInfo>> =>
    server.get<ApiResponse<ImageInfo>>(API.IMG_INFO.replace(':name', name))

export const reqImageStats = (): Promise<ApiResponse<MediaStats>> =>
    server.get<ApiResponse<MediaStats>>(API.IMG_STATS)

// URL生成函数
export function FileUrl(ip: string, name: string, path: string): string {
    return `http://${ip}:${localStorage.getItem('port')}${API.GET_FILE}/${name}?path=${encodeURIComponent(path)}`
}

export function getImg(ip: string, name: string): string {
    return `http://${ip}:${localStorage.getItem('port')}${API.IMG}/${name}`
}

// 错误处理包装函数
export async function safeApiCall<T>(apiCall: () => Promise<T>): Promise<T | null> {
    try {
        return await apiCall();
    } catch (error) {
        console.error('API调用失败:', error);
        return null;
    }
}

// 带重试的API调用
export async function retryApiCall<T>(
    apiCall: () => Promise<T>, 
    maxRetries: number = 3,
    delay: number = 1000
): Promise<T | null> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            console.warn(`API调用失败 (${i + 1}/${maxRetries}):`, error);
            if (i === maxRetries - 1) {
                console.error('API调用最终失败:', error);
                return null;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
}

