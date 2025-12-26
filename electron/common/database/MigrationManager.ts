import { performanceMonitor } from '../util/PerformanceMonitor';
import { errorHandler, ErrorType } from '../util/ErrorHandler';
import { databaseManager } from './DatabaseManager';
import { Migration } from './types';

/**
 * 数据库迁移管理器
 * 负责管理数据库版本和执行迁移脚本
 */
export class MigrationManager {
  private static readonly CURRENT_VERSION = '1.1.0';
  private migrations: Map<string, Migration> = new Map();

  constructor() {
    this.registerMigrations();
  }

  /**
   * 注册迁移脚本
   */
  private registerMigrations(): void {
    // 初始版本迁移
    this.addMigration({
      version: '1.0.0',
      description: '初始数据库结构',
      up: async (db) => {
        // 表结构在 DatabaseManager 中创建
        // 迁移记录由 recordMigration() 统一管理，这里不需要再次插入
      },
      down: async (db) => {
        // 降级逻辑（如果需要）
        db.exec('DELETE FROM schema_version WHERE version = "1.0.0"');
      }
    });

    // 版本 1.1.0：移除 file_hash 的 UNIQUE 约束，允许使用 UPSERT
    this.addMigration({
      version: '1.1.0',
      description: '移除 file_hash 唯一约束，支持增量更新',
      up: async (db) => {
        console.log('[Migration] 开始执行迁移 1.1.0: 移除 file_hash 唯一约束');

        // SQLite 不支持直接删除约束，需要重建表
        try {
          // 先删除可能存在的临时表
          db.exec('DROP TABLE IF EXISTS media_files_new');

          db.exec(`
            -- 创建新表（不带 file_hash UNIQUE 约束）
            CREATE TABLE media_files_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              url TEXT UNIQUE NOT NULL,
              name TEXT NOT NULL,
              suffix TEXT NOT NULL,
              size INTEGER NOT NULL,
              duration REAL DEFAULT 0,
              artist TEXT DEFAULT '未知',
              album TEXT DEFAULT '未知',
              quality TEXT DEFAULT '未知',
              resolution TEXT,
              picture TEXT,
              lyrics TEXT,
              file_hash TEXT NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- 复制数据
            INSERT INTO media_files_new
            SELECT id, url, name, suffix, size, duration, artist, album, quality, resolution, picture, lyrics, file_hash, created_at, updated_at
            FROM media_files;

            -- 删除旧表
            DROP TABLE media_files;

            -- 重命名新表
            ALTER TABLE media_files_new RENAME TO media_files;

            -- 重建索引
            CREATE INDEX IF NOT EXISTS idx_media_files_url ON media_files(url);
            CREATE INDEX IF NOT EXISTS idx_media_files_hash ON media_files(file_hash);
            CREATE INDEX IF NOT EXISTS idx_media_files_artist ON media_files(artist);
            CREATE INDEX IF NOT EXISTS idx_media_files_album ON media_files(album);
            CREATE INDEX IF NOT EXISTS idx_media_files_suffix ON media_files(suffix);
            CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at);
          `);

          console.log('[Migration] 迁移 1.1.0 完成: file_hash 唯一约束已移除');
        } catch (error) {
          console.error('[Migration] 迁移 1.1.0 失败:', error);
          throw error;
        }
      },
      down: async (db) => {
        // 降级：恢复 file_hash UNIQUE 约束
        db.exec('DROP TABLE IF EXISTS media_files_new');

        db.exec(`
          CREATE TABLE media_files_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            suffix TEXT NOT NULL,
            size INTEGER NOT NULL,
            duration REAL DEFAULT 0,
            artist TEXT DEFAULT '未知',
            album TEXT DEFAULT '未知',
            quality TEXT DEFAULT '未知',
            resolution TEXT,
            picture TEXT,
            lyrics TEXT,
            file_hash TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          INSERT INTO media_files_new
          SELECT * FROM media_files;

          DROP TABLE media_files;
          ALTER TABLE media_files_new RENAME TO media_files;

          CREATE INDEX IF NOT EXISTS idx_media_files_url ON media_files(url);
          CREATE INDEX IF NOT EXISTS idx_media_files_hash ON media_files(file_hash);
          CREATE INDEX IF NOT EXISTS idx_media_files_artist ON media_files(artist);
          CREATE INDEX IF NOT EXISTS idx_media_files_album ON media_files(album);
          CREATE INDEX IF NOT EXISTS idx_media_files_suffix ON media_files(suffix);
          CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at);
        `);
      }
    });
  }

  /**
   * 添加迁移
   */
  addMigration(migration: Migration): void {
    this.migrations.set(migration.version, migration);
  }

  /**
   * 获取当前数据库版本
   */
  async getCurrentVersion(): Promise<string | null> {
    try {
      const db = databaseManager.getDb();
      // better-sqlite3 需要先 prepare，然后 get
      const stmt = db.prepare('SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1');
      const result = stmt.get<{ version: string }>();
      return result?.version || null;
    } catch (error) {
      // 如果表不存在，说明是全新安装
      return null;
    }
  }

  /**
   * 检查是否需要迁移
   */
  async needsMigration(): Promise<boolean> {
    const currentVersion = await this.getCurrentVersion();
    return currentVersion !== MigrationManager.CURRENT_VERSION;
  }

