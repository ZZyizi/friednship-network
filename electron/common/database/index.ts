/**
 * 数据库模块入口文件
 * 统一导出所有数据库相关的类、接口和工具
 */

// 核心类
export { DatabaseManager, databaseManager } from './DatabaseManager';
export { MigrationManager, migrationManager } from './MigrationManager';
export { BackupManager, backupManager } from './BackupManager';
export { JsonToSQLiteMigrator } from './JsonToSQLiteMigrator';
export { DatabaseService, databaseService } from './DatabaseService';

// 类型定义
export * from './types';

// 便捷导入
import { DatabaseService } from './DatabaseService';
import { migrationManager } from './MigrationManager';
import { backupManager } from './BackupManager';
import { JsonToSQLiteMigrator } from './JsonToSQLiteMigrator';

/**
 * 初始化数据库系统
 */
export async function initializeDatabaseSystem(jsonCachePath?: string): Promise<void> {
  try {
    // 1. 初始化数据库服务
    await DatabaseService.getInstance().initialize();

    // 2. 执行数据库迁移
    await migrationManager.runMigrations();

    // 3. 如果指定了JSON缓存路径，执行JSON到SQLite的迁移
    if (jsonCachePath) {
      const migrator = new JsonToSQLiteMigrator(jsonCachePath);

      if (await migrator.hasJsonData()) {
        console.log('检测到JSON数据，开始迁移到SQLite数据库...');
        await migrator.migrate();

        // 验证迁移结果
        const validation = await migrator.validateMigration();
        if (!validation.isValid) {
          console.warn('迁移验证发现问题:', validation.issues);
        } else {
          console.log('JSON到SQLite迁移成功完成');
        }
      }
    }

    console.log('数据库系统初始化完成');
  } catch (error) {
    console.error('数据库系统初始化失败:', error);
    throw error;
  }
}

/**
 * 关闭数据库系统
 */
export async function shutdownDatabaseSystem(): Promise<void> {
  try {
    await DatabaseService.getInstance().shutdown();
    console.log('数据库系统已关闭');
  } catch (error) {
    console.error('关闭数据库系统失败:', error);
    throw error;
  }
}

// 默认导出数据库服务实例
export default {
  initialize: initializeDatabaseSystem,
  shutdown: shutdownDatabaseSystem,
  service: DatabaseService.getInstance(),
  migration: migrationManager,
  backup: backupManager
};