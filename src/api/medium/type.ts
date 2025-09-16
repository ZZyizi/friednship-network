export interface FileInter {
    Url: string,
    Name: string,
    Suffix: string,
    Size: number,
    info?: MusicInfo;
    classify?: ClassifyType | null;
}

export interface MusicInfo {
    artist?: string;
    album?: string;
    lyrics?: string[];
    duration: number;
    picture: string | null;
    quality: string;
    resolution: string | null;
}

export interface ClassifyType {
    year: string;
    month: string;
    day: string;
    prepose: string;
    picture?: string | null;
}

// API响应包装类型
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    error?: string;
}

// 图片信息类型 (对应数据库模式)
export interface ImageInfo {
    hash: string;
    relativePath: string;
    cachedPath?: string;
    originalPath?: string;
    size: number;
    format: string;
    createdAt: Date | string;
    lastUsed: Date | string;
}

// 媒体统计信息
export interface MediaStats {
    totalImages: number;
    totalSize: number;
    formatCounts: Record<string, number>;
    averageSize: number;
    oldestImage?: Date | string;
    newestImage?: Date | string;
    mode?: 'database' | 'legacy';
}

// 数据库状态信息
export interface DatabaseStatus {
    useDatabase: boolean;
    dbReady: boolean;
    migrationStatus: MigrationStatus;
}

export interface MigrationStatus {
    completed: boolean;
    version?: string;
    lastMigration?: Date | string;
    needsMigration?: boolean;
}

// 错误处理类型
export interface ApiError {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
}

// 媒体查询类型
export type MediaQueryType = 'all' | 'music' | 'video';

// 清理结果类型
export interface CleanupResult {
    deletedCount: number;
    freedSpace: number;
    deletedFiles: string[];
    errors: string[];
}

// 搜索参数类型
export interface SearchParams {
    query: string;
    type?: MediaQueryType;
    limit?: number;
    offset?: number;
}
