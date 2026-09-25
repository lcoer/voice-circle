// 首页 / 平台资料库 / 行业工具包 三个 browsing 类页面

import { api, esc, icon, num, fromNow, fmtDate, toast, store, buildHash, requireLogin } from '../core.js';
import {
  setContent, setRail, postCard, platformCard, toolCard, rankWidget, noticeWidget,
  commentList, emptyBox, loadingList, statusChip
} from './components.js';

const TOOL_CATEGORIES = ['话术模板', '运营表格', '合同协议', '素材资源', '软件工具', '避坑指南'];

/* ---------------- 首页 ---------------- */

export async function home(params, query) {
  const sort = query.sort || 'latest';
  setContent(loadingList(4));

  const useSub = sort === 'sub';
  const [homeData, options] = await Promise.all([
    api.get(`/home?sort=${encodeURIComponent(useSub ? 'latest' : sort)}${useSub ? '&sub=1' : ''}`),
    api.get('/meta/options')
  ]);

  const { feed, jobs, tools, platforms } = homeData;
  const boards = options.boards;

  const tabs = [
    ['latest', '最新'],
    ['hot', '热门'],
    ['sub', '我的订阅']
  ];

  setContent(`
   <div data-live="home">
    <div class="card" style="margin-bottom:14px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between">
      <div>
        <div class="section-title" style="margin-bottom:4px">今天找个靠谱的厅，或者招到靠谱的人</div>
        <div class="section-sub">
          ${platforms.length} 个平台档案 · ${tools.length} 份行业工具 · ${options.disclaimer}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <a class="btn btn-primary" href="#/jobs/new">${icon('plus', 15)} 发布招聘 / 求职</a>
        <a class="btn" href="#/community">${icon('chat', 15)} 进社区聊聊</a>
      </div>
    </div>

    <div class="filterbar">
      ${tabs.map(([k, label]) => `<a class="tab-pill ${sort === k ? 'active' : ''}" href="${buildHash('/', { sort: k })}">${label}</a>`).join('')}
      <span style="margin-left:auto" class="section-sub">共 ${homeData.meta.total} 条社区内容</span>
    </div>

    <div class="feed">
      ${feed.length ? feed.map(postCard).join('') : emptyBox('还没有内容，去社区发第一帖吧')}
    </div>

    <div style="height:14px"></div>
    <div class="section-head"><div class="section-title">${icon('brief', 15)} 最新岗位速览</div>
      <a class="section-sub" href="#/jobs">查看全部 →</a></div>
    <div class="card-grid">
      ${jobs.slice(0, 4).map((j) => `
        <a class="card card-hover" href="#/job/${esc(j.id)}" style="padding:14px">
          <div style="font-size:13.5px;font-weight:600;margin-bottom:8px">${esc(j.title)}</div>
          <div class="job-meta">
            <span class="chip chip-brand">${esc(j.role_type || '岗位')}</span>
            <span class="chip">${esc(j.platform_name || '未指定平台')}</span>
            ${j.salary_cycle ? `<span class="chip chip-ok">${esc(j.salary_cycle)}</span>` : ''}
            ${j.risk_flags && j.risk_flags.some((f) => f.level === 'high') ? '<span class="chip chip-danger">存在风险标记</span>' : ''}
          </div>
          <div class="section-sub">${fromNow(j.created_at)}</div>
        </a>`).join('')}
    </div>
   </div>
  `);

  setRail(`
    ${noticeWidget('免责声明', options.disclaimer)}
    <div class="card">
      <div class="widget-title">${icon('layers', 15)} 平台热度榜</div>
      ${platforms.slice(0, 6).map((p, i) => `
        <a class="rank-item" href="#/platform/${esc(p.id)}">
          <span class="rank-no ${i < 3 ? 'top' : ''}">${i + 1}</span>
          <span class="rank-name">${esc(p.name)}</span>
          <span class="rank-value">${num(p.views)}</span>
        </a>`).join('')}
    </div>
    <div class="card">
      <div class="widget-title">${icon('tool', 15)} 最近更新的工具</div>
      ${tools.map((t) => `
        <a class="rank-item" href="#/tool/${esc(t.id)}">
          <span class="rank-name">${esc(t.title)}</span>
          <span class="rank-value">${esc(t.category)}</span>
        </a>`).join('')}
    </div>
    <div class="card">
      <div class="widget-title">${icon('board', 15)} 板块</div>
      ${boards.map((b) => `
        <a class="rank-item" href="${buildHash('/community', { board: b.id })}">
          <span class="rank-name">${esc(b.name)}</span>
          <span class="rank-value">${b.thread_count} 帖</span>
        </a>`).join('')}
    </div>
  `);
}

