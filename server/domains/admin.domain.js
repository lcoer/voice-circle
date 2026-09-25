'use strict';
/** 管理后台领域：概览看板、审核队列、举报处理、用户管理、操作日志。 */

const express = require('express');
const { get, all, run } = require('../data/db');
const util = require('../lib/util');
const { ok, wrap, AppError, notFound } = require('../lib/http');
const { requireStaff, requireAdmin } = require('../lib/auth');
const audit = require('./audit');
const metaDomain = require('./meta.domain');
const { publish } = require('../lib/bus');

const router = express.Router();
const { nowISO, addDays } = util;

/* ---------- repository ---------- */

const repo = {
  overview() {
    const c = (sql, params = []) => Number(get(sql, params).c);
    const trend = [];
    for (let i = 6; i >= 0; i -= 1) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const label = `${start.getMonth() + 1}/${start.getDate()}`;
      const iso = start.toISOString();
      const nextIso = addDays(iso, 1);
      trend.push({
        label,
        posts: c('SELECT COUNT(*) AS c FROM posts WHERE created_at >= ? AND created_at < ?', [iso, nextIso]),
        jobs: c('SELECT COUNT(*) AS c FROM jobs WHERE created_at >= ? AND created_at < ?', [iso, nextIso]),
        users: c('SELECT COUNT(*) AS c FROM users WHERE created_at >= ? AND created_at < ?', [iso, nextIso])
      });
    }
    return {
      counts: {
        users: c('SELECT COUNT(*) AS c FROM users'),
        posts: c("SELECT COUNT(*) AS c FROM posts WHERE status = 'published'"),
        pending_posts: c("SELECT COUNT(*) AS c FROM posts WHERE status = 'pending'"),
        jobs: c("SELECT COUNT(*) AS c FROM jobs WHERE status = 'approved'"),
        pending_jobs: c("SELECT COUNT(*) AS c FROM jobs WHERE status = 'pending'"),
        expired_jobs: c("SELECT COUNT(*) AS c FROM jobs WHERE status = 'expired'"),
        pending_reports: c("SELECT COUNT(*) AS c FROM reports WHERE status = 'pending'"),
        pending_comments: c("SELECT COUNT(*) AS c FROM comments WHERE status = 'pending'"),
        tools: c("SELECT COUNT(*) AS c FROM tools WHERE status = 'on'"),
        platforms: c("SELECT COUNT(*) AS c FROM platforms WHERE status = 'published'")
      },
      trend,
      hot_platforms: all('SELECT name, views FROM platforms ORDER BY views DESC LIMIT 5'),
      role_distribution: metaDomain.DICT.userRoles.map((r) => ({
        label: r.label,
        value: c('SELECT COUNT(*) AS c FROM users WHERE role = ?', [r.value])
      }))
    };
  },
  pending() {
    const posts = all(
      `SELECT p.id, p.title, p.created_at, p.board_id, p.author_id, u.nick AS author_nick, b.name AS board_name
       FROM posts p JOIN users u ON u.id = p.author_id JOIN boards b ON b.id = p.board_id
       WHERE p.status = 'pending' ORDER BY p.created_at ASC`
    );
    const jobs = all(
      `SELECT j.id, j.title, j.kind, j.role_type, j.created_at, u.nick AS author_nick,
              j.risk_deposit, j.risk_fee, pf.name AS platform_name
       FROM jobs j JOIN users u ON u.id = j.author_id LEFT JOIN platforms pf ON pf.id = j.platform_id
       WHERE j.status = 'pending' OR j.status = 'expired' ORDER BY j.created_at ASC`
    );
    const comments = all(
      `SELECT c.id, c.content, c.created_at, c.target_type, c.target_id, u.nick AS author_nick
       FROM comments c JOIN users u ON u.id = c.author_id WHERE c.status = 'pending' ORDER BY c.created_at ASC`
    );
    return { posts, jobs, comments };
  }
};

/* ---------- routes ---------- */

router.get('/overview', requireStaff, wrap(async (req, res) => {
  ok(res, repo.overview());
}));

router.get('/pending', requireStaff, wrap(async (req, res) => {
  ok(res, repo.pending());
}));

