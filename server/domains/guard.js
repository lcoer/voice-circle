'use strict';
/** 权限中间件的集中导出防止循环依赖 */
const { requireAuth, requireStaff, requireAdmin } = require('../lib/auth');
module.exports = { requireAuth, requireStaff, requireAdmin };
