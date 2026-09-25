'use strict';
/** 数据访问底座：SQLite 连接（Node 内置 node:sqlite）+ 自动建表 + 首次空库自动灌种子数据。 */

const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

function openDatabase() {
  try {
    // Node 22 需要 --experimental-sqlite；Node 23.4+ 无需参数。boot.js 已处理自动重启。
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(config.DB_FILE);
  } catch (err) {
    if (err && (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ERR_REQUIRE_ESM' || /Cannot find module/.test(err.message))) {
      throw new Error('当前 Node 版本不支持内置 node:sqlite，请使用 Node 22 及以上版本');
    }
    throw err;
  }
}

fs.mkdirSync(path.dirname(config.DB_FILE), { recursive: true });
fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });

const db = openDatabase();
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  const { count } = get('SELECT COUNT(*) AS count FROM users');
  if (Number(count) === 0) {
    console.log('[db] 检测到空库，正在写入演示种子数据…');
    require('./seed')({ db, run, get, all });
    console.log('[db] 种子数据写入完成');
  }
}

module.exports = { db, run, get, all, init };
