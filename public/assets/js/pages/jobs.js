// 招聘求职区：列表筛选、岗位详情、发布表单

import { api, esc, icon, num, fromNow, fmtDate, toast, store, buildHash, requireLogin, salaryText } from '../core.js';
import {
  setContent, setRail, jobCard, commentItem, emptyBox, loadingList, pagination, noticeWidget, rankWidget, statusChip
} from './components.js';

let dictCache = null;
async function dict() {
  if (!dictCache) dictCache = await api.get('/meta/options');
  return dictCache;
}

/* ---------------- 列表 ---------------- */

export async function jobs(params, query) {
  const q = {
    kind: query.kind || '',
    platform: query.platform || '',
    role_type: query.role || '',
    salary_cycle: query.cycle || '',
    sort: query.sort || 'latest',
    no_risk: query.no_risk || '',
    keyword: query.keyword || '',
    page: query.page || '1',
    page_size: '10'
  };
  setContent(loadingList(3));
  const options = await dict();
  const data = await api.get(`/jobs?${new URLSearchParams(q).toString()}`);

  const baseQuery = { ...q, page: '' };
  const pills = (key, list, labelFn = (x) => x, valueFn = (x) => x) => list.map((item) => {
    const v = valueFn(item);
    return `<a class="tab-pill ${q[key] === v ? 'active' : ''}" href="${buildHash('/jobs', { ...baseQuery, [key]: q[key] === v ? '' : v })}">${esc(labelFn(item))}</a>`;
  }).join('');

  setContent(`
    <div class="section-head">
      <div>
        <div class="section-title">招聘求职</div>
        <div class="section-sub">主播 · 主持 · 运营 · 厅管 · 星探 · 美工 · 音频后期，信息均经人工审核</div>
      </div>
      <a class="btn btn-primary btn-sm" href="#/jobs/new" id="new-job">${icon('plus', 14)} 招聘 / 投简历</a>
    </div>

    <div class="filterbar">
      <a class="tab-pill ${!q.kind ? 'active' : ''}" href="${buildHash('/jobs', { ...baseQuery, kind: '' })}">全部</a>
      <a class="tab-pill ${q.kind === 'recruit' ? 'active' : ''}" href="${buildHash('/jobs', { ...baseQuery, kind: 'recruit' })}">我要找工作</a>
      <a class="tab-pill ${q.kind === 'seek' ? 'active' : ''}" href="${buildHash('/jobs', { ...baseQuery, kind: 'seek' })}">我要招人</a>
      <span style="margin-left:auto" class="section-sub">共 ${data.meta.total} 条</span>
    </div>

    <div class="filterbar">
      <select class="select" id="jb-platform">
        <option value="">全部平台</option>
        ${options.platforms.map((p) => `<option value="${esc(p.id)}" ${q.platform === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select>
      <select class="select" id="jb-role">
        <option value="">全部岗位</option>
        ${options.roleTypes.map((r) => `<option value="${esc(r)}" ${q.role_type === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
      </select>
      <select class="select" id="jb-cycle">
        <option value="">结算方式不限</option>
        ${options.salaryCycles.map((c) => `<option value="${esc(c)}" ${q.salary_cycle === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <select class="select" id="jb-sort">
        <option value="latest" ${q.sort === 'latest' ? 'selected' : ''}>最新发布</option>
        <option value="salary" ${q.sort === 'salary' ? 'selected' : ''}>薪资从高到低</option>
        <option value="hot" ${q.sort === 'hot' ? 'selected' : ''}>热度优先</option>
      </select>
      <a class="tab-pill ${q.no_risk === '1' ? 'active' : ''}" href="${buildHash('/jobs', { ...baseQuery, no_risk: q.no_risk === '1' ? '' : '1' })}">${icon('shield', 13)} 仅看无收取费用</a>
      <input class="input filter-input" id="jb-kw" placeholder="搜索岗位 / 关键词" value="${esc(q.keyword)}" style="margin-left:auto">
    </div>

    <div class="feed" data-live="jobs" data-live-query="${esc(JSON.stringify({ kind: q.kind, platform: q.platform, role: q.role_type, cycle: q.salary_cycle, sort: q.sort, no_risk: q.no_risk, keyword: q.keyword, page: q.page }))}">
      ${data.list.length ? data.list.map(jobCard).join('') : emptyBox('没有符合条件的岗位，试试放宽筛选')}
    </div>
    ${pagination(data.meta, '/jobs', baseQuery)}
  `);

  const reload = (patch) => { location.hash = buildHash('/jobs', { ...baseQuery, ...patch }); };
  document.getElementById('jb-platform').addEventListener('change', (e) => reload({ platform: e.target.value }));
  document.getElementById('jb-role').addEventListener('change', (e) => reload({ role: e.target.value }));
  document.getElementById('jb-cycle').addEventListener('change', (e) => reload({ cycle: e.target.value }));
  document.getElementById('jb-sort').addEventListener('change', (e) => reload({ sort: e.target.value }));
  document.getElementById('jb-kw').addEventListener('keydown', (e) => { if (e.key === 'Enter') reload({ keyword: e.target.value.trim() }); });
  document.getElementById('new-job').addEventListener('click', (e) => { if (!requireLogin()) e.preventDefault(); });

  setRail(`
    ${noticeWidget('防骗三不', '1. 不缴纳任何押金、培训费、服装费；2. 不接受口头保底；3. 不在站外私下转账。遇到违规请先举报。')}
    ${rankWidget('热门岗位类型', options.roleTypes.map((r) => ({ name: r, value: '' })), 'brief')}
    ${rankWidget('平台岗位数', options.platforms.slice(0, 6).map((p) => ({ name: p.name, value: '' })), 'layers')}
  `);
}

/* ---------------- 详情 ---------------- */

export async function jobDetail(params) {
  const id = params.id;
  setContent(loadingList(2));
  const [job, comments] = await Promise.all([
    api.get(`/jobs/${id}`),
    api.get(`/interaction/comments?target_type=job&target_id=${encodeURIComponent(id)}`)
  ]);
  const isOwner = store.user && store.user.id === job.author_id;
  const risk = job.risk_flags || [];

  setContent(`
    <a class="btn btn-sm btn-ghost" href="${buildHash('/jobs', { kind: job.kind })}" style="margin-bottom:12px">${icon('back', 14)} 返回列表</a>
    <div class="card" data-live="jobStats" data-live-target="${esc(job.id)}">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="min-width:240px">
          <h1 class="detail-title" style="margin:0 0 8px">${esc(job.title)}</h1>
          <div class="job-meta">
            <span class="chip chip-brand">${job.kind === 'seek' ? '求职简历' : '招聘信息'}</span>
            ${statusChip(job.status)}
            ${job.platform_name ? `<a class="chip" href="#/platform/${esc(job.platform_id)}">${esc(job.platform_name)}</a>` : ''}
            ${job.city ? `<span class="chip">${esc(job.city)}</span>` : ''}
            <span class="chip">${job.remote ? '线上' : '线下'}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start">
          <button class="btn btn-sm" id="jd-copy">复制联系方式</button>
          <span class="btn btn-sm fav ${job.faved ? 'on' : ''}" data-fav="job:${esc(job.id)}">${icon('star', 14)} 收藏 ${num(job.fav_count)}</span>
          <span class="btn btn-sm" data-report="job:${esc(job.id)}">${icon('report', 14)} 举报</span>
        </div>
      </div>

      ${risk.length ? `<div style="height:12px"></div><div class="risk-banner">${icon('alert', 16)} <div>
        <strong>风险提示</strong><br>${risk.map((f) => `· ${esc(f.label)}`).join('<br>')}
        <br><span style="opacity:.85">按行业规范，正规岗位不应要求任何形式的前置费用；请保留聊天记录与转账凭证。</span>
      </div></div>` : ''}

      <div style="height:12px"></div>
      <div class="grid-2">
        <div class="info-block"><div class="info-block-title">${icon('cash', 15)} 薪资待遇</div>
          <div style="font-size:18px;font-weight:600;color:var(--warn)">${esc(salaryText(job))}</div>
          <div class="section-sub">结算周期：${esc(job.salary_cycle || '面议')}</div>
        </div>
        <div class="info-block"><div class="info-block-title">${icon('clock', 15)} 工作时间</div>
          <div>${esc(job.work_time || '面议')}</div>
        </div>
        <div class="info-block"><div class="info-block-title">${icon('brief', 15)} 岗位类型</div>
          <div>${esc(job.role_type || '未指定')}</div>
        </div>
        <div class="info-block"><div class="info-block-title">${icon('user', 15)} 联系方式</div>
          <div>${esc(job.contact_name || '未提供')} · ${esc(job.contact_value || '请通过站内留言联系')}</div>
        </div>
      </div>

      <div style="height:12px"></div>
      <div class="info-block">
        <div class="info-block-title">${icon('board', 15)} 详细描述</div>
        <div class="article-body">${job.description}</div>
      </div>

      <div class="post-foot" style="margin-top:12px">
        <span>${icon('user', 14)} ${esc(job.author_nick)}</span>
        <span>发布于 ${fmtDate(job.created_at)}</span>
        <span>${icon('eye', 14)} ${num(job.views)} 浏览</span>
        <span style="margin-left:auto">${job.expires_at ? (job.days_left > 0 ? `${job.days_left} 天后到期` : '已到期自动下架') : ''}</span>
      </div>

      ${job.reject_reason ? `<div style="height:12px"></div><div class="risk-banner">${icon('alert', 15)} 审核意见：${esc(job.reject_reason)}</div>` : ''}

      ${isOwner ? `<div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-sm" id="jd-renew">续期 30 天</button>
        <button class="btn btn-sm btn-danger" id="jd-close">下架该信息</button>
      </div>` : ''}
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="widget-title">${icon('chat', 15)} 留言 / 咨询<span data-cmt-count="${esc(job.id)}">（${comments.length}）</span></div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <input class="input" id="job-comment-input" placeholder="询问排班、结算等细节，注意保护个人隐私">
        <button class="btn" id="job-comment-send">发送</button>
      </div>
      <div id="job-comment-list" data-live="comments" data-live-type="job" data-live-target="${esc(job.id)}">${comments.length ? comments.map((c) => commentItem(c)).join('') : emptyBox('还没有留言')}</div>
    </div>
  `);

  document.getElementById('jd-copy').addEventListener('click', () => {
    const text = `${job.contact_name || ''} ${job.contact_value || ''}`.trim();
    if (!text) return toast('对方未提供联系方式', 'error');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('联系方式已复制', 'success'));
    else toast('浏览器不支持一键复制', 'error');
  });

  document.getElementById('job-comment-send').addEventListener('click', async () => {
    if (!requireLogin()) return;
    const content = document.getElementById('job-comment-input').value.trim();
    if (content.length < 2) return toast('留言内容过短', 'error');
    try {
      await api.post('/interaction/comments', { target_type: 'job', target_id: id, content });
      toast('留言已发布', 'success');
      jobDetail(params);
    } catch (err) { toast(err.message, 'error'); }
  });

  const renew = document.getElementById('jd-renew');
  if (renew) renew.addEventListener('click', async () => {
    try { await api.post(`/jobs/${id}/renew`); toast('已续期 30 天', 'success'); jobDetail(params); }
    catch (err) { toast(err.message, 'error'); }
  });
  const close = document.getElementById('jd-close');
  if (close) close.addEventListener('click', async () => {
    if (!confirm('确定要下架这条信息吗？下架后不再对外展示。')) return;
    try { await api.post(`/jobs/${id}/close`); toast('已下架', 'success'); location.hash = '#/jobs'; }
    catch (err) { toast(err.message, 'error'); }
  });

  setRail(`
    ${noticeWidget('投递建议', '先确认对方的平台、房间号与结算凭证，再决定是否入职。第一次合作尽量选择短周期结算。')}
    ${rankWidget('薪资中位数参考', [
      { name: '兼职主播', value: '2k - 6k / 月' },
      { name: '主持 / 控场', value: '3k - 8k / 月' },
      { name: '厅管', value: '2.5k - 6k / 月' },
      { name: '音频后期', value: '80 - 300 / 时' }
    ], 'cash')}
  `);
}

/* ---------------- 发布 ---------------- */

export async function newJob(params, query) {
  if (!requireLogin('登录后才能发布招聘 / 求职信息')) { location.hash = '#/jobs'; return; }
  const options = await dict();
  const kind = query.kind || 'recruit';

  setContent(`
    <div class="section-head"><div class="section-title">发布${kind === 'seek' ? '求职简历' : '招聘信息'}</div>
      <div class="section-sub">提交后进入人工审核队列，通过后自动上架，30 天后到期自动下架</div></div>
    <div class="filterbar">
      <a class="tab-pill ${kind === 'recruit' ? 'active' : ''}" href="${buildHash('/jobs/new', { kind: 'recruit' })}">我要招人</a>
      <a class="tab-pill ${kind === 'seek' ? 'active' : ''}" href="${buildHash('/jobs/new', { kind: 'seek' })}">我要找工作</a>
    </div>
    <div class="card">
      <div class="field">
        <label class="field-label">标题</label>
        <input class="input" id="nj-title" placeholder="${kind === 'seek' ? '例：两年电台经验，可 20-24 点稳定开播' : '例：【Hello语音】夜航厅招聘兼职歌手（日结）'}">
      </div>
      <div class="grid-3">
        <div class="field">
          <label class="field-label">所属平台</label>
          <select class="select" id="nj-platform">
            <option value="">不限 / 其他</option>
            ${options.platforms.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">岗位类型</label>
          <select class="select" id="nj-role">
            ${options.roleTypes.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">工作地点</label>
          <input class="input" id="nj-city" placeholder="不限">
        </div>
      </div>
      <div class="grid-3">
        <div class="field">
          <label class="field-label">薪资下限</label>
          <input class="input" id="nj-min" type="number" min="0" placeholder="3000">
        </div>
        <div class="field">
          <label class="field-label">薪资上限</label>
          <input class="input" id="nj-max" type="number" min="0" placeholder="8000">
        </div>
        <div class="field">
          <label class="field-label">结算方式</label>
          <select class="select" id="nj-cycle">
            ${options.salaryCycles.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label class="field-label">单位</label>
          <select class="select" id="nj-unit">
            ${options.salaryUnits.map((u) => `<option value="${esc(u)}">${esc(u)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">工作时间 / 麦时</label>
          <input class="input" id="nj-time" placeholder="每晚 20:00-24:00，每周至少 4 天">
        </div>
      </div>
      <div class="grid-2">
        <div class="field">
          <label class="field-label">联系人</label>
          <input class="input" id="nj-contact-name" placeholder="称呼">
        </div>
        <div class="field">
          <label class="field-label">联系方式</label>
          <input class="input" id="nj-contact-value" placeholder="微信 / QQ / 邮箱">
        </div>
      </div>
      <div class="field">
        <label class="field-label">详细描述</label>
        <textarea class="textarea" id="nj-desc" placeholder="${kind === 'seek' ? '介绍经验、擅长方向、设备情况、可上麦时段、薪资预期' : '厅的情况、岗位要求、薪资构成、我们能提供什么'}"></textarea>
        <div class="field-hint">支持空行分段。请如实描述，隐瞒收费情况一经核实将直接下架。</div>
      </div>
      <div class="info-block" style="border-color:rgba(255,90,90,.32);background:rgba(255,90,90,.06)">
        <div class="info-block-title" style="color:#ff9e9e">${icon('alert', 15)} 费用披露（必填，关系到是否挂风险标记）</div>
        <label style="display:flex;gap:10px;align-items:center;padding:4px 0">
          <input type="checkbox" id="nj-deposit" style="width:18px;height:18px"> 该岗位需要缴纳押金 / 保证金
        </label>
        <label style="display:flex;gap:10px;align-items:center;padding:4px 0">
          <input type="checkbox" id="nj-fee" style="width:18px;height:18px"> 该岗位需要缴纳培训费 / 入职费
        </label>
        <label style="display:flex;gap:10px;align-items:center;padding:4px 0">
          <input type="checkbox" id="nj-verified" style="width:18px;height:18px"> 我已核验对方 / 我方实名信息
        </label>
        <div class="section-sub">勾选前两项后，列表与详情页会强展示红色风险横幅，并在筛选中被过滤。</div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <a class="btn" href="#/jobs">取消</a>
        <button class="btn btn-primary" id="nj-submit">提交审核</button>
      </div>
    </div>
  `);

  document.getElementById('nj-submit').addEventListener('click', async () => {
    const payload = {
      kind,
      title: document.getElementById('nj-title').value.trim(),
      platform_id: document.getElementById('nj-platform').value || null,
      role_type: document.getElementById('nj-role').value,
      city: document.getElementById('nj-city').value.trim(),
      salary_min: Number(document.getElementById('nj-min').value) || 0,
      salary_max: Number(document.getElementById('nj-max').value) || 0,
      salary_cycle: document.getElementById('nj-cycle').value,
      salary_unit: document.getElementById('nj-unit').value,
      work_time: document.getElementById('nj-time').value.trim(),
      contact_name: document.getElementById('nj-contact-name').value.trim(),
      contact_value: document.getElementById('nj-contact-value').value.trim(),
      description: document.getElementById('nj-desc').value,
      risk_deposit: document.getElementById('nj-deposit').checked ? 1 : 0,
      risk_fee: document.getElementById('nj-fee').checked ? 1 : 0,
      real_name_verified: document.getElementById('nj-verified').checked ? 1 : 0
    };
    try {
      const res = await api.post('/jobs', payload);
      toast(res.status === 'pending' ? '已提交，等待人工审核通过后上架' : '发布成功', 'success');
      location.hash = '#/me';
    } catch (err) { toast(err.message, 'error'); }
  });

  setRail('');
}
