'use strict';
/**
 * 用户与鉴权领域：注册、登录、会话、个人资料、平台订阅、我的发布/收藏。
 * 分层：repository 函数（perUser 前缀）→ service（路由内编排）。不依赖其他领域模块。
 */

const express = require('express');
const { get, all, run } = require('../data/db');
const util = require('../lib/util');
const publicUser = require('./helpers').publicUser;
const { hashPassword, verifyPassword, createSession, destroySession, requireAuth, readToken } = require('../lib/auth');
const { ok, wrap, AppError, notFound } = require('../lib/http');

const router = express.Router();
const { uid, nowISO, stringifyJSON } = util;

/* ---------- repository ---------- */

const repo = {
  byUsername(username) {
    return get('SELECT * FROM users WHERE username = ?', [username]);
  },
  byId(id) {
    return get('SELECT * FROM users WHERE id = ?', [id]);
  },
  create({ username, nick, password, role }) {
    const id = uid('u');
    const { hash, salt } = hashPassword(password);
    run(
      `INSERT INTO users (id, username, nick, password_hash, password_salt, role, avatar, bio, contact, platforms, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, username, nick, hash, salt, role || 'user', nick.slice(0, 1), '', '', '[]', 'normal', nowISO()]
    );
    return id;
  },
  update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const setSql = keys.map((k) => `${k} = ?`).join(', ');
    run(`UPDATE users SET ${setSql} WHERE id = ?`, [...keys.map((k) => fields[k]), id]);
  },
  statistics(userId) {
    const posts = get('SELECT COUNT(*) AS c FROM posts WHERE author_id = ? AND status != ?', [userId, 'removed']).c;
    const jobs = get('SELECT COUNT(*) AS c FROM jobs WHERE author_id = ? AND status != ?', [userId, 'removed']).c;
    const favs = get('SELECT COUNT(*) AS c FROM reactions WHERE user_id = ? AND type = ?', [userId, 'fav']).c;
    return { posts, jobs, favorites: favs };
  }
};

/* ---------- routes ---------- */

router.post('/register', wrap(async (req, res) => {
  const { username, password, nick, role } = req.body || {};
  if (!username || !password) throw new AppError('用户名与密码不能为空');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new AppError('用户名为 3-20 位字母、数字或下划线');
  if (password.length < 6) throw new AppError('密码至少 6 位');
  if (repo.byUsername(username)) throw new AppError('该用户名已被注册', 409);
  const safeRole = ['user', 'recruiter'].includes(role) ? role : 'user';
  const id = repo.create({ username, nick: nick || username, password, role: safeRole });
  const session = createSession(id);
  ok(res, { token: session.token, user: publicUser(repo.byId(id)) }, '注册成功');
}));

router.post('/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const user = repo.byUsername(username);
  if (!user) throw new AppError('用户名或密码错误');
  if (!verifyPassword(password, user.password_salt, user.password_hash)) throw new AppError('用户名或密码错误');
  if (user.status === 'banned') throw new AppError('账号已被封禁', 403);
  const session = createSession(user.id);
  ok(res, { token: session.token, user: publicUser(user) }, '登录成功');
}));

router.post('/logout', requireAuth, wrap(async (req, res) => {
  destroySession(readToken(req));
  ok(res, null, '已退出');
}));

router.get('/me', requireAuth, wrap(async (req, res) => {
  ok(res, { user: publicUser(repo.byId(req.user.id)), stats: repo.statistics(req.user.id) });
}));

router.put('/me', requireAuth, wrap(async (req, res) => {
  const { nick, bio, contact, avatar } = req.body || {};
  const fields = {};
  if (nick !== undefined) fields.nick = String(nick).slice(0, 20) || req.user.nick;
  if (bio !== undefined) fields.bio = String(bio).slice(0, 200);
  if (contact !== undefined) fields.contact = String(contact).slice(0, 60);
  if (avatar !== undefined) fields.avatar = String(avatar).slice(0, 300);
  repo.update(req.user.id, fields);
  ok(res, { user: publicUser(repo.byId(req.user.id)) }, '资料已更新');
}));

router.post('/me/subscribe', requireAuth, wrap(async (req, res) => {
  const { platformId } = req.body || {};
  if (!platformId) throw new AppError('缺少平台 ID');
  const user = repo.byId(req.user.id);
  const list = new Set(util.parseJSON(user.platforms, []));
  if (list.has(platformId)) list.delete(platformId);
  else list.add(platformId);
  repo.update(req.user.id, { platforms: stringifyJSON([...list]) });
  ok(res, { subscribed: [...list] }, '订阅已更新');
}));

router.get('/me/posts', requireAuth, wrap(async (req, res) => {
  const rows = all(
    `SELECT p.*, b.name AS board_name FROM posts p
     JOIN boards b ON b.id = p.board_id
     WHERE p.author_id = ? AND p.status != 'removed'
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  ok(res, rows.map((r) => ({ ...r, tags: util.parseJSON(r.tags, []) })));
}));

router.get('/me/jobs', requireAuth, wrap(async (req, res) => {
  const rows = all(
    `SELECT j.*, pf.name AS platform_name FROM jobs j
     LEFT JOIN platforms pf ON pf.id = j.platform_id
     WHERE j.author_id = ? ORDER BY j.created_at DESC`,
    [req.user.id]
  );
  ok(res, rows);
}));

router.get('/me/favorites', requireAuth, wrap(async (req, res) => {
  const rows = all(
    'SELECT target_type, target_id, created_at FROM reactions WHERE user_id = ? AND type = ? ORDER BY created_at DESC',
    [req.user.id, 'fav']
  );
  const result = [];
  rows.forEach((r) => {
    if (r.target_type === 'post') {
      const p = get('SELECT id, title, board_id, created_at FROM posts WHERE id = ?', [r.target_id]);
      if (p) result.push({ target_type: 'post', target_id: r.target_id, title: p.title, board_id: p.board_id, at: r.created_at });
    } else if (r.target_type === 'job') {
      const j = get('SELECT id, title, kind FROM jobs WHERE id = ?', [r.target_id]);
      if (j) result.push({ target_type: 'job', target_id: r.target_id, title: j.title, kind: j.kind, at: r.created_at });
    } else if (r.target_type === 'tool') {
      const t = get('SELECT id, title, category FROM tools WHERE id = ?', [r.target_id]);
      if (t) result.push({ target_type: 'tool', target_id: r.target_id, title: t.title, category: t.category, at: r.created_at });
    } else if (r.target_type === 'platform') {
      const pf = get('SELECT id, name FROM platforms WHERE id = ?', [r.target_id]);
      if (pf) result.push({ target_type: 'platform', target_id: r.target_id, title: pf.name, at: r.created_at });
    }
  });
  ok(res, result);
}));

router.get('/users/:id', wrap(async (req, res) => {
  const user = repo.byId(req.params.id);
  if (!user) throw notFound('用户不存在');
  const stats = repo.statistics(req.params.id);
  const recentPosts = all(
    `SELECT id, title, created_at, views FROM posts WHERE author_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 5`,
    [req.params.id]
  );
  ok(res, { user: publicUser(user), stats, recentPosts });
}));

router.get('/users/:id/posts', wrap(async (req, res) => {
  const rows = all(
    `SELECT p.*, b.name AS board_name FROM posts p JOIN boards b ON b.id = p.board_id
     WHERE p.author_id = ? AND p.status = 'published' ORDER BY p.created_at DESC`,
    [req.params.id]
  );
  ok(res, rows.map((r) => ({ ...r, tags: util.parseJSON(r.tags, []) })));
}));

module.exports = { router, repo };
