// 社区交流区：板块列表、帖子详情、发帖、登录、个人中心、用户主页

import { api, esc, icon, num, fromNow, fmtDate, toast, store, modal, buildHash, requireLogin, hashQuery } from '../core.js?v=2';
import {
  setContent, setRail, postCard, commentList, emptyBox, loadingList, pagination, noticeWidget, rankWidget
} from './components.js?v=2';

/* ---------------- 板块列表 ---------------- */

export async function community(params, query) {
  const board = query.board || '';
  const sort = query.sort || 'latest';
  const type = query.type || '';
  const page = query.page || '1';
  const keyword = query.keyword || '';
  setContent(loadingList(3));

  const [options, postsData] = await Promise.all([
    api.get('/meta/options'),
    api.get(`/posts?${new URLSearchParams({ board: board || 'all', sort, type, page, keyword }).toString()}`)
  ]);
  const boards = options.boards;
  const sortTabs = [['latest', '最新'], ['hot', '热门'], ['essence', '精华']];
  const typeTabs = options.postTypes;

  setContent(`
    <div class="section-head">
      <div>
        <div class="section-title">社区交流</div>
        <div class="section-sub">平台讨论 · 运营经验 · 资源分享 · 避坑曝光 · 新人问答</div>
      </div>
      <a class="btn btn-primary btn-sm" href="#/community/new" id="new-post">${icon('plus', 14)} 发帖</a>
    </div>

    <div class="filterbar">
      <a class="tab-pill ${!board ? 'active' : ''}" href="${buildHash('/community', { sort, type, keyword })}">全部</a>
      ${boards.map((b) => `<a class="tab-pill ${board === b.id ? 'active' : ''}" href="${buildHash('/community', { board: b.id, sort, type, keyword })}">${esc(b.name)}</a>`).join('')}
    </div>
    <div class="filterbar">
      ${sortTabs.map(([k, label]) => `<a class="tab-pill ${sort === k ? 'active' : ''}" href="${buildHash('/community', { board, sort: k, type, keyword })}">${label}</a>`).join('')}
      <span style="width:1px;height:20px;background:var(--line-strong)"></span>
      ${typeTabs.map((t) => `<a class="tab-pill ${type === t.value ? 'active' : ''}" href="${buildHash('/community', { board, sort, type: t.value, keyword })}">${t.label}</a>`).join('')}
      <input class="input filter-input" id="community-kw" placeholder="搜索帖子" value="${esc(keyword)}" style="margin-left:auto">
    </div>

    <div class="feed" data-live="posts" data-live-query="${esc(JSON.stringify({ board, sort, type, keyword, page }))}">${postsData.list.length ? postsData.list.map(postCard).join('') : emptyBox('这个板块还没有内容')}</div>
    ${pagination(postsData.meta, '/community', { board, sort, type, keyword })}
  `);

  document.getElementById('community-kw').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    location.hash = buildHash('/community', { board, sort, type, keyword: e.target.value.trim() });
  });
  document.getElementById('new-post').addEventListener('click', (e) => {
    if (!requireLogin()) { e.preventDefault(); return; }
  });

  setRail(`
    ${noticeWidget('发帖提醒', '曝光类帖子请附凭证；引用平台规则请注明时间；招聘相关务必如实勾选是否收费。')}
    ${rankWidget('板块热度', boards.map((b) => ({ name: b.name, value: `${b.thread_count} 帖` })), 'board')}
  `);
}

/* ---------------- 帖子详情 ---------------- */

