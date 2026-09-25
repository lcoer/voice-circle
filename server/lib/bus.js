'use strict';
/**
 * 轻量实时总线：给写操作打版本号，让前台能判断「别人是不是发了新内容」。
 * 单进程内有效（本项目为单实例部署）；前台另有轮询兜底，SSE 不可用时自动降级。
 */

const { EventEmitter } = require('node:events');
const { nowISO } = require('./util');

const bus = new EventEmitter();
// 连接数多时放宽告警阈值，避免每个长连接都占用默认监听器额度
bus.setMaxListeners(0);

/** 全局单调版本号：任何一次内容变更都 +1 */
let revision = Date.now();

/** 各类资源的版本号快照，前台按 type 差异决定要不要刷新对应列表 */
const types = {
  post: 0,
  job: 0,
  comment: 0,
  reaction: 0
};

/**
 * 广播一次内容变更。
 * @param {string} type post | job | comment | reaction
 * @param {object} payload 附加信息（targetType/targetId/actorId 等）
 */
function publish(type, payload = {}) {
  revision += 1;
  if (Object.prototype.hasOwnProperty.call(types, type)) types[type] = revision;
  const event = {
    revision,
    type,
    targetType: payload.targetType || null,
    targetId: payload.targetId || null,
    actorId: payload.actorId || null,
    at: nowISO()
  };
  bus.emit('change', event);
  return event;
}

function currentRevision() {
  return revision;
}

/** 版本号快照，供轮询接口与 SSE 首帧使用 */
function snapshot() {
  return { revision, types: { ...types }, serverTime: nowISO() };
}

module.exports = { bus, publish, snapshot, currentRevision };
