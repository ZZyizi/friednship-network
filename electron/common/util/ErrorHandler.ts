import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * 错误级别枚举
 */
export enum ErrorLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    FATAL = 'FATAL'
}

/**
 * 错误类型枚举
 */
export enum ErrorType {
    DATABASE = 'DATABASE',
    MIGRATION = 'MIGRATION',
    IMAGE = 'IMAGE',
    FILE_SYSTEM = 'FILE_SYSTEM',
    NETWORK = 'NETWORK',
    VALIDATION = 'VALIDATION',
    UNKNOWN = 'UNKNOWN'
}

/**
 * 错误信息接口
 */
export interface ErrorInfo {
    level: ErrorLevel;
    type: ErrorType;
    code: string;
    message: string;
    details?: any;
    stack?: string;
    timestamp: Date;
    context?: Record<string, any>;
}

/**
 * 日志配置接口
 */
export interface LogConfig {
    logDir: string;
    maxFileSize: number; // MB
    maxFiles: number;
    enableConsole: boolean;
    enableFile: boolean;
    level: ErrorLevel;
}

/**
 * 错误处理和日志管理器
 */
export class ErrorHandler {
    private static instance: ErrorHandler;
    private config: LogConfig;
    private logStream: fs.WriteStream | null = null;
    private currentLogFile: string = '';

    // 默认配置
    private static readonly DEFAULT_CONFIG: LogConfig = {
        logDir: path.join(app.getPath('userData'), 'logs'),
        maxFileSize: 10, // 10MB
        maxFiles: 5,
        enableConsole: true,
        enableFile: true,
        level: ErrorLevel.INFO
    };

    private constructor(config?: Partial<LogConfig>) {
        this.config = { ...ErrorHandler.DEFAULT_CONFIG, ...config };
        this.initializeLogger();
    }

