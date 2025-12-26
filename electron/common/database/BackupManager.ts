import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { performanceMonitor } from '../util/PerformanceMonitor';
import { errorHandler, ErrorType } from '../util/ErrorHandler';
import { databaseManager } from './DatabaseManager';
import { BackupInfo } from './types';
import crypto from 'crypto';

/**
 * 数据库备份和恢复管理器
 * 提供完整的数据库备份、恢复和管理功能
 */
export class BackupManager {
  private static readonly BACKUP_DIR = path.join(app.getPath('userData'), 'backups');
  private static readonly MAX_BACKUPS = 10;
  private static readonly BACKUP_VERSION = '1.0.0';

  constructor() {
    this.ensureBackupDirectory();
  }

  /**
   * 确保备份目录存在
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(BackupManager.BACKUP_DIR)) {
      fs.mkdirSync(BackupManager.BACKUP_DIR, { recursive: true });
      errorHandler.info(ErrorType.DATABASE, 'BACKUP_DIR_CREATED', `创建备份目录: ${BackupManager.BACKUP_DIR}`);
    }
  }

  /**
   * 创建数据库备份
   */
  async createBackup(description?: string): Promise<BackupInfo> {
    if (!databaseManager.isReady()) {
      throw new Error('数据库未连接，无法创建备份');
    }

    return await performanceMonitor.measureDatabaseOperation('backup', async () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = crypto.randomUUID().slice(0, 8);
      const filename = `backup-${backupId}-${timestamp}.db`;
      const backupPath = path.join(BackupManager.BACKUP_DIR, filename);

      try {
        // 获取数据库统计信息
        const stats = await databaseManager.getDatabaseStats();

        // 执行数据库备份（SQLite的VACUUM INTO命令）
        const db = databaseManager.getDb();
        // better-sqlite3 的 db.exec() 是同步方法
        db.exec(`VACUUM INTO '${backupPath}'`);

        // 获取备份文件信息
        const backupStats = fs.statSync(backupPath);

        // 创建备份元数据
        const backupInfo: BackupInfo = {
          id: backupId,
          filename,
          size: backupStats.size,
          created_at: new Date().toISOString(),
          file_count: stats.totalFiles,
          version: BackupManager.BACKUP_VERSION
        };

        // 保存备份元数据
        await this.saveBackupMetadata(backupInfo);

        // 清理旧备份
        await this.cleanupOldBackups();

        errorHandler.info(ErrorType.DATABASE, 'BACKUP_CREATED',
          `数据库备份完成: ${filename} (${this.formatFileSize(backupStats.size)})`);

        return backupInfo;
      } catch (error) {
        // 如果备份失败，清理可能创建的文件
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        errorHandler.error(ErrorType.DATABASE, 'BACKUP_FAILED', '数据库备份失败', error as Error);
        throw error;
      }
    });
  }

  /**
   * 恢复数据库备份
   */
  async restoreBackup(backupId: string): Promise<void> {
    return await performanceMonitor.measureDatabaseOperation('restore', async () => {
      const backupInfo = await this.getBackupInfo(backupId);
      if (!backupInfo) {
        throw new Error(`备份不存在: ${backupId}`);
      }

      // 检查备份版本兼容性
      if (!this.isBackupVersionCompatible(backupInfo.version)) {
        throw new Error(`不兼容的备份版本: ${backupInfo.version}`);
      }

      const backupPath = path.join(BackupManager.BACKUP_DIR, backupInfo.filename);
      if (!fs.existsSync(backupPath)) {
        throw new Error(`备份文件不存在: ${backupPath}`);
      }

      // 先创建当前数据库的备份
      try {
        await this.createBackup('恢复前自动备份');
      } catch (error) {
        errorHandler.warn(ErrorType.DATABASE, 'PRE_RESTORE_BACKUP_FAILED', '恢复前备份失败', error as Error);
      }

      // 关闭当前数据库连接
      await databaseManager.disconnect();

      try {
        // 备份当前数据库文件
        const dbPath = databaseManager.getConfig().path;
        const tempPath = `${dbPath}.temp`;

        if (fs.existsSync(dbPath)) {
          fs.copyFileSync(dbPath, tempPath);
        }

        // 恢复备份
        fs.copyFileSync(backupPath, dbPath);

        // 重新连接数据库并验证
        await databaseManager.connect();

        // 验证恢复的数据库
        const validation = await this.validateRestoredDatabase();
        if (!validation.isValid) {
          // 恢复失败，回滚
          await databaseManager.disconnect();
          if (fs.existsSync(tempPath)) {
            fs.copyFileSync(tempPath, dbPath);
          }
          await databaseManager.connect();

          throw new Error(`数据库恢复验证失败: ${validation.issues.join(', ')}`);
        }

        // 清理临时文件
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }

        errorHandler.info(ErrorType.DATABASE, 'BACKUP_RESTORED', `数据库恢复完成: ${backupInfo.filename}`);
      } catch (error) {
        // 确保数据库重新连接
        try {
          await databaseManager.connect();
        } catch (reconnectError) {
          errorHandler.error(ErrorType.DATABASE, 'DB_RECONNECT_FAILED', '数据库重新连接失败', reconnectError as Error);
        }
        throw error;
      }
    });
  }

  /**
   * 获取所有备份信息
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const metadataPath = path.join(BackupManager.BACKUP_DIR, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        return [];
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      return metadata.backups || [];
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'BACKUP_LIST_ERROR', '获取备份列表失败', error as Error);
      return [];
    }
  }

  /**
   * 获取特定备份信息
   */
  async getBackupInfo(backupId: string): Promise<BackupInfo | null> {
    const backups = await this.listBackups();
    return backups.find(backup => backup.id === backupId) || null;
  }

  /**
   * 删除备份
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const backupInfo = await this.getBackupInfo(backupId);
      if (!backupInfo) {
        return false;
      }

      const backupPath = path.join(BackupManager.BACKUP_DIR, backupInfo.filename);
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      // 更新元数据
      await this.removeBackupMetadata(backupId);

      errorHandler.info(ErrorType.DATABASE, 'BACKUP_DELETED', `备份已删除: ${backupInfo.filename}`);
      return true;
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'BACKUP_DELETE_ERROR', '删除备份失败', error as Error);
      return false;
    }
  }

  /**
   * 导出数据库到SQL文件
   */
  async exportToSQL(outputPath: string): Promise<void> {
    return await performanceMonitor.measureDatabaseOperation('export_sql', async () => {
      try {
        const db = databaseManager.getDb();

        // SQLite的.dump命令导出
        const sql = await db.export();

        fs.writeFileSync(outputPath, sql);

        errorHandler.info(ErrorType.DATABASE, 'SQL_EXPORTED', `数据库已导出到SQL文件: ${outputPath}`);
      } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'SQL_EXPORT_ERROR', '导出SQL文件失败', error as Error);
        throw error;
      }
    });
  }

  /**
   * 从SQL文件导入数据库
   */
  async importFromSQL(sqlPath: string): Promise<void> {
    return await performanceMonitor.measureDatabaseOperation('import_sql', async () => {
      if (!fs.existsSync(sqlPath)) {
        throw new Error(`SQL文件不存在: ${sqlPath}`);
      }

      try {
        // 先创建备份
        await this.createBackup('SQL导入前自动备份');

        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
        const db = databaseManager.getDb();

        // better-sqlite3 的 db.exec() 是同步方法
        db.exec(sqlContent);

        errorHandler.info(ErrorType.DATABASE, 'SQL_IMPORTED', `SQL文件导入完成: ${sqlPath}`);
      } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'SQL_IMPORT_ERROR', '导入SQL文件失败', error as Error);
        throw error;
      }
    });
  }

  /**
   * 保存备份元数据
   */
  private async saveBackupMetadata(backupInfo: BackupInfo): Promise<void> {
    const metadataPath = path.join(BackupManager.BACKUP_DIR, 'metadata.json');
    let metadata = { backups: [] as BackupInfo[] };

    try {
      if (fs.existsSync(metadataPath)) {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      }
    } catch (error) {
      errorHandler.warn(ErrorType.DATABASE, 'METADATA_READ_WARN', '读取备份元数据失败，将创建新的', error as Error);
    }

    metadata.backups.push(backupInfo);
    metadata.backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * 移除备份元数据
   */
  private async removeBackupMetadata(backupId: string): Promise<void> {
    const metadataPath = path.join(BackupManager.BACKUP_DIR, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      return;
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      metadata.backups = metadata.backups.filter((backup: BackupInfo) => backup.id !== backupId);

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'METADATA_REMOVE_ERROR', '移除备份元数据失败', error as Error);
    }
  }

  /**
   * 清理旧备份
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();

      if (backups.length <= BackupManager.MAX_BACKUPS) {
        return;
      }

      const backupsToDelete = backups.slice(BackupManager.MAX_BACKUPS);

      for (const backup of backupsToDelete) {
        await this.deleteBackup(backup.id);
      }

      errorHandler.info(ErrorType.DATABASE, 'OLD_BACKUPS_CLEANED', `已清理 ${backupsToDelete.length} 个旧备份`);
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'BACKUP_CLEANUP_ERROR', '清理旧备份失败', error as Error);
    }
  }

  /**
   * 检查备份版本兼容性
   */
  private isBackupVersionCompatible(backupVersion: string): boolean {
    // 简单的版本检查，实际项目中可能需要更复杂的兼容性检查
    const [backupMajor] = backupVersion.split('.').map(Number);
    const [currentMajor] = BackupManager.BACKUP_VERSION.split('.').map(Number);

    return backupMajor === currentMajor;
  }

  /**
   * 验证恢复的数据库
   */
  private async validateRestoredDatabase(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // 检查必需的表是否存在
      const requiredTables = ['media_files', 'media_categories', 'settings'];
      for (const table of requiredTables) {
        const exists = await databaseManager.tableExists(table);
        if (!exists) {
          issues.push(`缺少必需的表: ${table}`);
        }
      }

      // 检查数据库完整性
      const db = databaseManager.getDb();
      // better-sqlite3 需要先 prepare，然后 get
      const stmt = db.prepare('PRAGMA integrity_check');
      const integrityResult = stmt.get();

      if (integrityResult && integrityResult.integrity_check !== 'ok') {
        issues.push(`数据库完整性检查失败: ${integrityResult.integrity_check}`);
      }

      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error) {
      issues.push(`验证过程出错: ${(error as Error).message}`);
      return { isValid: false, issues };
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
   * 获取备份统计信息
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
  }> {
    try {
      const backups = await this.listBackups();

      if (backups.length === 0) {
        return {
          totalBackups: 0,
          totalSize: 0,
          oldestBackup: null,
          newestBackup: null
        };
      }

      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      const dates = backups.map(backup => backup.created_at);
      const oldestBackup = dates.length > 0 ? dates.sort()[0] : null;
      const newestBackup = dates.length > 0 ? dates.sort().reverse()[0] : null;

      return {
        totalBackups: backups.length,
        totalSize,
        oldestBackup,
        newestBackup
      };
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'BACKUP_STATS_ERROR', '获取备份统计失败', error as Error);
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null
      };
    }
  }
}

// 导出单例实例
export const backupManager = new BackupManager();
export default backupManager;