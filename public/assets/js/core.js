// 声圈 VoiceCircle - 前端核心工具（无外部依赖，全部原生实现）

/* ---------------- API ---------------- */

const TOKEN_KEY = 'vc_token';
const USER_KEY = 'vc_user';

export const store = {
  get token() { return localStorage.getItem(TOKEN_KEY) || ''; },
  set token(v) { if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY); },
  get user() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (_) { return null; } },
  set user(v) { if (v) localStorage.setItem(USER_KEY, JSON.stringify(v)); else localStorage.removeItem(USER_KEY); },
  isStaff() { const u = this.user; return !!u && (u.role === 'admin' || u.role === 'moderator'); },
  isAdmin() { return !!this.user && this.user.role === 'admin'; }
};

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (store.token) headers.Authorization = `Bearer ${store.token}`;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json;
  try { json = await res.json(); } catch (_) { throw new Error('服务返回异常，请稍后重试'); }
  if (json.code !== 0) {
    if (json.code === 401) { store.token = ''; store.user = null; window.dispatchEvent(new Event('vc:auth-changed')); }
    throw new Error(json.message || '请求失败');
  }
  return json.data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p)
};

/* ---------------- 工具函数 ---------------- */

export function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromNow(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return fmtDate(iso);
}

export function num(n) {
  const v = Number(n) || 0;
  return v >= 10000 ? `${(v / 10000).toFixed(1)}w` : String(v);
}

export function salaryText(job) {
  if (!job.salary_min && !job.salary_max) return '面议';
  if (job.salary_unit === '分成%') return `${job.salary_min || 0}% - ${job.salary_max || 0}% 分成`;
  const unit = job.salary_unit || '元/月';
  if (!job.salary_min || job.salary_min === job.salary_max) return `${job.salary_max || job.salary_min} ${unit}`;
  if (!job.salary_max) return `${job.salary_min} ${unit}起`;
  return `${job.salary_min} - ${job.salary_max} ${unit}`;
}

export function qs(name, fallback = '') {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || fallback;
}

export function hashPath() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function hashQuery() {
  const hash = window.location.hash.slice(1);
  const idx = hash.indexOf('?');
  if (idx < 0) return {};
  const out = {};
  new URLSearchParams(hash.slice(idx + 1)).forEach((v, k) => { out[k] = v; });
  return out;
}

export function buildHash(path, query = {}) {
  const parts = Object.entries(query)
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `#${path}?${parts.join('&')}` : `#${path}`;
}

export function html(strings, ...values) {
  return String.raw({ raw: strings }, ...values);
}

/* ---------------- 图标（全部内联 SVG） ---------------- */

const iconPaths = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  layers: '<path d="M12 3 3 7.5 12 12l9-4.5L12 3Z"/><path d="m3 12.5 9 4.5 9-4.5"/><path d="m3 17 9 4.5 9-4.5"/>',
  tool: '<path d="M14.7 6.3a4 4 0 1 0 3 6.6l6 6-2.6 2.6-6-6a4 4 0 0 1-6.6-3l-3 3-2.1-2.1 6.6-6.6"/><path d="m14.7 6.3 6 6"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z"/>',
  brief: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M2 13h20"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6"/><path d="M18 21a7 7 0 0 0-2-4.9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  heart: '<path d="M12 20s-7-4.4-9-8.6C1.6 7.6 4.3 4 7.9 4c2 0 3.4 1.1 4.1 2.2.7-1.1 2.1-2.2 4.1-2.2 3.6 0 6.3 3.6 4.9 7.4-2 4.2-9 8.6-9 8.6Z"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/>',
  fire: '<path d="M12 3c2.5 3 1 4.6 1 6.6A3 3 0 0 0 8.6 12c0 3.3 3.4 5 3.4 5s-4 .3-4-3"/><path d="M12 21a5.5 5.5 0 0 0 5.5-5.5c0-4-4-6-5.5-9.5"/>',
  shield: '<path d="M12 3 5 6v6c0 4.4 3 8 7 9 4-1 7-4.6 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><path d="M12 17.5h.01"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 10v4M18 10v4"/>',
  pin: '<path d="M12 17v5"/><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17 5 12l5-5"/><path d="M5 12h10"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h5"/>',
  log: '<path d="M6 3v6l-3 3 3 3v6"/><path d="M18 3v6l3 3-3 3v6"/>',
  report: '<path d="M12 3 4 6v12l8-3 8 3V6l-8-3Z"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/>',
  sponsor: '<path d="M12 3v18"/><path d="M5 8h14"/><path d="M8 21h8"/>'
};

export function icon(name, size = 16, cls = '') {
  const d = iconPaths[name] || iconPaths.home;
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

/* ---------------- 提示条 ---------------- */

export function toast(message, type = '') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  wrap.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

/* ---------------- 弹窗 ---------------- */

export function modal({ title, body, wide = false, onMount, footer = '' }) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal ${wide ? 'modal-wide' : ''}">
      <div class="modal-head">
        <div class="modal-title">${esc(title)}</div>
        <button class="btn btn-sm btn-ghost" data-close>${icon('back', 16)}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  mask.addEventListener('click', (e) => { if (e.target === mask || e.target.closest('[data-close]')) mask.remove(); });
  document.body.appendChild(mask);
  if (onMount) onMount(mask);
  return mask;
}

export function confirmBox(message, onOk) {
  const mask = modal({
    title: '请确认',
    body: `<p style="color:var(--text-2)">${esc(message)}</p>`,
    footer: `<button class="btn" data-close>取消</button><button class="btn btn-primary" data-ok>确定</button>`
  });
  mask.querySelector('[data-ok]').addEventListener('click', () => { mask.remove(); onOk(); });
}

/* ---------------- 登录守卫 ---------------- */

export function requireLogin(message = '请先登录后再操作') {
  if (store.user) return true;
  toast(message, 'error');
  location.hash = '#/login';
  return false;
}

/* ---------------- 路由 ---------------- */
/* 路由表由 app.js / admin.js 注入，路由层不反向依赖页面模块 */

const routes = [];

export const router = {
  add(pattern, handler) { routes.push({ pattern, handler }); },
  start() {
    window.addEventListener('hashchange', () => this.resolve());
    if (!window.location.hash) window.location.hash = '#/';
    this.resolve();
  },
  resolve() {
    const path = hashPath();
    const query = hashQuery();
    for (const r of routes) {
      const m = matchPath(r.pattern, path);
      if (m) { r.handler(m.params, query); return; }
    }
    if (notFoundHandler) notFoundHandler();
  }
};

let notFoundHandler = null;
export function setNotFound(fn) { notFoundHandler = fn; }

function matchPath(pattern, path) {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return { params };
}

export function setActiveNav(hash) {
  const target = hash.replace(/^#/, '').split('?')[0] || '/';
  document.querySelectorAll('[data-nav]').forEach((el) => {
    const v = el.getAttribute('data-nav');
    const active = v === '/' ? (target === '/' || target === '') : target.startsWith(v);
    el.classList.toggle('active', active);
  });
}
