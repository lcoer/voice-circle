'use strict';
/**
 * 实时通道：别人发帖 / 评论 / 点赞 / 发布岗位后，前台无需手动刷新即可感知。
 * - GET /api/updates      轮询兜底：返回全局版本号与各资源版本号快照
 * - GET /api/stream       SSE 主通道：内容变更时推送 change 事件
 * 托管环境的反向代理可能缓冲 SSE，因此前台实现的策略是「SSE 优先 + 自动降级轮询」。
 */

const express = require('express');
const { bus, snapshot } = require('../lib/bus');

const router = express.Router();

router.get('/updates', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ code: 0, message: 'ok', data: snapshot() });
});

router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform, no-store',
    Connection: 'keep-alive',
    // 关闭 Nginx 侧响应缓冲，否则事件会被攒着发不出去
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const write = (chunk) => { try { res.write(chunk); } catch (_) { /* 连接已断开 */ } };
  write('retry: 5000\n\n');
  write(`event: hello\ndata: ${JSON.stringify(snapshot())}\n\n`);

  // 自己的操作不必回推给自己：前台已在本地处理，重复推送会造成"多出一条"的错觉
  const selfId = req.user ? req.user.id : null;
  const onChange = (event) => {
    if (selfId && event.actorId === selfId) return;
    write(`event: change\ndata: ${JSON.stringify({ ...event, types: snapshot().types })}\n\n`);
  };

  bus.on('change', onChange);
  const heartbeat = setInterval(() => write(`: ping ${Date.now()}\n\n`), 15000);

  const cleanup = () => {
    clearInterval(heartbeat);
    bus.off('change', onChange);
  };
  res.on('close', cleanup);
  req.on('close', cleanup);
});

module.exports = { router };
