
export interface fileType {
    loadFileCache:Function,
    saveFile:Function,
    readFile:Function,
    searchFile:Function,
    startScan:Function,
    selectDirectory:Function,
    saveSettings:Function,
    loadSettings:Function,
    // 数据库相关API
    getDatabaseStatus: () => Promise<{
        useDatabase: boolean;
        dbReady: boolean;
        migrationStatus: {
            completed: boolean;
            version?: string;
            needsMigration?: boolean;
        };
    }>;
    getMigrationStatus: () => Promise<{
        completed: boolean;
        version?: string;
        lastMigration?: Date | string;
        needsMigration?: boolean;
        history?: Array<{
            version: string;
            description: string;
            applied_at: string;
        }>;
    }>;
    initializeDatabase: () => Promise<{ success: boolean; message: string }>;
    performMigration: () => Promise<{ success: boolean; message: string }>;
    triggerMigration: () => Promise<{ success: boolean; message: string }>;
    rollbackMigration: (targetVersion?: string) => Promise<{ success: boolean; message: string }>;
    setDatabaseMode: (enabled: boolean) => Promise<{ success: boolean; message: string }>;
    getMediaStats: () => Promise<{ success: boolean; data: any }>;
    searchMediaFiles: (searchTerm: string, type?: string) => Promise<{ success: boolean; data: any[] }>;
    getImageStats: () => Promise<{ success: boolean; data: any }>;
    cleanImageCache: () => Promise<{ success: boolean; message: string }>;
    getVersionCompatibility: () => Promise<{ success: boolean; data: any }>;
}
export interface configType {
    getConfig:Function,
    start:Function,
    theme:Function,
    copy:Function,
    getLoadNet:Function,
    getStartServer:Function,
}
export interface searchFileType {
    path:string,
    type:string[],
}
