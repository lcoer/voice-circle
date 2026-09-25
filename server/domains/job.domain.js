'use strict';
/**
 * 招聘求职领域：岗位列表（多维筛选）、详情、发布、续期、自动过期下架、后台审核。
 * 行业字段：所属平台、岗位类型、薪资结构、结算周期、排班麦时、风险标记（押金/培训费）。
 */

const express = require('express');
const { get, all, run } = require('../data/db');
const util = require('../lib/util');
const { myReaction } = require('./helpers');
const { ok, wrap, AppError, notFound, forbidden } = require('../lib/http');
const { requireAuth, requireStaff } = require('../lib/auth');
const risk = require('../lib/risk');
const config = require('../config');
const audit = require('./audit');

const router = express.Router();
const { uid, nowISO, addDays, textToSafeHTML, clampInt } = util;

const BASE_SQL = `
  SELECT j.*, u.nick AS author_nick, u.avatar AS author_avatar, u.role AS author_role, u.contact AS author_contact,
    pf.name AS platform_name, pf.logo_text AS platform_logo, pf.category AS platform_category,
    (SELECT COUNT(*) FROM reactions r WHERE r.target_id = j.id AND r.target_type = 'job' AND r.type = 'fav') AS fav_count,
    (SELECT COUNT(*) FROM comments c WHERE c.target_id = j.id AND c.target_type = 'job' AND c.status = 'published') AS comment_count
  FROM jobs j
  JOIN users u ON u.id = j.author_id
  LEFT JOIN platforms pf ON pf.id = j.platform_id
`;

function jobRiskFlags(row) {
  const flags = [];
  if (row.risk_deposit) flags.push({ code: 'deposit', label: '收取押金', level: 'high' });
  if (row.risk_fee) flags.push({ code: 'fee', label: '收取培训费/入职费', level: 'high' });
  if (!row.real_name_verified) flags.push({ code: 'unverified', label: '招聘方未实名核验', level: 'medium' });
  if (risk.salaryLooksOdd(row)) flags.push({ code: 'salary', label: '薪资水平显著高于行业均值，请谨慎甄别', level: 'medium' });
  return flags;
}

function decorate(rows, userId) {
  return rows.map((r) => ({
    ...r,
    tags: [],
    risk_flags: jobRiskFlags(r),
    days_left: util.daysLeft(r.expires_at),
    expired: util.isExpired(r.expires_at),
    faved: myReaction(userId, 'job', r.id, 'fav')
  }));
}

/** 到期自动下架：任何查询前先跑一次，保证 expired 状态实时生效 */
function sweepExpired() {
  run("UPDATE jobs SET status = 'expired', updated_at = ? WHERE status = 'approved' AND expires_at IS NOT NULL AND expires_at < ?",
    [nowISO(), nowISO()]);
}

/* ---------- repository ---------- */

