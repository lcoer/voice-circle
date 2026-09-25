// 声圈前台入口：装配外壳（导航/用户区）→ 注册路由 → 全局交互委托

import { api, store, router, setActiveNav, icon, esc, toast, modal, buildHash, requireLogin } from './core.js?v=2';
import { home, platforms, platformDetail, tools, toolDetail } from './pages/discover.js?v=2';
import { community, postDetail, newPost, loginPage, registerPage, mePage, userPage } from './pages/community.js?v=2';
import { jobs, jobDetail, newJob } from './pages/jobs.js?v=2';
import { startRealtime } from './realtime.js?v=2';

/* ---------------- 外壳渲染 ---------------- */

function renderUserArea() {
  const box = document.getElementById('topbar-user');
  const user = store.user;
  if (user) {
    box.innerHTML = `
      <a class="btn btn-sm" href="#/community/new">${icon('plus', 14)} 发帖</a>
      ${store.isStaff() ? '<a class="btn btn-sm btn-ghost" href="/admin">后台</a>' : ''}
      <a href="#/me" style="display:flex;align-items:center;gap:8px">
        <span class="avatar avatar-sm">${esc(user.avatar || user.nick.slice(0, 1))}</span>
        <span style="font-size:13.5px">${esc(user.nick)}</span>
      </a>`;
  } else {
    box.innerHTML = `<a class="btn btn-sm btn-primary" href="#/login">登录</a><a class="btn btn-sm" href="#/register">注册</a>`;
  }
}

let boardsCache = [];

async function renderSidenav() {
  const nav = document.getElementById('sidenav');
  const items = [
    ['/', '首页', 'home'],
    ['/platforms', '平台资料库', 'layers'],
    ['/tools', '行业工具包', 'tool'],
    ['/community', '社区交流', 'chat'],
    ['/jobs', '招聘求职', 'brief']
  ];
  const mine = [['/me', '个人中心', 'user']];
  try {
    if (!boardsCache.length) boardsCache = (await api.get('/meta/options')).boards;
  } catch (_) { /* 静默容错 */ }

  nav.innerHTML = `
    ${items.map(([href, label, ic]) => `<a class="sidenav-item" href="#${href}" data-nav="${href}">${icon(ic, 17)} ${label}</a>`).join('')}
    <div class="sidenav-group">我的</div>
    ${mine.map(([href, label, ic]) => `<a class="sidenav-item" href="#${href}" data-nav="${href}">${icon(ic, 17)} ${label}</a>`).join('')}
    ${store.isStaff() ? '<div class="sidenav-group">管理</div><a class="sidenav-item" href="/admin">' + icon('shield', 17) + ' 管理后台</a>' : ''}
  `;
  setActiveNav(location.hash);
}

function syncShell() {
  renderUserArea();
  renderSidenav();
}

/* ---------------- 路由表 ---------------- */

router.add('/', home);
router.add('/platforms', platforms);
router.add('/platform/:id', platformDetail);
router.add('/tools', tools);
router.add('/tool/:id', toolDetail);
router.add('/community', community);
router.add('/community/new', newPost);
router.add('/post/:id', postDetail);
router.add('/jobs', jobs);
router.add('/jobs/new', newJob);
router.add('/job/:id', jobDetail);
router.add('/me', mePage);
router.add('/u/:id', userPage);
router.add('/login', loginPage);
router.add('/register', registerPage);

/* 未匹配路由兜底 */
window.addEventListener('hashchange', () => setActiveNav(location.hash));

/* ---------------- 全局交互：点赞 / 收藏 / 订阅 / 举报 ---------------- */

function paintReaction(targetType, targetId, data) {
  if (targetType === 'post') {
    document.querySelectorAll(`[data-like="${targetId}"]`).forEach((el) => {
      el.innerHTML = `${icon('heart', 15)} ${data.like_count}`;
      el.classList.toggle('on', !!data.liked);
    });
  }
  document.querySelectorAll(`[data-fav="${targetType}:${targetId}"]`).forEach((el) => {
    const label = el.classList.contains('btn') ? ' 收藏' : '';
    el.innerHTML = `${icon('star', el.classList.contains('btn') ? 14 : 15)}${label} ${data.fav_count}`;
    el.classList.toggle('on', !!data.faved);
  });
}

