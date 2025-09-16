import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import {
  ImageConfig,
  ImageInfo,
  SaveImageOptions,
  CleanupOptions,
  CleanupResult,
  ImageStats,
  CacheEntry
} from './types';

/**
 * 图片管理器
 * 负责图片的存储、压缩、缓存管理和清理
 */
export class ImageManager {
  private static instance: ImageManager;
  private config: ImageConfig;
  private cacheMap: Map<string, CacheEntry> = new Map();

  // 默认配置
  private static readonly DEFAULT_CONFIG: ImageConfig = {
    cacheDir: path.join(app.getPath('userData'), 'media_data', 'images'),
    maxCacheSize: 500, // 500MB
    supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'],
    quality: 85,
    maxDimension: 2048
  };

  private constructor(config?: Partial<ImageConfig>) {
    this.config = { ...ImageManager.DEFAULT_CONFIG, ...config };
    this.initializeCache();
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<ImageConfig>): ImageManager {
    if (!ImageManager.instance) {
      ImageManager.instance = new ImageManager(config);
    }
    return ImageManager.instance;
  }

  /**
   * 初始化缓存目录和索引
   */
  private initializeCache(): void {
    try {
      // 确保缓存目录存在
      if (!fs.existsSync(this.config.cacheDir)) {
        fs.mkdirSync(this.config.cacheDir, { recursive: true });
        console.log(`创建图片缓存目录: ${this.config.cacheDir}`);
      }

      // 加载现有图片索引
      this.loadCacheIndex();
    } catch (error) {
      console.error('初始化图片缓存失败:', error);
      throw error;
    }
  }

  /**
   * 加载缓存索引
   */
  private loadCacheIndex(): void {
    try {
      const files = fs.readdirSync(this.config.cacheDir);
      
      for (const file of files) {
        const filePath = path.join(this.config.cacheDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && this.isSupportedFormat(file)) {
          const hash = path.parse(file).name;
          const relativePath = `images/${file}`;
          
          const imageInfo: ImageInfo = {
            hash,
            cachedPath: filePath,
            relativePath,
            size: stats.size,
            format: path.extname(file).slice(1).toLowerCase(),
            createdAt: stats.birthtime,
            lastUsed: stats.atime
          };

          this.cacheMap.set(hash, {
            key: hash,
            info: imageInfo,
            accessCount: 0,
            lastAccess: stats.atime
          });
        }
      }

      console.log(`加载了 ${this.cacheMap.size} 个缓存图片`);
    } catch (error) {
      console.error('加载缓存索引失败:', error);
    }
  }

  /**
   * 保存 Base64 图片到缓存
   */
  async saveBase64Image(
    base64Data: string, 
    sourceHash?: string,
    options: SaveImageOptions = {}
  ): Promise<string | null> {
    if (!base64Data) return null;

    try {
      // 处理 Base64 数据
      const base64Content = base64Data.includes('base64,')
        ? base64Data.split(',')[1]
        : base64Data;

      if (!base64Content) {
        throw new Error('无效的 Base64 数据');
      }

      // 生成图片缓存键
      const contentHash = sourceHash || this.generateHash(base64Content);
      
      // 检查是否已存在
      if (this.cacheMap.has(contentHash)) {
        const entry = this.cacheMap.get(contentHash)!;
        this.updateAccessInfo(contentHash);
        return entry.info.relativePath;
      }

      // 解码 Base64 数据
      const buffer = Buffer.from(base64Content, 'base64');
      
      // 检测图片格式和生成文件名
      const format = options.format || this.detectImageFormat(buffer) || 'jpg';
      const fileName = `${contentHash}.${format}`;
      const filePath = path.join(this.config.cacheDir, fileName);

      // 处理图片（可选的压缩和调整大小）
      const processedBuffer = await this.processImage(buffer, options);

      // 保存到磁盘
      fs.writeFileSync(filePath, processedBuffer);

      // 获取文件信息
      const stats = fs.statSync(filePath);
      const relativePath = `images/${fileName}`;

      // 创建图片信息
      const imageInfo: ImageInfo = {
        hash: contentHash,
        cachedPath: filePath,
        relativePath,
        size: stats.size,
        format,
        createdAt: new Date(),
        lastUsed: new Date()
      };

      // 添加到缓存
      this.cacheMap.set(contentHash, {
        key: contentHash,
        info: imageInfo,
        accessCount: 1,
        lastAccess: new Date()
      });

      console.log(`保存图片: ${fileName} (${this.formatFileSize(stats.size)})`);
      return relativePath;

    } catch (error) {
      console.error('保存 Base64 图片失败:', error);
      return null;
    }
  }

