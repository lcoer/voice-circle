// 前端页面冒烟：逐个路由加载，捕获控制台错误与未捕获异常，并输出关键元素是否渲染
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:5173';
const SHOT_DIR = __dirname + '/shots';
const fs = require('fs');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const routes = [
  ['/', 'home', '.post-card'],
  ['/#/platforms', 'platforms', '.platform-card'],
  ['/#/platform/p_hello', 'platform-detail', '.info-block-title'],
  ['/#/tools', 'tools', '.tool-card'],
  ['/#/tool/t_kaitou', 'tool-detail', '#tool-content'],
  ['/#/community', 'community', '.post-card'],
  ['/#/jobs', 'jobs', '.job-card'],
  ['/#/login', 'login', '#lg-submit']
];

const adminRoutes = [
  ['#/overview', 'admin-overview', '.stat-card'],
  ['#/pending', 'admin-pending', '.queue-item'],
  ['#/reports', 'admin-reports', '.table'],
  ['#/platforms', 'admin-platforms', '.table'],
  ['#/tools', 'admin-tools', '.table'],
  ['#/boards', 'admin-boards', '.table'],
  ['#/users', 'admin-users', '.table'],
  ['#/logs', 'admin-logs', '.table']
];

async function run() {
  const browser = await chromium.launch();
  const errors = [];

  async function visit(context, url, name, selector, shotName) {
    const page = await context.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[${name}] console: ${msg.text()}`); });
    page.on('pageerror', (err) => errors.push(`[${name}] pageerror: ${err.message}`));
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    let found = false;
    try { await page.waitForSelector(selector, { timeout: 6000 }); found = true; } catch (_) { /* 继续截图排查 */ }
    await page.screenshot({ path: `${SHOT_DIR}/${shotName}.png`, fullPage: false });
    console.log(`  ${found ? 'PASS' : 'MISS'}  ${name.padEnd(22)} ${selector}`);
    await page.close();
  }

  console.log('\n=== 前台页面 ===');
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  for (const [r, name, sel] of routes) await visit(ctx, `${BASE}/${r.replace(/^\//, '')}`, name, sel, `pc-${name}`);

  console.log('\n=== 移动端（390x844）===');
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await visit(mctx, `${BASE}/#/`, 'mobile-home', '.post-card', 'mobile-home');
  await visit(mctx, `${BASE}/#/jobs`, 'mobile-jobs', '.job-card', 'mobile-jobs');
  await visit(mctx, `${BASE}/#/community`, 'mobile-community', '.post-card', 'mobile-community');

  console.log('\n=== 后台（需登录）===');
  const actx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const loginPage = await actx.newPage();
  await loginPage.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' });
  await loginPage.fill('#lg-name', 'admin');
  await loginPage.fill('#lg-pwd', 'admin123');
  await loginPage.click('#lg-submit');
  await loginPage.waitForTimeout(1200);
  await loginPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await loginPage.waitForTimeout(1200);
  await loginPage.close();
  for (const [r, name, sel] of adminRoutes) await visit(actx, `${BASE}/admin${r}`, name, sel, `admin-${name}`);

  await browser.close();

  console.log('\n=== 控制台错误 ===');
  if (!errors.length) console.log('  无');
  else errors.forEach((e) => console.log('  ' + e));
  console.log(`\n截图输出目录：${SHOT_DIR}\n`);
}

run().catch((e) => { console.error(e); process.exit(1); });