const repo = {
  list(q = {}) {
    sweepExpired();
    const where = [];
    const params = [];
    if (q.status) { where.push('j.status = ?'); params.push(q.status); }
    else { where.push("j.status = 'approved'"); }
    if (q.kind) { where.push('j.kind = ?'); params.push(q.kind); }
    if (q.platform) { where.push('j.platform_id = ?'); params.push(q.platform); }
    if (q.role_type) { where.push('j.role_type = ?'); params.push(q.role_type); }
    if (q.salary_cycle) { where.push('j.salary_cycle = ?'); params.push(q.salary_cycle); }
    if (q.no_risk === '1') { where.push('j.risk_deposit = 0 AND j.risk_fee = 0'); }
    if (q.min_salary) { where.push('j.salary_max >= ?'); params.push(Number(q.min_salary)); }
    if (q.keyword) { where.push('(j.title LIKE ? OR j.description LIKE ?)'); params.push(`%${q.keyword}%`, `%${q.keyword}%`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql = q.sort === 'salary' ? 'j.salary_max DESC, j.created_at DESC'
      : q.sort === 'hot' ? 'j.views DESC, j.created_at DESC'
        : 'j.created_at DESC';
    const pageNum = clampInt(q.page, 1, 1, 999);
    const pageSize = clampInt(q.page_size, 12, 1, 50);
    const total = get(`SELECT COUNT(*) AS c FROM jobs j ${whereSql}`, params).c;
    const rows = all(`${BASE_SQL} ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`, [...params, pageSize, (pageNum - 1) * pageSize]);
    return { rows, total, pageNum, pageSize };
  },
  detail(id) {
    return get(`${BASE_SQL} WHERE j.id = ?`, [id]);
  },
  create(body, authorId) {
    const id = uid('job');
    const created = nowISO();
    const scan = risk.scan(`${body.title} ${body.description}`);
    const autoApprove = body.auto_approve === true;
    const status = autoApprove ? 'approved' : (scan.level === 'high' ? 'pending' : 'pending');
    const ttl = Number(body.ttl_days) || config.JOB_DEFAULT_TTL_DAYS;
    run(
      `INSERT INTO jobs (id, kind, title, platform_id, role_type, salary_min, salary_max, salary_unit, salary_cycle,
        work_time, city, remote, contact_name, contact_value, description, risk_deposit, risk_fee, real_name_verified,
        status, expires_at, author_id, views, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
      [id, body.kind === 'seek' ? 'seek' : 'recruit', body.title, body.platform_id || null, body.role_type || '',
        Number(body.salary_min) || 0, Number(body.salary_max) || 0, body.salary_unit || '元/月', body.salary_cycle || '月结',
        body.work_time || '', body.city || '', body.remote === false ? 0 : 1, body.contact_name || '', body.contact_value || '',
        textToSafeHTML(body.description || ''), body.risk_deposit ? 1 : 0, body.risk_fee ? 1 : 0, body.real_name_verified ? 1 : 0,
        status, addDays(created, ttl), authorId, created, created]
    );
    return { id, status, scan };
  },
  renew(id, authorId, force) {
    const job = get('SELECT author_id, status FROM jobs WHERE id = ?', [id]);
    if (!job) throw notFound('岗位不存在');
    if (!force && job.author_id !== authorId) throw forbidden('只能续期自己发布的岗位');
    const next = addDays(nowISO(), config.JOB_DEFAULT_TTL_DAYS);
    run("UPDATE jobs SET expires_at = ?, status = ?, updated_at = ? WHERE id = ?",
      [next, job.status === 'expired' ? 'pending' : job.status, nowISO(), id]);
    return { expires_at: next, status: job.status === 'expired' ? 'pending' : job.status };
  },
  close(id, authorId, force) {
    const job = get('SELECT author_id FROM jobs WHERE id = ?', [id]);
    if (!job) throw notFound('岗位不存在');
    if (!force && job.author_id !== authorId) throw forbidden('只能下架自己发布的岗位');
    run("UPDATE jobs SET status = 'removed', updated_at = ? WHERE id = ?", [nowISO(), id]);
  }
};

/* ---------- routes ---------- */

router.get('/', wrap(async (req, res) => {
  const { rows, total, pageNum, pageSize } = repo.list(req.query);
  ok(res, {
    list: decorate(rows, req.user ? req.user.id : null),
    meta: { total, page: pageNum, page_size: pageSize, total_pages: Math.max(1, Math.ceil(total / pageSize)) }
  });
}));

router.get('/latest', wrap(async (req, res) => {
  sweepExpired();
  const rows = all(`${BASE_SQL} WHERE j.status = 'approved' ORDER BY j.created_at DESC LIMIT 6`);
  ok(res, decorate(rows, req.user ? req.user.id : null));
}));

router.get('/:id', wrap(async (req, res) => {
  sweepExpired();
  const row = repo.detail(req.params.id);
  if (!row) throw notFound('岗位不存在');
  run('UPDATE jobs SET views = views + 1 WHERE id = ?', [req.params.id]);
  ok(res, decorate([row], req.user ? req.user.id : null)[0]);
}));

router.post('/', requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.title || b.title.trim().length < 4) throw new AppError('标题至少 4 个字');
  if (!b.description || b.description.trim().length < 10) throw new AppError('请补充岗位/求职详情（至少 10 字）');
  // 收费类岗位由 jobRiskFlags 统一打标记：列表与详情页强展示红色风险横幅并降低曝光权重
  const staff = ['admin', 'moderator'].includes(req.user.role);
  const result = repo.create({ ...b, title: b.title.trim(), auto_approve: staff }, req.user.id);
  ok(res, result, '发布成功，已进入审核队列，通过后自动上架');
}));

router.post('/:id/renew', requireAuth, wrap(async (req, res) => {
  const force = ['admin', 'moderator'].includes(req.user.role);
  const data = repo.renew(req.params.id, req.user.id, force);
  ok(res, data, '已续期 30 天');
}));

router.post('/:id/close', requireAuth, wrap(async (req, res) => {
  const force = ['admin', 'moderator'].includes(req.user.role);
  repo.close(req.params.id, req.user.id, force);
  ok(res, null, '已下架');
}));

router.post('/admin/status', requireStaff, wrap(async (req, res) => {
  const { id, status, reason } = req.body || {};
  if (!['approved', 'rejected', 'removed', 'pending'].includes(status)) throw new AppError('状态值不合法');
  run('UPDATE jobs SET status = ?, reject_reason = ?, updated_at = ? WHERE id = ?', [status, reason || '', nowISO(), id]);
  audit.log(req.user, '招聘审核', 'job', id, `${status} ${reason || ''}`);
  ok(res, null, '审核结果已保存');
}));

module.exports = { router, repo, sweepExpired, jobRiskFlags };