  /**
   * 保存文件图片到缓存
   */
  async saveFileImage(
    sourceFilePath: string, 
    options: SaveImageOptions = {}
  ): Promise<string | null> {
    if (!fs.existsSync(sourceFilePath)) {
      console.error(`源文件不存在: ${sourceFilePath}`);
      return null;
    }

    try {
      // 读取文件
      const buffer = fs.readFileSync(sourceFilePath);
      
      // 生成哈希
      const contentHash = this.generateHash(buffer.toString('base64'));
      
      // 检查是否已存在
      if (this.cacheMap.has(contentHash)) {
        const entry = this.cacheMap.get(contentHash)!;
        this.updateAccessInfo(contentHash);
        return entry.info.relativePath;
      }

      // 处理图片
      const format = options.format || this.detectImageFormat(buffer) || path.extname(sourceFilePath).slice(1).toLowerCase();
      const fileName = `${contentHash}.${format}`;
      const filePath = path.join(this.config.cacheDir, fileName);

      // 处理和保存
      const processedBuffer = await this.processImage(buffer, options);
      fs.writeFileSync(filePath, processedBuffer);

      // 获取文件信息
      const stats = fs.statSync(filePath);
      const relativePath = `images/${fileName}`;

      // 创建图片信息
      const imageInfo: ImageInfo = {
        hash: contentHash,
        originalPath: sourceFilePath,
        cachedPath: filePath,
        relativePath,
        size: stats.size,
        format,
        createdAt: new Date(),
        lastUsed: new Date()
      };

      // 添加到缓存
      this.cacheMap.set(contentHash, {
        key: contentHash,
        info: imageInfo,
        accessCount: 1,
        lastAccess: new Date()
      });

      console.log(`缓存图片: ${path.basename(sourceFilePath)} -> ${fileName}`);
      return relativePath;

    } catch (error) {
      console.error(`保存文件图片失败: ${sourceFilePath}`, error);
      return null;
    }
  }

  /**
   * 获取图片信息
   */
  getImageInfo(hashOrPath: string): ImageInfo | null {
    // 如果是相对路径，提取哈希
    if (hashOrPath.includes('/')) {
      const fileName = path.basename(hashOrPath);
      const hash = path.parse(fileName).name;
      const entry = this.cacheMap.get(hash);
      return entry ? entry.info : null;
    }

    // 直接通过哈希查找
    const entry = this.cacheMap.get(hashOrPath);
    if (entry) {
      this.updateAccessInfo(hashOrPath);
      return entry.info;
    }

    return null;
  }

  /**
   * 生成图片 URL
   */
  getImageUrl(relativePath: string, serverInfo: { ip: string; port: number }): string {
    if (!relativePath) return '';
    const filename = path.basename(relativePath);
    return `http://${serverInfo.ip}:${serverInfo.port}/img/${filename}`;
  }

