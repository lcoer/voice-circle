'use strict';
/** 站点级选项：板块、分类字典、筛选项、免责声明。前台筛选与后台表单共用同一份字典。 */

const express = require('express');
const { all } = require('../data/db');
const { ok } = require('../lib/http');
const { requireAdmin } = require('../lib/auth');
const { run, get } = require('../data/db');
const { uid, nowISO } = require('../lib/util');
const { AppError } = require('../lib/http');

const DICT = {
  disclaimer: '平台入驻条件、分成政策、结算周期等均为示例数据，以各平台官方最新公告为准',
  platformCategories: ['综合语音', '游戏陪玩语音', '社交语音', '二次元语音', '综合内容'],
  toolCategories: ['话术模板', '运营表格', '合同协议', '素材资源', '软件工具', '避坑指南'],
  toolForms: [
    { value: 'template', label: '模板正文' },
    { value: 'article', label: '图文教程' },
    { value: 'link', label: '外部链接' },
    { value: 'file', label: '附件下载' }
  ],
  roleTypes: ['主播', '主持', '运营', '厅管', '星探', '美工', '音频后期'],
  salaryUnits: ['元/月', '元/小时', '分成%'],
  salaryCycles: ['日结', '周结', '半月结', '月结'],
  reportReasons: ['虚假信息', '收取押金', '诈骗风险', '广告引流', '人身攻击', '其他'],
  postTypes: [
    { value: 'experience', label: '运营经验' },
    { value: 'resource', label: '资源分享' },
    { value: 'expose', label: '避坑曝光' },
    { value: 'question', label: '新人问答' },
    { value: 'normal', label: '综合讨论' }
  ],
  userRoles: [
    { value: 'user', label: '普通用户' },
    { value: 'recruiter', label: '招聘方/厅主' },
    { value: 'moderator', label: '审核员' },
    { value: 'admin', label: '超级管理员' }
  ]
};

const router = express.Router();

router.get('/options', (req, res) => {
  const boards = all('SELECT * FROM boards ORDER BY sort_order ASC').map((b) => ({
    ...b,
    thread_count: get('SELECT COUNT(*) AS c FROM posts WHERE board_id = ? AND status = ?', [b.id, 'published']).c
  }));
  const platforms = all('SELECT id, name, category FROM platforms WHERE status = ? ORDER BY featured DESC, views DESC', ['published']);
  ok(res, { ...DICT, boards, platforms });
});

router.get('/boards', (req, res) => {
  const boards = all('SELECT * FROM boards ORDER BY sort_order ASC');
  ok(res, boards);
});

router.post('/boards', requireAdmin, (req, res) => {
  const { name, slug, description, accent, sort_order } = req.body || {};
  if (!name || !slug) throw new AppError('板块名称与标识不能为空');
  if (get('SELECT id FROM boards WHERE slug = ?', [slug])) throw new AppError('板块标识已存在');
  const id = uid('b');
  run('INSERT INTO boards (id, name, slug, description, accent, sort_order) VALUES (?,?,?,?,?,?)',
    [id, name, slug, description || '', accent || 'violet', Number(sort_order) || 99]);
  ok(res, { id }, '板块已创建');
});

router.put('/boards/:id', requireAdmin, (req, res) => {
  const board = get('SELECT id FROM boards WHERE id = ?', [req.params.id]);
  if (!board) throw new AppError('板块不存在', 404);
  const { name, description, accent, sort_order } = req.body || {};
  run('UPDATE boards SET name = ?, description = ?, accent = ?, sort_order = ? WHERE id = ?',
    [name, description, accent, Number(sort_order) || 0, req.params.id]);
  ok(res, null, '板块已更新');
});

router.delete('/boards/:id', requireAdmin, (req, res) => {
  const { c } = get('SELECT COUNT(*) AS c FROM posts WHERE board_id = ?', [req.params.id]);
  if (Number(c) > 0) throw new AppError('该板块下仍有帖子，请先迁移或删除帖子');
  run('DELETE FROM boards WHERE id = ?', [req.params.id]);
  ok(res, null, '板块已删除');
});

module.exports = { router, DICT };
