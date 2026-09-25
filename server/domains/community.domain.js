'use strict';
/**
 * 社区交流领域：板块内帖子列表（最新/热门/精华）、详情、发帖、赞藏计数。
 * 说明：列表与详情均通过 SQL 子查询聚合互动数，避免应用层多次往返。
 */

const express = require('express');
const { get, all, run } = require('../data/db');
const util = require('../lib/util');
const { myReaction } = require('./helpers');
const { ok, wrap, AppError, notFound, forbidden } = require('../lib/http');
const { requireAuth, requireStaff } = require('../lib/auth');
const risk = require('../lib/risk');
const audit = require('./audit');
const { publish } = require('../lib/bus');

const router = express.Router();
const { uid, nowISO, stringifyJSON, textToSafeHTML, clampInt } = util;

const LIST_SQL = `
  SELECT p.*, u.nick AS author_nick, u.avatar AS author_avatar, u.role AS author_role,
    b.name AS board_name, b.slug AS board_slug, b.accent AS board_accent,
    pf.name AS platform_name, pf.logo_text AS platform_logo,
    (SELECT COUNT(*) FROM reactions r WHERE r.target_id = p.id AND r.target_type = 'post' AND r.type = 'like') AS like_count,
    (SELECT COUNT(*) FROM reactions r WHERE r.target_id = p.id AND r.target_type = 'post' AND r.type = 'fav') AS fav_count,
    (SELECT COUNT(*) FROM comments c WHERE c.target_id = p.id AND c.target_type = 'post' AND c.status = 'published') AS comment_count
  FROM posts p
  JOIN users u ON u.id = p.author_id
  JOIN boards b ON b.id = p.board_id
  LEFT JOIN platforms pf ON pf.id = p.platform_id
`;

function decorate(rows, userId) {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    excerpt: r.excerpt || util.excerpt(r.content, 96),
    content: r.content,
    board_id: r.board_id,
    board_name: r.board_name,
    board_slug: r.board_slug,
    board_accent: r.board_accent,
    author_id: r.author_id,
    author_nick: r.author_nick,
    author_avatar: r.author_avatar,
    author_role: r.author_role,
    platform_id: r.platform_id,
    platform_name: r.platform_name,
    platform_logo: r.platform_logo,
    type: r.type,
    tags: util.parseJSON(r.tags, []),
    status: r.status,
    pinned: r.pinned,
    essence: r.essence,
    views: r.views,
    like_count: r.like_count,
    fav_count: r.fav_count,
    comment_count: r.comment_count,
    liked: myReaction(userId, 'post', r.id, 'like'),
    faved: myReaction(userId, 'post', r.id, 'fav'),
    created_at: r.created_at,
    updated_at: r.updated_at,
    reject_reason: r.reject_reason
  }));
}

const sortMap = {
  latest: 'p.created_at DESC',
  hot: '(p.views + (SELECT COUNT(*) FROM reactions r WHERE r.target_id = p.id AND r.type = \'like\') * 3) DESC, p.created_at DESC',
  essence: 'p.essence DESC, p.created_at DESC'
};

/* ---------- repository ---------- */

