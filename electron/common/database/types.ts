/**
 * 数据库相关类型定义
 */

// 媒体文件信息接口（对应 FileInter）
export interface MediaFileRecord {
  id?: number;
  url: string;
  name: string;
  suffix: string;
  size: number;
  duration?: number;
  artist?: string;
  album?: string;
  quality?: string;
  resolution?: string;
  picture?: string;
  lyrics?: string;
  file_hash: string;
  created_at?: string;
  updated_at?: string;
}

// 媒体分类接口（对应 ClassifyType）
export interface MediaCategoryRecord {
  id?: number;
  year: string;
  month: string;
  day: string;
  prepose: string;
  picture?: string;
  created_at?: string;
  updated_at?: string;
}

// 系统设置接口
export interface SettingsRecord {
  id?: number;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// 数据库统计信息接口
export interface DatabaseStats {
  totalFiles: number;
  totalSize: number;
  musicFiles: number;
  videoFiles: number;
  categories: number;
  settings: number;
  lastScanned?: string;
}

// 查询选项接口
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

// 搜索选项接口
export interface SearchOptions {
  keyword?: string;
  artist?: string;
  album?: string;
  category?: string;
  fileType?: 'music' | 'video';
  minDuration?: number;
  maxDuration?: number;
  minSize?: number;
  maxSize?: number;
  dateRange?: {
    start: string;
    end: string;
  };
  queryOptions?: QueryOptions;
}

// 批量操作结果接口
export interface BatchResult {
  success: number;
  failed: number;
  errors: string[];
  details?: any;
}

// 数据库迁移接口
export interface Migration {
  version: string;
  description: string;
  up: (db: any) => Promise<void>;
  down: (db: any) => Promise<void>;
}

// 备份信息接口
export interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  created_at: string;
  file_count: number;
  version: string;
}

// 数据库配置接口
export interface DatabaseConfig {
  path: string;
  maxConnections?: number;
  busyTimeout?: number;
  enableWAL?: boolean;
  enableForeignKeys?: boolean;
}

// 数据库事务函数类型
export type TransactionFunction<T> = (db: any) => Promise<T>;

// 索引信息接口
export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
}

// 表信息接口
export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  rowCount: number;
}

// 列信息接口
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  primaryKey: boolean;
  autoIncrement: boolean;
}

// 迁移进度接口
export interface MigrationProgress {
  totalFiles: number;
  processedFiles: number;
  errors: string[];
  status: 'idle' | 'running' | 'processing' | 'completed' | 'failed';
}