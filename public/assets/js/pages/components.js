// 跨页面复用的卡片与挂件组件（只被页面引用，不反向依赖页面）

import { esc, icon, num, fromNow, fmtDate, salaryText } from '../core.js';

export function setContent(html) {
  const app = document.getElementById('app');
  app.innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function setRail(html) {
  const rail = document.getElementById('rail');
  if (rail) rail.innerHTML = html;
}

export function shell(title, subHtml, bodyHtml) {
  return `
    <div class="section-head">
      <div>
        <div class="section-title">${esc(title)}</div>
        ${subHtml ? `<div class="section-sub">${subHtml}</div>` : ''}
      </div>
    </div>
    ${bodyHtml}`;
}

export function emptyBox(text) {
  return `<div class="empty">${esc(text)}</div>`;
}

export function loadingList(count = 3) {
  return Array.from({ length: count }).map(() => '<div class="skeleton" style="height:112px"></div>').join('');
}

export function postCard(post) {
  return `
  <article class="post-card" data-post="${esc(post.id)}">
    <div class="post-head">
      <div class="avatar avatar-sm">${esc(post.author_avatar || post.author_nick?.slice(0, 1) || 'U')}</div>
      <div class="post-meta">
        <div class="post-author">${esc(post.author_nick)}</div>
        <div class="post-sub">
          <span>${fromNow(post.created_at)}</span>
          <span>${esc(post.board_name || '')}</span>
          ${post.platform_name ? `<span>${esc(post.platform_name)}</span>` : ''}
        </div>
      </div>
    </div>
    <h3 class="post-title">
      ${post.pinned ? '<span class="badge-pin">置顶</span>' : ''}
      ${post.essence ? '<span class="badge-essence">精华</span>' : ''}
      <a href="#/post/${esc(post.id)}">${esc(post.title)}</a>
    </h3>
    <div class="post-excerpt">${esc(post.excerpt)}</div>
    ${post.tags && post.tags.length ? `<div class="post-tags">${post.tags.map((t) => `<span class="chip"># ${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="post-foot">
      <span class="act like ${post.liked ? 'on' : ''}" data-like="${esc(post.id)}">${icon('heart', 15)} ${num(post.like_count)}</span>
      <span class="act" data-goto="#/post/${esc(post.id)}" data-cmt="${esc(post.id)}">${icon('chat', 15)} ${num(post.comment_count)}</span>
      <span class="act fav ${post.faved ? 'on' : ''}" data-fav="post:${esc(post.id)}">${icon('star', 15)} ${num(post.fav_count)}</span>
      <span style="margin-left:auto">${icon('eye', 14)} ${num(post.views)}</span>
    </div>
  </article>`;
}

export function jobCard(job) {
  const risk = job.risk_flags || [];
  const high = risk.some((f) => f.level === 'high');
  return `
  <article class="card card-hover job-card ${high ? 'risk' : ''}" data-job="${esc(job.id)}">
    <div class="job-title">
      <a href="#/job/${esc(job.id)}">${esc(job.title)}</a>
      ${job.kind === 'seek' ? '<span class="chip chip-cyan">求职</span>' : '<span class="chip chip-brand">招聘</span>'}
      ${job.status === 'pending' ? '<span class="chip chip-warn">待审核</span>' : ''}
      ${job.status === 'expired' ? '<span class="chip">已过期</span>' : ''}
    </div>
    <div class="job-meta">
      <span class="job-salary">${esc(salaryText(job))}</span>
      ${job.salary_cycle ? `<span class="chip chip-ok">${esc(job.salary_cycle)}</span>` : ''}
      ${job.role_type ? `<span class="chip">${esc(job.role_type)}</span>` : ''}
      ${job.platform_name ? `<span class="chip">${esc(job.platform_name)}</span>` : ''}
      ${job.city ? `<span class="chip">${esc(job.city)}</span>` : ''}
    </div>
    ${high ? `<div class="risk-banner">${icon('alert', 15)} <div>风险提示：${risk.filter((f) => f.level === 'high').map((f) => esc(f.label)).join(' / ')}。行业规范下，正规招聘不应要求前置缴费。</div></div>` : ''}
    <div class="job-line">${icon('clock', 13)} ${esc(job.work_time || '时间面议')}</div>
    <div class="post-foot" style="margin-top:10px">
      <span>${icon('user', 14)} ${esc(job.author_nick || '匿名')}</span>
      <span>${fromNow(job.created_at)}</span>
      <span style="margin-left:auto">${job.days_left !== null && job.days_left !== undefined ? `${job.days_left > 0 ? `还剩 ${job.days_left} 天` : '已到期'}` : ''}</span>
      <span class="act fav ${job.faved ? 'on' : ''}" data-fav="job:${esc(job.id)}">${icon('star', 15)} ${num(job.fav_count)}</span>
    </div>
  </article>`;
}

export function platformCard(p) {
  return `
  <a class="card card-hover platform-card" href="#/platform/${esc(p.id)}">
    <div class="logo-box">${esc(p.logo_text || p.name.slice(0, 2))}</div>
    <div class="platform-meta">
      <div class="platform-name">${esc(p.name)} ${p.verified ? '<span class="chip chip-ok">已核验</span>' : ''}</div>
      <div class="platform-desc">${esc(p.summary || '')}</div>
      <div class="platform-stats">
        <span>${icon('eye', 12)} ${num(p.views)}</span>
        ${p.job_count !== undefined ? `<span>${icon('brief', 12)} ${p.job_count} 岗位</span>` : ''}
        ${p.post_count !== undefined ? `<span>${icon('chat', 12)} ${p.post_count} 讨论</span>` : ''}
      </div>
    </div>
  </a>`;
}

export function toolCard(tool) {
  return `
  <a class="card card-hover tool-card" href="#/tool/${esc(tool.id)}">
    <div class="tool-title">
      ${esc(tool.title)}
      ${tool.pinned ? '<span class="badge-pin">置顶</span>' : ''}
    </div>
    <div class="tool-desc">${esc(tool.summary || '')}</div>
    <div class="tool-foot">
      <span class="chip chip-brand">${esc(tool.category)}</span>
      <span>${icon('cash', 12)} ${num(tool.downloads)} 次使用 · ${num(tool.views)} 浏览</span>
    </div>
  </a>`;
}

export function rankWidget(title, items, iconName = 'fire') {
  return `
  <div class="card">
    <div class="widget-title">${icon(iconName, 15)} ${esc(title)}</div>
    ${items.map((it, i) => `
      <div class="rank-item">
        <span class="rank-no ${i < 3 ? 'top' : ''}">${i + 1}</span>
        <span class="rank-name">${esc(it.name)}</span>
        <span class="rank-value">${esc(it.value)}</span>
      </div>`).join('')}
  </div>`;
}

export function noticeWidget(title, text) {
  return `<div class="card"><div class="widget-title">${icon('shield', 15)} ${esc(title)}</div><div class="notice">${esc(text)}</div></div>`;
}

export function commentItem(c, isNew = false) {
  return `
    <div class="comment-item${isNew ? ' live-new' : ''}" data-comment="${esc(c.id)}">
      <div class="avatar avatar-sm">${esc(c.author_avatar || (c.author_nick || 'U').slice(0, 1))}</div>
      <div class="comment-body">
        <div class="comment-head"><strong style="color:var(--text)">${esc(c.author_nick)}</strong><span>${fromNow(c.created_at)}</span></div>
        <div class="comment-text">${esc(c.content)}</div>
      </div>
    </div>`;
}

export function commentList(comments) {
  if (!comments.length) return emptyBox('还没有评论，来说两句');
  return comments.map((c) => commentItem(c)).join('');
}

export function pagination(meta, basePath, query) {
  if (!meta || meta.total_pages <= 1) return '';
  const pages = [];
  const cur = Number(meta.page);
  for (let i = 1; i <= meta.total_pages; i += 1) {
    if (i === 1 || i === meta.total_pages || Math.abs(i - cur) <= 2) {
      pages.push(`<button class="btn btn-sm ${i === cur ? 'btn-primary' : 'btn-ghost'}" data-page="${i}">${i}</button>`);
    } else if (pages[pages.length - 1] !== '<span class="section-sub">…</span>') {
      pages.push('<span class="section-sub">…</span>');
    }
  }
  return `<div style="display:flex;gap:6px;justify-content:center;margin-top:16px;flex-wrap:wrap" data-pager-base="${esc(basePath)}" data-pager-query="${esc(JSON.stringify(query))}">${pages.join('')}</div>`;
}

export function statusChip(status) {
  const map = {
    pending: ['chip-warn', '待审核'],
    approved: ['chip-ok', '已上架'],
    rejected: ['chip-danger', '已驳回'],
    expired: ['chip', '已过期'],
    removed: ['chip', '已下架'],
    published: ['chip-ok', '已发布'],
    draft: ['chip', '未发布'],
    on: ['chip-ok', '上架中'],
    off: ['chip', '已下架']
  };
  const [cls, label] = map[status] || ['chip', status];
  return `<span class="chip ${cls}">${label}</span>`;
}

export function dateText(iso) { return fmtDate(iso); }
