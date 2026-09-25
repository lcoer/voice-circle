'use strict';
/** 操作日志：只依赖 db，任何领域都可安全引用（无反向依赖）。 */

const { run, all, get } = require('../data/db');
const { uid, nowISO } = require('../lib/util');

function log(actor, action, targetType = '', targetId = '', detail = '') {
  run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, target_type, target_id, detail, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [uid('log'), actor ? actor.id : null, actor ? actor.nick : 'system', action, targetType, targetId, detail, nowISO()]
  );
}

function recent(limit = 30) {
  return all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [limit]);
}

function countSince(iso) {
  return get('SELECT COUNT(*) AS c FROM audit_logs WHERE created_at >= ?', [iso]).c;
}

module.exports = { log, recent, countSince };
