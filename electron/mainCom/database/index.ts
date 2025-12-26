import electron from "electron";
import { databaseService } from "../../common/database";
import { migrationManager } from "../../common/database/MigrationManager";
import { databaseManager } from "../../common/database/DatabaseManager";
import { imageManager } from "../../common/image";
import { errorHandler, ErrorType } from "../../common/util/ErrorHandler";

/**
 * 获取数据库状态
 */
async function getDatabaseStatus(_: electron.Event) {
    try {
        const isReady = databaseManager.isReady();
        const currentVersion = await migrationManager.getCurrentVersion();
        const needsMigration = await migrationManager.needsMigration();

        return {
            useDatabase: true,
            dbReady: isReady,
            migrationStatus: {
                completed: !needsMigration,
                version: currentVersion,
                needsMigration: needsMigration
            }
        };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'GET_STATUS_ERROR', '获取数据库状态失败', error as Error);
        return {
            useDatabase: true,
            dbReady: false,
            migrationStatus: {
                completed: false,
                needsMigration: false
            }
        };
    }
}

/**
 * 获取迁移状态
 */
async function getMigrationStatus(_: electron.Event) {
    try {
        const currentVersion = await migrationManager.getCurrentVersion();
        const needsMigration = await migrationManager.needsMigration();
        const migrationHistory = await migrationManager.getMigrationHistory();

        return {
            completed: !needsMigration,
            version: currentVersion,
            lastMigration: migrationHistory.length > 0 ? migrationHistory[migrationHistory.length - 1].applied_at : undefined,
            needsMigration: needsMigration,
            history: migrationHistory
        };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'GET_MIGRATION_STATUS_ERROR', '获取迁移状态失败', error as Error);
        return {
            completed: false,
            needsMigration: true
        };
    }
}

/**
 * 初始化数据库
 */
async function initializeDatabase(_: electron.Event) {
    try {
        await databaseService.initialize();
        return { success: true, message: '数据库初始化成功' };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'INIT_ERROR', '数据库初始化失败', error as Error);
        return { success: false, message: '数据库初始化失败', error: (error as Error).message };
    }
}

/**
 * 执行迁移
 */
async function performMigration(_: electron.Event) {
    try {
        await migrationManager.runMigrations();
        return { success: true, message: '迁移执行成功' };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'MIGRATION_ERROR', '迁移执行失败', error as Error);
        return { success: false, message: '迁移执行失败', error: (error as Error).message };
    }
}

/**
 * 回滚迁移
 */
async function rollbackMigration(_: electron.Event, targetVersion?: string) {
    try {
        if (!targetVersion) {
            const currentVersion = await migrationManager.getCurrentVersion();
            // 默认回滚到上一个版本
            const versions = Array.from(migrationManager['migrations'].keys()).sort((a, b) => {
                const aParts = a.split('.').map(Number);
                const bParts = b.split('.').map(Number);
                for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                    const aPart = aParts[i] || 0;
                    const bPart = bParts[i] || 0;
                    if (aPart < bPart) return -1;
                    if (aPart > bPart) return 1;
                }
                return 0;
            });
            const currentIndex = versions.indexOf(currentVersion || '');
            if (currentIndex > 0) {
                targetVersion = versions[currentIndex - 1];
            } else {
                return { success: false, message: '没有可回滚的版本' };
            }
        }

        await migrationManager.rollbackToVersion(targetVersion);
        return { success: true, message: `回滚到版本 ${targetVersion} 成功` };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'ROLLBACK_ERROR', '回滚失败', error as Error);
        return { success: false, message: '回滚失败', error: (error as Error).message };
    }
}

/**
 * 设置数据库模式
 */
async function setDatabaseMode(_: electron.Event, enabled: boolean) {
    try {
        await databaseService.setSetting('use_database', enabled);
        return { success: true, message: `数据库模式已${enabled ? '启用' : '禁用'}` };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'SET_MODE_ERROR', '设置数据库模式失败', error as Error);
        return { success: false, message: '设置数据库模式失败', error: (error as Error).message };
    }
}

/**
 * 获取媒体统计信息
 */
