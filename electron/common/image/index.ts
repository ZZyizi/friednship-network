/**
 * 图片管理模块入口文件
 * 统一导出图片管理相关的类和方法
 */

export { ImageManager, imageManager } from './ImageManager';
export * from './types';

// 重新导出常用方法的简化接口
import { imageManager } from './ImageManager';
import { SaveImageOptions, CleanupOptions } from './types';

/**
 * 简化的图片存储接口
 */
export class ImageStorage {
  /**
   * 保存 Base64 图片
   * @param base64Data Base64 图片数据
   * @param sourceHash 可选的源文件哈希
   * @param options 保存选项
   * @returns 返回图片的相对路径或 null
   */
  static async saveBase64(
    base64Data: string, 
    sourceHash?: string, 
    options?: SaveImageOptions
  ): Promise<string | null> {
    return imageManager.saveBase64Image(base64Data, sourceHash, options);
  }

  /**
   * 保存文件图片
   * @param sourceFilePath 源文件路径
   * @param options 保存选项
   * @returns 返回图片的相对路径或 null
   */
  static async saveFile(
    sourceFilePath: string, 
    options?: SaveImageOptions
  ): Promise<string | null> {
    return imageManager.saveFileImage(sourceFilePath, options);
  }

  /**
   * 获取图片 URL
   * @param relativePath 图片相对路径
   * @param serverInfo 服务器信息
   * @returns 完整的图片 URL
   */
  static getImageUrl(
    relativePath: string, 
    serverInfo: { ip: string; port: number }
  ): string {
    return imageManager.getImageUrl(relativePath, serverInfo);
  }

  /**
   * 清理未使用的图片
   * @param usedPaths 正在使用的图片路径列表
   * @param options 清理选项
   * @returns 清理结果
   */
  static async cleanUnused(usedPaths: string[], options?: CleanupOptions) {
    return imageManager.cleanUnusedImages(usedPaths, options);
  }

  /**
   * 获取缓存统计信息
   */
  static getStats() {
    return imageManager.getCacheStats();
  }

  /**
   * 检查并清理缓存
   */
  static async checkAndClean() {
    return imageManager.checkAndCleanCache();
  }
}

/**
 * 与现有文件系统的集成工具
 */
export class ImageIntegration {
  /**
   * 为媒体文件处理封面图片
   * @param filePath 媒体文件路径
   * @param metadata 媒体元数据
   * @returns 处理后的图片路径
   */
  static async processMediaCover(
    filePath: string, 
    metadata: any
  ): Promise<string | null> {
    try {
      // 如果有 Base64 封面数据
      if (metadata.picture && typeof metadata.picture === 'string') {
        const fileHash = ImageIntegration.generateFileHash(filePath);
        return await ImageStorage.saveBase64(metadata.picture, fileHash);
      }

      // 如果有封面文件路径
      if (metadata.coverPath && typeof metadata.coverPath === 'string') {
        return await ImageStorage.saveFile(metadata.coverPath);
      }

      return null;
    } catch (error) {
      console.error(`处理媒体封面失败: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 批量处理媒体文件的封面
   * @param mediaFiles 媒体文件列表
   * @returns 处理结果统计
   */
  static async batchProcessCovers(
    mediaFiles: Array<{ path: string; metadata: any }>
  ): Promise<{ processed: number; failed: number; results: string[] }> {
    const results = {
      processed: 0,
      failed: 0,
      results: [] as string[]
    };

    for (const file of mediaFiles) {
      try {
        const coverPath = await ImageIntegration.processMediaCover(file.path, file.metadata);
        if (coverPath) {
          results.processed++;
          results.results.push(coverPath);
        }
      } catch (error) {
        console.error(`批量处理封面失败: ${file.path}`, error);
        results.failed++;
      }
    }

    return results;
  }

  /**
   * 生成文件哈希（用于图片缓存键）
   * @param filePath 文件路径
   * @returns 文件路径的哈希值
   */
  private static generateFileHash(filePath: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(filePath).digest('hex').slice(0, 16);
  }

  /**
   * 迁移现有图片到新的缓存系统
   * @param oldImageDir 旧的图片目录
   * @returns 迁移结果
   */
  static async migrateExistingImages(
    oldImageDir: string
  ): Promise<{ migrated: number; failed: number; errors: string[] }> {
    const result = {
      migrated: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      const fs = require('fs');
      const path = require('path');

      if (!fs.existsSync(oldImageDir)) {
        console.log(`旧图片目录不存在: ${oldImageDir}`);
        return result;
      }

      const files = fs.readdirSync(oldImageDir);
      
      for (const file of files) {
        const filePath = path.join(oldImageDir, file);
        
        try {
          if (fs.statSync(filePath).isFile()) {
            const newPath = await ImageStorage.saveFile(filePath);
            if (newPath) {
              result.migrated++;
              console.log(`迁移图片: ${file} -> ${newPath}`);
            } else {
              result.failed++;
            }
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`迁移 ${file} 失败: ${error}`);
        }
      }

      console.log(`图片迁移完成: 成功 ${result.migrated}, 失败 ${result.failed}`);
      return result;

    } catch (error) {
      console.error('图片迁移过程出错:', error);
      result.errors.push(`迁移过程出错: ${error}`);
      return result;
    }
  }

  /**
   * 验证图片缓存完整性
   * @returns 验证结果
   */
  static async validateCache(): Promise<{
    valid: number;
    invalid: number;
    missing: number;
    errors: string[];
  }> {
    const result = {
      valid: 0,
      invalid: 0,
      missing: 0,
      errors: [] as string[]
    };

    try {
      const fs = require('fs');
      const allImages = imageManager.getAllImages();

      for (const imageInfo of allImages) {
        try {
          if (fs.existsSync(imageInfo.cachedPath)) {
            const stats = fs.statSync(imageInfo.cachedPath);
            if (stats.size === imageInfo.size) {
              result.valid++;
            } else {
              result.invalid++;
              result.errors.push(`文件大小不匹配: ${imageInfo.relativePath}`);
            }
          } else {
            result.missing++;
            result.errors.push(`文件不存在: ${imageInfo.relativePath}`);
          }
        } catch (error) {
          result.invalid++;
          result.errors.push(`验证失败: ${imageInfo.relativePath} - ${error}`);
        }
      }

      console.log(`缓存验证完成: 有效 ${result.valid}, 无效 ${result.invalid}, 丢失 ${result.missing}`);
      return result;

    } catch (error) {
      console.error('缓存验证出错:', error);
      result.errors.push(`验证过程出错: ${error}`);
      return result;
    }
  }
}

// 默认导出
export default {
  ImageStorage,
  ImageIntegration,
  imageManager
};