  /**
   * 清理未使用的图片
   */
  async cleanUnusedImages(usedPaths: string[], options: CleanupOptions = {}): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedCount: 0,
      freedSpace: 0,
      deletedFiles: [],
      errors: []
    };

    try {
      const usedHashes = new Set<string>();
      
      // 提取使用中的图片哈希
      for (const usedPath of usedPaths) {
        if (usedPath) {
          const fileName = path.basename(usedPath);
          const hash = path.parse(fileName).name;
          usedHashes.add(hash);
        }
      }

      // 排除指定路径
      const excludeHashes = new Set<string>();
      if (options.excludePaths) {
        for (const excludePath of options.excludePaths) {
          const fileName = path.basename(excludePath);
          const hash = path.parse(fileName).name;
          excludeHashes.add(hash);
        }
      }

      // 查找要删除的图片
      const toDelete: string[] = [];
      const maxAge = options.maxAge ? options.maxAge * 24 * 60 * 60 * 1000 : null;
      const now = Date.now();

      for (const [hash, entry] of this.cacheMap.entries()) {
        const shouldDelete = 
          !usedHashes.has(hash) && 
          !excludeHashes.has(hash) &&
          (!maxAge || (now - entry.lastAccess.getTime()) > maxAge);

        if (shouldDelete) {
          toDelete.push(hash);
        }
      }

      // 执行删除
      for (const hash of toDelete) {
        const entry = this.cacheMap.get(hash);
        if (!entry) continue;

        try {
          if (!options.dryRun && fs.existsSync(entry.info.cachedPath)) {
            fs.unlinkSync(entry.info.cachedPath);
          }

          result.deletedCount++;
          result.freedSpace += entry.info.size;
          result.deletedFiles.push(entry.info.relativePath);

          // 从缓存中移除
          this.cacheMap.delete(hash);

        } catch (error) {
          const errorMsg = `删除图片失败: ${entry.info.relativePath} - ${error}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log(`图片清理完成: 删除 ${result.deletedCount} 个文件，释放 ${this.formatFileSize(result.freedSpace)}`);
      return result;

    } catch (error) {
      console.error('图片清理失败:', error);
      result.errors.push(`清理过程出错: ${error}`);
      return result;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): ImageStats {
    const stats: ImageStats = {
      totalImages: this.cacheMap.size,
      totalSize: 0,
      formatCounts: {},
      averageSize: 0
    };

    let oldestTime = Date.now();
    let newestTime = 0;

    for (const entry of this.cacheMap.values()) {
      const info = entry.info;
      
      // 累计大小
      stats.totalSize += info.size;
      
      // 格式统计
      stats.formatCounts[info.format] = (stats.formatCounts[info.format] || 0) + 1;
      
      // 时间统计
      const createTime = info.createdAt.getTime();
      if (createTime < oldestTime) {
        oldestTime = createTime;
        stats.oldestImage = info.createdAt;
      }
      if (createTime > newestTime) {
        newestTime = createTime;
        stats.newestImage = info.createdAt;
      }
    }

    stats.averageSize = stats.totalImages > 0 ? stats.totalSize / stats.totalImages : 0;

    return stats;
  }

  /**
   * 检查缓存大小并执行自动清理
   */
  async checkAndCleanCache(): Promise<void> {
    const stats = this.getCacheStats();
    const maxSizeBytes = this.config.maxCacheSize * 1024 * 1024;

    if (stats.totalSize > maxSizeBytes) {
      console.log(`缓存大小 ${this.formatFileSize(stats.totalSize)} 超过限制 ${this.formatFileSize(maxSizeBytes)}，开始自动清理`);
      
      // 按最后访问时间排序，删除最旧的文件
      const entries = Array.from(this.cacheMap.entries())
        .sort(([, a], [, b]) => a.lastAccess.getTime() - b.lastAccess.getTime());

      let freedSpace = 0;
      const targetFree = stats.totalSize - maxSizeBytes * 0.8; // 清理到80%

      for (const [hash, entry] of entries) {
        if (freedSpace >= targetFree) break;

        try {
          if (fs.existsSync(entry.info.cachedPath)) {
            fs.unlinkSync(entry.info.cachedPath);
            freedSpace += entry.info.size;
            this.cacheMap.delete(hash);
          }
        } catch (error) {
          console.error(`自动清理图片失败: ${entry.info.relativePath}`, error);
        }
      }

      console.log(`自动清理完成，释放空间: ${this.formatFileSize(freedSpace)}`);
    }
  }

  // ================================================================
  // 私有工具方法
  // ================================================================

  /**
   * 生成内容哈希
   */
  private generateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 检测图片格式
   */
  private detectImageFormat(buffer: Buffer): string | null {
    // 简单的文件头检测
    if (buffer.length < 8) return null;

    const header = buffer.slice(0, 8);
    
    // JPEG
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return 'jpg';
    }
    
    // PNG
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return 'png';
    }
    
    // GIF
    if (header.slice(0, 3).toString() === 'GIF') {
      return 'gif';
    }
    
    // WebP
    if (header.slice(0, 4).toString() === 'RIFF' && header.slice(8, 12).toString() === 'WEBP') {
      return 'webp';
    }
    
    // BMP
    if (header[0] === 0x42 && header[1] === 0x4D) {
      return 'bmp';
    }

    return null;
  }

  /**
   * 检查是否为支持的格式
   */
  private isSupportedFormat(filename: string): boolean {
    const ext = path.extname(filename).slice(1).toLowerCase();
    return this.config.supportedFormats.includes(ext);
  }

  /**
   * 处理图片（压缩、调整大小等）
   * 注意：这里使用简单的 Buffer 操作，实际项目中可能需要使用 Sharp 等库
   */
  private async processImage(buffer: Buffer, _options?: SaveImageOptions): Promise<Buffer> {
    // 目前直接返回原始 buffer
    // 在实际项目中，这里可以集成 Sharp 库进行图片处理
    return buffer;
  }

  /**
   * 更新访问信息
   */
  private updateAccessInfo(hash: string): void {
    const entry = this.cacheMap.get(hash);
    if (entry) {
      entry.accessCount++;
      entry.lastAccess = new Date();
      entry.info.lastUsed = new Date();
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取配置信息
   */
  getConfig(): ImageConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ImageConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取所有缓存的图片信息
   */
  getAllImages(): ImageInfo[] {
    return Array.from(this.cacheMap.values()).map(entry => entry.info);
  }

  /**
   * 销毁实例（用于测试）
   */
  static destroy(): void {
    ImageManager.instance = null as any;
  }
}

// 导出单例实例
export const imageManager = ImageManager.getInstance();
export default imageManager;
