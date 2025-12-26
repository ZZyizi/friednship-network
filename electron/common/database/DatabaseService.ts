import { performanceMonitor } from '../util/PerformanceMonitor';
import { errorHandler, ErrorType } from '../util/ErrorHandler';
import { databaseManager } from './DatabaseManager';
import {
  MediaFileRecord,
  MediaCategoryRecord,
  SettingsRecord,
  SearchOptions,
  QueryOptions,
  BatchResult,
  DatabaseStats
} from './types';
import { FileInter, ClassifyType } from '../../api/medium/type';

/**
 * 数据库服务层
 * 提供高级的数据库操作接口，封装业务逻辑
 */
export class DatabaseService {
  private static instance: DatabaseService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * 初始化数据库服务
   */
  async initialize(): Promise<void> {
    await performanceMonitor.measureDatabaseOperation('service_init', async () => {
      await databaseManager.connect();
      errorHandler.info(ErrorType.DATABASE, 'DB_SERVICE_INIT', '数据库服务初始化完成');
    });
  }

  /**
   * 关闭数据库服务
   */
  async shutdown(): Promise<void> {
    await databaseManager.disconnect();
    errorHandler.info(ErrorType.DATABASE, 'DB_SERVICE_SHUTDOWN', '数据库服务已关闭');
  }

  // ==================== 媒体文件操作 ====================

