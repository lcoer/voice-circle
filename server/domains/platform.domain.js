'use strict';
/**
 * 平台资料库领域：档案列表/详情/评论对外只读，后台维护走 /admin 前缀（requireStaff）。
 * 字段覆盖：入驻条件、特色、分成政策、结算周期、规则红线、官方链接、风险提示。
 */

const express = require('express');
const { get, all, run } = require('../data/db');
const util = require('../lib/util');
const { hydratePlatform, attachInteraction } = require('./helpers');
const { ok, wrap, AppError, notFound } = require('../lib/http');
const { requireStaff } = require('../lib/auth');
const audit = require('./audit');

const router = express.Router();
const { uid, nowISO, stringifyJSON } = util;

/* ---------- repository ---------- */

const repo = {
  list({ keyword, category, verified, only, status } = {}) {
    const where = [status === 'all' ? '1 = 1' : "status = 'published'"];
    const params = [];
    if (keyword) {
      where.push('(name LIKE ? OR alias LIKE ? OR summary LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (category) { where.push('category = ?'); params.push(category); }
    if (verified === '1') { where.push('verified = 1'); }
    const rows = all(
      `SELECT * FROM platforms WHERE ${where.join(' AND ')} ORDER BY featured DESC, views DESC`,
      params
    );
    const list = rows.map((p) => {
      const base = hydratePlatform(p);
      if (only === 'list') return base;
      return {
        ...base,
        job_count: get('SELECT COUNT(*) AS c FROM jobs WHERE platform_id = ? AND status = ?', [p.id, 'approved']).c,
        post_count: get('SELECT COUNT(*) AS c FROM posts WHERE platform_id = ? AND status = ?', [p.id, 'published']).c
      };
    });
    return list;
  },
  detail(id, userId) {
    const row = get('SELECT * FROM platforms WHERE id = ?', [id]);
    if (!row) return null;
    run('UPDATE platforms SET views = views + 1 WHERE id = ?', [id]);
    const base = hydratePlatform(row);
    return attachInteraction(base, 'platform', 'id', userId);
  },
  adminSave(body, operatorId) {
    const id = body.id || uid('p');
    const exists = !!get('SELECT id FROM platforms WHERE id = ?', [id]);
    const fields = [
      body.name, body.alias || '', body.category || '综合语音', body.logo_text || (body.name || '').slice(0, 2),
      body.summary || '', stringifyJSON(body.features || []), body.entry_condition || '', body.payout_policy || '',
      body.settlement_cycle || '', stringifyJSON(body.redlines || []), stringifyJSON(body.official_links || []),
      stringifyJSON(body.tags || []), body.risk_note || '', Number(body.verified) ? 1 : 0,
      body.status || 'published', Number(body.featured) ? 1 : 0, nowISO(), id
    ];
    if (exists) {
      run(
        `UPDATE platforms SET name=?, alias=?, category=?, logo_text=?, summary=?, features=?, entry_condition=?,
         payout_policy=?, settlement_cycle=?, redlines=?, official_links=?, tags=?, risk_note=?, verified=?, status=?, featured=?, updated_at=?
         WHERE id=?`, fields
      );
    } else {
      run(
        `INSERT INTO platforms (name, alias, category, logo_text, summary, features, entry_condition,
          payout_policy, settlement_cycle, redlines, official_links, tags, risk_note, verified, status, featured, updated_at, id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, fields
      );
    }
    return id;
  },
  adminRemove(id) {
    run("UPDATE platforms SET status = 'draft' WHERE id = ?", [id]);
  }
};

/* ---------- routes ---------- */

router.get('/', wrap(async (req, res) => {
  ok(res, repo.list({ keyword: req.query.keyword, category: req.query.category, verified: req.query.verified, only: req.query.only, status: req.query.status }));
}));

router.get('/rank', wrap(async (req, res) => {
  const rows = all(
    `SELECT id, name, category, logo_text, views FROM platforms WHERE status = 'published'
     ORDER BY views DESC LIMIT 10`
  );
  ok(res, rows);
}));

router.get('/:id', wrap(async (req, res) => {
  const userId = req.user ? req.user.id : null;
  const data = repo.detail(req.params.id, userId);
  if (!data) throw notFound('平台档案不存在');
  ok(res, data);
}));

/* 后台维护 */
router.post('/admin/save', requireStaff, wrap(async (req, res) => {
  const { name } = req.body || {};
  if (!name) throw new AppError('平台名称不能为空');
    const id = repo.adminSave(req.body, req.user.id);
    audit.log(req.user, '维护平台档案', 'platform', id, req.body.name || '');
    ok(res, { id }, '平台档案已保存');
}));

router.post('/admin/remove', requireStaff, wrap(async (req, res) => {
  repo.adminRemove(req.body.id);
  ok(res, null, '平台已下架');
}));

module.exports = { router, repo };
