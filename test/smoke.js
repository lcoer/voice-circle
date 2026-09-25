'use strict';
/** 端到端冒烟测试：进程内拉起服务，跑通四大模块核心流程后退出。 */

const path = require('node:path');
const fs = require('node:fs');

process.env.PORT = process.env.PORT || '5199';
// 测试使用独立数据库，避免污染演示数据；每次跑测试前强制重建
const TEST_DB = path.resolve(__dirname, '..', 'data', 'test-smoke.db');
process.env.VC_DB_FILE = path.relative(path.resolve(__dirname, '..'), TEST_DB);
[TEST_DB, `${TEST_DB}-wal`, `${TEST_DB}-shm`].forEach((f) => { try { fs.rmSync(f); } catch (_) { /* 忽略 */ } });

const { createApp } = require('../server/app');

const PORT = Number(process.env.PORT);
const BASE = `http://127.0.0.1:${PORT}/api`;

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; console.log(`  FAIL  ${name} ${extra}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 读取 SSE 流，按帧收集事件；到时自动断开 */
function streamProbe(token = null, waitMs = 2000) {
  const events = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), waitMs);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const ready = fetch(`${BASE}/stream`, { headers, signal: controller.signal })
    .then((res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) { clearTimeout(timer); return events; }
        buf += decoder.decode(value, { stream: true });
        let idx = buf.indexOf('\n\n');
        while (idx >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const name = (frame.match(/^event:\s*(.+)$/m) || [])[1];
          const dataLine = (frame.match(/^data:\s*(.+)$/m) || [])[1];
          if (name) {
            let data = null;
            if (dataLine) { try { data = JSON.parse(dataLine); } catch (_) { data = null; } }
            events.push({ name, data });
          }
          idx = buf.indexOf('\n\n');
        }
        return pump();
      }).catch(() => { clearTimeout(timer); return events; });
      return pump();
    })
    .catch(() => events);
  return { events, ready };
}

async function api(pathname, options = {}, token = null) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${pathname}`, { ...options, headers });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  console.log('\n=== 声圈 VoiceCircle 冒烟测试 ===\n');
  const app = createApp();
  const server = app.listen(PORT, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));

  console.log('[1] 基础与字典');
  const health = await api('/health');
  check('健康检查通过', health.json.code === 0);
  const options = await api('/meta/options');
  check('字典返回板块 5 个', options.json.data.boards.length === 5, `实际 ${options.json.data.boards.length}`);
  check('字典包含岗位类型 7 项', options.json.data.roleTypes.length === 7);

  console.log('\n[2] 平台资料库');
  const platforms = await api('/platforms?only=list');
  check('平台档案 8 条', platforms.json.data.length === 8, `实际 ${platforms.json.data.length}`);
  const pdetail = await api('/platforms/p_hello');
  check('平台详情含入驻条件', !!pdetail.json.data.entry_condition);
  check('平台详情含规则红线', pdetail.json.data.redlines.length >= 3);
  check('平台详情含官方链接', pdetail.json.data.official_links.length >= 1);
  const pfilter = await api('/platforms?category=%E7%BB%BC%E5%90%88%E8%AF%AD%E9%9F%B3');
  check('按分类筛选生效（综合语音 2 条）', pfilter.json.data.length === 2, `实际 ${pfilter.json.data.length}`);

  console.log('\n[3] 行业工具包');
  const tools = await api('/tools');
  check('工具列表 7 条上架', tools.json.data.length === 7, `实际 ${tools.json.data.length}`);
  const toolAll = await api('/tools?status=all');
  check('后台可见全部 8 条（含下架）', toolAll.json.data.length === 8, `实际 ${toolAll.json.data.length}`);
  const tdetail = await api('/tools/t_scam');
  check('工具详情返回正文', !!tdetail.json.data.content);

  console.log('\n[4] 登录与权限');
  const badLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'wrong' }) });
  check('错误密码被拒绝', badLogin.json.code !== 0);
  const adminLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  const adminToken = adminLogin.json.data.token;
  check('管理员登录成功', !!adminToken);
  const me = await api('/auth/me', {}, adminToken);
  check('获取当前用户信息', me.json.data.user.role === 'admin');
  const noAuth = await api('/admin/overview');
  check('未登录访问后台被拦截', noAuth.json.code !== 0);

  console.log('\n[5] 普通用户注册与发帖/评论/收藏');
  const uname = `smoke_${Date.now()}`;
  const reg = await api('/auth/register', { method: 'POST', body: JSON.stringify({ username: uname, password: '123456', nick: '冒烟测试号' }) });
  const userToken = reg.json.data.token;
  check('注册成功并返回 token', !!userToken);
  const boards = options.json.data.boards;
  const newPost = await api('/posts', {
    method: 'POST',
    body: JSON.stringify({
      boardId: boards[1].id, title: '冒烟测试帖：排班制度讨论', content: '这是一条用于冒烟测试的正文内容，长度足够。',
      platformId: 'p_hello', type: 'experience', tags: ['测试']
    })
  }, userToken);
  check('发帖成功', newPost.json.code === 0 && !!newPost.json.data.id, JSON.stringify(newPost.json));
  const postId = newPost.json.data.id;
  const postDetail = await api(`/posts/${postId}`, {}, userToken);
  check('帖子详情可读', postDetail.json.data.title.includes('冒烟测试'));
  const comment = await api('/interaction/comments', {
    method: 'POST', body: JSON.stringify({ target_type: 'post', target_id: postId, content: '冒烟测试评论内容' })
  }, userToken);
  check('评论发布成功', comment.json.code === 0);
  const reaction = await api('/interaction/reaction', {
    method: 'POST', body: JSON.stringify({ target_type: 'post', target_id: postId, type: 'like' })
  }, userToken);
  check('点赞计数生效', reaction.json.data.like_count === 1 && reaction.json.data.active === 1);
  const reactionUndo = await api('/interaction/reaction', {
    method: 'POST', body: JSON.stringify({ target_type: 'post', target_id: postId, type: 'like' })
  }, userToken);
  check('再次点赞取消', reactionUndo.json.data.like_count === 0 && reactionUndo.json.data.active === 0);

  console.log('\n[6] 招聘发布 → 审核 → 上架');
  const newJob = await api('/jobs', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'recruit', title: '冒烟测试岗位：招聘兼职主持', platform_id: 'p_hello', role_type: '主持',
      salary_min: 3000, salary_max: 6000, salary_unit: '元/月', salary_cycle: '周结',
      work_time: '每晚 20-24 点', city: '不限', remote: 1, contact_name: '测试联系人', contact_value: '微信 test001',
      description: '这是一条用于冒烟测试的招聘描述，内容长度足够通过校验。'
    })
  }, userToken);
  check('招聘发布成功', newJob.json.code === 0 && !!newJob.json.data.id);
  check('招聘进入待审核队列', newJob.json.data.status === 'pending');
  const jobId = newJob.json.data.id;
  const beforeList = await api('/jobs?kind=recruit&page_size=50');
  check('待审岗位不出现在前台列表', !beforeList.json.data.list.some((j) => j.id === jobId));
  const approve = await api('/jobs/admin/status', {
    method: 'POST', body: JSON.stringify({ id: jobId, status: 'approved', reason: '' })
  }, adminToken);
  check('管理员审核通过', approve.json.code === 0);
  const afterList = await api('/jobs?kind=recruit&page_size=50');
  check('审核通过后前台可见', afterList.json.data.list.some((j) => j.id === jobId));

  console.log('\n[7] 风控标记与筛选');
  const riskJob = await api('/jobs', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'recruit', title: '冒烟测试：含押金的高薪岗位', platform_id: 'p_soul', role_type: '主播',
      salary_min: 8000, salary_max: 20000, salary_unit: '元/月', salary_cycle: '日结',
      contact_name: '风险示例', contact_value: '见详情', work_time: '每天 6 小时',
      description: '该岗位用于验证风险标记是否生效，包含押金与培训费字段。', risk_deposit: 1, risk_fee: 1
    })
  }, adminToken);
  const riskId = riskJob.json.data.id;
  const riskDetail = await api(`/jobs/${riskId}`, {}, adminToken);
  check('风险标记生成', riskDetail.json.data.risk_flags.length >= 2, JSON.stringify(riskDetail.json.data.risk_flags.map((f) => f.code)));
  const noRisk = await api('/jobs?kind=recruit&no_risk=1&page_size=50');
  check('无风险筛选排除收费岗位', !noRisk.json.data.list.some((j) => j.id === riskId));

  console.log('\n[8] 举报与处理');
  const report = await api('/interaction/reports', {
    method: 'POST', body: JSON.stringify({ target_type: 'job', target_id: riskId, reason_type: '收取押金', reason_detail: '冒烟测试举报' })
  }, userToken);
  check('举报提交成功', report.json.code === 0);
  const reports = await api('/admin/reports', {}, adminToken);
  check('后台可见待处理举报', reports.json.data.some((r) => r.target_id === riskId));
  const target = reports.json.data.find((r) => r.target_id === riskId);
  const handle = await api('/admin/reports/handle', { method: 'POST', body: JSON.stringify({ id: target.id, action: '下架', note: '冒烟' }) }, adminToken);
  check('举报处理成功', handle.json.code === 0);
  const afterHandle = await api(`/jobs/${riskId}`, {}, adminToken);
  check('举报后内容被下架', afterHandle.json.data.status === 'removed');

  console.log('\n[9] 过期自动下架');
  const { get } = require('../server/data/db');
  const expiredCount = Number(get("SELECT COUNT(*) AS c FROM jobs WHERE status = 'expired'").c);
  check('存在过期自动下架岗位', expiredCount >= 1, `实际 ${expiredCount}`);

  console.log('\n[10] 后台：平台/工具维护');
  const savePlatform = await api('/platforms/admin/save', {
    method: 'POST', body: JSON.stringify({ name: '冒烟测试平台', category: '综合语音', summary: '后台新增验证', features: [{ title: '测试', desc: '测试' }] })
  }, adminToken);
  check('后台新增平台档案', savePlatform.json.code === 0);
  const saveTool = await api('/tools/admin/save', {
    method: 'POST', body: JSON.stringify({ title: '冒烟测试工具', category: '话术模板', form: 'template', summary: '后台新增工具', content: '内容' })
  }, adminToken);
  check('后台新增工具', saveTool.json.code === 0);
  const offTool = await api('/tools/admin/toggle', { method: 'POST', body: JSON.stringify({ id: saveTool.json.data.id, field: 'status' }) }, adminToken);
  check('工具下架成功', offTool.json.data.value === 'off');
  const overview = await api('/admin/overview', {}, adminToken);
  check('概览返回统计数据', overview.json.data.counts.users >= 5);
  check('概览返回趋势数据 7 天', overview.json.data.trend.length === 7);
  const logs = await api('/admin/logs', {}, adminToken);
  check('操作日志已记录', logs.json.data.length >= 4, `实际 ${logs.json.data.length}`);

  console.log('\n[11] 移动端首页聚合接口');
  const home = await api('/home', {}, userToken);
  check('首页信息流返回', home.json.data.feed.length > 0);
  check('首页岗位速览返回', home.json.data.jobs.length > 0);
  check('首页工具推荐返回', home.json.data.tools.length > 0);

  console.log('\n[12] 实时通道：别人发帖即时可见');
  const baseSnap = await api('/updates');
  check('版本号快照覆盖四类资源',
    ['post', 'job', 'comment', 'reaction'].every((k) => typeof baseSnap.json.data.types[k] === 'number'));
  check('无变更时版本号不变', (await api('/updates')).json.data.revision === baseSnap.json.data.revision);

  const anonProbe = streamProbe(null, 3000);
  await sleep(300);
  check('SSE 握手成功并收到首帧快照', anonProbe.events.some((e) => e.name === 'hello'));

  await api('/posts', {
    method: 'POST',
    body: JSON.stringify({
      boardId: boards[0].id, title: '冒烟测试帖：实时通道验证', content: '用于验证他人发帖是否会实时推送到已打开的页面。',
      type: 'normal', tags: []
    })
  }, userToken);
  await sleep(400);
  check('他人发帖后 SSE 推送 change(post)',
    anonProbe.events.some((e) => e.name === 'change' && e.data && e.data.type === 'post'));
  const afterSnap = await api('/updates');
  check('发帖后 post 版本号递增', afterSnap.json.data.types.post > baseSnap.json.data.types.post);
  check('发帖后全局版本号递增', afterSnap.json.data.revision > baseSnap.json.data.revision);

  const selfProbe = streamProbe(userToken, 2200);
  await sleep(300);
  await api('/interaction/comments', {
    method: 'POST', body: JSON.stringify({ target_type: 'post', target_id: postId, content: '自己的评论不应回推' })
  }, userToken);
  await sleep(500);
  check('自己的操作不回推给自己（避免重复插入）', !selfProbe.events.some((e) => e.name === 'change'));
  await anonProbe.ready;
  await selfProbe.ready;

  console.log(`\n=== 结果：${passed} 项通过，${failed} 项失败 ===\n`);
  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('冒烟测试异常：', err);
  process.exit(1);
});
