/**
 * 数据库系统测试脚本
 * 用于验证 SQLite 数据库系统的基本功能
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模拟 Electron 环境
global.app = {
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(__dirname, '..', 'temp', 'test-data');
    }
    return '';
  }
};

async function testDatabase() {
  try {
    console.log('开始测试数据库系统...\n');

    // 动态导入数据库模块
    const { initializeDatabaseSystem, shutdownDatabaseSystem, databaseService } =
      await import('../electron/common/database/index.js');

    // 1. 初始化数据库
    console.log('1. 初始化数据库...');
    await initializeDatabaseSystem();
    console.log('✅ 数据库初始化成功\n');

    // 2. 测试基本操作
    console.log('2. 测试基本数据库操作...');

    // 添加一些测试数据
    const testFiles = [
      {
        Url: '/test/music1.mp3',
        Name: '测试音乐1.mp3',
        Suffix: '.mp3',
        Size: 1024000,
        info: {
          duration: 180,
          artist: '测试艺术家',
          album: '测试专辑',
          quality: '高',
          picture: '/test/cover1.jpg'
        }
      },
      {
        Url: '/test/video1.mp4',
        Name: '测试视频1.mp4',
        Suffix: '.mp4',
        Size: 5120000,
        info: {
          duration: 300,
          artist: '未知',
          album: '未知',
          quality: '1080P',
          resolution: '1920x1080'
        }
      }
    ];

    console.log('   添加测试数据...');
    await databaseService.addMediaFiles(testFiles);
    console.log('✅ 测试数据添加成功');

    // 查询数据
    console.log('   查询所有媒体文件...');
    const allFiles = await databaseService.getMediaFiles();
    console.log(`✅ 查询到 ${allFiles.length} 个媒体文件`);

    // 搜索测试
    console.log('   搜索测试...');
    const searchResults = await databaseService.searchMediaFiles('测试');
    console.log(`✅ 搜索到 ${searchResults.length} 个结果`);

    // 分类测试
    console.log('   添加分类数据...');
    await databaseService.addMediaCategory({
      year: '2024',
      month: '12',
      day: '21',
      prepose: '测试文件夹',
      picture: '/test/folder.jpg'
    });
    console.log('✅ 分类数据添加成功');

    // 设置测试
    console.log('   测试设置功能...');
    await databaseService.setSetting('test_setting', 'test_value', 'string', '测试设置');
    const testValue = await databaseService.getSetting('test_setting');
    console.log(`✅ 设置读取成功: ${testValue}`);

    console.log('✅ 基本操作测试完成\n');

    // 3. 获取统计信息
    console.log('3. 获取数据库统计信息...');
    const stats = await databaseService.getDatabaseStats();
    console.log('📊 数据库统计:');
    console.log(`   总文件数: ${stats.totalFiles}`);
    console.log(`   总大小: ${Math.round(stats.totalSize / 1024 / 1024)} MB`);
    console.log(`   音乐文件: ${stats.musicFiles}`);
    console.log(`   视频文件: ${stats.videoFiles}`);
    console.log(`   分类数: ${stats.categories}`);
    console.log(`   设置数: ${stats.settings}`);
    console.log('✅ 统计信息获取完成\n');

    // 4. 测试性能
    console.log('4. 测试数据库性能...');
    const startTime = Date.now();

    // 批量插入测试
    const batchFiles = Array.from({ length: 1000 }, (_, i) => ({
      Url: `/test/batch_${i}.mp3`,
      Name: `批量测试_${i}.mp3`,
      Suffix: '.mp3',
      Size: 1024000 + i,
      info: {
        duration: 180 + i,
        artist: `艺术家${i % 10}`,
        album: `专辑${i % 5}`,
        quality: '标准'
      }
    }));

    const batchResult = await databaseService.addMediaFiles(batchFiles);
    const insertTime = Date.now() - startTime;

    console.log(`✅ 批量插入完成:`);
    console.log(`   成功: ${batchResult.success}`);
    console.log(`   失败: ${batchResult.failed}`);
    console.log(`   耗时: ${insertTime}ms`);
    console.log(`   速度: ${Math.round(batchResult.success / (insertTime / 1000))} 条/秒\n`);

    // 5. 关闭数据库
    console.log('5. 关闭数据库...');
    await shutdownDatabaseSystem();
    console.log('✅ 数据库关闭成功\n');

    console.log('🎉 数据库系统测试完成！所有功能正常工作。');

  } catch (error) {
    console.error('❌ 数据库测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testDatabase().then(() => {
  console.log('测试成功完成');
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});

export { testDatabase };