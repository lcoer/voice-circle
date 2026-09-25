#!/usr/bin/env node
'use strict';
/**
 * 一键提交并推送到 GitHub（npm run push）
 *
 * 存在的意义：本机沙箱代理对 github.com 的 CONNECT 会间歇性返回 502，
 * 裸 `git push` 大约有 2/3 概率失败，所以这里内置了重试循环。
 *
 * 用法：
 *   npm run push                     自动根据改动文件生成提交信息
 *   npm run push -- "修复登录跳转"     自定义提交信息
 *   npm run push -- --dry            只预览，不提交不推送
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MAX_RETRY = 8;
const RETRY_DELAY_MS = 3000;

function git(args, opts = {}) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts });
  if (r.error) {
    // 少数受限环境（如沙箱）禁止派生子进程，这里给出明确提示而不是静默失败
    console.error(`[push] 无法调用 git：${r.error.code || r.error.message}`);
    process.exit(1);
  }
  return r;
}

/** 同步阻塞等待（Node 无内置 sync sleep，用 Atomics.wait 实现） */
function sleep(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

/** 把改动文件归纳成一句提交信息 */
function buildMessage(files) {
  const pick = (ext) => files.filter((f) => f.endsWith(ext));
  const parts = [];
  const buckets = [
    ['server/domains', '业务域'],
    ['server/', '服务端'],
    ['public/assets/js/pages', '页面'],
    ['public/assets/js', '前端脚本'],
    ['public/assets/css', '样式'],
    ['public/', '前端'],
    ['test/', '测试'],
    ['scripts/', '脚本']
  ];
  const used = new Set();
  for (const [prefix, label] of buckets) {
    const hit = files.filter((f) => f.startsWith(prefix) && !used.has(f));
    if (!hit.length) continue;
    hit.forEach((f) => used.add(f));
    parts.push(`${label} ${hit.length} 处`);
    if (parts.length >= 3) break;
  }
  const summary = parts.join('、');
  return summary
    ? `chore: 更新 ${files.length} 个文件（${summary}）`
    : `chore: 更新 ${files.length} 个文件`;
}

function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry');
  const msg = argv.filter((a) => a !== '--dry').join(' ').trim();

  // 1) 确认有远端
  const remote = git(['remote', 'get-url', 'origin']);
  if (remote.status !== 0) {
    console.error('[push] 未配置 origin 远端，请先执行：git remote add origin <url>');
    process.exit(1);
  }

  // 2) 暂存
  git(['add', '-A']);
  const status = git(['status', '--porcelain']);
  if (!status.stdout.trim()) {
    console.log('[push] 工作区无改动，跳过');
    process.exit(0);
  }

  const changed = status.stdout
    .trim()
    .split('\n')
    .map((line) => line.slice(3).trim().replace(/^"|"$/g, ''));

  const message = msg || buildMessage(changed);
  console.log(`[push] 改动 ${changed.length} 个文件：`);
  changed.slice(0, 10).forEach((f) => console.log(`       - ${f}`));
  if (changed.length > 10) console.log(`       ... 另有 ${changed.length - 10} 个`);
  console.log(`[push] 提交信息：${message}`);

  if (dry) {
    console.log('[push] --dry 模式，未实际提交');
    process.exit(0);
  }

  // 3) 提交
  const commit = git(['commit', '-m', message]);
  if (commit.status !== 0) {
    console.error('[push] 提交失败：', commit.stderr || commit.stdout);
    process.exit(1);
  }
  const sha = git(['rev-parse', '--short', 'HEAD']).stdout.trim();
  console.log(`[push] 已提交 ${sha}`);

  // 4) 带重试推送（代理 502 是间歇性的）
  for (let i = 1; i <= MAX_RETRY; i += 1) {
    const r = git(['push']);
    if (r.status === 0) {
      const url = remote.stdout.trim().replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
      console.log(`[push] 推送成功（第 ${i} 次尝试）`);
      console.log(`[push] ${url}`);
      process.exit(0);
    }
    const why = ((r.stderr || '') + (r.stdout || '')).split('\n').filter(Boolean).slice(-1)[0] || '未知错误';
    console.warn(`[push] 第 ${i}/${MAX_RETRY} 次失败：${why.trim()}`);
    if (i < MAX_RETRY) sleep(RETRY_DELAY_MS);
  }

  console.error('[push] 已达重试上限仍未成功。改动已提交到本地，稍后手动执行：git push');
  process.exit(1);
}

main();