document.addEventListener('click', async (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    if (!requireLogin('登录后可收藏内容')) return;
    const [targetType, targetId] = fav.getAttribute('data-fav').split(':');
    try {
      const data = await api.post('/interaction/reaction', { target_type: targetType, target_id: targetId, type: 'fav' });
      paintReaction(targetType, targetId, data);
    } catch (err) { toast(err.message, 'error'); }
    return;
  }

  const like = e.target.closest('[data-like]');
  if (like) {
    if (!requireLogin('登录后可点赞')) return;
    const id = like.getAttribute('data-like');
    try {
      const data = await api.post('/interaction/reaction', { target_type: 'post', target_id: id, type: 'like' });
      paintReaction('post', id, data);
    } catch (err) { toast(err.message, 'error'); }
    return;
  }

  const sub = e.target.closest('[data-subscribe]');
  if (sub) {
    if (!requireLogin('登录后可订阅平台')) return;
    try {
      const data = await api.post('/auth/me/subscribe', { platformId: sub.getAttribute('data-subscribe') });
      const me = await api.get('/auth/me');
      store.user = me.user;
      toast(data.subscribed.length ? '订阅状态已更新' : '订阅状态已更新', 'success');
      location.reload();
    } catch (err) { toast(err.message, 'error'); }
    return;
  }

  const report = e.target.closest('[data-report]');
  if (report) {
    if (!requireLogin('登录后可举报')) return;
    const [targetType, targetId] = report.getAttribute('data-report').split(':');
    const reasons = ['虚假信息', '收取押金', '诈骗风险', '广告引流', '人身攻击', '其他'];
    modal({
      title: '举报内容',
      body: `
        <div class="field">
          <label class="field-label">举报类型</label>
          <select class="select" id="rp-type">${reasons.map((r) => `<option>${r}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label class="field-label">补充说明</label>
          <textarea class="textarea" id="rp-detail" placeholder="请尽量提供时间、账号、聊天截图等可核实信息"></textarea>
        </div>
        <div class="notice">恶意举报会被记录，重复滥用将被限制功能。</div>`,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="rp-submit">提交举报</button>',
      onMount: (mask) => {
        mask.querySelector('#rp-submit').addEventListener('click', async () => {
          try {
            await api.post('/interaction/reports', {
              target_type: targetType,
              target_id: targetId,
              reason_type: mask.querySelector('#rp-type').value,
              reason_detail: mask.querySelector('#rp-detail').value
            });
            mask.remove();
            toast('举报已提交，平台将在 24 小时内处理', 'success');
          } catch (err) { toast(err.message, 'error'); }
        });
      }
    });
    return;
  }

  const goto = e.target.closest('[data-goto]');
  if (goto) { location.hash = goto.getAttribute('data-goto'); return; }

  const pager = e.target.closest('[data-page]');
  if (pager) {
    const wrap = pager.closest('[data-pager-base]');
    const base = wrap.getAttribute('data-pager-base');
    const query = JSON.parse(wrap.getAttribute('data-pager-query') || '{}');
    location.hash = buildHash(base, { ...query, page: pager.getAttribute('data-page') });
  }
});

/* ---------------- 搜索 ---------------- */

function bindSearch(input) {
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const kw = e.target.value.trim();
    if (!kw) return;
    location.hash = buildHash('/community', { keyword: kw });
  });
}
bindSearch(document.getElementById('global-search'));
bindSearch(document.getElementById('mobile-search'));

/* ---------------- 启动 ---------------- */

window.addEventListener('vc:auth-changed', syncShell);

syncShell();
startRealtime();
const current = (location.hash || '#/').slice(1);
router.start();
setActiveNav(current);