router.get('/reports', requireStaff, wrap(async (req, res) => {
  const status = req.query.status || 'pending';
  const rows = all(
    `SELECT r.*, u.nick AS reporter_nick, h.nick AS handler_nick FROM reports r
     JOIN users u ON u.id = r.reporter_id LEFT JOIN users h ON h.id = r.handler_id
     WHERE r.status = ? ORDER BY r.created_at DESC`,
    [status]
  );
  const enriched = rows.map((r) => {
    let title = '';
    if (r.target_type === 'post') title = get('SELECT title FROM posts WHERE id = ?', [r.target_id])?.title || '（已删除）';
    if (r.target_type === 'job') title = get('SELECT title FROM jobs WHERE id = ?', [r.target_id])?.title || '（已删除）';
    if (r.target_type === 'comment') title = util.excerpt(get('SELECT content FROM comments WHERE id = ?', [r.target_id])?.content || '', 40);
    return { ...r, target_title: title };
  });
  ok(res, enriched);
}));

router.post('/reports/handle', requireStaff, wrap(async (req, res) => {
  const { id, action, note } = req.body || {};
  const report = get('SELECT * FROM reports WHERE id = ?', [id]);
  if (!report) throw notFound('举报记录不存在');
  run('UPDATE reports SET status = ?, action = ?, handler_id = ?, handled_at = ? WHERE id = ?',
    ['resolved', action, req.user.id, nowISO(), id]);
  if (action === '下架') {
    if (report.target_type === 'post') run("UPDATE posts SET status = 'removed', updated_at = ? WHERE id = ?", [nowISO(), report.target_id]);
    if (report.target_type === 'job') run("UPDATE jobs SET status = 'removed', updated_at = ? WHERE id = ?", [nowISO(), report.target_id]);
    if (report.target_type === 'comment') run("UPDATE comments SET status = 'removed' WHERE id = ?", [report.target_id]);
    // 举报成立并下架后，其他正在浏览该内容的用户需要立刻看到它消失
    if (['post', 'job', 'comment'].includes(report.target_type)) {
      publish(report.target_type === 'comment' ? 'comment' : report.target_type === 'job' ? 'job' : 'post',
        { targetType: report.target_type, targetId: report.target_id, actorId: req.user.id });
    }
  }
  audit.log(req.user, '处理举报', report.target_type, report.target_id, `${report.reason_type} / ${action} ${note || ''}`);
  ok(res, null, '举报已处理');
}));

router.post('/comments/status', requireStaff, wrap(async (req, res) => {
  const { id, status } = req.body || {};
  const row = get('SELECT target_type AS t, target_id AS tid FROM comments WHERE id = ?', [id]);
  run('UPDATE comments SET status = ? WHERE id = ?', [status === 'published' ? 'published' : 'removed', id]);
  publish('comment', { targetType: row ? row.t : null, targetId: row ? row.tid : null, actorId: req.user.id });
  audit.log(req.user, '评论审核', 'comment', id, status);
  ok(res, null, '已更新');
}));

router.get('/users', requireStaff, wrap(async (req, res) => {
  const keyword = req.query.keyword;
  const rows = keyword
    ? all('SELECT * FROM users WHERE username LIKE ? OR nick LIKE ? ORDER BY created_at DESC', [`%${keyword}%`, `%${keyword}%`])
    : all('SELECT * FROM users ORDER BY created_at DESC');
  const { publicUser } = require('./helpers');
  ok(res, rows.map(publicUser));
}));

router.post('/users/save', requireAdmin, wrap(async (req, res) => {
  const { id, role, status } = req.body || {};
  const user = get('SELECT id FROM users WHERE id = ?', [id]);
  if (!user) throw notFound('用户不存在');
  if (id === req.user.id && (role !== 'admin' || status === 'banned')) throw new AppError('不能修改自己的管理员权限或封禁自己');
  run('UPDATE users SET role = ?, status = ? WHERE id = ?', [role || 'user', status || 'normal', id]);
  audit.log(req.user, '修改用户权限', 'user', id, `role=${role} status=${status}`);
  ok(res, null, '用户已更新');
}));

router.get('/logs', requireStaff, wrap(async (req, res) => {
  ok(res, audit.recent(Number(req.query.limit) || 40));
}));

module.exports = { router, repo };