    /**
     * 获取单例实例
     */
    static getInstance(config?: Partial<LogConfig>): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler(config);
        }
        return ErrorHandler.instance;
    }

    /**
     * 初始化日志记录器
     */
    private initializeLogger(): void {
        if (!this.config.enableFile) return;

        try {
            // 确保日志目录存在
            if (!fs.existsSync(this.config.logDir)) {
                fs.mkdirSync(this.config.logDir, { recursive: true });
            }

            // 清理旧日志文件
            this.cleanupOldLogs();

            // 创建新的日志文件
            this.createNewLogFile();

        } catch (error) {
            console.error('初始化日志记录器失败:', error);
        }
    }

    /**
     * 创建新的日志文件
     */
    private createNewLogFile(): void {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.currentLogFile = path.join(this.config.logDir, `friendship-network-${timestamp}.log`);
        
        this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
        
        this.logStream.on('error', (error) => {
            console.error('日志文件写入错误:', error);
        });

        // 写入日志文件头
        this.writeToFile(`[${new Date().toISOString()}] === 日志开始 ===\n`);
    }

    /**
     * 清理旧日志文件
     */
    private cleanupOldLogs(): void {
        try {
            const files = fs.readdirSync(this.config.logDir)
                .filter(file => file.startsWith('friendship-network-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.config.logDir, file),
                    stat: fs.statSync(path.join(this.config.logDir, file))
                }))
                .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

            // 删除超出数量限制的文件
            if (files.length >= this.config.maxFiles) {
                const filesToDelete = files.slice(this.config.maxFiles - 1);
                filesToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                        console.log(`删除旧日志文件: ${file.name}`);
                    } catch (error) {
                        console.error(`删除日志文件失败: ${file.name}`, error);
                    }
                });
            }
        } catch (error) {
            console.error('清理旧日志失败:', error);
        }
    }

    /**
     * 检查日志文件大小并轮转
     */
    private checkLogRotation(): void {
        if (!this.currentLogFile || !fs.existsSync(this.currentLogFile)) return;

        try {
            const stats = fs.statSync(this.currentLogFile);
            const fileSizeMB = stats.size / (1024 * 1024);

            if (fileSizeMB > this.config.maxFileSize) {
                this.logStream?.end();
                this.createNewLogFile();
            }
        } catch (error) {
            console.error('检查日志轮转失败:', error);
        }
    }

    /**
     * 写入文件
     */
    private writeToFile(content: string): void {
        if (!this.config.enableFile || !this.logStream) return;

        this.logStream.write(content);
        this.checkLogRotation();
    }

    /**
     * 格式化日志消息
     */
    private formatLogMessage(errorInfo: ErrorInfo): string {
        const timestamp = errorInfo.timestamp.toISOString();
        const level = errorInfo.level.padEnd(5);
        const type = errorInfo.type.padEnd(10);
        
        let message = `[${timestamp}] [${level}] [${type}] ${errorInfo.code}: ${errorInfo.message}`;
        
        if (errorInfo.details) {
            message += `\n详细信息: ${JSON.stringify(errorInfo.details, null, 2)}`;
        }
        
        if (errorInfo.context) {
            message += `\n上下文: ${JSON.stringify(errorInfo.context, null, 2)}`;
        }
        
        if (errorInfo.stack) {
            message += `\n堆栈跟踪:\n${errorInfo.stack}`;
        }
        
        return message + '\n';
    }

    /**
     * 检查日志级别
     */
    private shouldLog(level: ErrorLevel): boolean {
        const levels = [ErrorLevel.DEBUG, ErrorLevel.INFO, ErrorLevel.WARN, ErrorLevel.ERROR, ErrorLevel.FATAL];
        const currentLevelIndex = levels.indexOf(this.config.level);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }

    /**
     * 记录错误
     */
    log(errorInfo: ErrorInfo): void {
        if (!this.shouldLog(errorInfo.level)) return;

        const formattedMessage = this.formatLogMessage(errorInfo);

        // 控制台输出
        if (this.config.enableConsole) {
            switch (errorInfo.level) {
                case ErrorLevel.DEBUG:
                    console.debug(formattedMessage);
                    break;
                case ErrorLevel.INFO:
                    console.info(formattedMessage);
                    break;
                case ErrorLevel.WARN:
                    console.warn(formattedMessage);
                    break;
                case ErrorLevel.ERROR:
                case ErrorLevel.FATAL:
                    console.error(formattedMessage);
                    break;
            }
        }

        // 文件输出
        this.writeToFile(formattedMessage);
    }

    /**
     * 便捷方法：记录调试信息
     */
    debug(type: ErrorType, code: string, message: string, details?: any, context?: Record<string, any>): void {
        this.log({
            level: ErrorLevel.DEBUG,
            type,
            code,
            message,
            details,
            context,
            timestamp: new Date()
        });
    }

    /**
     * 便捷方法：记录信息
     */
    info(type: ErrorType, code: string, message: string, details?: any, context?: Record<string, any>): void {
        this.log({
            level: ErrorLevel.INFO,
            type,
            code,
            message,
            details,
            context,
            timestamp: new Date()
        });
    }

    /**
     * 便捷方法：记录警告
     */
    warn(type: ErrorType, code: string, message: string, details?: any, context?: Record<string, any>): void {
        this.log({
            level: ErrorLevel.WARN,
            type,
            code,
            message,
            details,
            context,
            timestamp: new Date()
        });
    }

    /**
     * 便捷方法：记录错误
     */
    error(type: ErrorType, code: string, message: string, error?: Error, context?: Record<string, any>): void {
        this.log({
            level: ErrorLevel.ERROR,
            type,
            code,
            message,
            details: error?.message,
            stack: error?.stack,
            context,
            timestamp: new Date()
        });
    }

    /**
     * 便捷方法：记录致命错误
     */
    fatal(type: ErrorType, code: string, message: string, error?: Error, context?: Record<string, any>): void {
        this.log({
            level: ErrorLevel.FATAL,
            type,
            code,
            message,
            details: error?.message,
            stack: error?.stack,
            context,
            timestamp: new Date()
        });
    }

    /**
     * 数据库错误处理
     */
    handleDatabaseError(operation: string, error: Error, context?: Record<string, any>): void {
        this.error(
            ErrorType.DATABASE,
            `DB_${operation.toUpperCase()}_ERROR`,
            `数据库操作失败: ${operation}`,
            error,
            { operation, ...context }
        );
    }

    /**
     * 迁移错误处理
     */
    handleMigrationError(phase: string, error: Error, context?: Record<string, any>): void {
        this.error(
            ErrorType.MIGRATION,
            `MIGRATION_${phase.toUpperCase()}_ERROR`,
            `迁移阶段失败: ${phase}`,
            error,
            { phase, ...context }
        );
    }

    /**
     * 图片处理错误处理
     */
    handleImageError(operation: string, error: Error, imagePath?: string, context?: Record<string, any>): void {
        this.error(
            ErrorType.IMAGE,
            `IMAGE_${operation.toUpperCase()}_ERROR`,
            `图片处理失败: ${operation}`,
            error,
            { operation, imagePath, ...context }
        );
    }

    /**
     * 文件系统错误处理
     */
    handleFileSystemError(operation: string, error: Error, filePath?: string, context?: Record<string, any>): void {
        this.error(
            ErrorType.FILE_SYSTEM,
            `FS_${operation.toUpperCase()}_ERROR`,
            `文件系统操作失败: ${operation}`,
            error,
            { operation, filePath, ...context }
        );
    }

    /**
     * 网络错误处理
     */
    handleNetworkError(operation: string, error: Error, url?: string, context?: Record<string, any>): void {
        this.error(
            ErrorType.NETWORK,
            `NETWORK_${operation.toUpperCase()}_ERROR`,
            `网络操作失败: ${operation}`,
            error,
            { operation, url, ...context }
        );
    }

    /**
     * 验证错误处理
     */
    handleValidationError(field: string, value: any, rule: string, context?: Record<string, any>): void {
        this.warn(
            ErrorType.VALIDATION,
            `VALIDATION_${field.toUpperCase()}_ERROR`,
            `验证失败: ${field} 不符合规则 ${rule}`,
            { field, value, rule },
            context
        );
    }

    /**
     * 获取日志统计信息
     */
    getLogStats(): { totalLogs: number; logFiles: string[]; currentLogFile: string; logDir: string } {
        try {
            const logFiles = fs.readdirSync(this.config.logDir)
                .filter(file => file.startsWith('friendship-network-') && file.endsWith('.log'));
            
            return {
                totalLogs: logFiles.length,
                logFiles,
                currentLogFile: this.currentLogFile,
                logDir: this.config.logDir
            };
        } catch (error) {
            console.error('获取日志统计失败:', error);
            return {
                totalLogs: 0,
                logFiles: [],
                currentLogFile: this.currentLogFile,
                logDir: this.config.logDir
            };
        }
    }

    /**
     * 关闭日志记录器
     */
    close(): void {
        if (this.logStream) {
            this.writeToFile(`[${new Date().toISOString()}] === 日志结束 ===\n`);
            this.logStream.end();
            this.logStream = null;
        }
    }
}

// 导出单例实例
export const errorHandler = ErrorHandler.getInstance();
export default errorHandler;



