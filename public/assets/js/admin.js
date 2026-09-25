// 声圈管理后台：概览 / 审核 / 举报 / 平台 / 工具 / 板块 / 用户 / 日志

import { api, store, router, setActiveNav, icon, esc, toast, modal, fmtDate, num, requireLogin } from './core.js?v=2';

function setContent(html) {
  document.getElementById('admin-app').innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

const ROLE_LABEL = { user: '从业者', recruiter: '招聘方', moderator: '审核员', admin: '管理员' };

function guard() {
  const user = store.user;
  if (!user || !['admin', 'moderator'].includes(user.role)) {
    setContent(`
      <div class="card" style="max-width:420px;margin:60px auto;text-align:center">
        <div style="font-size:16px;font-weight:600;margin-bottom:8px">需要管理员权限</div>
        <p class="section-sub">请使用管理员账号登录后再访问后台。演示账号：admin / admin123</p>
        <a class="btn btn-primary btn-block" href="/#/login">去登录</a>
      </div>`);
    return false;
  }
  return true;
}

function renderTopbar() {
  const box = document.getElementById('admin-topbar-user');
  const user = store.user;
  box.innerHTML = user
    ? `<span class="chip chip-brand">${esc(ROLE_LABEL[user.role])}</span>
       <a href="/#/me" style="display:flex;align-items:center;gap:8px">
         <span class="avatar avatar-sm">${esc(user.avatar || user.nick.slice(0, 1))}</span>
         <span style="font-size:13.5px">${esc(user.nick)}</span></a>
       <a class="btn btn-sm btn-ghost" href="/">返回前台</a>`
    : '<a class="btn btn-sm btn-primary" href="/#/login">登录</a>';
}

/* ---------- 概览看板 ---------- */

function sparkline(trend) {
  const w = 640; const h = 160; const pad = 26;
  const max = Math.max(1, ...trend.flatMap((t) => [t.posts, t.jobs, t.users]));
  const len = trend.length;
  const x = (i) => pad + (i * (w - pad * 2)) / (len - 1);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const line = (key) => trend.map((t, i) => `${x(i).toFixed(1)},${y(t[key]).toFixed(1)}`).join(' ');
  return `
  <svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="近 7 天内容增长趋势">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#23232f" stroke-width="1"/>
    <polyline points="${line('posts')}" fill="none" stroke="#7c5cff" stroke-width="2" stroke-linejoin="round"/>
    <polyline points="${line('jobs')}" fill="none" stroke="#35e0f0" stroke-width="2" stroke-linejoin="round"/>
    <polyline points="${line('users')}" fill="none" stroke="#ff4d9d" stroke-width="2" stroke-linejoin="round"/>
    ${trend.map((t, i) => `<text x="${x(i)}" y="${h - 8}" fill="#6d6d88" font-size="11" text-anchor="middle">${t.label}</text>`).join('')}
  </svg>
  <div class="filterbar">
    <span class="chip chip-brand">帖子</span><span class="chip chip-cyan">岗位</span><span class="chip" style="background:rgba(255,77,157,.14);border-color:rgba(255,77,157,.4);color:#ffb0d3">新用户</span>
  </div>`;
}

async function overview() {
  if (!guard()) return;
  setContent('<div class="skeleton" style="height:220px"></div>');
  const data = await api.get('/admin/overview');
  const c = data.counts;
  const stat = (label, value, hint = '') => `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${hint ? `<div class="stat-label">${hint}</div>` : ''}</div>`;
  setContent(`
    <div class="section-head"><div><div class="section-title">概览看板</div><div class="section-sub">社区内容运营情况与待处理事项</div></div></div>
    <div class="stat-grid">
      ${stat('用户总数', c.users)}
      ${stat('已发布帖子', c.posts, `待审 ${c.pending_posts}`)}
      ${stat('在架岗位', c.jobs, `待审 ${c.pending_jobs} · 已过期 ${c.expired_jobs}`)}
      ${stat('待处理举报', c.pending_reports)}
      ${stat('待审评论', c.pending_comments)}
      ${stat('工具 / 平台', `${c.tools} / ${c.platforms}`)}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="widget-title">近 7 天增长趋势</div>
      ${sparkline(data.trend)}
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="widget-title">角色分布</div>
        ${data.role_distribution.map((r) => `
          <div class="rank-item">
            <span class="rank-name">${esc(r.label)}</span>
            <span class="rank-value">${r.value}</span>
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="widget-title">平台浏览 TOP5</div>
        ${data.hot_platforms.map((p, i) => `
          <div class="rank-item">
            <span class="rank-no ${i < 3 ? 'top' : ''}">${i + 1}</span>
            <span class="rank-name">${esc(p.name)}</span>
            <span class="rank-value">${num(p.views)}</span>
          </div>`).join('')}
      </div>
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="widget-title">快捷处理</div>
      <div class="filterbar">
        <a class="btn btn-sm btn-primary" href="#/pending">处理审核队列（${c.pending_posts + c.pending_jobs + c.pending_comments}）</a>
        <a class="btn btn-sm" href="#/reports">处理举报（${c.pending_reports}）</a>
        <a class="btn btn-sm" href="#/platforms">维护平台资料</a>
        <a class="btn btn-sm" href="#/tools">维护工具包</a>
      </div>
    </div>
  `);
}

/* ---------- 审核队列 ---------- */

async function pending() {
  if (!guard()) return;
  setContent('<div class="skeleton" style="height:200px"></div>');
  const data = await api.get('/admin/pending');

  const postBlock = data.posts.length ? data.posts.map((p) => `
    <div class="queue-item">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="min-width:200px">
          <a href="/#/post/${esc(p.id)}" target="_blank" style="font-weight:600">${esc(p.title)}</a>
          <div class="section-sub">${esc(p.author_nick)} · ${esc(p.board_name)} · ${fmtDate(p.created_at)}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-primary" data-post-approve="${esc(p.id)}">通过</button>
          <button class="btn btn-sm btn-danger" data-post-reject="${esc(p.id)}">驳回</button>
        </div>
      </div>
    </div>`).join('') : '<div class="empty">没有待审帖子</div>';

  const jobBlock = data.jobs.length ? data.jobs.map((j) => `
    <div class="queue-item">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="min-width:240px">
          <a href="/#/job/${esc(j.id)}" target="_blank" style="font-weight:600">${esc(j.title)}</a>
          <div class="section-sub">${esc(j.author_nick)} · ${esc(j.kind === 'seek' ? '求职' : '招聘')} · ${esc(j.platform_name || '未指定平台')} · ${fmtDate(j.created_at)}
            ${j.risk_deposit || j.risk_fee ? ' · <span style="color:#ff9e9e">存在收费标记，请重点核实</span>' : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="chip ${j.status === 'expired' ? '' : 'chip-warn'}">${j.status}</span>
          <button class="btn btn-sm btn-primary" data-job-approve="${esc(j.id)}">通过</button>
          <button class="btn btn-sm btn-danger" data-job-reject="${esc(j.id)}">驳回</button>
        </div>
      </div>
    </div>`).join('') : '<div class="empty">没有待审岗位</div>';

  const commentBlock = data.comments.length ? data.comments.map((c) => `
    <div class="queue-item">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="min-width:240px">
          <div>${esc(c.content)}</div>
          <div class="section-sub">${esc(c.author_nick)} · ${c.target_type} · ${fmtDate(c.created_at)}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-primary" data-comment-approve="${esc(c.id)}">通过</button>
          <button class="btn btn-sm btn-danger" data-comment-reject="${esc(c.id)}">删除</button>
        </div>
      </div>
    </div>`).join('') : '<div class="empty">没有待审评论</div>';

  setContent(`
    <div class="section-head"><div><div class="section-title">审核队列</div><div class="section-sub">内容提交后进入人工审核，通过后才会出现在前台列表</div></div></div>
    <div class="card" style="margin-bottom:14px"><div class="widget-title">待审帖子（${data.posts.length}）</div>${postBlock}</div>
    <div class="card" style="margin-bottom:14px"><div class="widget-title">待审 / 申请续期岗位（${data.jobs.length}）</div>${jobBlock}</div>
    <div class="card"><div class="widget-title">待审评论（${data.comments.length}）</div>${commentBlock}</div>
  `);

  bindPendingActions();
}

function bindPendingActions() {
  const reject = async (pathName, id, payload, tip) => {
    modal({
      title: tip,
      body: '<div class="field"><label class="field-label">驳回原因（会展示给发布者）</label><input class="input" id="rj-reason" placeholder="例：薪资承诺缺乏依据且联系方式不完整"></div>',
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-danger" id="rj-ok">确认驳回</button>',
      onMount: (mask) => mask.querySelector('#rj-ok').addEventListener('click', async () => {
        try {
          await api.post(pathName, { ...payload, id, status: 'rejected', reason: mask.querySelector('#rj-reason').value.trim() || '不符合社区规范' });
          mask.remove(); toast('已驳回', 'success'); pending();
        } catch (err) { toast(err.message, 'error'); }
      })
    });
  };

  document.querySelectorAll('[data-post-approve]').forEach((el) => el.addEventListener('click', async () => {
    await api.post('/posts/admin/status', { id: el.getAttribute('data-post-approve'), status: 'published' });
    toast('已通过', 'success'); pending();
  }));
  document.querySelectorAll('[data-post-reject]').forEach((el) => el.addEventListener('click', () =>
    reject('/posts/admin/status', el.getAttribute('data-post-reject'), {}, '驳回帖子')));
  document.querySelectorAll('[data-job-approve]').forEach((el) => el.addEventListener('click', async () => {
    await api.post('/jobs/admin/status', { id: el.getAttribute('data-job-approve'), status: 'approved' });
    toast('已通过并上架', 'success'); pending();
  }));
  document.querySelectorAll('[data-job-reject]').forEach((el) => el.addEventListener('click', () =>
    reject('/jobs/admin/status', el.getAttribute('data-job-reject'), {}, '驳回招聘信息')));
  document.querySelectorAll('[data-comment-approve]').forEach((el) => el.addEventListener('click', async () => {
    await api.post('/admin/comments/status', { id: el.getAttribute('data-comment-approve'), status: 'published' });
    toast('已通过', 'success'); pending();
  }));
  document.querySelectorAll('[data-comment-reject]').forEach((el) => el.addEventListener('click', async () => {
    await api.post('/admin/comments/status', { id: el.getAttribute('data-comment-reject'), status: 'removed' });
    toast('已删除', 'success'); pending();
  }));
}

/* ---------- 举报处理 ---------- */

async function reports(params, query) {
  if (!guard()) return;
  const status = query.status || 'pending';
  setContent('<div class="skeleton" style="height:200px"></div>');
  const list = await api.get(`/admin/reports?status=${encodeURIComponent(status)}`);

  setContent(`
    <div class="section-head">
      <div><div class="section-title">举报处理</div><div class="section-sub">处理下架或驳回举报，处置动作会写入操作日志</div></div>
      <div class="filterbar">
        <a class="tab-pill ${status === 'pending' ? 'active' : ''}" href="#/reports?status=pending">待处理</a>
        <a class="tab-pill ${status === 'resolved' ? 'active' : ''}" href="#/reports?status=resolved">已处理</a>
      </div>
    </div>
    <div class="card">
      ${list.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>时间</th><th>类型</th><th>举报对象</th><th>举报人</th><th>说明</th><th style="width:180px">操作</th></tr></thead>
        <tbody>${list.map((r) => `
          <tr>
            <td>${fmtDate(r.created_at)}</td>
            <td><span class="chip chip-danger">${esc(r.reason_type)}</span></td>
            <td>${esc(r.target_title || r.target_id)}<div class="section-sub">${r.target_type}</div></td>
            <td>${esc(r.reporter_nick)}</td>
            <td>${esc(r.reason_detail || '—')}</td>
            <td>${r.status === 'pending'
              ? `<button class="btn btn-sm btn-danger" data-rp-down="${esc(r.id)}">下架处理</button>
                 <button class="btn btn-sm" data-rp-dismiss="${esc(r.id)}">驳回举报</button>`
              : `<span class="chip chip-ok">${esc(r.action || '已处理')}</span><div class="section-sub">${esc(r.handler_nick || '')} ${r.handled_at ? fmtDate(r.handled_at) : ''}</div>`}</td>
          </tr>`).join('')}</tbody>
      </table></div>` : '<div class="empty">没有相关举报</div>'}
    </div>
  `);

  document.querySelectorAll('[data-rp-down]').forEach((el) => el.addEventListener('click', async () => {
    await api.post('/admin/reports/handle', { id: el.getAttribute('data-rp-down'), action: '下架', note: '管理员下架' });
    toast('已下架对应内容', 'success'); reports(params, query);
  }));
  document.querySelectorAll('[data-rp-dismiss]').forEach((el) => el.addEventListener('click', async () => {
    await api.post('/admin/reports/handle', { id: el.getAttribute('data-rp-dismiss'), action: '驳回举报', note: '证据不足' });
    toast('已驳回举报', 'success'); reports(params, query);
  }));
}

/* ---------- 平台资料库维护 ---------- */

async function adminPlatforms() {
  if (!guard()) return;
  setContent('<div class="skeleton" style="height:200px"></div>');
  const [options, list] = await Promise.all([api.get('/meta/options'), api.get('/platforms?status=all')]);

  setContent(`
    <div class="section-head">
      <div><div class="section-title">平台资料库维护</div><div class="section-sub">入驻条件 / 分成政策 / 结算周期 / 规则红线 / 官方链接</div></div>
      <button class="btn btn-primary btn-sm" id="pf-new">${icon('plus', 14)} 新增平台</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table class="table">
        <thead><tr><th>名称</th><th>分类</th><th>核验</th><th>状态</th><th>浏览</th><th>更新时间</th><th style="width:140px">操作</th></tr></thead>
        <tbody>${list.map((p) => `
          <tr>
            <td><strong>${esc(p.name)}</strong><div class="section-sub">${esc(p.alias || '')}</div></td>
            <td>${esc(p.category)}</td>
            <td>${p.verified ? '<span class="chip chip-ok">已核验</span>' : '<span class="chip chip-warn">待核验</span>'}</td>
            <td>${p.status === 'published' ? '<span class="chip chip-ok">已发布</span>' : '<span class="chip">草稿</span>'}</td>
            <td>${num(p.views)}</td>
            <td>${fmtDate(p.updated_at)}</td>
            <td><button class="btn btn-sm" data-pf-edit="${esc(p.id)}">编辑</button>
                ${p.status === 'published' ? `<button class="btn btn-sm btn-danger" data-pf-off="${esc(p.id)}">下架</button>` : ''}</td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>
  `);

  document.getElementById('pf-new').addEventListener('click', () => platformForm(options, null, list));
  document.querySelectorAll('[data-pf-edit]').forEach((el) => el.addEventListener('click', () => {
    const target = list.find((p) => p.id === el.getAttribute('data-pf-edit'));
    platformForm(options, target, list);
  }));
  document.querySelectorAll('[data-pf-off]').forEach((el) => el.addEventListener('click', async () => {
    await api.post('/platforms/admin/remove', { id: el.getAttribute('data-pf-off') });
    toast('已下架', 'success'); adminPlatforms();
  }));
}

function platformForm(options, item, list) {
  const p = item || { features: [], redlines: [], official_links: [], tags: [] };
  modal({
    title: item ? `编辑平台 · ${item.name}` : '新增平台档案',
    wide: true,
    body: `
      <div class="grid-3">
        <div class="field"><label class="field-label">名称</label><input class="input" id="f-name" value="${esc(p.name || '')}"></div>
        <div class="field"><label class="field-label">别名</label><input class="input" id="f-alias" value="${esc(p.alias || '')}"></div>
        <div class="field"><label class="field-label">Logo 文字</label><input class="input" id="f-logo" value="${esc(p.logo_text || '')}" placeholder="最多 2 字"></div>
      </div>
      <div class="grid-3">
        <div class="field"><label class="field-label">分类</label>
          <select class="select" id="f-category">${options.platformCategories.map((c) => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label class="field-label">状态</label>
          <select class="select" id="f-status"><option value="published" ${p.status === 'published' ? 'selected' : ''}>已发布</option><option value="draft" ${p.status === 'draft' ? 'selected' : ''}>草稿</option></select></div>
        <div class="field"><label class="field-label">标签（逗号分隔）</label><input class="input" id="f-tags" value="${esc((p.tags || []).join(','))}"></div>
      </div>
      <div class="field"><label class="field-label">一句话简介</label><textarea class="textarea" id="f-summary" style="min-height:70px">${esc(p.summary || '')}</textarea></div>
      <div class="field"><label class="field-label">平台特色（每行一条：标题 | 说明）</label>
        <textarea class="textarea" id="f-features">${esc((p.features || []).map((f) => `${f.title} | ${f.desc}`).join('\n'))}</textarea></div>
      <div class="grid-2">
        <div class="field"><label class="field-label">入驻条件</label><textarea class="textarea" id="f-entry" style="min-height:80px">${esc(p.entry_condition || '')}</textarea></div>
        <div class="field"><label class="field-label">分成政策</label><textarea class="textarea" id="f-payout" style="min-height:80px">${esc(p.payout_policy || '')}</textarea></div>
      </div>
      <div class="grid-2">
        <div class="field"><label class="field-label">结算周期</label><input class="input" id="f-cycle" value="${esc(p.settlement_cycle || '')}"></div>
        <div class="field"><label class="field-label">风险提示</label><input class="input" id="f-risk" value="${esc(p.risk_note || '')}"></div>
      </div>
      <div class="field"><label class="field-label">规则红线（每行一条）</label>
        <textarea class="textarea" id="f-redlines">${esc((p.redlines || []).join('\n'))}</textarea></div>
      <div class="field"><label class="field-label">官方链接（每行一条：名称 | URL）</label>
        <textarea class="textarea" id="f-links">${esc((p.official_links || []).map((l) => `${l.label} | ${l.url}`).join('\n'))}</textarea></div>
      <div class="grid-3">
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="f-verified" ${p.verified ? 'checked' : ''} style="width:18px;height:18px"> 已核验资料</label>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="f-featured" ${p.featured ? 'checked' : ''} style="width:18px;height:18px"> 推荐展示</label>
      </div>`,
    footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="f-save">保存</button>',
    onMount: (mask) => mask.querySelector('#f-save').addEventListener('click', async () => {
      const v = (id) => mask.querySelector(id).value;
      const lines = (sel) => v(sel).split('\n').map((s) => s.trim()).filter(Boolean);
      try {
        await api.post('/platforms/admin/save', {
          id: item ? item.id : null,
          name: v('#f-name'), alias: v('#f-alias'), logo_text: v('#f-logo'), category: v('#f-category'),
          status: v('#f-status'), tags: v('#f-tags').split(/[,，]/).map((s) => s.trim()).filter(Boolean),
          summary: v('#f-summary'),
          features: lines('#f-features').map((l) => { const [title, desc] = l.split('|'); return { title: (title || '').trim(), desc: (desc || '').trim() }; }),
          entry_condition: v('#f-entry'), payout_policy: v('#f-payout'), settlement_cycle: v('#f-cycle'),
          risk_note: v('#f-risk'), redlines: lines('#f-redlines'),
          official_links: lines('#f-links').map((l) => { const [label, url] = l.split('|'); return { label: (label || '').trim(), url: (url || '').trim() }; }),
          verified: mask.querySelector('#f-verified').checked ? 1 : 0,
          featured: mask.querySelector('#f-featured').checked ? 1 : 0
        });
        mask.remove(); toast('平台档案已保存', 'success'); adminPlatforms();
      } catch (err) { toast(err.message, 'error'); }
    })
  });
}

/* ---------- 工具包维护 ---------- */

async function adminTools() {
  if (!guard()) return;
  setContent('<div class="skeleton" style="height:200px"></div>');
  const [options, list] = await Promise.all([api.get('/meta/options'), api.get('/tools?status=all')]);

  setContent(`
    <div class="section-head">
      <div><div class="section-title">行业工具包维护</div><div class="section-sub">支持上下架与置顶，下架后前台不可见但数据保留</div></div>
      <button class="btn btn-primary btn-sm" id="tl-new">${icon('plus', 14)} 新增工具</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table class="table">
        <thead><tr><th>标题</th><th>分类</th><th>形式</th><th>状态</th><th>置顶</th><th>使用</th><th style="width:200px">操作</th></tr></thead>
        <tbody>${list.map((t) => `
          <tr>
            <td><strong>${esc(t.title)}</strong><div class="section-sub">${esc(t.summary || '')}</div></td>
            <td>${esc(t.category)}</td>
            <td>${esc({ template: '模板正文', article: '图文', link: '外链', file: '附件' }[t.form] || t.form)}</td>
            <td>${t.status === 'on' ? '<span class="chip chip-ok">上架中</span>' : '<span class="chip">已下架</span>'}</td>
            <td>${t.pinned ? '<span class="chip chip-warn">置顶</span>' : '—'}</td>
            <td>${num(t.downloads)}</td>
            <td>
              <button class="btn btn-sm" data-tl-edit="${esc(t.id)}">编辑</button>
              <button class="btn btn-sm" data-tl-toggle="${esc(t.id)}">${t.status === 'on' ? '下架' : '上架'}</button>
              <button class="btn btn-sm btn-danger" data-tl-del="${esc(t.id)}">删除</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>
  `);

  document.getElementById('tl-new').addEventListener('click', () => toolForm(options, null, list));
  document.querySelectorAll('[data-tl-edit]').forEach((el) => el.addEventListener('click', () => {
    toolForm(options, list.find((t) => t.id === el.getAttribute('data-tl-edit')), list);
  }));
  document.querySelectorAll('[data-tl-toggle]').forEach((el) => el.addEventListener('click', async () => {
    await api.post('/tools/admin/toggle', { id: el.getAttribute('data-tl-toggle'), field: 'status' });
    toast('状态已切换', 'success'); adminTools();
  }));
  document.querySelectorAll('[data-tl-del]').forEach((el) => el.addEventListener('click', async () => {
    if (!confirm('删除后不可恢复，确认删除该工具？')) return;
    await api.post('/tools/admin/remove', { id: el.getAttribute('data-tl-del') });
    toast('已删除', 'success'); adminTools();
  }));
}

function toolForm(options, item, list) {
  const t = item || { tags: [] };
  modal({
    title: item ? `编辑工具 · ${item.title}` : '新增工具',
    wide: true,
    body: `
      <div class="field"><label class="field-label">标题</label><input class="input" id="t-title" value="${esc(t.title || '')}"></div>
      <div class="grid-3">
        <div class="field"><label class="field-label">分类</label>
          <select class="select" id="t-category">${options.toolCategories.map((c) => `<option ${t.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label class="field-label">形式</label>
          <select class="select" id="t-form">${options.toolForms.map((f) => `<option value="${f.value}" ${t.form === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}</select></div>
        <div class="field"><label class="field-label">标签（逗号分隔）</label><input class="input" id="t-tags" value="${esc((t.tags || []).join(','))}"></div>
      </div>
      <div class="field"><label class="field-label">简介</label><input class="input" id="t-summary" value="${esc(t.summary || '')}"></div>
      <div class="field"><label class="field-label">模板正文 / 图文内容 / 外部链接</label>
        <textarea class="textarea" id="t-content" style="min-height:180px">${esc(t.content || t.link || '')}</textarea>
        <div class="field-hint">选择「外部链接」时，此处填写 URL；其余形式按正文展示。</div></div>
      <div class="grid-2">
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="t-pinned" ${t.pinned ? 'checked' : ''} style="width:18px;height:18px"> 置顶显示</label>
        <div class="field"><label class="field-label">上架状态</label>
          <select class="select" id="t-status"><option value="on" ${t.status !== 'off' ? 'selected' : ''}>上架</option><option value="off" ${t.status === 'off' ? 'selected' : ''}>下架</option></select></div>
      </div>`,
    footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="t-save">保存</button>',
    onMount: (mask) => mask.querySelector('#t-save').addEventListener('click', async () => {
      const v = (id) => mask.querySelector(id).value;
      const form = v('#t-form');
      try {
        await api.post('/tools/admin/save', {
          id: item ? item.id : null,
          title: v('#t-title'), category: v('#t-category'), form,
          tags: v('#t-tags').split(/[,，]/).map((s) => s.trim()).filter(Boolean),
          summary: v('#t-summary'),
          content: form === 'link' ? '' : v('#t-content'),
          link: form === 'link' ? v('#t-content') : '',
          status: v('#t-status'),
          pinned: mask.querySelector('#t-pinned').checked ? 1 : 0
        });
        mask.remove(); toast('工具已保存', 'success'); adminTools();
      } catch (err) { toast(err.message, 'error'); }
    })
  });
}

/* ---------- 板块管理 ---------- */

async function adminBoards() {
  if (!guard()) return;
  setContent('<div class="skeleton" style="height:160px"></div>');
  const boards = await api.get('/meta/boards');
  setContent(`
    <div class="section-head">
      <div><div class="section-title">板块管理</div><div class="section-sub">板块下仍存在帖子时不允许删除</div></div>
      <button class="btn btn-primary btn-sm" id="bd-new">${icon('plus', 14)} 新增板块</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table class="table">
        <thead><tr><th>排序</th><th>名称</th><th>标识</th><th>描述</th><th style="width:140px">操作</th></tr></thead>
        <tbody>${boards.map((b) => `
          <tr>
            <td>${b.sort_order}</td>
            <td><strong>${esc(b.name)}</strong></td>
            <td><span class="chip">${esc(b.slug)}</span></td>
            <td>${esc(b.description)}</td>
            <td><button class="btn btn-sm" data-bd-edit="${esc(b.id)}">编辑</button>
                <button class="btn btn-sm btn-danger" data-bd-del="${esc(b.id)}">删除</button></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>
  `);

  document.getElementById('bd-new').addEventListener('click', () => boardForm(null, boards));
  document.querySelectorAll('[data-bd-edit]').forEach((el) => el.addEventListener('click', () => {
    boardForm(boards.find((b) => b.id === el.getAttribute('data-bd-edit')), boards);
  }));
  document.querySelectorAll('[data-bd-del]').forEach((el) => el.addEventListener('click', async () => {
    try { await api.del(`/meta/boards/${el.getAttribute('data-bd-del')}`); toast('已删除', 'success'); adminBoards(); }
    catch (err) { toast(err.message, 'error'); }
  }));
}

function boardForm(item, boards) {
  const b = item || {};
  modal({
    title: item ? '编辑板块' : '新增板块',
    body: `
      <div class="grid-2">
        <div class="field"><label class="field-label">名称</label><input class="input" id="b-name" value="${esc(b.name || '')}"></div>
        <div class="field"><label class="field-label">标识（英文，用于 URL）</label><input class="input" id="b-slug" value="${esc(b.slug || '')}" ${item ? 'disabled' : ''}></div>
      </div>
      <div class="field"><label class="field-label">描述</label><input class="input" id="b-desc" value="${esc(b.description || '')}"></div>
      <div class="grid-2">
        <div class="field"><label class="field-label">排序</label><input class="input" id="b-sort" type="number" value="${b.sort_order || 99}"></div>
        <div class="field"><label class="field-label">强调色</label>
          <select class="select" id="b-accent">${['violet', 'cyan', 'green', 'red', 'amber'].map((c) => `<option ${b.accent === c ? 'selected' : ''} value="${c}">${c}</option>`).join('')}</select></div>
      </div>`,
    footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="b-save">保存</button>',
    onMount: (mask) => mask.querySelector('#b-save').addEventListener('click', async () => {
      const payload = {
        name: mask.querySelector('#b-name').value,
        slug: mask.querySelector('#b-slug').value,
        description: mask.querySelector('#b-desc').value,
        accent: mask.querySelector('#b-accent').value,
        sort_order: Number(mask.querySelector('#b-sort').value) || 99
      };
      try {
        if (item) await api.put(`/meta/boards/${item.id}`, payload);
        else await api.post('/meta/boards', payload);
        mask.remove(); toast('板块已保存', 'success'); adminBoards();
      } catch (err) { toast(err.message, 'error'); }
    })
  });
}

/* ---------- 用户管理 ---------- */

async function adminUsers(params, query) {
  if (!guard()) return;
  const keyword = query.keyword || '';
  setContent('<div class="skeleton" style="height:200px"></div>');
  const [users, options] = await Promise.all([
    api.get(`/admin/users?keyword=${encodeURIComponent(keyword)}`),
    api.get('/meta/options')
  ]);

  setContent(`
    <div class="section-head">
      <div><div class="section-title">用户管理</div><div class="section-sub">角色决定权限：审核员可处理内容审核，管理员额外可管理平台数据</div></div>
      <input class="input filter-input" id="us-kw" placeholder="搜索用户名 / 昵称" value="${esc(keyword)}">
    </div>
    <div class="card">
      <div class="table-wrap"><table class="table">
        <thead><tr><th>用户</th><th>注册时间</th><th>身份</th><th>联系方式</th><th>状态</th><th style="width:120px">操作</th></tr></thead>
        <tbody>${users.map((u) => `
          <tr>
            <td><strong>${esc(u.nick)}</strong><div class="section-sub">@${esc(u.username)}</div></td>
            <td>${fmtDate(u.created_at)}</td>
            <td><span class="chip chip-brand">${esc(ROLE_LABEL[u.role])}</span></td>
            <td>${esc(u.contact || '—')}</td>
            <td>${u.status === 'banned' ? '<span class="chip chip-danger">已封禁</span>' : '<span class="chip chip-ok">正常</span>'}</td>
            <td>${store.isAdmin() ? `<button class="btn btn-sm" data-us-edit="${esc(u.id)}">权限</button>` : '<span class="section-sub">管理员可见</span>'}</td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>
  `);

  document.getElementById('us-kw').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    location.hash = `#/users?keyword=${encodeURIComponent(e.target.value.trim())}`;
  });

  document.querySelectorAll('[data-us-edit]').forEach((el) => el.addEventListener('click', () => {
    const u = users.find((x) => x.id === el.getAttribute('data-us-edit'));
    modal({
      title: `调整权限 · ${u.nick}`,
      body: `
        <div class="field"><label class="field-label">角色</label>
          <select class="select" id="u-role">${options.userRoles.map((r) => `<option value="${r.value}" ${u.role === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}</select></div>
        <div class="field"><label class="field-label">账号状态</label>
          <select class="select" id="u-status"><option value="normal" ${u.status === 'normal' ? 'selected' : ''}>正常</option><option value="banned" ${u.status === 'banned' ? 'selected' : ''}>封禁</option></select></div>`,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="u-save">保存</button>',
      onMount: (mask) => mask.querySelector('#u-save').addEventListener('click', async () => {
        try {
          await api.post('/admin/users/save', {
            id: u.id,
            role: mask.querySelector('#u-role').value,
            status: mask.querySelector('#u-status').value
          });
          mask.remove(); toast('已更新', 'success'); adminUsers(params, query);
        } catch (err) { toast(err.message, 'error'); }
      })
    });
  }));
}

/* ---------- 操作日志 ---------- */

async function logs() {
  if (!guard()) return;
  setContent('<div class="skeleton" style="height:200px"></div>');
  const list = await api.get('/admin/logs?limit=60');
  setContent(`
    <div class="section-head"><div><div class="section-title">操作日志</div><div class="section-sub">后台所有内容维护与审核动作均留痕，便于追溯</div></div></div>
    <div class="card">
      <div class="table-wrap"><table class="table">
        <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th></tr></thead>
        <tbody>${list.map((l) => `
          <tr>
            <td>${fmtDate(l.created_at)}<div class="section-sub">${new Date(l.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div></td>
            <td>${esc(l.actor_name || '系统')}</td>
            <td><span class="chip chip-brand">${esc(l.action)}</span></td>
            <td>${esc(l.target_type || '')}<div class="section-sub">${esc(l.target_id || '')}</div></td>
            <td>${esc(l.detail || '')}</td>
          </tr>`).join('')}</tbody>
      </table></div>
    </div>
  `);
}

/* ---------- 路由与启动 ---------- */

router.add('/', overview);
router.add('/overview', overview);
router.add('/pending', pending);
router.add('/reports', reports);
router.add('/platforms', adminPlatforms);
router.add('/tools', adminTools);
router.add('/boards', adminBoards);
router.add('/users', adminUsers);
router.add('/logs', logs);

window.addEventListener('hashchange', () => setActiveNav(location.hash));

renderTopbar();
window.addEventListener('vc:auth-changed', renderTopbar);
if (!location.hash) location.hash = '#/overview';
router.start();
setActiveNav(location.hash || '#/overview');