const repo = {
  list({ board, platform, type, keyword, sort, subscribed, page = 1, pageSize = 10 }) {
    const where = ["p.status = 'published'"];
    const params = [];
    if (board && board !== 'all') { where.push('p.board_id = ?'); params.push(board); }
    if (platform) { where.push('p.platform_id = ?'); params.push(platform); }
    if (type) { where.push('p.type = ?'); params.push(type); }
    if (keyword) { where.push('(p.title LIKE ? OR p.content LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
    if (subscribed && subscribed.length) {
      where.push(`p.platform_id IN (${subscribed.map(() => '?').join(',')})`);
      params.push(...subscribed);
    }
    const whereSql = where.join(' AND ');
    const total = get(`SELECT COUNT(*) AS c FROM posts p WHERE ${whereSql}`, params).c;
    const orderSql = sortMap[sort] || sortMap.latest;
    const rows = all(
      `${LIST_SQL} WHERE ${whereSql} ORDER BY p.pinned DESC, ${orderSql} LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { rows, total };
  },
  detail(id) {
    return get(`${LIST_SQL} WHERE p.id = ?`, [id]);
  },
  create({ boardId, authorId, title, content, platformId, type, tags }) {
    const id = uid('post');
    const created = nowISO();
    const scan = risk.scan(`${title} ${content}`);
    const status = scan.level === 'high' ? 'pending' : 'published';
    run(
      `INSERT INTO posts (id, board_id, author_id, title, content, platform_id, type, tags, cover, status, pinned, essence, views, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,0,0,0,?,?)`,
      [id, boardId, authorId, title, textToSafeHTML(content), platformId || null, type || 'normal',
        stringifyJSON(tags || []), '', status, created, created]
    );
    return { id, status, scan };
  },
  remove(id, authorId, force) {
    const post = get('SELECT author_id FROM posts WHERE id = ?', [id]);
    if (!post) throw notFound('帖子不存在');
    if (!force && post.author_id !== authorId) throw forbidden('只能删除自己的帖子');
    run("UPDATE posts SET status = 'removed', updated_at = ? WHERE id = ?", [nowISO(), id]);
  }
};

/* ---------- routes ---------- */

router.get('/', wrap(async (req, res) => {
  const userId = req.user ? req.user.id : null;
  const subscribed = req.query.subscribed === '1' && req.user ? util.parseJSON(req.user.platforms, []) : null;
  const pageNum = clampInt(req.query.page, 1, 1, 999);
  const pageSize = clampInt(req.query.page_size, 10, 1, 50);
  const { rows, total } = repo.list({
    board: req.query.board,
    platform: req.query.platform,
    type: req.query.type,
    keyword: req.query.keyword,
    sort: req.query.sort,
    subscribed: subscribed && subscribed.length ? subscribed : null,
    page: pageNum,
    pageSize
  });
  ok(res, {
    list: decorate(rows, userId),
    meta: { total, page: pageNum, page_size: pageSize, total_pages: Math.max(1, Math.ceil(total / pageSize)) }
  });
}));

router.get('/hot', wrap(async (req, res) => {
  const rows = all(
    `${LIST_SQL} WHERE p.status = 'published' ORDER BY (p.views + (SELECT COUNT(*) FROM reactions r WHERE r.target_id=p.id AND r.type='like') * 5) DESC LIMIT 8`
  );
  ok(res, decorate(rows, req.user ? req.user.id : null));
}));

router.get('/:id', wrap(async (req, res) => {
  const row = repo.detail(req.params.id);
  if (!row || row.status === 'removed') throw notFound('帖子不存在或已下架');
  run('UPDATE posts SET views = views + 1 WHERE id = ?', [req.params.id]);
  ok(res, decorate([row], req.user ? req.user.id : null)[0]);
}));

router.post('/', requireAuth, wrap(async (req, res) => {
  const { boardId, title, content, platformId, type, tags } = req.body || {};
  if (!boardId) throw new AppError('请选择发帖板块');
  if (!title || title.trim().length < 4) throw new AppError('标题至少 4 个字');
  if (!content || content.trim().length < 5) throw new AppError('正文内容过短');
  if (!get('SELECT id FROM boards WHERE id = ?', [boardId])) throw new AppError('板块不存在');
  const result = repo.create({ boardId, authorId: req.user.id, title: title.trim(), content, platformId, type, tags });
  const message = result.status === 'pending'
    ? '发布成功，内容命中风控词已进入人工审核队列'
    : '发布成功';
  // 直接上架的帖子才广播：待审核内容前台列表本就查不到，推送会造成无效刷新
  if (result.status === 'published') {
    publish('post', { targetType: 'post', targetId: result.id, actorId: req.user.id });
  }
  ok(res, result, message);
}));

router.delete('/:id', requireAuth, wrap(async (req, res) => {
  const force = ['admin', 'moderator'].includes(req.user.role);
  repo.remove(req.params.id, req.user.id, force);
  publish('post', { targetType: 'post', targetId: req.params.id, actorId: req.user.id });
  ok(res, null, '帖子已删除');
}));

router.post('/admin/status', requireStaff, wrap(async (req, res) => {
  const { id, status, reason } = req.body || {};
  if (!['published', 'rejected', 'removed', 'pending'].includes(status)) throw new AppError('状态值不合法');
  run('UPDATE posts SET status = ?, reject_reason = ?, updated_at = ? WHERE id = ?', [status, reason || '', nowISO(), id]);
  audit.log(req.user, '帖子审核', 'post', id, `${status} ${reason || ''}`);
  publish('post', { targetType: 'post', targetId: id, actorId: req.user.id });
  ok(res, null, '状态已更新');
}));

router.post('/admin/flag', requireStaff, wrap(async (req, res) => {
  const { id, field, value } = req.body || {};
  if (!['pinned', 'essence'].includes(field)) throw new AppError('不支持的操作');
  run(`UPDATE posts SET ${field} = ?, updated_at = ? WHERE id = ?`, [value ? 1 : 0, nowISO(), id]);
  audit.log(req.user, field === 'pinned' ? '帖子置顶' : '帖子加精', 'post', id, String(!!value));
  publish('post', { targetType: 'post', targetId: id, actorId: req.user.id });
  ok(res, null, '已更新');
}));

module.exports = { router, repo, decorate };
