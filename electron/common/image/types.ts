/**
 * 图片管理相关类型定义
 */

// 图片存储配置
export interface ImageConfig {
  cacheDir: string;           // 图片缓存目录
  maxCacheSize: number;       // 最大缓存大小 (MB)
  supportedFormats: string[]; // 支持的图片格式
  quality: number;            // 压缩质量 (1-100)
  maxDimension: number;       // 最大尺寸限制
}

// 图片信息接口
export interface ImageInfo {
  hash: string;               // 图片文件哈希
  originalPath?: string;      // 原始文件路径
  cachedPath: string;         // 缓存文件路径
  relativePath: string;       // 相对路径
  size: number;               // 文件大小 (字节)
  width?: number;             // 图片宽度
  height?: number;            // 图片高度
  format: string;             // 图片格式
  createdAt: Date;           // 创建时间
  lastUsed: Date;            // 最后使用时间
}

// 图片保存选项
export interface SaveImageOptions {
  quality?: number;          // 压缩质量
  maxWidth?: number;         // 最大宽度
  maxHeight?: number;        // 最大高度
  format?: 'jpg' | 'png' | 'webp'; // 输出格式
  overwrite?: boolean;       // 是否覆盖现有文件
}

// 图片清理选项
export interface CleanupOptions {
  maxAge?: number;           // 最大保留时间 (天)
  maxSize?: number;          // 最大缓存大小 (MB)
  excludePaths?: string[];   // 排除的路径
  dryRun?: boolean;          // 仅模拟，不实际删除
}

// 图片清理结果
export interface CleanupResult {
  deletedCount: number;      // 删除的文件数量
  freedSpace: number;        // 释放的空间 (字节)
  deletedFiles: string[];    // 删除的文件列表
  errors: string[];          // 错误信息
}

// 图片统计信息
export interface ImageStats {
  totalImages: number;       // 总图片数量
  totalSize: number;         // 总大小 (字节)
  formatCounts: Record<string, number>; // 各格式数量统计
  oldestImage?: Date;        // 最旧图片时间
  newestImage?: Date;        // 最新图片时间
  averageSize: number;       // 平均大小
}

// 图片处理错误类型
export interface ImageError {
  code: string;
  message: string;
  path?: string;
  originalError?: Error;
}

// 图片缓存条目
export interface CacheEntry {
  key: string;               // 缓存键
  info: ImageInfo;           // 图片信息
  accessCount: number;       // 访问次数
  lastAccess: Date;          // 最后访问时间
}

// 支持的图片格式枚举
export enum SupportedFormat {
  JPEG = 'jpg',
  PNG = 'png',
  WEBP = 'webp',
  GIF = 'gif',
  BMP = 'bmp'
}

// 图片处理状态
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing', 
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 图片批处理任务
export interface BatchTask {
  id: string;
  files: string[];
  options: SaveImageOptions;
  status: ProcessingStatus;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  results: string[];
  errors: ImageError[];
}
