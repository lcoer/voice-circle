'use strict';
/** 通用工具：ID、时间、JSON 字段解析、文本处理。被所有上层（服务层/路由层）依赖，自身不依赖上层。 */

const crypto = require('node:crypto');

function uid(prefix = '') {
  const s = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${s}` : s;
}

function token() {
  return crypto.randomBytes(24).toString('hex');
}

function nowISO() {
  return new Date().toISOString();
}

function addDays(iso, days) {
  const d = iso ? new Date(iso) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function isExpired(iso) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

/** 把日期按 YYYY-MM-DD 输出（演示用，统一本地可读格式） */
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fromNow(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return fmtDate(iso);
}

function daysLeft(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function parseJSON(text, fallback) {
  if (text === null || text === undefined || text === '') return fallback;
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function stringifyJSON(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** 轻量 HTML 转义，前端内容以纯文本为主，这里做兜底安全处理 */
function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 把纯文本安全地渲染成可展示的 HTML：保留换行与段落 */
function textToSafeHTML(text) {
  return escapeHTML(text)
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function excerpt(text, len = 90) {
  const plain = String(text ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > len ? `${plain.slice(0, len)}…` : plain;
}

function clampInt(value, def, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(n, min), max);
}

module.exports = {
  uid, token, nowISO, addDays, isExpired, fmtDate, fromNow, daysLeft,
  parseJSON, stringifyJSON, escapeHTML, textToSafeHTML, excerpt, clampInt
};
