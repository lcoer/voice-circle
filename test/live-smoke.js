'use strict';
/**
 * 实时能力验证：开两个浏览器上下文，A 停留在社区列表 / 帖子详情，
 * B 用管理员账号发帖与评论，检查 A 的页面是否无需手动刷新就出现新内容。
 * 需要先安装浏览器：`npm i -D playwright && npx playwright install chromium`
 * 运行前请保证本地服务已在 http://127.0.0.1:5173 启动。
 */

const { chromium } = require('playwright');

const BASE = process.env.LIVE_BASE || 'http://127.0.0.1:5173';

let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed += 1; console.log(`  PASS  ${name} ${extra}`); }
  else { failed += 1; console.log(`  FAIL  ${name} ${extra}`); }
}

async function run() {
  console.log('\n=== 实时更新验证（两个浏览器上下文） ===\n');
  const browser = await chromium.launch();
  const errors = [];

  const ca = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const A = await ca.newPage();
  A.on('pageerror', (e) => errors.push(`[浏览者] ${e.message}`));
  A.on('console', (m) => { if (m.type() === 'error') errors.push(`[浏览者] ${m.text()}`); });

  await A.goto(`${BASE}/#/community`, { waitUntil: 'domcontentloaded' });
  await A.waitForSelector('.post-card', { timeout: 20000 });

  // 发布者侧：登录管理员账号
  const cb = await browser.newContext();
  const B = await cb.newPage();
  B.on('pageerror', (e) => errors.push(`[发布者] ${e.message}`));
  await B.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded' });
  await B.fill('#lg-name', 'admin');
  await B.fill('#lg-pwd', 'admin123');
  await B.click('#lg-submit');
  await B.waitForSelector('#topbar-user a[href="#/me"]', { timeout: 20000 });

  const title = `实时验证帖 ${Date.now()}`;
  await B.goto(`${BASE}/#/community/new`, { waitUntil: 'domcontentloaded' });
  await B.fill('#np-title', title);
  await B.fill('#np-content', '用于验证他人发帖能否实时出现在已打开的页面上，正文长度足够。');
  await B.click('#np-submit');
  await B.waitForTimeout(800);

  let newPostVisible = true;
  try { await A.waitForSelector(`text=${title}`, { timeout: 25000 }); } catch (_) { newPostVisible = false; }
  check('他人发帖后，列表页自动出现新帖', newPostVisible);

  // 详情 + 评论实时
  let commentVisible = false;
  const comment = `来自另一个账号的实时评论 ${Date.now()}`;
  try {
    const link = await A.$(`text=${title}`);
    if (link) {
      await link.click();
      await A.waitForSelector('#comment-input', { timeout: 20000 });
      await B.goto(A.url(), { waitUntil: 'domcontentloaded' });
      await B.waitForSelector('#comment-input', { timeout: 20000 });
      await B.fill('#comment-input', comment);
      await B.click('#comment-send');
      await B.waitForTimeout(600);
      await A.waitForSelector(`text=${comment}`, { timeout: 25000 });
      commentVisible = true;
    }
  } catch (e) {
    errors.push(`[详情] ${e.message}`);
  }
  check('他人评论后，详情页自动出现新评论', commentVisible);

  // 清理验证数据
  const cleaned = await B.evaluate(async (t) => {
    const token = localStorage.getItem('vc_token');
    const res = await fetch(`/api/posts?keyword=${encodeURIComponent(t)}`, { headers: { 'x-token': token } });
    const json = await res.json();
    for (const p of json.data.list || []) {
      await fetch(`/api/posts/${p.id}`, { method: 'DELETE', headers: { 'x-token': token } });
    }
    return (json.data.list || []).length;
  }, title);
  check('验证数据已清理', cleaned >= 1, `清理 ${cleaned} 条`);

  check('页面无控制台错误', errors.length === 0, errors.join(' | '));

  await browser.close();
  console.log(`\n=== 结果：${passed} 项通过，${failed} 项失败 ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => { console.error('实时验证异常：', err); process.exit(1); });