async function getMediaStats(_: electron.Event) {
    try {
        const stats = await databaseService.getDatabaseStats();
        return {
            success: true,
            data: stats
        };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'GET_STATS_ERROR', '获取媒体统计失败', error as Error);
        return {
            success: false,
            data: null
        };
    }
}

/**
 * 搜索媒体文件
 */
async function searchMediaFiles(_: electron.Event, searchTerm: string, type?: string) {
    try {
        let results;
        if (type === 'music') {
            results = await databaseService.getMediaFilesByType('music', { keyword: searchTerm });
        } else if (type === 'video') {
            results = await databaseService.getMediaFilesByType('video', { keyword: searchTerm });
        } else {
            results = await databaseService.searchMediaFiles(searchTerm);
        }

        return {
            success: true,
            data: results
        };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'SEARCH_ERROR', '搜索媒体文件失败', error as Error);
        return {
            success: false,
            data: []
        };
    }
}

/**
 * 获取图片缓存统计
 */
async function getImageStats(_: electron.Event) {
    try {
        const cacheDir = await databaseService.getSetting('cache_directory');
        const stats = await imageManager.getCacheStats();
        return {
            success: true,
            data: stats
        };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'GET_IMAGE_STATS_ERROR', '获取图片统计失败', error as Error);
        return {
            success: false,
            data: null
        };
    }
}

/**
 * 清理图片缓存
 */
async function cleanImageCache(_: electron.Event) {
    try {
        await imageManager.checkAndCleanCache();
        await databaseService.setSetting('last_image_cleanup', Date.now());
        return { success: true, message: '图片缓存清理成功' };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'CLEAN_CACHE_ERROR', '清理图片缓存失败', error as Error);
        return { success: false, message: '清理图片缓存失败', error: (error as Error).message };
    }
}

/**
 * 获取版本兼容性信息
 */
async function getVersionCompatibility(_: electron.Event) {
    try {
        const currentVersion = await migrationManager.getCurrentVersion();
        const validation = await migrationManager.validateDatabase();
        const needsMigration = await migrationManager.needsMigration();

        return {
            success: true,
            data: {
                currentVersion,
                isValid: validation.isValid,
                issues: validation.issues,
                needsMigration,
                latestVersion: '1.0.0' // MigrationManager.CURRENT_VERSION
            }
        };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'VERSION_CHECK_ERROR', '检查版本兼容性失败', error as Error);
        return {
            success: false,
            data: null
        };
    }
}

/**
 * 优化数据库
 */
async function optimizeDatabase(_: electron.Event) {
    try {
        await databaseService.optimize();
        await databaseService.setSetting('last_db_optimization', Date.now());
        return { success: true, message: '数据库优化成功' };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'OPTIMIZE_ERROR', '数据库优化失败', error as Error);
        return { success: false, message: '数据库优化失败', error: (error as Error).message };
    }
}

/**
 * 获取艺术家列表
 */
async function getArtistList(_: electron.Event) {
    try {
        const artists = await databaseService.getArtists();
        return {
            success: true,
            data: artists
        };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'GET_ARTISTS_ERROR', '获取艺术家列表失败', error as Error);
        return {
            success: false,
            data: []
        };
    }
}

/**
 * 获取专辑列表
 */
async function getAlbumList(_: electron.Event) {
    try {
        const albums = await databaseService.getAlbums();
        return {
            success: true,
            data: albums
        };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'GET_ALBUMS_ERROR', '获取专辑列表失败', error as Error);
        return {
            success: false,
            data: []
        };
    }
}

/**
 * 获取文件格式统计
 */
async function getFileFormatStats(_: electron.Event) {
    try {
        const stats = await databaseService.getFileFormatStats();
        return {
            success: true,
            data: stats
        };
    } catch (error) {
        errorHandler.error(ErrorType.DATABASE, 'GET_FORMAT_STATS_ERROR', '获取格式统计失败', error as Error);
        return {
            success: false,
            data: {}
        };
    }
}

export {
    getDatabaseStatus,
    getMigrationStatus,
    initializeDatabase,
    performMigration,
    rollbackMigration,
    setDatabaseMode,
    getMediaStats,
    searchMediaFiles,
    getImageStats,
    cleanImageCache,
    getVersionCompatibility,
    optimizeDatabase,
    getArtistList,
    getAlbumList,
    getFileFormatStats
};
