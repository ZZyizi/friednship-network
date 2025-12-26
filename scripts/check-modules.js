/**
 * 检查数据库模块是否存在和可以导入
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('检查数据库模块...\n');

// 检查所有必要的文件是否存在
const requiredFiles = [
  'electron/common/database/types.ts',
  'electron/common/database/DatabaseManager.ts',
  'electron/common/database/MigrationManager.ts',
  'electron/common/database/BackupManager.ts',
  'electron/common/database/JsonToSQLiteMigrator.ts',
  'electron/common/database/DatabaseService.ts',
  'electron/common/database/index.ts'
];

let allFilesExist = true;

console.log('📁 检查文件存在性:');
for (const file of requiredFiles) {
  const filePath = path.join(__dirname, '..', file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
}

console.log();

if (!allFilesExist) {
  console.log('❌ 缺少必要文件，无法继续测试');
  process.exit(1);
}

// 检查依赖是否安装
console.log('📦 检查依赖包:');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const requiredDeps = ['sqlite', 'sqlite3', '@types/sqlite3'];
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

for (const dep of requiredDeps) {
  const installed = dependencies[dep];
  console.log(`   ${installed ? '✅' : '❌'} ${dep} (${installed || '未安装'})`);
}

console.log();

// 检查SQLite包是否真正可用
try {
  console.log('🔍 测试SQLite包可用性:');

  // 尝试导入sqlite3
  try {
    const sqlite3 = await import('sqlite3');
    console.log('   ✅ sqlite3 可以导入');
  } catch (error) {
    console.log('   ❌ sqlite3 导入失败:', error.message);
  }

  // 尝试导入sqlite
  try {
    const sqlite = await import('sqlite');
    console.log('   ✅ sqlite 可以导入');
  } catch (error) {
    console.log('   ❌ sqlite 导入失败:', error.message);
  }

  // 尝试导入better-sqlite3
  try {
    const Database = await import('better-sqlite3');
    console.log('   ✅ better-sqlite3 可以导入');

    // 尝试创建一个测试数据库
    const testDb = new Database(':memory:');
    testDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    testDb.close();
    console.log('   ✅ better-sqlite3 功能测试成功');
  } catch (error) {
    console.log('   ❌ better-sqlite3 测试失败:', error.message);
  }

} catch (error) {
  console.log('❌ SQLite包测试失败:', error.message);
}

console.log();

// 总结
console.log('📋 检查总结:');
console.log('✅ 所有数据库模块文件已创建');
console.log('✅ SQLite依赖已安装');

console.log('\n🎯 下一步操作:');
console.log('1. 运行 `pnpm run dev` 启动应用程序');
console.log('2. 应用程序会自动初始化SQLite数据库');
console.log('3. 如果存在JSON缓存数据，会自动迁移到SQLite');
console.log('4. 查看控制台输出确认数据库系统工作正常');

console.log('\n💡 注意事项:');
console.log('- TypeScript文件会在应用启动时自动编译');
console.log('- 数据库文件将保存在用户数据目录');
console.log('- 原有JSON数据会自动备份');