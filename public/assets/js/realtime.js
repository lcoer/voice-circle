// 声圈前台实时层：别人发的新帖 / 新评论 / 新岗位无需手动刷新即可出现在页面上
// 通道策略：SSE（/api/stream）优先，托管反代可能缓冲长连接 → 自动降级为 /api/updates 轮询

import { api, num } from './core.js';
import { postCard, jobCard, commentItem } from './pages/components.js';

const POLL_MS = 12000;

let base = null;        // 已见的版本号快照 { revision, types }
let source = null;      // EventSource
let sseAlive = false;   // SSE 是否握手成功
let timer = null;
let busy = false;

/* ---------------- 启动 ---------------- */

export function startRealtime() {
  api.get('/updates').then((data) => { base = data; }).catch(() => { /* 忽略首帧失败 */ });
  openStream();
  if (!timer) timer = setInterval(tick, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  window.addEventListener('hashchange', hidePill);
}

function openStream() {
  if (typeof window.EventSource === 'undefined') return;
  try {
    source = new EventSource('/api/stream');
  } catch (_) { return; }

  source.addEventListener('hello', (e) => {
    sseAlive = true;
    try { base = JSON.parse(e.data); } catch (_) { /* 忽略脏帧 */ }
  });

  source.addEventListener('change', (e) => {
    let evt;
    try { evt = JSON.parse(e.data); } catch (_) { return; }
    if (evt.types) base = { revision: evt.revision, types: evt.types };
    applyChange([evt.type]);
  });

  source.onerror = () => {
    // 从未握手成功说明环境不支持长连接，关掉交给轮询；曾连上则让浏览器自行重试
    if (!sseAlive && source) { source.close(); source = null; }
    else sseAlive = false;
  };
}

/** 轮询兜底：SSE 正常时跳过；页面在后台时不打扰 */
async function tick() {
  if (document.hidden) return;
  if (sseAlive && source && source.readyState === 1) return;
  if (busy) return;
  busy = true;
  try {
    const data = await api.get('/updates');
    const changed = base ? changedTypes(base, data) : [];
    base = data;
    if (changed.length) applyChange(changed);
  } catch (_) { /* 网络抖动忽略，下一次轮询再试 */ } finally { busy = false; }
}

function changedTypes(prev, next) {
  const keys = Object.keys(next.types || {});
  return keys.filter((k) => (prev.types?.[k] || 0) !== (next.types?.[k] || 0));
}

/* ---------------- 分发 ---------------- */

const HANDLERS = {
  posts: { interests: ['post', 'comment', 'reaction'], run: refreshPosts },
  jobs: { interests: ['job', 'comment', 'reaction'], run: refreshJobs },
  comments: { interests: ['comment'], run: refreshComments },
  postStats: { interests: ['post', 'comment', 'reaction'], run: refreshPostStats },
  jobStats: { interests: ['job', 'comment', 'reaction'], run: refreshJobStats },
  home: { interests: ['post', 'job'], run: refreshHome }
};

function applyChange(kinds) {
  const changed = new Set(kinds);
  document.querySelectorAll('[data-live]').forEach((el) => {
    const cfg = HANDLERS[el.getAttribute('data-live')];
    if (!cfg) return;
    if (!cfg.interests.some((k) => changed.has(k))) return;
    // 串行失败不影响其它容器，错误静默：实时刷新属增强能力，不该打断浏览
    Promise.resolve(cfg.run(el)).catch(() => {});
  });
}

/* ---------------- 列表增量刷新 ---------------- */

async function refreshPosts(el) {
  const q = safeQuery(el);
  const data = await api.get(`/posts?${new URLSearchParams({
    board: q.board || 'all',
    sort: q.sort || 'latest',
    type: q.type || '',
    keyword: q.keyword || '',
    page: q.page || '1'
  }).toString()}`);

  syncPostCards(el, data.list);

  const nodes = new Map([...el.querySelectorAll('[data-post]')].map((n) => [n.getAttribute('data-post'), n]));
  const liveIds = new Set(data.list.map((p) => String(p.id)));
  nodes.forEach((node, id) => { if (!liveIds.has(id)) node.remove(); });

  const fresh = data.list.filter((p) => !nodes.has(String(p.id)));
  if (!fresh.length) return;

  const html = fresh.map((p) => markNew(postCard(p), 'post-card')).join('');
  insert(html, el, `${fresh.length} 条新帖`, '#/community', { ...q, page: '' });
}

async function refreshJobs(el) {
  const q = safeQuery(el);
  const data = await api.get(`/jobs?${new URLSearchParams({
    kind: q.kind || '',
    platform: q.platform || '',
    role_type: q.role || '',
    salary_cycle: q.cycle || '',
    sort: q.sort || 'latest',
    no_risk: q.no_risk || '',
    keyword: q.keyword || '',
    page: q.page || '1'
  }).toString()}`);

  syncJobCards(el, data.list);

  const nodes = new Map([...el.querySelectorAll('[data-job]')].map((n) => [n.getAttribute('data-job'), n]));
  const liveIds = new Set(data.list.map((j) => String(j.id)));
  nodes.forEach((node, id) => { if (!liveIds.has(id)) node.remove(); });

  const fresh = data.list.filter((j) => !nodes.has(String(j.id)));
  if (!fresh.length) return;

  const html = fresh.map((j) => markNew(jobCard(j), 'card')).join('');
  insert(html, el, `${fresh.length} 条新岗位`, '#/jobs', { ...q, page: '' });
}

/**
 * 统一插入策略：在列表顶部附近就读直接插入；不在顶部或非第一页则用胶囊提示，
 * 避免"内容自己往下跳"打断正在阅读的人。
 */
function insert(html, el, label, basePath, query) {
  if (String(safeQuery(el).page || '1') !== '1') {
    showPill(`${label} · 查看`, () => { hidePill(); location.hash = hash(basePath, query); });
    return;
  }
  const flush = () => {
    const empty = el.querySelector('.empty');
    if (empty) empty.remove();
    el.insertAdjacentHTML('afterbegin', html);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  if (window.scrollY < 240) flush();
  else showPill(`${label} · 查看`, () => { hidePill(); flush(); });
}

function hash(basePath, query) {
  const parts = Object.entries(query || {})
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `#${basePath}?${parts.join('&')}` : `#${basePath}`;
}

function safeQuery(el) {
  try { return JSON.parse(el.getAttribute('data-live-query') || '{}') || {}; } catch (_) { return {}; }
}

function markNew(html, baseClass) {
  return html.replace(`class="${baseClass}`, `class="${baseClass} live-new`);
}

/* ---------------- 计数同步 ---------------- */

/** 保留原有图标与文字前缀（如「点赞」），只替换末尾数字 */
function refreshCount(el, count) {
  if (!el) return;
  const text = String(el.textContent || '').trim();
  const label = text.replace(/[\d.,]+\s*(w|万|k)?\s*$/, '').trim();
  const svg = el.querySelector('svg');
  const body = `${label} ${num(count)}`.trim();
  if (svg) el.innerHTML = `${svg.outerHTML} ${body}`;
  else el.textContent = body;
}

function syncPostCards(container, list) {
  const map = new Map(list.map((p) => [String(p.id), p]));
  container.querySelectorAll('[data-post]').forEach((card) => {
    const p = map.get(card.getAttribute('data-post'));
    if (!p) return;
    const like = card.querySelector('[data-like]');
    refreshCount(like, p.like_count);
    if (like) like.classList.toggle('on', !!p.liked);
    refreshCount(card.querySelector('[data-cmt]'), p.comment_count);
    const fav = card.querySelector('[data-fav]');
    refreshCount(fav, p.fav_count);
    if (fav) fav.classList.toggle('on', !!p.faved);
  });
}

function syncJobCards(container, list) {
  const map = new Map(list.map((j) => [String(j.id), j]));
  container.querySelectorAll('[data-job]').forEach((card) => {
    const j = map.get(card.getAttribute('data-job'));
    if (!j) return;
    const fav = card.querySelector('[data-fav]');
    refreshCount(fav, j.fav_count);
    if (fav) fav.classList.toggle('on', !!j.faved);
  });
}

async function refreshPostStats(el) {
  const id = el.getAttribute('data-live-target');
  if (!id) return;
  const p = await api.get(`/posts/${id}`);
  const like = el.querySelector(`[data-like="${cssEscape(id)}"]`);
  refreshCount(like, p.like_count);
  if (like) like.classList.toggle('on', !!p.liked);
  refreshCount(el.querySelector(`[data-cmt="${cssEscape(id)}"]`), p.comment_count);
  const fav = el.querySelector(`[data-fav="${cssEscape(`post:${id}`)}"]`);
  refreshCount(fav, p.fav_count);
  if (fav) fav.classList.toggle('on', !!p.faved);
}

async function refreshJobStats(el) {
  const id = el.getAttribute('data-live-target');
  if (!id) return;
  const j = await api.get(`/jobs/${id}`);
  const fav = el.querySelector(`[data-fav="${cssEscape(`job:${id}`)}"]`);
  refreshCount(fav, j.fav_count);
  if (fav) fav.classList.toggle('on', !!j.faved);
}

function cssEscape(v) {
  return String(v).replace(/["\\]/g, '\\$&');
}

/* ---------------- 评论区增量刷新 ---------------- */

async function refreshComments(el) {
  const targetType = el.getAttribute('data-live-type') || 'post';
  const targetId = el.getAttribute('data-live-target');
  if (!targetId) return;

  const list = await api.get(`/interaction/comments?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}`);
  const known = new Set([...el.querySelectorAll('[data-comment]')].map((n) => n.getAttribute('data-comment')));
  const liveIds = new Set(list.map((c) => String(c.id)));
  el.querySelectorAll('[data-comment]').forEach((n) => { if (!liveIds.has(n.getAttribute('data-comment'))) n.remove(); });

  const fresh = list.filter((c) => !known.has(String(c.id)));
  if (!fresh.length) return;

  const empty = el.querySelector('.empty');
  if (empty) empty.remove();
  el.insertAdjacentHTML('beforeend', fresh.map((c) => commentItem(c, true)).join(''));
  updateCommentCount(targetId, el.querySelectorAll('[data-comment]').length);
}

function updateCommentCount(targetId, count) {
  document.querySelectorAll(`[data-cmt-count="${cssEscape(targetId)}"]`).forEach((node) => {
    node.textContent = `（${count}）`;
  });
}

/* ---------------- 首页提示 ---------------- */

async function refreshHome(el) {
  const data = await api.get('/posts?page=1&page_size=6');
  const sig = data.list.length ? String(data.list[0].id) : '';
  if (!sig) return;
  const prev = el.getAttribute('data-live-sig');
  el.setAttribute('data-live-sig', sig);
  if (prev === null || prev === sig) return;   // 首次只记基线
  showPill('社区有新动态 · 刷新', () => {
    hidePill();
    window.dispatchEvent(new Event('hashchange'));
  });
}

/* ---------------- 胶囊提示 ---------------- */

function showPill(text, onClick) {
  let wrap = document.getElementById('live-pill');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'live-pill';
    wrap.className = 'live-pill';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = `<button class="live-pill-btn" type="button">${text}</button>`;
  wrap.querySelector('.live-pill-btn').addEventListener('click', onClick);
  requestAnimationFrame(() => wrap.classList.add('show'));
}

export function hidePill() {
  const wrap = document.getElementById('live-pill');
  if (wrap) wrap.classList.remove('show');
}