export async function postDetail(params) {
  const id = params.id;
  setContent(loadingList(2));
  const [post, comments, options] = await Promise.all([
    api.get(`/posts/${id}`),
    api.get(`/interaction/comments?target_type=post&target_id=${encodeURIComponent(id)}`),
    api.get('/meta/options')
  ]);

  setContent(`
    <a class="btn btn-sm btn-ghost" href="${buildHash('/community', { board: post.board_id })}" style="margin-bottom:12px">${icon('back', 14)} 返回 ${esc(post.board_name)}</a>
    <div class="card" data-live="postStats" data-live-target="${esc(post.id)}">
      <h1 class="detail-title">
        ${post.pinned ? '<span class="badge-pin">置顶</span>' : ''}
        ${post.essence ? '<span class="badge-essence">精华</span>' : ''}
        ${esc(post.title)}
      </h1>
      <div class="post-head">
        <div class="avatar">${esc(post.author_avatar || post.author_nick.slice(0, 1))}</div>
        <div class="post-meta">
          <a class="post-author" href="#/u/${esc(post.author_id)}">${esc(post.author_nick)}</a>
          <div class="post-sub">
            <span>${fromNow(post.created_at)}</span>
            <span>${esc(post.board_name)}</span>
            ${post.platform_name ? `<a href="#/platform/${esc(post.platform_id)}" style="color:var(--cyan)">${esc(post.platform_name)}</a>` : ''}
            <span>${icon('eye', 12)} ${num(post.views)}</span>
          </div>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <span class="btn btn-sm fav ${post.faved ? 'on' : ''}" data-fav="post:${esc(post.id)}">${icon('star', 14)} ${num(post.fav_count)}</span>
          <span class="btn btn-sm" data-report="post:${esc(post.id)}">${icon('report', 14)} 举报</span>
        </div>
      </div>
      <div class="article-body">${post.content}</div>
      ${post.tags && post.tags.length ? `<div class="post-tags" style="margin-top:12px">${post.tags.map((t) => `<span class="chip"># ${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="post-foot" style="margin-top:14px">
        <span class="act like ${post.liked ? 'on' : ''}" data-like="${esc(post.id)}">${icon('heart', 15)} 点赞 ${num(post.like_count)}</span>
        <span data-cmt="${esc(post.id)}">${icon('chat', 15)} ${num(post.comment_count)} 评论</span>
      </div>
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="widget-title">${icon('chat', 15)} 全部评论<span data-cmt-count="${esc(post.id)}">（${comments.length}）</span></div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <input class="input" id="comment-input" placeholder="友善发言，理性讨论">
        <button class="btn" id="comment-send">发送</button>
      </div>
      <div id="comment-list" data-live="comments" data-live-type="post" data-live-target="${esc(post.id)}">${commentList(comments)}</div>
    </div>
  `);

  const input = document.getElementById('comment-input');
  document.getElementById('comment-send').addEventListener('click', async () => {
    if (!requireLogin()) return;
    const content = input.value.trim();
    if (content.length < 2) return toast('评论内容过短', 'error');
    try {
      await api.post('/interaction/comments', { target_type: 'post', target_id: id, content });
      input.value = '';
      toast('评论已发布', 'success');
      postDetail(params);
    } catch (err) { toast(err.message, 'error'); }
  });

  setRail(`
    ${noticeWidget('社区公约', '禁止人身攻击、跨平台恶意拉踩与站外违规引流。违规按 删除 → 禁言 → 封号 三级处理。')}
  `);
}

/* ---------------- 发帖 ---------------- */

export async function newPost(params, query) {
  if (!requireLogin('登录后才能发帖')) { location.hash = '#/community'; return; }
  const [options, platformList] = await Promise.all([api.get('/meta/options'), api.get('/platforms?only=list')]);
  const boards = options.boards;
  const presetBoard = query.board || boards[0].id;

  setContent(`
    <div class="section-head"><div class="section-title">发布新帖</div></div>
    <div class="card">
      <div class="field">
        <label class="field-label">选择板块</label>
        <select class="select" id="np-board">
          ${boards.map((b) => `<option value="${esc(b.id)}" ${b.id === presetBoard ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
        </select>
        <div class="field-hint">${esc(boards.find((b) => b.id === presetBoard)?.description || '')}</div>
      </div>
      <div class="field">
        <label class="field-label">标题</label>
        <input class="input" id="np-title" placeholder="一句话说清你的问题或经验" maxlength="60">
      </div>
      <div class="field">
        <label class="field-label">正文</label>
        <textarea class="textarea" id="np-content" placeholder="支持空行分段。曝光类内容请务必附上聊天记录、转账凭证等证据。"></textarea>
      </div>
      <div class="grid-2">
        <div class="field">
          <label class="field-label">关联平台（可选）</label>
          <select class="select" id="np-platform">
            <option value="">不关联</option>
            ${platformList.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">内容类型</label>
          <select class="select" id="np-type">
            ${options.postTypes.map((t) => `<option value="${esc(t.value)}">${esc(t.label)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label class="field-label">标签（英文逗号分隔，最多 4 个）</label>
        <input class="input" id="np-tags" placeholder="排班,结算,避坑">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <a class="btn" href="#/community">取消</a>
        <button class="btn btn-primary" id="np-submit">发布</button>
      </div>
    </div>
  `);

  document.getElementById('np-submit').addEventListener('click', async () => {
    const payload = {
      boardId: document.getElementById('np-board').value,
      title: document.getElementById('np-title').value.trim(),
      content: document.getElementById('np-content').value,
      platformId: document.getElementById('np-platform').value || null,
      type: document.getElementById('np-type').value,
      tags: document.getElementById('np-tags').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, 4)
    };
    try {
      const res = await api.post('/posts', payload);
      toast(res.status === 'pending' ? '命中风控词，已进入人工审核' : '发布成功', 'success');
      location.hash = '#/community';
    } catch (err) { toast(err.message, 'error'); }
  });

  setRail('');
}

/* ---------------- 登录 / 注册 ---------------- */

export function loginPage() {
  setContent(`
    <div style="max-width:420px;margin:20px auto">
      <div class="card">
        <div class="section-head"><div class="section-title">登录声圈</div></div>
        <div class="field"><input class="input" id="lg-name" placeholder="用户名" autocomplete="username"></div>
        <div class="field"><input class="input" id="lg-pwd" type="password" placeholder="密码（至少 6 位）" autocomplete="current-password"></div>
        <button class="btn btn-primary btn-block" id="lg-submit">登录</button>
        <div style="height:14px"></div>
        <div class="notice">演示账号：admin / admin123（管理员）· hall01 / 123456（招聘方）· host01 / 123456（主播）· newbie / 123456（新人）</div>
        <div style="height:14px"></div>
        <button class="btn btn-ghost btn-block" id="lg-switch">还没有账号？注册一个</button>
      </div>
    </div>
  `);
  bindLogin(false);
  setRail('');
}

export function registerPage() {
  setContent(`
    <div style="max-width:420px;margin:20px auto">
      <div class="card">
        <div class="section-head"><div class="section-title">注册账号</div></div>
        <div class="field"><input class="input" id="lg-name" placeholder="用户名（3-20 位字母数字下划线）"></div>
        <div class="field"><input class="input" id="lg-nick" placeholder="昵称（社区展示用）"></div>
        <div class="field"><input class="input" id="lg-pwd" type="password" placeholder="密码（至少 6 位）"></div>
        <div class="field">
          <label class="field-label">身份</label>
          <select class="select" id="lg-role">
            <option value="user">主播 / 从业者</option>
            <option value="recruiter">招聘方 / 厅主</option>
          </select>
        </div>
        <button class="btn btn-primary btn-block" id="lg-submit">注册并登录</button>
        <div style="height:14px"></div>
        <a class="btn btn-ghost btn-block" href="#/login">已有账号，去登录</a>
      </div>
    </div>
  `);
  bindLogin(true);
  setRail('');
}

function bindLogin(isRegister) {
  document.getElementById('lg-submit').addEventListener('click', async () => {
    const payload = {
      username: document.getElementById('lg-name').value.trim(),
      password: document.getElementById('lg-pwd').value
    };
    try {
      if (isRegister) {
        payload.nick = document.getElementById('lg-nick').value.trim() || payload.username;
        payload.role = document.getElementById('lg-role').value;
        const data = await api.post('/auth/register', payload);
        store.token = data.token; store.user = data.user;
        toast('注册成功', 'success');
      } else {
        const data = await api.post('/auth/login', payload);
        store.token = data.token; store.user = data.user;
        toast('登录成功', 'success');
      }
      window.dispatchEvent(new Event('vc:auth-changed'));
      location.hash = '#/';
    } catch (err) { toast(err.message, 'error'); }
  });
  if (isRegister) return;
  const sw = document.getElementById('lg-switch');
  if (sw) sw.addEventListener('click', () => { location.hash = '#/register'; });
}

/* ---------------- 个人中心 ---------------- */

export async function mePage() {
  if (!requireLogin()) { location.hash = '#/login'; return; }
  setContent(loadingList(2));
  const [me, myPosts, myJobs, favs, options] = await Promise.all([
    api.get('/auth/me'),
    api.get('/auth/me/posts'),
    api.get('/auth/me/jobs'),
    api.get('/auth/me/favorites'),
    api.get('/meta/options')
  ]);
  const user = me.user;
  const platformMap = Object.fromEntries(options.platforms.map((p) => [p.id, p.name]));

  setContent(`
    <div class="card" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
      <div class="avatar avatar-lg">${esc(user.avatar || user.nick.slice(0, 1))}</div>
      <div style="flex:1;min-width:200px">
        <div style="font-size:18px;font-weight:600">${esc(user.nick)}</div>
        <div class="section-sub">@${esc(user.username)} · 加入于 ${fmtDate(user.created_at)}</div>
        <div class="job-meta" style="margin-top:8px">
          <span class="chip chip-brand">${{ user: '从业者', recruiter: '招聘方/厅主', moderator: '审核员', admin: '管理员' }[user.role]}</span>
          ${user.contact ? `<span class="chip">${esc(user.contact)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" id="me-edit">编辑资料</button>
        ${store.isStaff() ? '<a class="btn btn-sm btn-primary" href="/admin">进入管理后台</a>' : ''}
        <button class="btn btn-sm btn-ghost" id="me-logout">退出</button>
      </div>
    </div>

    <div style="height:14px"></div>
    <div class="grid-3">
      <div class="card"><div class="section-sub">发布帖子</div><div style="font-size:22px;font-weight:600">${me.stats.posts}</div></div>
      <div class="card"><div class="section-sub">招聘岗位/简历</div><div style="font-size:22px;font-weight:600">${me.stats.jobs}</div></div>
      <div class="card"><div class="section-sub">收藏内容</div><div style="font-size:22px;font-weight:600">${me.stats.favorites}</div></div>
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="widget-title">${icon('layers', 15)} 我的平台订阅</div>
      <div class="filterbar">
        ${options.platforms.map((p) => `<a class="tab-pill ${(user.platforms || []).includes(p.id) ? 'active' : ''}" href="#/platform/${esc(p.id)}">${esc(p.name)}</a>`).join('')}
      </div>
      <div class="section-sub">订阅后，首页「我的订阅」分页只显示你所在平台的相关讨论与岗位。</div>
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="widget-title">${icon('brief', 15)} 我发布的岗位与简历（${myJobs.length}）</div>
      ${myJobs.length ? `<div class="feed" style="margin-top:10px">${myJobs.map((j) => `
        <div style="display:flex;gap:10px;align-items:center;border-bottom:1px solid var(--line);padding:10px 0">
          <a style="flex:1" href="#/job/${esc(j.id)}">${esc(j.title)}</a>
          <span class="chip ${j.status === 'approved' ? 'chip-ok' : j.status === 'pending' ? 'chip-warn' : j.status === 'rejected' ? 'chip-danger' : ''}">${j.status}</span>
          <span class="section-sub">${fmtDate(j.created_at)}</span>
          ${j.status === 'expired' || j.status === 'approved' ? `<button class="btn btn-sm" data-renew="${esc(j.id)}">续期</button>` : ''}
          ${j.reject_reason ? `<span class="chip chip-danger">${esc(j.reject_reason)}</span>` : ''}
        </div>`).join('')}</div>` : '<div class="section-sub" style="margin-top:8px">还没有发布记录</div>'}
      ${myJobs.length ? '' : '<div style="height:10px"></div><a class="btn btn-sm btn-primary" href="#/jobs/new">发布招聘 / 求职信息</a>'}
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="widget-title">${icon('star', 15)} 我的收藏（${favs.length}）</div>
      ${favs.length ? favs.map((f) => `
        <div style="display:flex;gap:10px;align-items:center;border-bottom:1px solid var(--line);padding:8px 0">
          <span class="chip">${f.target_type}</span>
          <a style="flex:1" href="${f.target_type === 'post' ? `#/post/${esc(f.target_id)}` : f.target_type === 'job' ? `#/job/${esc(f.target_id)}` : f.target_type === 'tool' ? `#/tool/${esc(f.target_id)}` : `#/platform/${esc(f.target_id)}`}">${esc(f.title)}</a>
        </div>`).join('') : '<div class="section-sub" style="margin-top:8px">还没有收藏</div>'}
    </div>

    <div style="height:14px"></div>
    <div class="card">
      <div class="widget-title">${icon('board', 15)} 我的帖子（${myPosts.length}）</div>
      ${myPosts.length ? myPosts.map((p) => `<div style="display:flex;gap:10px;align-items:center;border-bottom:1px solid var(--line);padding:8px 0">
        <a style="flex:1" href="#/post/${esc(p.id)}">${esc(p.title)}</a>
        <span class="chip">${p.status}</span></div>`).join('') : '<div class="section-sub" style="margin-top:8px">还没有发帖</div>'}
    </div>
  `);

  document.getElementById('me-logout').addEventListener('click', () => {
    api.post('/auth/logout').catch(() => {});
    store.token = ''; store.user = null;
    window.dispatchEvent(new Event('vc:auth-changed'));
    location.hash = '#/';
    toast('已退出登录');
  });

  document.querySelectorAll('[data-renew]').forEach((el) => {
    el.addEventListener('click', async () => {
      try { await api.post(`/jobs/${el.getAttribute('data-renew')}/renew`); toast('已续期 30 天', 'success'); mePage(); }
      catch (err) { toast(err.message, 'error'); }
    });
  });

  document.getElementById('me-edit').addEventListener('click', () => {
    modal({
      title: '编辑资料',
      body: `
        <div class="field"><label class="field-label">昵称</label><input class="input" id="ed-nick" value="${esc(user.nick)}"></div>
        <div class="field"><label class="field-label">简介</label><input class="input" id="ed-bio" value="${esc(user.bio || '')}"></div>
        <div class="field"><label class="field-label">联系方式</label><input class="input" id="ed-contact" value="${esc(user.contact || '')}" placeholder="微信号 / QQ / 邮箱"></div>`,
      footer: '<button class="btn" data-close>取消</button><button class="btn btn-primary" id="ed-save">保存</button>',
      onMount: (mask) => {
        mask.querySelector('#ed-save').addEventListener('click', async () => {
          try {
            const updated = await api.put('/auth/me', {
              nick: mask.querySelector('#ed-nick').value,
              bio: mask.querySelector('#ed-bio').value,
              contact: mask.querySelector('#ed-contact').value
            });
            store.user = updated.user;
            window.dispatchEvent(new Event('vc:auth-changed'));
            mask.remove();
            toast('资料已更新', 'success');
            mePage();
          } catch (err) { toast(err.message, 'error'); }
        });
      }
    });
  });

  setRail('');
}

/* ---------------- 用户主页 ---------------- */

export async function userPage(params) {
  setContent(loadingList(2));
  const [data, posts] = await Promise.all([
    api.get(`/users/${params.id}`),
    api.get(`/users/${params.id}/posts`)
  ]);
  const user = data.user;
  setContent(`
    <div class="card" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div class="avatar avatar-lg">${esc(user.avatar || user.nick.slice(0, 1))}</div>
      <div style="flex:1;min-width:200px">
        <div style="font-size:18px;font-weight:600">${esc(user.nick)}</div>
        <div class="section-sub">@${esc(user.username)} · 加入于 ${fmtDate(user.created_at)}</div>
        ${user.bio ? `<p style="color:var(--text-2);margin-top:8px">${esc(user.bio)}</p>` : ''}
      </div>
      ${user.contact ? `<div class="chip chip-cyan">${icon('cash', 13)} ${esc(user.contact)}</div>` : ''}
    </div>
    <div style="height:14px"></div>
    <div class="section-head"><div class="section-title">TA 的帖子（${posts.length}）</div></div>
    <div class="feed">${posts.length ? posts.map((p) => `
      <a class="card card-hover" href="#/post/${esc(p.id)}" style="padding:14px">
        <div style="font-weight:600">${esc(p.title)}</div>
        <div class="section-sub">${fromNow(p.created_at)} · ${num(p.views)} 浏览</div>
      </a>`).join('') : emptyBox('TA 还没有公开发帖')}</div>
  `);
  setRail('');
}
