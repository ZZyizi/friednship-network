import Database from 'better-sqlite3';

declare module 'better-sqlite3' {
  interface Database {
    pragma(sql: string): any;
  }
}
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { performanceMonitor } from '../util/PerformanceMonitor';
import { errorHandler, ErrorType } from '../util/ErrorHandler';
import {
  DatabaseConfig,
  MediaFileRecord,
  MediaCategoryRecord,
  SettingsRecord,
  QueryOptions,
  SearchOptions,
  BatchResult,
  DatabaseStats,
  TableInfo,
  IndexInfo
} from './types';

/**
 * SQLite 数据库管理器 (better-sqlite3版本)
 * 提供完整的数据库操作接口，包括连接管理、事务支持、备份恢复等
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database | null = null;
  private config: DatabaseConfig;
  private isConnected = false;

  // 默认配置
  private static readonly DEFAULT_CONFIG: DatabaseConfig = {
    path: path.join(app.getPath('userData'), 'media_data', 'friendship-network.db'),
    maxConnections: 10,
    busyTimeout: 30000,
    enableWAL: true,
    enableForeignKeys: true
  };

  private constructor(config?: Partial<DatabaseConfig>) {
    this.config = { ...DatabaseManager.DEFAULT_CONFIG, ...config };
    this.ensureDatabaseDirectory();
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<DatabaseConfig>): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(config);
    }
    return DatabaseManager.instance;
  }

  /**
   * 确保数据库目录存在
   */
  private ensureDatabaseDirectory(): void {
    const dbDir = path.dirname(this.config.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      errorHandler.info(ErrorType.DATABASE, 'DB_DIR_CREATED', `创建数据库目录: ${dbDir}`);
    }
  }

  /**
   * 连接到数据库
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.db) {
      console.log('[Database] 数据库已连接，跳过重复连接');
      return;
    }

    try {
      await performanceMonitor.measureDatabaseOperation('connect', async () => {
        // 输出数据库路径用于调试
        console.log('[Database] 正在连接数据库:', this.config.path);
        console.log('[Database] userData 目录:', app.getPath('userData'));

        this.db = new Database(this.config.path);

        // 配置数据库
        this.db.pragma('foreign_keys = ' + (this.config.enableForeignKeys ? 'ON' : 'OFF'));
        this.db.pragma('busy_timeout = ' + this.config.busyTimeout);

        if (this.config.enableWAL) {
          this.db.pragma('journal_mode = WAL');
        }

        // 创建表结构
        this.createTables();
        this.createIndexes();

        this.isConnected = true;

        // 检查现有数据
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM media_files');
        const result = stmt.get() as { count: number };
        console.log('[Database] 数据库连接成功，当前媒体文件数量:', result.count);

        errorHandler.info(ErrorType.DATABASE, 'DB_CONNECTED', `数据库连接成功: ${this.config.path}`);
      });
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'DB_CONNECT_ERROR', '数据库连接失败', error as Error);
      throw error;
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<void> {
    if (this.db) {
      await performanceMonitor.measureDatabaseOperation('disconnect', async () => {
        this.db!.close();
        this.db = null;
        this.isConnected = false;

        errorHandler.info(ErrorType.DATABASE, 'DB_DISCONNECTED', '数据库连接已断开');
      });
    }
  }

  /**
   * 检查数据库是否连接
   */
  isReady(): boolean {
    return this.isConnected && this.db !== null;
  }

  /**
   * 创建数据库表结构
   */
  private createTables(): void {
    const tables = [
      // 媒体文件表
      `CREATE TABLE IF NOT EXISTS media_files (
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
      )`,

      // 媒体分类表
      `CREATE TABLE IF NOT EXISTS media_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year TEXT NOT NULL,
        month TEXT NOT NULL,
        day TEXT NOT NULL,
        prepose TEXT NOT NULL,
        picture TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month, day, prepose)
      )`,

      // 系统设置表
      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'string',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // 数据库版本表
      `CREATE TABLE IF NOT EXISTS schema_version (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      )`,

      // 数据库统计表
      `CREATE TABLE IF NOT EXISTS database_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stat_key TEXT UNIQUE NOT NULL,
        stat_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      this.db!.exec(sql);
    }

    errorHandler.info(ErrorType.DATABASE, 'DB_TABLES_CREATED', '数据库表结构创建完成');
  }

  /**
   * 创建索引
   */
  private createIndexes(): void {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_media_files_url ON media_files(url)',
      'CREATE INDEX IF NOT EXISTS idx_media_files_hash ON media_files(file_hash)',
      'CREATE INDEX IF NOT EXISTS idx_media_files_artist ON media_files(artist)',
      'CREATE INDEX IF NOT EXISTS idx_media_files_album ON media_files(album)',
      'CREATE INDEX IF NOT EXISTS idx_media_files_suffix ON media_files(suffix)',
      'CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_media_categories_prepose ON media_categories(prepose)',
      'CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)'
    ];

    for (const sql of indexes) {
      this.db!.exec(sql);
    }

    errorHandler.info(ErrorType.DATABASE, 'DB_INDEXES_CREATED', '数据库索引创建完成');
  }

  /**
   * 执行事务
   */
  async transaction<T>(fn: (db: Database) => T): Promise<T> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    return await performanceMonitor.measureDatabaseOperation('transaction', async () => {
      try {
        this.db!.exec('BEGIN TRANSACTION');
        const result = fn(this.db!);
        this.db!.exec('COMMIT');
        return result;
      } catch (error) {
        this.db!.exec('ROLLBACK');
        errorHandler.error(ErrorType.DATABASE, 'DB_TRANSACTION_ERROR', '事务执行失败', error as Error);
        throw error;
      }
    });
  }

  /**
   * 插入媒体文件
   */
  async insertMediaFile(file: Omit<MediaFileRecord, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    return await this.transaction(async (db) => {
      const stmt = db.prepare(`
        INSERT INTO media_files (url, name, suffix, size, duration, artist, album, quality, resolution, picture, lyrics, file_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        file.url,
        file.name,
        file.suffix,
        file.size,
        file.duration || 0,
        file.artist || '未知',
        file.album || '未知',
        file.quality || '未知',
        file.resolution,
        file.picture,
        file.lyrics,
        file.file_hash
      );

      return result.lastInsertRowid as number;
    });
  }

  /**
   * 批量插入媒体文件
   * 使用 UPSERT 策略：如果文件已存在（基于 URL），则更新指定字段
   * 保留原有的 id 和 created_at，不删除旧记录
   */
  async insertMediaFiles(files: Omit<MediaFileRecord, 'id' | 'created_at' | 'updated_at'>[]): Promise<BatchResult> {
    const result: BatchResult = { success: 0, failed: 0, errors: [] };
    const stats = { inserted: 0, updated: 0, failed: 0 };

    await this.transaction(async (db) => {
      // 使用 INSERT ... ON CONFLICT DO UPDATE（UPSERT）
      // 当 URL 冲突时，更新除 id、created_at、url、file_hash 外的所有字段
      const stmt = db.prepare(`
        INSERT INTO media_files (url, name, suffix, size, duration, artist, album, quality, resolution, picture, lyrics, file_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
          name = excluded.name,
          suffix = excluded.suffix,
          size = excluded.size,
          duration = excluded.duration,
          artist = excluded.artist,
          album = excluded.album,
          quality = excluded.quality,
          resolution = excluded.resolution,
          picture = excluded.picture,
          lyrics = excluded.lyrics,
          file_hash = excluded.file_hash,
          updated_at = CURRENT_TIMESTAMP
      `);

      for (const file of files) {
        try {
          const info = stmt.run(
            file.url,
            file.name,
            file.suffix,
            file.size,
            file.duration || 0,
            file.artist || '未知',
            file.album || '未知',
            file.quality || '未知',
            file.resolution,
            file.picture,
            file.lyrics,
            file.file_hash
          );

          // changes = 1 表示插入，= 2 表示更新
          if (info.changes === 1) {
            stats.inserted++;
          } else if (info.changes === 2) {
            stats.updated++;
          }
          result.success++;
        } catch (error: any) {
          result.failed++;
          stats.failed++;
          const errorMsg = (error as Error).message;
          result.errors.push(`${file.name}: ${errorMsg}`);
        }
      }
    });

    // 输出详细统计信息
    console.log(`[数据库] 保存完成: 插入 ${stats.inserted} 条, 更新 ${stats.updated} 条, 失败 ${stats.failed} 条`);

    if (result.failed > 0 && result.errors.length > 0) {
      const displayErrors = result.errors.slice(0, 10);
      console.log(`[数据库] 失败详情 (前 ${displayErrors.length} 条):`);
      displayErrors.forEach(err => console.log(`  - ${err}`));

      if (result.errors.length > 10) {
        console.log(`[数据库] ... 还有 ${result.errors.length - 10} 条错误未显示`);
      }
    }

    return result;
  }

  /**
   * 查询媒体文件
   */
  async getMediaFiles(options: SearchOptions = {}): Promise<MediaFileRecord[]> {
    const { keyword, artist, album, category, fileType, minDuration, maxDuration, minSize, maxSize, dateRange, queryOptions } = options;

    let whereConditions: string[] = [];
    let params: any[] = [];

    // 构建查询条件
    if (keyword) {
      whereConditions.push('(name LIKE ? OR artist LIKE ? OR album LIKE ?)');
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam, keywordParam);
    }

    if (artist) {
      whereConditions.push('artist = ?');
      params.push(artist);
    }

    if (album) {
      whereConditions.push('album = ?');
      params.push(album);
    }

    if (fileType) {
      const musicTypes = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.ape', '.aiff', '.opus'];
      const videoTypes = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.rmvb', '.webm'];
      const targetTypes = fileType === 'music' ? musicTypes : videoTypes;

      whereConditions.push(`suffix IN (${targetTypes.map(() => '?').join(', ')})`);
      params.push(...targetTypes);
    }

    if (minDuration !== undefined) {
      whereConditions.push('duration >= ?');
      params.push(minDuration);
    }

    if (maxDuration !== undefined) {
      whereConditions.push('duration <= ?');
      params.push(maxDuration);
    }

    if (minSize !== undefined) {
      whereConditions.push('size >= ?');
      params.push(minSize);
    }

    if (maxSize !== undefined) {
      whereConditions.push('size <= ?');
      params.push(maxSize);
    }

    if (dateRange) {
      whereConditions.push('created_at BETWEEN ? AND ?');
      params.push(dateRange.start, dateRange.end);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const limitClause = queryOptions?.limit ? `LIMIT ${queryOptions.limit}` : '';
    const offsetClause = queryOptions?.offset ? `OFFSET ${queryOptions.offset}` : '';
    const orderClause = queryOptions?.orderBy ?
      `ORDER BY ${queryOptions.orderBy} ${queryOptions.orderDirection || 'ASC'}` :
      'ORDER BY created_at DESC';

    const sql = `
      SELECT * FROM media_files
      ${whereClause}
      ${orderClause}
      ${limitClause}
      ${offsetClause}
    `;

    return await performanceMonitor.measureDatabaseOperation('query', async () => {
      const stmt = this.db!.prepare(sql);
      return stmt.all(...params) as MediaFileRecord[];
    });
  }

  /**
   * 根据URL获取媒体文件
   */
  async getMediaFileByUrl(url: string): Promise<MediaFileRecord | null> {
    const stmt = this.db!.prepare('SELECT * FROM media_files WHERE url = ?');
    const result = stmt.get(url) as MediaFileRecord;
    return result || null;
  }

  /**
   * 根据哈希获取媒体文件
   */
  async getMediaFileByHash(hash: string): Promise<MediaFileRecord | null> {
    const stmt = this.db!.prepare('SELECT * FROM media_files WHERE file_hash = ?');
    const result = stmt.get(hash) as MediaFileRecord;
    return result || null;
  }

  /**
   * 更新媒体文件
   */
  async updateMediaFile(url: string, updates: Partial<MediaFileRecord>): Promise<boolean> {
    const fields = Object.keys(updates).filter(key => key !== 'id' && key !== 'created_at');
    if (fields.length === 0) return false;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => (updates as any)[field]);
    values.push(url);

    const sql = `UPDATE media_files SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE url = ?`;
    const stmt = this.db!.prepare(sql);
    const result = stmt.run(...values);

    return result.changes > 0;
  }

  /**
   * 删除媒体文件
   */
  async deleteMediaFile(url: string): Promise<boolean> {
    const stmt = this.db!.prepare('DELETE FROM media_files WHERE url = ?');
    const result = stmt.run(url);
    return result.changes > 0;
  }

  /**
   * 批量删除不存在的文件
   */
  async cleanupNonExistentFiles(): Promise<number> {
    return await performanceMonitor.measureDatabaseOperation('cleanup', async () => {
      const stmt = this.db!.prepare('SELECT url FROM media_files');
      const files = stmt.all() as Array<{ url: string }>;
      let deletedCount = 0;

      for (const file of files) {
        if (!fs.existsSync(file.url)) {
          await this.deleteMediaFile(file.url);
          deletedCount++;
        }
      }

      return deletedCount;
    });
  }

  /**
   * 插入媒体分类
   */
  async insertMediaCategory(category: Omit<MediaCategoryRecord, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    return await this.transaction(async (db) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO media_categories (year, month, day, prepose, picture)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        category.year,
        category.month,
        category.day,
        category.prepose,
        category.picture
      );

      return result.lastInsertRowid as number;
    });
  }

  /**
   * 获取媒体分类
   */
  async getMediaCategories(): Promise<MediaCategoryRecord[]> {
    const stmt = this.db!.prepare('SELECT * FROM media_categories ORDER BY year DESC, month DESC, day DESC');
    return stmt.all() as MediaCategoryRecord[];
  }

  /**
   * 清理未使用的分类
   * 注意：此功能暂时简化，因为SQLite的INSTR函数与MySQL不同
   * 目前保留所有分类，未来可以实现更复杂的路径解析
   */
  async cleanupUnusedClassifications(): Promise<number> {
    // 简化版本：直接删除没有关联媒体文件的分类
    const stmt = this.db!.prepare(`
      DELETE FROM media_categories
      WHERE id NOT IN (
        SELECT DISTINCT CASE
          WHEN mf.picture IS NOT NULL AND mf.picture != '' THEN (
            SELECT mc.id FROM media_categories mc WHERE mc.picture = mf.picture LIMIT 1
          )
          ELSE NULL
        END
        FROM media_files mf
        WHERE mf.picture IS NOT NULL AND mf.picture != ''
      )
    `);

    const result = stmt.run();
    return result.changes;
  }

  /**
   * 获取或插入设置
   */
  async getSetting(key: string): Promise<SettingsRecord | null> {
    const stmt = this.db!.prepare('SELECT * FROM settings WHERE key = ?');
    const result = stmt.get(key) as SettingsRecord;
    return result || null;
  }

  async setSetting(key: string, value: string, type: 'string' | 'number' | 'boolean' | 'object' = 'string', description?: string): Promise<void> {
    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO settings (key, value, type, description, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(key, value, type, description);
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    const stats = await Promise.all([
      this.db!.prepare('SELECT COUNT(*) as count FROM media_files').get() as { count: number },
      this.db!.prepare('SELECT SUM(size) as sum FROM media_files').get() as { sum: number | null },
      this.db!.prepare(`SELECT COUNT(*) as count FROM media_files WHERE suffix IN ('.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.ape', '.aiff', '.opus')`).get() as { count: number },
      this.db!.prepare(`SELECT COUNT(*) as count FROM media_files WHERE suffix IN ('.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.rmvb', '.webm')`).get() as { count: number },
      this.db!.prepare('SELECT COUNT(*) as count FROM media_categories').get() as { count: number },
      this.db!.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number },
      this.db!.prepare('SELECT MAX(created_at) as max_date FROM media_files').get() as { max_date: string | null }
    ]);

    return {
      totalFiles: stats[0].count,
      totalSize: stats[1]?.sum || 0,
      musicFiles: stats[2].count,
      videoFiles: stats[3].count,
      categories: stats[4].count,
      settings: stats[5].count,
      lastScanned: stats[6]?.max_date || null
    };
  }

  /**
   * 更新数据库统计信息
   */
  async updateDatabaseStats(): Promise<void> {
    const stats = await this.getDatabaseStats();

    await this.transaction(async (db) => {
      const deleteStmt = db.prepare('DELETE FROM database_stats');
      deleteStmt.run();

      const insertStmt = db.prepare('INSERT INTO database_stats (stat_key, stat_value) VALUES (?, ?)');

      insertStmt.run('total_files', stats.totalFiles.toString());
      insertStmt.run('total_size', stats.totalSize.toString());
      insertStmt.run('music_files', stats.musicFiles.toString());
      insertStmt.run('video_files', stats.videoFiles.toString());
      insertStmt.run('categories', stats.categories.toString());
      insertStmt.run('settings', stats.settings.toString());
      if (stats.lastScanned) {
        insertStmt.run('last_scanned', stats.lastScanned);
      }
    });
  }

  /**
   * 优化数据库
   */
  async optimize(): Promise<void> {
    await performanceMonitor.measureDatabaseOperation('optimize', async () => {
      this.db!.exec('VACUUM');
      this.db!.exec('ANALYZE');
      errorHandler.info(ErrorType.DATABASE, 'DB_OPTIMIZED', '数据库优化完成');
    });
  }

  /**
   * 获取表信息
   */
  async getTableInfo(tableName: string): Promise<TableInfo | null> {
    try {
      // 获取列信息
      const columns = this.db!.prepare(`PRAGMA table_info(${tableName})`).all() as any[];

      // 获取索引信息
      const indexes = this.db!.prepare(`PRAGMA index_list(${tableName})`).all() as any[];

      // 获取行数
      const rowCount = this.db!.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };

      return {
        name: tableName,
        columns: columns.map(col => ({
          name: col.name,
          type: col.type,
          nullable: !col.notnull,
          defaultValue: col.dflt_value,
          primaryKey: col.pk > 0,
          autoIncrement: col.pk > 0 && col.type.toUpperCase().includes('INT')
        })),
        indexes: indexes.map(idx => ({
          name: idx.name,
          table: tableName,
          columns: [], // 需要额外查询
          unique: idx.unique === 1
        })),
        rowCount: rowCount.count
      };
    } catch (error) {
      errorHandler.error(ErrorType.DATABASE, 'DB_TABLE_INFO_ERROR', `获取表信息失败: ${tableName}`, error as Error);
      return null;
    }
  }

  /**
   * 检查表是否存在
   */
  async tableExists(tableName: string): Promise<boolean> {
    const stmt = this.db!.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
    const result = stmt.get(tableName);
    return !!result;
  }

  /**
   * 获取数据库实例
   */
  getDb(): Database {
    if (!this.db) {
      throw new Error('数据库未连接');
    }
    return this.db;
  }

  /**
   * 获取配置信息
   */
  getConfig(): DatabaseConfig {
    return { ...this.config };
  }

  /**
   * 销毁实例（用于测试）
   */
  static destroy(): void {
    DatabaseManager.instance = null as any;
  }
}

// 导出单例实例
export const databaseManager = DatabaseManager.getInstance();
export default databaseManager;