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

function readToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-token'] || '';
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
  attachUser, requireAuth, requireStaff, requireAdmin
};
