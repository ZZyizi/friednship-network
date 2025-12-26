import fs from 'fs';
import path from 'path';
import { performanceMonitor } from '../util/PerformanceMonitor';
import { errorHandler, ErrorType } from '../util/ErrorHandler';
import { databaseManager } from './DatabaseManager';
import { FileInter, ClassifyType, configType } from '../../api/medium/type';
import { BatchResult, MigrationProgress } from './types';

/**
 * JSON 到 SQLite 数据迁移器
 * 负责将现有的 JSON 文件数据迁移到 SQLite 数据库
 */
export class JsonToSQLiteMigrator {
  private jsonFilesPath: string;
  private isMigrating = false;
  private migrationProgress: MigrationProgress = {
    totalFiles: 0,
    processedFiles: 0,
    errors: [],
    status: 'idle'
  };

  constructor(jsonFilesPath: string) {
    this.jsonFilesPath = jsonFilesPath;
  }

  /**
   * 检查是否存在需要迁移的 JSON 数据
   */
  async hasJsonData(): Promise<boolean> {
    try {
      const fileCachePath = path.join(this.jsonFilesPath, 'fileCache.json');
      const classifyTypePath = path.join(this.jsonFilesPath, 'classifyType.json');
      const configPath = path.join(this.jsonFilesPath, 'config.json');

      const hasFileCache = fs.existsSync(fileCachePath) && fs.statSync(fileCachePath).size > 0;
      const hasClassifyType = fs.existsSync(classifyTypePath) && fs.statSync(classifyTypePath).size > 0;
      const hasConfig = fs.existsSync(configPath);

      return hasFileCache || hasClassifyType || hasConfig;
    } catch (error) {
      errorHandler.error(ErrorType.MIGRATION, 'JSON_DATA_CHECK_ERROR', '检查JSON数据失败', error as Error);
      return false;
    }
  }

  /**
   * 获取迁移进度
   */
  getMigrationProgress(): MigrationProgress {
    return { ...this.migrationProgress };
  }

  /**
   * 执行完整迁移
   */
  async migrate(): Promise<void> {
    if (this.isMigrating) {
      throw new Error('迁移正在进行中');
    }

    if (!databaseManager.isReady()) {
      throw new Error('数据库未连接');
    }

    this.isMigrating = true;
    this.migrationProgress = {
      totalFiles: 0,
      processedFiles: 0,
      errors: [],
      status: 'running'
    };

    try {
      await performanceMonitor.measureDatabaseOperation('json_to_sqlite_migration', async () => {
        errorHandler.info(ErrorType.MIGRATION, 'MIGRATION_STARTED', '开始JSON到SQLite迁移');

        // 1. 迁移媒体文件数据
        await this.migrateMediaFiles();

        // 2. 迁移分类数据
        await this.migrateCategories();

        // 3. 迁移配置数据
        await this.migrateSettings();

        // 4. 更新数据库统计
        await databaseManager.updateDatabaseStats();

        this.migrationProgress.status = 'completed';
        errorHandler.info(ErrorType.MIGRATION, 'MIGRATION_COMPLETED', 'JSON到SQLite迁移完成');
      });
    } catch (error) {
      this.migrationProgress.status = 'failed';
      this.migrationProgress.errors.push(`迁移失败: ${(error as Error).message}`);
      errorHandler.error(ErrorType.MIGRATION, 'MIGRATION_FAILED', 'JSON到SQLite迁移失败', error as Error);
      throw error;
    } finally {
      this.isMigrating = false;
    }
  }