  /**
   * 添加媒体文件
   */
  async addMediaFile(file: FileInter): Promise<boolean> {
    try {
      // 检查文件是否已存在
      const existing = await databaseManager.getMediaFileByUrl(file.Url);
      if (existing) {
        return false;
      }

      // 生成文件哈希
      const fileHash = await this.generateFileHash(file.Url);

      const record: Omit<MediaFileRecord, 'id' | 'created_at' | 'updated_at'> = {
        url: file.Url,
        name: file.Name,
        suffix: file.Suffix,
        size: file.Size,
        duration: file.info?.duration || 0,
        artist: file.info?.artist || '未知',
        album: file.info?.album || '未知',
        quality: file.info?.quality || '未知',
        resolution: file.info?.resolution,
        picture: file.info?.picture,
        lyrics: file.info?.lyrics,
        file_hash: fileHash
      };

      await databaseManager.insertMediaFile(record);
      return true;
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'ADD_MEDIA_FILE_ERROR', '添加媒体文件失败', error as Error);
      return false;
    }
  }

  /**
   * 批量添加媒体文件
   */
  async addMediaFiles(files: FileInter[]): Promise<BatchResult> {
    return await performanceMonitor.measureDatabaseOperation('batch_add_files', async () => {
      const records: Omit<MediaFileRecord, 'id' | 'created_at' | 'updated_at'>[] = [];
      let skipped = 0;

      for (const file of files) {
        try {
          // 生成文件哈希
          const fileHash = await this.generateFileHash(file.Url);

          records.push({
            url: file.Url,
            name: file.Name,
            suffix: file.Suffix,
            size: file.Size,
            duration: file.info?.duration || 0,
            artist: file.info?.artist || '未知',
            album: file.info?.album || '未知',
            quality: file.info?.quality || '未知',
            resolution: file.info?.resolution,
            picture: file.info?.picture,
            lyrics: file.info?.lyrics,
            file_hash: fileHash
          });
        } catch (error) {
          skipped++;
          errorHandler.warn(ErrorType.DATABASE, 'FILE_HASH_ERROR', `生成文件哈希失败: ${file.Name}`, error as Error);
        }
      }

      if (skipped > 0) {
        console.warn(`[DatabaseService] 跳过 ${skipped} 个文件（哈希生成失败）`);
      }

      const result = await databaseManager.insertMediaFiles(records);
      return { ...result, failed: result.failed + skipped };
    });
  }

  /**
   * 获取媒体文件
   */
  async getMediaFiles(options: SearchOptions = {}): Promise<FileInter[]> {
    try {
      const records = await databaseManager.getMediaFiles(options);

      return records.map(record => this.convertMediaFileRecordToFileInter(record));
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'GET_MEDIA_FILES_ERROR', '获取媒体文件失败', error as Error);
      return [];
    }
  }

  /**
   * 根据类型获取媒体文件
   */
  async getMediaFilesByType(type: 'music' | 'video', options: QueryOptions = {}): Promise<FileInter[]> {
    const searchOptions: SearchOptions = {
      fileType: type,
      queryOptions: options
    };

    return await this.getMediaFiles(searchOptions);
  }

  /**
   * 搜索媒体文件
   */
  async searchMediaFiles(keyword: string, options: QueryOptions = {}): Promise<FileInter[]> {
    const searchOptions: SearchOptions = {
      keyword,
      queryOptions: options
    };

    return await this.getMediaFiles(searchOptions);
  }

  /**
   * 根据艺术家获取媒体文件
   */
  async getMediaFilesByArtist(artist: string, options: QueryOptions = {}): Promise<FileInter[]> {
    const searchOptions: SearchOptions = {
      artist,
      queryOptions: options
    };

    return await this.getMediaFiles(searchOptions);
  }

  /**
   * 根据专辑获取媒体文件
   */
  async getMediaFilesByAlbum(album: string, options: QueryOptions = {}): Promise<FileInter[]> {
    const searchOptions: SearchOptions = {
      album,
      queryOptions: options
    };

    return await this.getMediaFiles(searchOptions);
  }

  /**
   * 更新媒体文件
   */
  async updateMediaFile(url: string, updates: Partial<FileInter>): Promise<boolean> {
    try {
      const dbUpdates: Partial<MediaFileRecord> = {};

      if (updates.info) {
        if (updates.info.duration !== undefined) dbUpdates.duration = updates.info.duration;
        if (updates.info.artist !== undefined) dbUpdates.artist = updates.info.artist;
        if (updates.info.album !== undefined) dbUpdates.album = updates.info.album;
        if (updates.info.quality !== undefined) dbUpdates.quality = updates.info.quality;
        if (updates.info.resolution !== undefined) dbUpdates.resolution = updates.info.resolution;
        if (updates.info.picture !== undefined) dbUpdates.picture = updates.info.picture;
        if (updates.info.lyrics !== undefined) dbUpdates.lyrics = updates.info.lyrics;
      }

      if (updates.Name !== undefined) dbUpdates.name = updates.Name;
      if (updates.Size !== undefined) dbUpdates.size = updates.Size;

      return await databaseManager.updateMediaFile(url, dbUpdates);
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'UPDATE_MEDIA_FILE_ERROR', '更新媒体文件失败', error as Error);
      return false;
    }
  }

  /**
   * 删除媒体文件
   */
  async deleteMediaFile(url: string): Promise<boolean> {
    try {
      return await databaseManager.deleteMediaFile(url);
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'DELETE_MEDIA_FILE_ERROR', '删除媒体文件失败', error as Error);
      return false;
    }
  }

  /**
   * 清理无效文件记录
   */
  async cleanupInvalidFiles(): Promise<number> {
    return await performanceMonitor.measureDatabaseOperation('cleanup_invalid_files', async () => {
      return await databaseManager.cleanupNonExistentFiles();
    });
  }

  // ==================== 媒体分类操作 ====================

  /**
   * 添加媒体分类
   */
  async addMediaCategory(category: ClassifyType): Promise<boolean> {
    try {
      await databaseManager.insertMediaCategory({
        year: category.year,
        month: category.month,
        day: category.day,
        prepose: category.prepose,
        picture: category.picture
      });
      return true;
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'ADD_CATEGORY_ERROR', '添加媒体分类失败', error as Error);
      return false;
    }
  }

  /**
   * 获取媒体分类
   */
  async getMediaCategories(): Promise<ClassifyType[]> {
    try {
      const records = await databaseManager.getMediaCategories();

      return records.map(record => ({
        year: record.year,
        month: record.month,
        day: record.day,
        prepose: record.prepose,
        picture: record.picture
      }));
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'GET_CATEGORIES_ERROR', '获取媒体分类失败', error as Error);
      return [];
    }
  }

  /**
   * 清理未使用的分类
   */
  async cleanupUnusedCategories(): Promise<number> {
    return await performanceMonitor.measureDatabaseOperation('cleanup_categories', async () => {
      return await databaseManager.cleanupUnusedClassifications();
    });
  }

  // ==================== 系统设置操作 ====================

  /**
   * 获取设置值
   */
  async getSetting(key: string): Promise<any> {
    try {
      const record = await databaseManager.getSetting(key);
      if (!record) {
        return null;
      }

      return this.parseSettingValue(record.value, record.type);
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'GET_SETTING_ERROR', `获取设置失败: ${key}`, error as Error);
      return null;
    }
  }

  /**
   * 设置配置项
   */
  async setSetting(key: string, value: any, description?: string): Promise<void> {
    try {
      const { stringValue, type } = this.serializeSettingValue(value);
      await databaseManager.setSetting(key, stringValue, type, description);
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'SET_SETTING_ERROR', `设置配置失败: ${key}`, error as Error);
    }
  }

  /**
   * 批量设置
   */
  async setMultipleSettings(settings: Record<string, any>): Promise<void> {
    await databaseManager.transaction(async (db) => {
      for (const [key, value] of Object.entries(settings)) {
        try {
          const { stringValue, type } = this.serializeSettingValue(value);
          await databaseManager.setSetting(key, stringValue, type);
        } catch (error) {
          errorHandler.error(ErrorType.DATABASE, 'SET_MULTIPLE_SETTINGS_ERROR', `批量设置失败: ${key}`, error as Error);
        }
      }
    });
  }

  /**
   * 获取所有设置
   */
  async getAllSettings(): Promise<Record<string, any>> {
    try {
      const db = databaseManager.getDb();
      // better-sqlite3 需要先 prepare，然后 all
      const stmt = db.prepare('SELECT * FROM settings');
      const records = stmt.all<SettingsRecord[]>();

      const settings: Record<string, any> = {};
      for (const record of records) {
        settings[record.key] = this.parseSettingValue(record.value, record.type);
      }

      return settings;
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'GET_ALL_SETTINGS_ERROR', '获取所有设置失败', error as Error);
      return {};
    }
  }

  // ==================== 统计和分析 ====================

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    return await databaseManager.getDatabaseStats();
  }

  /**
   * 获取艺术家列表
   */
  async getArtists(): Promise<string[]> {
    try {
      const db = databaseManager.getDb();
      // better-sqlite3 需要先 prepare，然后 all
      const stmt = db.prepare('SELECT DISTINCT artist FROM media_files WHERE artist != "未知" ORDER BY artist');
      const records = stmt.all<{ artist: string }>();
      return records.map(r => r.artist);
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'GET_ARTISTS_ERROR', '获取艺术家列表失败', error as Error);
      return [];
    }
  }

  /**
   * 获取专辑列表
   */
  async getAlbums(): Promise<string[]> {
    try {
      const db = databaseManager.getDb();
      // better-sqlite3 需要先 prepare，然后 all
      const stmt = db.prepare('SELECT DISTINCT album FROM media_files WHERE album != "未知" ORDER BY album');
      const records = stmt.all<{ album: string }>();
      return records.map(r => r.album);
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'GET_ALBUMS_ERROR', '获取专辑列表失败', error as Error);
      return [];
    }
  }

  /**
   * 获取文件格式统计
   */
  async getFileFormatStats(): Promise<Record<string, number>> {
    try {
      const db = databaseManager.getDb();
      // better-sqlite3 需要先 prepare，然后 all
      const stmt = db.prepare('SELECT suffix, COUNT(*) as count FROM media_files GROUP BY suffix ORDER BY count DESC');
      const records = stmt.all<{ suffix: string; count: number }>();

      const stats: Record<string, number> = {};
      for (const record of records) {
        stats[record.suffix] = record.count;
      }

      return stats;
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'GET_FORMAT_STATS_ERROR', '获取格式统计失败', error as Error);
      return {};
    }
  }

  // ==================== 工具方法 ====================

  /**
   * 生成文件哈希（基于文件路径的MD5）
   * 注意：这里是对路径进行哈希，而不是文件内容
   */
  private async generateFileHash(filePath: string): Promise<string> {
    try {
      const crypto = require('crypto');
      const hash = crypto.createHash('md5');
      // 使用 utf8 编码确保正确处理中文和特殊字符
      hash.update(filePath, 'utf8');
      return hash.digest('hex');
    } catch (error) {
      // 如果哈希失败，返回一个基于路径的简单标识
      // 使用 Buffer.from 确保编码正确
      return Buffer.from(filePath, 'utf8').toString('base64').substring(0, 32);
    }
  }

  /**
   * 转换数据库记录到业务对象
   */
  private convertMediaFileRecordToFileInter(record: MediaFileRecord): FileInter {
    return {
      Url: record.url,
      Name: record.name,
      Suffix: record.suffix,
      Size: record.size,
      info: {
        duration: record.duration || 0,
        artist: record.artist || '未知',
        album: record.album || '未知',
        quality: record.quality || '未知',
        resolution: record.resolution,
        picture: record.picture,
        lyrics: record.lyrics
      }
    };
  }

  /**
   * 序列化设置值
   */
  private serializeSettingValue(value: any): { stringValue: string; type: 'string' | 'number' | 'boolean' | 'object' } {
    if (typeof value === 'string') {
      return { stringValue: value, type: 'string' };
    } else if (typeof value === 'number') {
      return { stringValue: value.toString(), type: 'number' };
    } else if (typeof value === 'boolean') {
      return { stringValue: value.toString(), type: 'boolean' };
    } else {
      return { stringValue: JSON.stringify(value), type: 'object' };
    }
  }

  /**
   * 解析设置值
   */
  private parseSettingValue(value: string, type: string): any {
    switch (type) {
      case 'string':
        return value;
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true';
      case 'object':
        return JSON.parse(value);
      default:
        return value;
    }
  }

  /**
   * 执行数据库优化
   */
  async optimize(): Promise<void> {
    await databaseManager.optimize();
  }

  /**
   * 更新数据库统计
   */
  async updateStats(): Promise<void> {
    await databaseManager.updateDatabaseStats();
  }
}

// 导出单例实例
export const databaseService = DatabaseService.getInstance();
export default databaseService;