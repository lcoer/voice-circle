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

  // 历史数据清洗：早期版本把评论内容也套了段落标签，会被前端转义后原样显示成 <p>…</p>
  // 注意 SQLite 的 TRIM(x) 默认只去空格，换行需显式指定字符集
  const dirty = get("SELECT COUNT(*) AS count FROM comments WHERE content LIKE '%<p>%' OR content LIKE '%<br>%'");
  if (Number(dirty.count) > 0) {
    run("UPDATE comments SET content = TRIM(REPLACE(REPLACE(REPLACE(content, '<p>', ''), '</p>', CHAR(10)), '<br>', CHAR(10)), CHAR(10) || CHAR(13) || ' ')" +
        " WHERE content LIKE '%<p>%' OR content LIKE '%<br>%'");
    console.log(`[db] 已清洗 ${dirty.count} 条历史评论的段落标签`);
  }
  // 兜底：去掉评论首尾残留的空白与换行
  run("UPDATE comments SET content = TRIM(content, CHAR(10) || CHAR(13) || ' ') WHERE content <> TRIM(content, CHAR(10) || CHAR(13) || ' ')");

  const { count } = get('SELECT COUNT(*) AS count FROM users');
  if (Number(count) === 0) {
    console.log('[db] 检测到空库，正在写入演示种子数据…');
    require('./seed')({ db, run, get, all });
    console.log('[db] 种子数据写入完成');
  }
}

module.exports = { db, run, get, all, init };
