'use strict';
/** 服务装配：中间件 → 路由挂载 → 静态资源 → 错误收敛。只做装配，不含业务逻辑。 */

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const config = require('./config');
const { ok, wrap, AppError, errorHandler } = require('./lib/http');
const { attachUser, requireAuth } = require('./lib/auth');
const { init } = require('./data/db');
const { uid, nowISO } = require('./lib/util');
const { all } = require('./data/db');

function createApp() {
  init();

  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use(attachUser);

  app.get('/api/health', (_req, res) => ok(res, { time: nowISO() }, '声圈服务运行中'));

  // 实时通道（/api/updates 轮询 + /api/stream SSE），需排在 attachUser 之后以便过滤自身操作
  app.use('/api', require('./domains/stream.domain').router);

  app.use('/api/auth', require('./domains/auth.domain').router);
  app.use('/api/meta', require('./domains/meta.domain').router);
  app.use('/api/platforms', require('./domains/platform.domain').router);
  app.use('/api/tools', require('./domains/tool.domain').router);
  app.use('/api/posts', require('./domains/community.domain').router);
  app.use('/api/jobs', require('./domains/job.domain').router);
  app.use('/api/interaction', require('./domains/interaction.domain').router);
  app.use('/api/admin', require('./domains/admin.domain').router);

  /** 首页聚合：一次请求拿到订阅流、岗位速览、工具更新、热榜，减少移动端弱网下的往返 */
  app.get('/api/home', wrap(async (req, res) => {
    const userId = req.user ? req.user.id : null;
    const subscribed = require('./lib/util').parseJSON(req.user ? req.user.platforms : [], []);
    const community = require('./domains/community.domain');
    const jobDomain = require('./domains/job.domain');
    const toolDomain = require('./domains/tool.domain');
    const platformDomain = require('./domains/platform.domain');

    jobDomain.sweepExpired();

    const useSubscription = req.query.sub === '1';
    const feed = community.repo.list({
      board: req.query.board,
      subscribed: useSubscription && subscribed.length ? subscribed : null,
      sort: req.query.sort || 'latest',
      page: 1,
      pageSize: 6
    });

    const jobs = all(
      `SELECT j.id, j.title, j.kind, j.role_type, j.salary_min, j.salary_max, j.salary_unit, j.salary_cycle,
              j.platform_id, j.risk_deposit, j.risk_fee, j.created_at, pf.name AS platform_name
       FROM jobs j LEFT JOIN platforms pf ON pf.id = j.platform_id
       WHERE j.status = 'approved' ORDER BY j.created_at DESC LIMIT 5`
    ).map((j) => ({ ...j, risk_flags: jobDomain.jobRiskFlags(j) }));

    const tools = toolDomain.repo.list({}).slice(0, 4);
    const hot = community.repo.list({ sort: 'hot', page: 1, pageSize: 5 }).rows;
    const platforms = platformDomain.repo.list({});

    ok(res, {
      feed: community.decorate(feed.rows, userId),
      meta: { total: feed.total },
      jobs,
      tools,
      hot: community.decorate(hot, userId),
      platforms,
      subscribed
    });
  }));

  /** 图片上传：base64 → 本地磁盘，返回相对 URL（演示环境不做对象存储依赖） */
  app.post('/api/upload', requireAuth, wrap(async (req, res) => {
    const { dataBase64, ext } = req.body || {};
    if (!dataBase64) throw new AppError('缺少图片数据');
    const buffer = Buffer.from(String(dataBase64).replace(/^data:image\/\w+;base64,/, ''), 'base64');
    if (buffer.length > 4 * 1024 * 1024) throw new AppError('图片过大，请压缩后再上传');
    const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png';
    const name = `${uid('img')}.${safeExt}`;
    fs.writeFileSync(path.join(config.UPLOAD_DIR, name), buffer);
    ok(res, { url: `/uploads/${name}` }, '上传成功');
  }));

  // 静态资源：托管平台前置 CDN 会缓存 1h，重新发布后浏览器可能拿到
  //「新的 app.js + 旧的 components.js」导致 ESM 导出缺失 → 一律禁用缓存，每次回源校验
  app.use(express.static(config.PUBLIC_DIR, {
    index: false,
    setHeaders(res) { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); }
  }));

  app.get('/admin', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(config.PUBLIC_DIR, 'admin.html'));
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next(new AppError('接口不存在', 404, 'ERR_NOT_FOUND'));
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(config.PUBLIC_DIR, 'index.html'));
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