  /**
   * 迁移媒体文件数据
   */
  private async migrateMediaFiles(): Promise<void> {
    const fileCachePath = path.join(this.jsonFilesPath, 'fileCache.json');

    if (!fs.existsSync(fileCachePath)) {
      errorHandler.info(ErrorType.MIGRATION, 'NO_MEDIA_FILES', '未找到媒体文件缓存JSON');
      return;
    }

    try {
      const data = fs.readFileSync(fileCachePath, 'utf-8');
      const files: FileInter[] = JSON.parse(data);

      if (!Array.isArray(files) || files.length === 0) {
        errorHandler.info(ErrorType.MIGRATION, 'EMPTY_MEDIA_FILES', '媒体文件缓存为空');
        return;
      }

      this.migrationProgress.totalFiles = files.length;
      this.migrationProgress.status = 'processing';

      // 分批处理以避免内存问题
      const batchSize = 1000;
      let processedCount = 0;

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const result = await this.migrateMediaFilesBatch(batch);

        processedCount += result.success;
        this.migrationProgress.processedFiles = processedCount;

        if (result.failed > 0) {
          this.migrationProgress.errors.push(...result.errors);
          errorHandler.warn(ErrorType.MIGRATION, 'BATCH_ERRORS', `批次迁移错误: ${result.errors.length} 个`);
        }

        // 发送进度更新
        errorHandler.info(ErrorType.MIGRATION, 'BATCH_COMPLETED',
          `批次完成: ${processedCount}/${files.length} (${Math.round(processedCount / files.length * 100)}%)`);
      }

      errorHandler.info(ErrorType.MIGRATION, 'MEDIA_FILES_MIGRATED',
        `媒体文件迁移完成: ${processedCount} 成功, ${files.length - processedCount} 失败`);

    } catch (error) {
      this.migrationProgress.errors.push(`媒体文件迁移失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 批量迁移媒体文件
   */
  private async migrateMediaFilesBatch(files: FileInter[]): Promise<BatchResult> {
    const result: BatchResult = { success: 0, failed: 0, errors: [] };

    const mediaFileRecords = files.map(file => {
      try {
        // 生成文件哈希
        const fileHash = this.generateFileHash(file.Url);

        return {
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
      } catch (error) {
        result.failed++;
        result.errors.push(`${file.Url}: ${(error as Error).message}`);
        return null;
      }
    }).filter(record => record !== null);

    if (mediaFileRecords.length > 0) {
      const batchResult = await databaseManager.insertMediaFiles(mediaFileRecords);
      result.success = batchResult.success;
      result.failed += batchResult.failed;
      result.errors.push(...batchResult.errors);
    }

    return result;
  }

  /**
   * 迁移分类数据
   */
  private async migrateCategories(): Promise<void> {
    const classifyTypePath = path.join(this.jsonFilesPath, 'classifyType.json');

    if (!fs.existsSync(classifyTypePath)) {
      errorHandler.info(ErrorType.MIGRATION, 'NO_CATEGORIES', '未找到分类JSON文件');
      return;
    }

    try {
      const data = fs.readFileSync(classifyTypePath, 'utf-8');
      const categories: ClassifyType[] = JSON.parse(data);

      if (!Array.isArray(categories) || categories.length === 0) {
        errorHandler.info(ErrorType.MIGRATION, 'EMPTY_CATEGORIES', '分类数据为空');
        return;
      }

      let successCount = 0;

      for (const category of categories) {
        try {
          await databaseManager.insertMediaCategory({
            year: category.year,
            month: category.month,
            day: category.day,
            prepose: category.prepose,
            picture: category.picture
          });
          successCount++;
        } catch (error) {
          this.migrationProgress.errors.push(`分类迁移失败 ${category.prepose}: ${(error as Error).message}`);
        }
      }

      errorHandler.info(ErrorType.MIGRATION, 'CATEGORIES_MIGRATED',
        `分类迁移完成: ${successCount}/${categories.length} 成功`);

    } catch (error) {
      this.migrationProgress.errors.push(`分类迁移失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 迁移配置数据
   */
  private async migrateSettings(): Promise<void> {
    const configPath = path.join(this.jsonFilesPath, 'config.json');

    if (!fs.existsSync(configPath)) {
      errorHandler.info(ErrorType.MIGRATION, 'NO_SETTINGS', '未找到配置JSON文件');
      return;
    }

    try {
      const data = fs.readFileSync(configPath, 'utf-8');
      const config: configType = JSON.parse(data);

      // 迁移各个配置项
      const settingsMap: Array<[string, any, string]> = [
        ['theme', config.theme, 'string'],
        ['scanOnStartup', config.scanOnStartup, 'boolean'],
        ['scanInterval', config.scanInterval, 'number'],
        ['port', config.port, 'number'],
        ['autoPlay', config.autoPlay, 'boolean'],
        ['defaultVolume', config.defaultVolume, 'number'],
        ['rememberLastPlayed', config.rememberLastPlayed, 'boolean'],
        ['showTray', config.showTray, 'boolean'],
        ['minimization', config.minimization, 'boolean'],
        ['isRole', config.isRole, 'boolean'],
        ['scanPaths', JSON.stringify(config.scanPaths), 'object'],
        ['password', config.password || '', 'string']
      ];

      for (const [key, value, type] of settingsMap) {
        try {
          const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
          await databaseManager.setSetting(key, stringValue, type as any);
        } catch (error) {
          this.migrationProgress.errors.push(`设置迁移失败 ${key}: ${(error as Error).message}`);
        }
      }

      errorHandler.info(ErrorType.MIGRATION, 'SETTINGS_MIGRATED', '配置数据迁移完成');

    } catch (error) {
      this.migrationProgress.errors.push(`配置迁移失败: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 生成文件哈希
   */
  private generateFileHash(filePath: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    hash.update(filePath);
    return hash.digest('hex');
  }

  /**
   * 验证迁移结果
   */
  async validateMigration(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // 检查数据完整性
      const stats = await databaseManager.getDatabaseStats();

      if (stats.totalFiles === 0) {
        issues.push('数据库中没有媒体文件记录');
      }

      if (stats.settings === 0) {
        issues.push('数据库中没有设置记录');
      }

      // 检查数据一致性
      const duplicateUrls = databaseManager.getDb().prepare(`
        SELECT url, COUNT(*) as count
        FROM media_files
        GROUP BY url
        HAVING count > 1
      `).all();

      if (duplicateUrls.length > 0) {
        issues.push(`发现 ${duplicateUrls.length} 个重复的URL记录`);
      }

      const duplicateHashes = databaseManager.getDb().prepare(`
        SELECT file_hash, COUNT(*) as count
        FROM media_files
        GROUP BY file_hash
        HAVING count > 1
      `).all();

      if (duplicateHashes.length > 0) {
        issues.push(`发现 ${duplicateHashes.length} 个重复的文件哈希记录`);
      }

      // 检查必要的外键关系
      const orphanedFiles = databaseManager.getDb().prepare(`
        SELECT COUNT(*) as count FROM media_files mf
        LEFT JOIN media_categories mc ON mf.picture = mc.picture
        WHERE mf.picture IS NOT NULL AND mf.picture != '' AND mc.id IS NULL
      `).all();

      if (orphanedFiles[0].count > 0) {
        issues.push(`发现 ${orphanedFiles[0].count} 个孤立图片引用`);
      }

      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error) {
      issues.push(`验证过程中出错: ${(error as Error).message}`);
      return { isValid: false, issues };
    }
  }

  /**
   * 清理迁移后的 JSON 文件（可选）
   */
  async cleanupJsonFiles(backup: boolean = true): Promise<void> {
    if (!backup) {
      throw new Error('为安全起见，必须先备份JSON文件');
    }

    try {
      const backupDir = path.join(this.jsonFilesPath, 'backup', new Date().toISOString().replace(/[:.]/g, '-'));

      // 创建备份目录
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // 备份文件
      const filesToBackup = ['fileCache.json', 'classifyType.json', 'config.json'];

      for (const file of filesToBackup) {
        const sourcePath = path.join(this.jsonFilesPath, file);
        if (fs.existsSync(sourcePath)) {
          const backupPath = path.join(backupDir, file);
          fs.copyFileSync(sourcePath, backupPath);

          // 删除原文件
          fs.unlinkSync(sourcePath);

          errorHandler.info(ErrorType.MIGRATION, 'FILE_BACKUPED', `文件已备份并删除: ${file}`);
        }
      }

      errorHandler.info(ErrorType.MIGRATION, 'JSON_CLEANUP_COMPLETED', `JSON文件清理完成，备份位置: ${backupDir}`);
    } catch (error) {
      errorHandler.error(ErrorType.MIGRATION, 'JSON_CLEANUP_ERROR', 'JSON文件清理失败', error as Error);
      throw error;
    }
  }

  /**
   * 重置迁移状态
   */
  reset(): void {
    this.isMigrating = false;
    this.migrationProgress = {
      totalFiles: 0,
      processedFiles: 0,
      errors: [],
      status: 'idle'
    };
  }
}

export default JsonToSQLiteMigrator;