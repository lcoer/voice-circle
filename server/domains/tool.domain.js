'use strict';
/** 行业工具包领域：分类浏览、详情、查看/下载计数，后台维护与上/下架。 */

const express = require('express');
const { get, all, run } = require('../data/db');
const util = require('../lib/util');
const { hydrateTool, attachInteraction } = require('./helpers');
const { ok, wrap, AppError, notFound } = require('../lib/http');
const { requireStaff } = require('../lib/auth');
const audit = require('./audit');

const router = express.Router();
const { uid, nowISO, stringifyJSON } = util;

const repo = {
  list({ keyword, category, status }) {
    const where = ['1 = 1'];
    const params = [];
    if (keyword) { where.push('(title LIKE ? OR summary LIKE ? OR tags LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    if (category) { where.push('category = ?'); params.push(category); }
    if (status && status !== 'all') { where.push('status = ?'); params.push(status); }
    else if (!status) where.push("status = 'on'");
    const rows = all(
      `SELECT * FROM tools WHERE ${where.join(' AND ')} ORDER BY pinned DESC, downloads DESC, created_at DESC`,
      params
    );
    return rows.map(hydrateTool);
  },
  detail(id, userId) {
    const row = get('SELECT * FROM tools WHERE id = ?', [id]);
    if (!row) return null;
    run('UPDATE tools SET views = views + 1 WHERE id = ?', [id]);
    return attachInteraction(hydrateTool(row), 'tool', 'id', userId);
  },
  download(id) {
    run('UPDATE tools SET downloads = downloads + 1 WHERE id = ?', [id]);
    return get('SELECT title, link, file_path, form, content FROM tools WHERE id = ?', [id]);
  },
  toggle(id, field) {
    const row = get('SELECT * FROM tools WHERE id = ?', [id]);
    if (!row) throw notFound('工具不存在');
    const next = row[field] ? 0 : 1;
    run(`UPDATE tools SET ${field} = ? WHERE id = ?`, [next, id]);
    return next;
  },
  save(body) {
    if (!body.title) throw new AppError('工具标题不能为空');
    const id = body.id || uid('t');
    const exists = !!get('SELECT id FROM tools WHERE id = ?', [id]);
    const fields = [
      body.title, body.category || '话术模板', body.form || 'template', body.summary || '',
      body.content || '', body.link || '', body.file_path || '', stringifyJSON(body.tags || []),
      body.status || 'on', Number(body.pinned) ? 1 : 0, nowISO(), id
    ];
    if (exists) {
      run(
        `UPDATE tools SET title=?, category=?, form=?, summary=?, content=?, link=?, file_path=?, tags=?, status=?, pinned=?, updated_at=?
         WHERE id=?`, fields
      );
    } else {
      run(
        `INSERT INTO tools (title, category, form, summary, content, link, file_path, tags, status, pinned, updated_at, id, created_at, views, downloads, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [...fields.slice(0, 11), id, nowISO(), 0, 0, body.created_by || null]
      );
    }
    return id;
  },
  remove(id) {
    run('DELETE FROM tools WHERE id = ?', [id]);
  }
};

router.get('/', wrap(async (req, res) => {
  ok(res, repo.list(req.query));
}));

router.get('/:id', wrap(async (req, res) => {
  const userId = req.user ? req.user.id : null;
  const data = repo.detail(req.params.id, userId);
  if (!data) throw notFound('工具不存在或已下架');
  ok(res, data);
}));

router.post('/:id/download', wrap(async (req, res) => {
  const tool = repo.download(req.params.id);
  if (!tool) throw notFound('工具不存在');
  ok(res, tool);
}));

router.post('/admin/save', requireStaff, wrap(async (req, res) => {
    const id = repo.save(req.body);
    audit.log(req.user, '维护工具', 'tool', id, req.body.title || '');
    ok(res, { id }, '工具已保存');
}));

router.post('/admin/toggle', requireStaff, wrap(async (req, res) => {
  const field = ['status', 'pinned'].includes(req.body.field) ? (req.body.field === 'status' ? 'status' : 'pinned') : 'pinned';
    if (field === 'status') {
      const row = get('SELECT status FROM tools WHERE id = ?', [req.body.id]);
      const next = row.status === 'on' ? 'off' : 'on';
      run('UPDATE tools SET status = ? WHERE id = ?', [next, req.body.id]);
      audit.log(req.user, '工具上下架', 'tool', req.body.id, next);
    ok(res, { value: next }, next === 'on' ? '已上架' : '已下架');
  } else {
    const next = repo.toggle(req.body.id, 'pinned');
    ok(res, { value: next }, next ? '已置顶' : '已取消置顶');
  }
}));

router.post('/admin/remove', requireStaff, wrap(async (req, res) => {
  repo.remove(req.body.id);
  ok(res, null, '工具已删除');
}));

module.exports = { router, repo };
