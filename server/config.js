'use strict';

const path = require('node:path');

// __dirname 指向 <project>/server，故项目根只需向上一级
const ROOT = path.resolve(__dirname, '..');

module.exports = {
  ROOT,
  PORT: Number(process.env.PORT || 5173),
  DB_FILE: process.env.VC_DB_FILE
    ? path.resolve(ROOT, process.env.VC_DB_FILE)
    : path.join(ROOT, 'data', 'voice-circle.db'),
  UPLOAD_DIR: path.join(ROOT, 'public', 'uploads'),
  PUBLIC_DIR: path.join(ROOT, 'public'),
  SESSION_TTL_DAYS: 7,
  JOB_DEFAULT_TTL_DAYS: 30,
  PAGE_SIZE: 10,
  ADMIN_DEFAULT: {
    username: 'admin',
    password: 'admin123',
    nick: '平台管理员'
  }
};
