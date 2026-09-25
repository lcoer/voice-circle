'use strict';
/**
 * 鉴权底座：密码哈希（scrypt）、会话 token、角色中间件。
 * 依赖 lib/util + data/db，不依赖任何业务领域，避免循环依赖。
 */

const crypto = require('node:crypto');
const { run, get } = require('../data/db');
const { token, nowISO, addDays } = require('./util');
const { unauth, forbidden } = require('./http');

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return { hash, salt: s };
}

function verifyPassword(password, salt, hash) {
  try {
    const calc = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(hash, 'hex'));
  } catch (_) {
    return false;
  }
}

function createSession(userId) {
  const tk = token();
  const created = nowISO();
  const expires = addDays(created, 7);
  run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [tk, userId, created, expires]);
  return { token: tk, expiresAt: expires };
}

function destroySession(tk) {
  run('DELETE FROM sessions WHERE token = ?', [tk]);
}

function userFromToken(tk) {
  if (!tk) return null;
  const row = get(
    `SELECT u.*, s.expires_at FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`,
    [tk]
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(tk);
    return null;
  }
  const { expires_at, password_hash, password_salt, ...rest } = row;
  return rest;
}

/** Cookie 名：线上走反向代理时 Authorization / 自定义头可能被剥离，Cookie 是最稳的兜底通道 */
const COOKIE_NAME = 'vc_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  String(header).split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    if (key) out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

/**
 * 取值优先级：Cookie → x-token → Authorization。
 * 原因：部署平台的反向代理会给每个请求注入自己的 JWT 到 Authorization 头（覆盖业务 token），
 * 导致 Bearer 通道在托管环境下不可用；Cookie 与自定义头不受影响。
 */
function isInjectedJWT(value) {
  return /^eyJ[A-Za-z0-9_-]+\./.test(value);
}

function readToken(req) {
  const fromCookie = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const fromHeader = req.headers['x-token'];
  if (fromHeader) return String(fromHeader);
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const value = auth.slice(7);
    if (value && !isInjectedJWT(value)) return value;
  }
  return '';
}

/** 登录/注册成功后写入会话 Cookie（HttpOnly，前端无需感知） */
function setTokenCookie(res, tk) {
  const value = `${COOKIE_NAME}=${encodeURIComponent(tk)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`;
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, value) : value);
}

function clearTokenCookie(res) {
  const value = `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, value) : value);
}

/** 解析当前登录用户（可为空），挂载到 req.user */
function attachUser(req, _res, next) {
  req.user = userFromToken(readToken(req));
  next();
}

/** 必须登录 */
function requireAuth(req, _res, next) {
  if (!req.user) return next(unauth('请先登录后再操作'));
  if (req.user.status === 'banned') return next(forbidden('账号已被封禁，如有异议请联系管理员'));
  next();
}

/** 必须是管理员 / 审核员 */
function requireStaff(req, _res, next) {
  if (!req.user) return next(unauth('请先登录后再操作'));
  if (!['admin', 'moderator'].includes(req.user.role)) return next(forbidden('仅管理员或审核员可操作'));
  next();
}

function requireAdmin(req, _res, next) {
  if (!req.user) return next(unauth('请先登录后再操作'));
  if (req.user.role !== 'admin') return next(forbidden('仅超级管理员可操作'));
  next();
}

module.exports = {
  hashPassword, verifyPassword, createSession, destroySession, userFromToken, readToken,
  setTokenCookie, clearTokenCookie,
  attachUser, requireAuth, requireStaff, requireAdmin
};
