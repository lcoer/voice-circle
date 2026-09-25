'use strict';
/**
 * 给前端 ESM 的相对 import 路径补/升版本号： './x.js' -> './x.js?v=3'
 *
 * 为什么需要：托管平台前置 CDN 会按 URL 缓存静态资源 1 小时。重新发布后，
 * 若某个节点还缓存着旧版 components.js（缺少新导出），浏览器就会出现
 * 「'./components.js' does not provide an export named 'xxx'」的白屏。
 * 改变 URL 即可强制所有缓存节点回源。
 *
 * 用法：node scripts/bump-asset-version.js [版本号]    默认在现有版本上加 1
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'public', 'assets', 'js');

const arg = process.argv[2];
const target = arg ? Number(arg) : null;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = [
  ...walk(JS_DIR),
  path.join(ROOT, 'public', 'index.html'),
  path.join(ROOT, 'public', 'admin.html')
];

let current = 0;
const VERSION_RE = /(?:\.js\?v=(\d+)')|(?:\.js\?v=(\d+)")/g;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const [, a, b] of src.matchAll(VERSION_RE)) current = Math.max(current, Number(a || b));
  const m2 = src.match(/assets\/js\/[\w-]+\.js\?v=(\d+)"/);
  if (m2) current = Math.max(current, Number(m2[1]));
}

const version = target || current + 1;
let changed = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const next = src
    .replace(/'(\.{1,2}\/[\w./-]*\.js)(\?v=\d+)?'/g, (_whole, p) => `'${p}?v=${version}'`)
    .replace(/"(\/assets\/js\/[\w./-]*\.js)(\?v=\d+)?"/g, (_whole, p) => `"${p}?v=${version}"`);
  if (next !== src) {
    fs.writeFileSync(file, next);
    changed += 1;
  }
}

console.log(`已把 ${changed} 个模块的相对 import 升到 v=${version}（原 v=${current}）`);
console.log('发布后如需再次刷新线上 CDN 缓存，重新运行本脚本即可。');