/* ---------------- 平台资料库 ---------------- */

export async function platforms(params, query) {
  const keyword = query.keyword || '';
  const category = query.category || '';
  const list = await api.get('/platforms');

  const filtered = list.filter((p) => {
    const kwOk = !keyword || `${p.name}${p.alias}${p.summary}`.toLowerCase().includes(keyword.toLowerCase());
    const catOk = !category || p.category === category;
    return kwOk && catOk;
  });

  setContent(`
    <div class="section-head">
      <div>
        <div class="section-title">平台资料库</div>
        <div class="section-sub">入驻条件 · 分成政策 · 结算周期 · 规则红线 · 官方入口</div>
      </div>
      <span class="chip chip-cyan">${list.length} 个平台</span>
    </div>
    <div class="filterbar">
      <input class="input filter-input" id="pf-kw" placeholder="搜索平台名称 / 简介" value="${esc(keyword)}">
      <select class="select" id="pf-cat">
        <option value="">全部分类</option>
        ${[...new Set(list.map((p) => p.category))].map((c) => `<option value="${esc(c)}" ${c === category ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <button class="btn btn-sm" id="pf-reset">重置</button>
      <span style="margin-left:auto" class="section-sub">筛选出 ${filtered.length} 条</span>
    </div>
    <div class="card-grid">${filtered.map(platformCard).join('') || emptyBox('没有匹配的平台')}</div>
  `);

  const apply = () => {
    location.hash = buildHash('/platforms', {
      keyword: document.getElementById('pf-kw').value.trim(),
      category: document.getElementById('pf-cat').value
    });
  };
  document.getElementById('pf-kw').addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
  document.getElementById('pf-cat').addEventListener('change', apply);
  document.getElementById('pf-reset').addEventListener('click', () => { location.hash = '#/platforms'; });

  setRail(`
    ${rankWidget('按浏览量排序', list.map((p) => ({ name: p.name, value: `${num(p.views)} 浏览` })), 'layers')}
    ${noticeWidget('数据说明', '各平台入驻条件、分成与结算信息均为示例数据，随官方政策变动而失效，决策前请以官方最新公告为准。')}
  `);
}

export async function platformDetail(params) {
  const id = params.id;
  setContent(loadingList(2));
  const [p, comments] = await Promise.all([
    api.get(`/platforms/${id}`),
    api.get(`/interaction/comments?target_type=platform&target_id=${encodeURIComponent(id)}`)
  ]);

  const subscribed = (store.user?.platforms || []).includes(id);

  setContent(`
    <a class="btn btn-sm btn-ghost" href="#/platforms" style="margin-bottom:12px">${icon('back', 14)} 返回平台库</a>
    <div class="card">
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div class="logo-box" style="width:56px;height:56px;font-size:16px">${esc(p.logo_text || p.name.slice(0, 2))}</div>
        <div style="flex:1;min-width:220px">
          <h1 class="detail-title" style="margin:0">${esc(p.name)} ${p.verified ? '<span class="chip chip-ok">已核验</span>' : '<span class="chip chip-warn">待核验</span>'}</h1>
          <div class="job-meta">
            <span class="chip chip-brand">${esc(p.category)}</span>
            ${(p.tags || []).map((t) => `<span class="chip"># ${esc(t)}</span>`).join('')}
          </div>
        </div>
        <div style="display:grid;gap:8px">
          <button class="btn btn-sm ${subscribed ? 'btn-primary' : ''}" data-subscribe="${esc(p.id)}">${subscribed ? '已订阅' : icon('plus', 14) + ' 订阅该平台动态'}</button>
          <a class="btn btn-sm" href="${buildHash('/jobs', { platform: p.id })}">查看该平台岗位</a>
          <a class="btn btn-sm" href="${buildHash('/community', { platform: p.id })}">查看该平台讨论</a>
        </div>
      </div>
      <p style="color:var(--text-2);margin-top:14px">${esc(p.summary)}</p>
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="info-block-title">${icon('sponsor', 15)} 平台特色</div>
      <div class="grid-2">
        ${(p.features || []).map((f) => `
          <div class="info-block" style="margin:0">
            <div style="font-weight:600;margin-bottom:4px">${esc(f.title)}</div>
            <div class="section-sub" style="line-height:1.7">${esc(f.desc)}</div>
          </div>`).join('') || emptyBox('暂未整理特色条目')}
      </div>
    </div>

    <div style="height:14px"></div>
    <div class="grid-2">
      <div class="card">
        <div class="info-block-title">${icon('check', 15)} 入驻条件</div>
        <div style="color:var(--text-2);font-size:13.5px;line-height:1.8">${esc(p.entry_condition || '暂无')}</div>
      </div>
      <div class="card">
        <div class="info-block-title">${icon('cash', 15)} 分成政策</div>
        <div style="color:var(--text-2);font-size:13.5px;line-height:1.8">${esc(p.payout_policy || '暂无')}</div>
      </div>
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="info-block-title">${icon('clock', 15)} 结算周期</div>
      <div style="color:var(--text-2);font-size:13.5px">${esc(p.settlement_cycle || '暂无')}</div>
      <div style="height:14px"></div>
      <div class="info-block-title" style="color:#ff9e9e">${icon('alert', 15)} 规则红线</div>
      ${(p.redlines || []).map((r) => `<div class="redline-item">${icon('alert', 13)} <span>${esc(r)}</span></div>`).join('') || '<div class="section-sub">暂无</div>'}
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="info-block-title">${icon('link', 15)} 官方入口</div>
      ${(p.official_links || []).map((l) => `<div class="link-item">${icon('link', 13)} <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} · ${esc(l.url)}</a></div>`).join('') || '<div class="section-sub">暂无官方链接</div>'}
      <div style="height:14px"></div>
      <div class="notice">${icon('shield', 13)} 风险提示：${esc(p.risk_note || '暂无')}</div>
      <div style="height:10px"></div>
      <div class="section-sub">档案最后更新：${fmtDate(p.updated_at)} · 浏览量 ${num(p.views)} · 以上内容均为示例数据，以官方最新公告为准</div>
      <div style="margin-top:12px" class="post-foot">
        <span class="act fav ${p.faved ? 'on' : ''}" data-fav="platform:${esc(p.id)}">${icon('star', 15)} 收藏 ${num(p.fav_count)}</span>
        <span class="act" data-report="platform:${esc(p.id)}">${icon('report', 15)} 举报资料有误</span>
      </div>
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="widget-title">${icon('chat', 15)} 关于平台的讨论（${comments.length}）</div>
      <div id="platform-comments">${commentList(comments)}</div>
      <div style="margin-top:14px;display:flex;gap:8px">
        <input class="input" id="platform-comment-input" placeholder="说点什么（登录后可见身份）">
        <button class="btn" id="platform-comment-send">发送</button>
      </div>
    </div>
  `);

  const input = document.getElementById('platform-comment-input');
  document.getElementById('platform-comment-send').addEventListener('click', async () => {
    if (!requireLogin()) return;
    const content = input.value.trim();
    if (content.length < 2) return toast('评论内容过短', 'error');
    await api.post('/interaction/comments', { target_type: 'platform', target_id: id, content });
    input.value = '';
    toast('评论已发布', 'success');
    platformDetail(params);
  });

  setRail(`
    ${noticeWidget('如何核实信息', '入驻前建议同时核对：平台官方文档、已核验公会资质、真实结算流水样本。口头承诺不具备约束力。')}
  `);
}

/* ---------------- 行业工具包 ---------------- */

export async function tools(params, query) {
  const category = query.category || '';
  const keyword = query.keyword || '';
  const list = await api.get('/tools');
  const filtered = list.filter((t) => {
    const catOk = !category || t.category === category;
    const kwOk = !keyword || `${t.title}${t.summary}`.toLowerCase().includes(keyword.toLowerCase());
    return catOk && kwOk;
  });

  setContent(`
    <div class="section-head">
      <div>
        <div class="section-title">行业工具包</div>
        <div class="section-sub">话术 · 排班表 · 结算表 · 合同要点 · 素材规范 · 避坑手册</div>
      </div>
      ${store.isStaff() ? '<a class="btn btn-sm" href="/admin#/tools">后台维护</a>' : ''}
    </div>
    <div class="filterbar">
      <a class="tab-pill ${!category ? 'active' : ''}" href="#/tools">全部</a>
      ${TOOL_CATEGORIES.map((c) => `<a class="tab-pill ${category === c ? 'active' : ''}" href="${buildHash('/tools', { category: c, keyword })}">${c}</a>`).join('')}
      <input class="input filter-input" id="tool-kw" placeholder="搜索工具名 / 简介" value="${esc(keyword)}" style="margin-left:auto">
    </div>
    <div class="card-grid">${filtered.map(toolCard).join('') || emptyBox('没有匹配的工具')}</div>
  `);

  document.getElementById('tool-kw').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    location.hash = buildHash('/tools', { category, keyword: e.target.value.trim() });
  });

  setRail(`
    ${rankWidget('使用最多', [...list].sort((a, b) => b.downloads - a.downloads).slice(0, 6).map((t) => ({ name: t.title, value: `${t.downloads} 次` })), 'tool')}
    ${noticeWidget('投稿建议', '工具包支持后台新增与上下架。贡献者请附上使用场景与适用人数，便于他人判断是否适合自己。')}
  `);
}

export async function toolDetail(params) {
  const id = params.id;
  setContent(loadingList(2));
  const [tool, comments] = await Promise.all([
    api.get(`/tools/${id}`),
    api.get(`/interaction/comments?target_type=tool&target_id=${encodeURIComponent(id)}`)
  ]);
  await api.post(`/tools/${id}/download`);

  const formLabel = { template: '模板正文', article: '图文教程', link: '外部链接', file: '附件下载' }[tool.form] || '内容';

  setContent(`
    <a class="btn btn-sm btn-ghost" href="#/tools" style="margin-bottom:12px">${icon('back', 14)} 返回工具包</a>
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <h1 class="detail-title" style="margin:0 0 8px">${esc(tool.title)}</h1>
          <div class="job-meta">
            <span class="chip chip-brand">${esc(tool.category)}</span>
            <span class="chip">${formLabel}</span>
            ${(tool.tags || []).map((t) => `<span class="chip"># ${esc(t)}</span>`).join('')}
            ${statusChip(tool.status)}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start">
          <button class="btn btn-sm" id="tool-copy">复制内容</button>
          <span class="btn btn-sm fav ${tool.faved ? 'on' : ''}" data-fav="tool:${esc(tool.id)}">${icon('star', 14)} 收藏 ${num(tool.fav_count)}</span>
        </div>
      </div>
      <p style="color:var(--text-2);margin-top:12px">${esc(tool.summary)}</p>
      <div class="info-block" style="margin-top:14px">
        <div class="info-block-title">${icon('board', 15)} ${formLabel}</div>
        <div class="article-body" id="tool-content" style="white-space:pre-wrap">${esc(tool.content || '（无正文内容）')}</div>
      </div>
      ${tool.link ? `<a class="btn" href="${esc(tool.link)}" target="_blank" rel="noopener">${icon('link', 14)} 打开外部链接</a>` : ''}
      <div class="section-sub" style="margin-top:12px">使用 ${num(tool.downloads)} 次 · 浏览 ${num(tool.views)} 次 · 更新于 ${fmtDate(tool.updated_at)}</div>
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="widget-title">${icon('chat', 15)} 使用反馈（${comments.length}）</div>
      <div>${commentList(comments)}</div>
    </div>
  `);

  document.getElementById('tool-copy').addEventListener('click', () => {
    const text = tool.content || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板', 'success'));
    } else {
      toast('当前浏览器不支持一键复制，请手动选择', 'error');
    }
  });

  setRail('');
}
