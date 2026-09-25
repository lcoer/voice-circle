'use strict';
/** 互动领域：评论（帖子/岗位/平台/工具）与点赞收藏的统一接口，避免各领域重复实现。 */

const express = require('express');
const { get, all, run } = require('../data/db');
const util = require('../lib/util');
const { likeCount, favCount, commentCount, myReaction } = require('./helpers');
const { ok, wrap, AppError, notFound } = require('../lib/http');
const { requireAuth } = require('../lib/auth');
const risk = require('../lib/risk');
const { publish } = require('../lib/bus');

const router = express.Router();
const { uid, nowISO, plainText } = util;

function targetExists(targetType, targetId) {
  if (targetType === 'post') return !!get('SELECT id FROM posts WHERE id = ?', [targetId]);
  if (targetType === 'job') return !!get('SELECT id FROM jobs WHERE id = ?', [targetId]);
  if (targetType === 'platform') return !!get('SELECT id FROM platforms WHERE id = ?', [targetId]);
  if (targetType === 'tool') return !!get('SELECT id FROM tools WHERE id = ?', [targetId]);
  return false;
}

router.get('/comments', wrap(async (req, res) => {
  const { target_type: targetType, target_id: targetId } = req.query;
  if (!targetType || !targetId) throw new AppError('缺少评论目标');
  const rows = all(
    `SELECT c.*, u.nick AS author_nick, u.avatar AS author_avatar, u.role AS author_role
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.target_type = ? AND c.target_id = ? AND c.status = 'published'
     ORDER BY c.created_at ASC`,
    [targetType, targetId]
  );
  ok(res, rows);
}));

router.post('/comments', requireAuth, wrap(async (req, res) => {
  const { target_type: targetType, target_id: targetId, content } = req.body || {};
  if (!targetType || !targetId) throw new AppError('缺少评论目标');
  if (!content || content.trim().length < 2) throw new AppError('评论内容过短');
  if (!targetExists(targetType, targetId)) throw notFound('评论目标不存在');
  const scan = risk.scan(content);
  const id = uid('c');
  run(
    `INSERT INTO comments (id, target_type, target_id, parent_id, author_id, content, status, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, targetType, targetId, null, req.user.id, plainText(content),
      scan.level === 'high' ? 'pending' : 'published', nowISO()]
  );
  const row = get(
    `SELECT c.*, u.nick AS author_nick, u.avatar AS author_avatar FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
    [id]
  );
  if (row.status === 'published') {
    publish('comment', { targetType, targetId, actorId: req.user.id });
  }
  ok(res, row, scan.level === 'high' ? '评论已进入审核' : '评论已发布');
}));

router.delete('/comments/:id', requireAuth, wrap(async (req, res) => {
  const row = get('SELECT author_id FROM comments WHERE id = ?', [req.params.id]);
  if (!row) throw notFound('评论不存在');
  if (row.author_id !== req.user.id && !['admin', 'moderator'].includes(req.user.role)) {
    throw new AppError('只能删除自己的评论', 403);
  }
  const target = get('SELECT target_type AS t, target_id AS id FROM comments WHERE id = ?', [req.params.id]);
  run("UPDATE comments SET status = 'removed' WHERE id = ?", [req.params.id]);
  // 目标列表的评论数会减少，广播让详情页/列表数字实时同步
  publish('comment', { targetType: target ? target.t : null, targetId: target ? target.id : null, actorId: req.user.id });
  ok(res, null, '评论已删除');
}));

router.post('/reaction', requireAuth, wrap(async (req, res) => {
  const { target_type: targetType, target_id: targetId, type } = req.body || {};
  if (!['like', 'fav'].includes(type)) throw new AppError('互动类型不合法');
  if (!targetExists(targetType, targetId)) throw notFound('内容不存在');
  const existing = get(
    'SELECT id FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND type = ?',
    [req.user.id, targetType, targetId, type]
  );
  let active = 0;
  if (existing) {
    run('DELETE FROM reactions WHERE id = ?', [existing.id]);
  } else {
    run('INSERT INTO reactions (id, user_id, target_type, target_id, type, created_at) VALUES (?,?,?,?,?,?)',
      [uid('r'), req.user.id, targetType, targetId, type, nowISO()]);
    active = 1;
  }
  // 赞藏只影响计数（也有可能改变"热门"排序），广播后前台按需刷新列表数字
  publish('reaction', { targetType, targetId, actorId: req.user.id });
  ok(res, {
    active,
    like_count: likeCount(targetType, targetId),
    fav_count: favCount(targetType, targetId),
    comment_count: commentCount(targetType, targetId),
    liked: myReaction(req.user.id, targetType, targetId, 'like'),
    faved: myReaction(req.user.id, targetType, targetId, 'fav')
  });
}));

router.post('/reports', requireAuth, wrap(async (req, res) => {
  const { target_type: targetType, target_id: targetId, reason_type: reasonType, reason_detail: detail } = req.body || {};
  if (!targetType || !targetId) throw new AppError('缺少举报目标');
  if (!reasonType) throw new AppError('请选择举报类型');
  const id = uid('rep');
  run(
    `INSERT INTO reports (id, target_type, target_id, reason_type, reason_detail, reporter_id, status, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, targetType, targetId, reasonType, detail || '', req.user.id, 'pending', nowISO()]
  );
  ok(res, { id }, '举报已提交，平台将在 24 小时内处理');
}));

module.exports = { router };
