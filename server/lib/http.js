'use strict';
/** 统一响应 / 异常。路由层依赖，禁止反向依赖具体业务。 */

class AppError extends Error {
  constructor(message, status = 400, code = 'ERR_BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const bad = (msg = '参数不合法') => new AppError(msg, 400, 'ERR_BAD_REQUEST');
const forbidden = (msg = '没有操作权限') => new AppError(msg, 403, 'ERR_FORBIDDEN');
const notFound = (msg = '内容不存在或已下架') => new AppError(msg, 404, 'ERR_NOT_FOUND');
const unauth = (msg = '请先登录') => new AppError(msg, 401, 'ERR_UNAUTHORIZED');
const conflict = (msg = '数据冲突') => new AppError(msg, 409, 'ERR_CONFLICT');

function ok(res, data = null, message = 'ok') {
  return res.json({ code: 0, message, data });
}

function page(res, list, meta) {
  return res.json({ code: 0, message: 'ok', data: { list, meta } });
}

/** 包装异步路由，异常统一收敛到错误中间件 */
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const code = err.code || 'ERR_INTERNAL';
  if (status >= 500) console.error('[api error]', err);
  res.status(status).json({ code, message: err.message || '服务异常', data: null });
}

module.exports = { AppError, bad, forbidden, notFound, unauth, conflict, ok, page, wrap, errorHandler };
