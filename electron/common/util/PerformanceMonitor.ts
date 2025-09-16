import { errorHandler, ErrorType, ErrorLevel } from './ErrorHandler';

/**
 * 性能指标接口
 */
export interface PerformanceMetric {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    metadata?: Record<string, any>;
    category: string;
}

/**
 * 性能统计接口
 */
export interface PerformanceStats {
    totalOperations: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    successCount: number;
    errorCount: number;
    category: string;
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: Map<string, PerformanceMetric> = new Map();
    private completedMetrics: PerformanceMetric[] = [];
    private maxStoredMetrics: number = 1000;

    private constructor() {
        // 定期清理旧的性能数据
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 300000); // 5分钟
    }

    /**
     * 获取单例实例
     */
    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    /**
     * 开始性能测量
     */
    startMeasure(name: string, category: string = 'general', metadata?: Record<string, any>): string {
        const measureId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const metric: PerformanceMetric = {
            name,
            startTime: performance.now(),
            category,
            metadata
        };

        this.metrics.set(measureId, metric);
        
        errorHandler.debug(
            ErrorType.UNKNOWN,
            'PERF_START',
            `开始性能测量: ${name}`,
            { measureId, category, metadata }
        );

        return measureId;
    }

    /**
     * 结束性能测量
     */
    endMeasure(measureId: string, success: boolean = true, additionalMetadata?: Record<string, any>): number | null {
        const metric = this.metrics.get(measureId);
        if (!metric) {
            errorHandler.warn(
                ErrorType.UNKNOWN,
                'PERF_NOT_FOUND',
                `性能测量ID未找到: ${measureId}`
            );
            return null;
        }

        metric.endTime = performance.now();
        metric.duration = metric.endTime - metric.startTime;
        
        if (additionalMetadata) {
            metric.metadata = { ...metric.metadata, ...additionalMetadata, success };
        } else {
            metric.metadata = { ...metric.metadata, success };
        }

        // 移动到已完成列表
        this.completedMetrics.push(metric);
        this.metrics.delete(measureId);

        // 记录性能日志
        const level = metric.duration > 5000 ? ErrorLevel.WARN : ErrorLevel.DEBUG;
        errorHandler.log({
            level,
            type: ErrorType.UNKNOWN,
            code: 'PERF_COMPLETE',
            message: `性能测量完成: ${metric.name}`,
            details: {
                duration: `${metric.duration.toFixed(2)}ms`,
                category: metric.category,
                success,
                metadata: metric.metadata
            },
            timestamp: new Date()
        });

        return metric.duration;
    }

    /**
     * 测量函数执行时间
     */
    async measureFunction<T>(
        name: string,
        fn: () => Promise<T> | T,
        category: string = 'function',
        metadata?: Record<string, any>
    ): Promise<T> {
        const measureId = this.startMeasure(name, category, metadata);
        
        try {
            const result = await fn();
            this.endMeasure(measureId, true, { result: 'success' });
            return result;
        } catch (error) {
            this.endMeasure(measureId, false, { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * 测量数据库操作
     */
    async measureDatabaseOperation<T>(
        operation: string,
        fn: () => Promise<T> | T,
        tableName?: string,
        recordCount?: number
    ): Promise<T> {
        return this.measureFunction(
            `db_${operation}`,
            fn,
            'database',
            { operation, tableName, recordCount }
        );
    }

    /**
     * 测量文件操作
     */
    async measureFileOperation<T>(
        operation: string,
        fn: () => Promise<T> | T,
        filePath?: string,
        fileSize?: number
    ): Promise<T> {
        return this.measureFunction(
            `file_${operation}`,
            fn,
            'file_system',
            { operation, filePath, fileSize }
        );
    }

    /**
     * 测量网络操作
     */
    async measureNetworkOperation<T>(
        operation: string,
        fn: () => Promise<T> | T,
        url?: string,
        method?: string
    ): Promise<T> {
        return this.measureFunction(
            `network_${operation}`,
            fn,
            'network',
            { operation, url, method }
        );
    }

    /**
     * 获取性能统计
     */
    getStats(category?: string): PerformanceStats[] {
        const filteredMetrics = category 
            ? this.completedMetrics.filter(m => m.category === category)
            : this.completedMetrics;

        const statsByName = new Map<string, PerformanceStats>();

        filteredMetrics.forEach(metric => {
            if (!metric.duration) return;

            const key = `${metric.name}_${metric.category}`;
            const existing = statsByName.get(key);

            if (existing) {
                existing.totalOperations++;
                existing.averageDuration = (existing.averageDuration * (existing.totalOperations - 1) + metric.duration) / existing.totalOperations;
                existing.minDuration = Math.min(existing.minDuration, metric.duration);
                existing.maxDuration = Math.max(existing.maxDuration, metric.duration);
                
                if (metric.metadata?.success !== false) {
                    existing.successCount++;
                } else {
                    existing.errorCount++;
                }
            } else {
                statsByName.set(key, {
                    totalOperations: 1,
                    averageDuration: metric.duration,
                    minDuration: metric.duration,
                    maxDuration: metric.duration,
                    successCount: metric.metadata?.success !== false ? 1 : 0,
                    errorCount: metric.metadata?.success === false ? 1 : 0,
                    category: metric.category
                });
            }
        });

        return Array.from(statsByName.values());
    }

    /**
     * 获取慢操作报告
     */
    getSlowOperations(threshold: number = 1000): PerformanceMetric[] {
        return this.completedMetrics
            .filter(metric => metric.duration && metric.duration > threshold)
            .sort((a, b) => (b.duration || 0) - (a.duration || 0))
            .slice(0, 20); // 只返回前20个最慢的操作
    }

    /**
     * 获取错误操作报告
     */
    getErrorOperations(): PerformanceMetric[] {
        return this.completedMetrics
            .filter(metric => metric.metadata?.success === false)
            .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
            .slice(0, 50); // 只返回最近50个错误操作
    }

    /**
     * 清理旧的性能数据
     */
    private cleanupOldMetrics(): void {
        if (this.completedMetrics.length > this.maxStoredMetrics) {
            const removeCount = this.completedMetrics.length - this.maxStoredMetrics;
            this.completedMetrics.splice(0, removeCount);
            
            errorHandler.debug(
                ErrorType.UNKNOWN,
                'PERF_CLEANUP',
                `清理了 ${removeCount} 个旧的性能数据`
            );
        }
    }

    /**
     * 生成性能报告
     */
    generateReport(): {
        summary: {
            totalMetrics: number;
            categories: string[];
            timeRange: { start: Date; end: Date } | null;
        };
        stats: PerformanceStats[];
        slowOperations: PerformanceMetric[];
        errorOperations: PerformanceMetric[];
    } {
        const categories = [...new Set(this.completedMetrics.map(m => m.category))];
        const timeRange = this.completedMetrics.length > 0 ? {
            start: new Date(Math.min(...this.completedMetrics.map(m => m.startTime))),
            end: new Date(Math.max(...this.completedMetrics.map(m => m.endTime || m.startTime)))
        } : null;

        return {
            summary: {
                totalMetrics: this.completedMetrics.length,
                categories,
                timeRange
            },
            stats: this.getStats(),
            slowOperations: this.getSlowOperations(),
            errorOperations: this.getErrorOperations()
        };
    }

    /**
     * 重置所有性能数据
     */
    reset(): void {
        this.metrics.clear();
        this.completedMetrics = [];
        
        errorHandler.info(
            ErrorType.UNKNOWN,
            'PERF_RESET',
            '性能监控数据已重置'
        );
    }

    /**
     * 获取实时性能信息
     */
    getRealTimeInfo(): {
        activeOperations: number;
        completedOperations: number;
        averageResponseTime: number;
        recentErrors: number;
    } {
        const recentMetrics = this.completedMetrics.filter(
            m => m.endTime && (Date.now() - m.endTime) < 300000 // 最近5分钟
        );

        const averageResponseTime = recentMetrics.length > 0
            ? recentMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / recentMetrics.length
            : 0;

        const recentErrors = recentMetrics.filter(m => m.metadata?.success === false).length;

        return {
            activeOperations: this.metrics.size,
            completedOperations: this.completedMetrics.length,
            averageResponseTime,
            recentErrors
        };
    }
}

// 导出单例实例
export const performanceMonitor = PerformanceMonitor.getInstance();
export default performanceMonitor;