  /**
   * 执行所有待执行的迁移
   */
  async runMigrations(): Promise<void> {
    if (!databaseManager.isReady()) {
      throw new Error('数据库未连接');
    }

    await performanceMonitor.measureDatabaseOperation('migration', async () => {
      const currentVersion = await this.getCurrentVersion();
      const db = databaseManager.getDb();

      if (!currentVersion) {
        // 全新安装，执行所有迁移
        errorHandler.info(ErrorType.MIGRATION, 'MIGRATION_FRESH_INSTALL', '全新安装，开始执行所有迁移');

        for (const [version, migration] of this.migrations) {
          try {
            await migration.up(db);
            this.recordMigration(version, migration.description);
            errorHandler.info(ErrorType.MIGRATION, 'MIGRATION_SUCCESS', `迁移完成: ${version} - ${migration.description}`);
          } catch (error) {
            errorHandler.error(ErrorType.MIGRATION, 'MIGRATION_FAILED', `迁移失败: ${version}`, error as Error);
            throw error;
          }
        }
      } else {
        // 版本升级，执行待执行的迁移
        const sortedVersions = Array.from(this.migrations.keys()).sort(this.compareVersions);
        const currentIndex = sortedVersions.indexOf(currentVersion);

        if (currentIndex === -1) {
          throw new Error(`未知的数据库版本: ${currentVersion}`);
        }

        const pendingMigrations = sortedVersions.slice(currentIndex + 1);

        if (pendingMigrations.length === 0) {
          errorHandler.info(ErrorType.MIGRATION, 'MIGRATION_UP_TO_DATE', '数据库已是最新版本');
          return;
        }

        errorHandler.info(ErrorType.MIGRATION, 'MIGRATION_UPGRADE', `开始升级数据库: ${currentVersion} -> ${MigrationManager.CURRENT_VERSION}`);

        for (const version of pendingMigrations) {
          const migration = this.migrations.get(version)!;
          try {
            await migration.up(db);
            this.recordMigration(version, migration.description);
            errorHandler.info(ErrorType.MIGRATION, 'MIGRATION_SUCCESS', `迁移完成: ${version} - ${migration.description}`);
          } catch (error) {
            errorHandler.error(ErrorType.MIGRATION, 'MIGRATION_FAILED', `迁移失败: ${version}`, error as Error);
            throw error;
          }
        }
      }
    });
  }

  /**
   * 记录迁移执行
   */
  private recordMigration(version: string, description: string): void {
    const db = databaseManager.getDb();
    // better-sqlite3 的 prepare().run() 是同步的
    // 使用 INSERT OR REPLACE 避免重复键问题
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO schema_version (version, description, applied_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    );
    stmt.run(version, description);
  }

  /**
   * 版本比较函数
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }

    return 0;
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(targetVersion: string): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    if (!currentVersion) {
      throw new Error('无法回滚：当前没有版本信息');
    }

    if (this.compareVersions(currentVersion, targetVersion) <= 0) {
      throw new Error(`无法回滚：目标版本 ${targetVersion} 不低于当前版本 ${currentVersion}`);
    }

    const sortedVersions = Array.from(this.migrations.keys()).sort(this.compareVersions);
    const currentIndex = sortedVersions.indexOf(currentVersion);
    const targetIndex = sortedVersions.indexOf(targetVersion);

    if (targetIndex === -1) {
      throw new Error(`未知的回滚目标版本: ${targetVersion}`);
    }

    const rollbackVersions = sortedVersions.slice(targetIndex + 1, currentIndex + 1).reverse();

    await performanceMonitor.measureDatabaseOperation('rollback', async () => {
      const db = databaseManager.getDb();

      for (const version of rollbackVersions) {
        const migration = this.migrations.get(version)!;
        try {
          await migration.down(db);
          // better-sqlite3 的 prepare().run() 是同步的
          const stmt = db.prepare('DELETE FROM schema_version WHERE version = ?');
          stmt.run(version);
          errorHandler.info(ErrorType.MIGRATION, 'ROLLBACK_SUCCESS', `回滚完成: ${version}`);
        } catch (error) {
          errorHandler.error(ErrorType.MIGRATION, 'ROLLBACK_FAILED', `回滚失败: ${version}`, error as Error);
          throw error;
        }
      }
    });
  }

  /**
   * 获取迁移历史
   */
  async getMigrationHistory(): Promise<Array<{ version: string; description: string; applied_at: string }>> {
    const db = databaseManager.getDb();
    // better-sqlite3 需要先 prepare，然后 all
    const stmt = db.prepare(`
      SELECT version, description, applied_at
      FROM schema_version
      ORDER BY applied_at ASC
    `);
    return stmt.all() as Array<{ version: string; description: string; applied_at: string }>;
  }

  /**
   * 验证数据库结构
   */
  async validateDatabase(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const db = databaseManager.getDb();

      // 检查必需的表是否存在
      const requiredTables = ['media_files', 'media_categories', 'settings', 'schema_version'];
      for (const table of requiredTables) {
        // better-sqlite3 需要先 prepare，然后 get
        const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
        const result = stmt.get(table);
        if (!result) {
          issues.push(`缺少必需的表: ${table}`);
        }
      }

      // 检查版本信息
      const version = await this.getCurrentVersion();
      if (!version) {
        issues.push('缺少数据库版本信息');
      } else if (this.compareVersions(version, MigrationManager.CURRENT_VERSION) < 0) {
        issues.push(`数据库版本过低: ${version} < ${MigrationManager.CURRENT_VERSION}`);
      }

      // 检查外键约束
      // better-sqlite3 需要先 prepare，然后 get
      const fkStmt = db.prepare('PRAGMA foreign_key_check');
      const foreignKeyCheck = fkStmt.get();
      if (foreignKeyCheck) {
        issues.push('存在外键约束违规');
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
}

// 导出单例实例
export const migrationManager = new MigrationManager();
export default migrationManager;