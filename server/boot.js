'use strict';
/**
 * 启动引导：
 * 1) Node 22 需要 --experimental-sqlite 才能使用内置 SQLite，这里做一次自动重启；
 * 2) 支持 --seed / --reset 清空重建演示数据；
 * 3) 其余情况正常拉起服务。
 */

const path = require('node:path');
const fs = require('node:fs');
const config = require('./config');

function sqliteAvailable() {
  try {
    require('node:sqlite');
    return true;
  } catch (_) {
    return false;
  }
}

if (!process.env.__VC_BOOTED && !sqliteAvailable()) {
  const { spawnSync } = require('node:child_process');
  console.log('[boot] 正在以 --experimental-sqlite 重新启动…');
  const result = spawnSync(
    process.execPath,
    ['--experimental-sqlite', __filename, ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, __VC_BOOTED: '1' } }
  );
  process.exit(result.status === null ? 1 : result.status);
}

const args = process.argv.slice(2);

if (args.includes('--seed') || args.includes('--reset')) {
  if (fs.existsSync(config.DB_FILE)) {
    fs.rmSync(config.DB_FILE);
    const wal = `${config.DB_FILE}-wal`;
    const shm = `${config.DB_FILE}-shm`;
    if (fs.existsSync(wal)) fs.rmSync(wal);
    if (fs.existsSync(shm)) fs.rmSync(shm);
  }
  console.log('[boot] 已清空数据库，启动时将重新写入演示数据');
}

const { createApp } = require('./app');
const { sweepExpired } = require('./domains/job.domain');

const app = createApp();
sweepExpired();

const host = process.env.HOST || '127.0.0.1';
app.listen(config.PORT, host, () => {
  console.log('');
  console.log('  声圈 VoiceCircle 已启动');
  console.log(`  前台首页      http://localhost:${config.PORT}/`);
  console.log(`  管理后台      http://localhost:${config.PORT}/admin`);
  console.log(`  管理端账号    ${config.ADMIN_DEFAULT.username} / ${config.ADMIN_DEFAULT.password}`);
  console.log('');
});
