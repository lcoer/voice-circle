# 声圈 VoiceCircle · 语音厅行业垂直社区论坛

面向语音厅行业（YY / TT语音 / Hello语音 / 网易云音乐·音街 / 猫耳FM / 克拉克拉 / Soul / 抖音语音直播 等）的垂直社区，覆盖「查平台、拿工具、聊经验、找工作」四类高频场景。

- **前台**：http://localhost:5173/ （PC 三栏 / 移动端底部 Tab，同一套页面）
- **管理后台**：http://localhost:5173/admin
- **技术栈**：Node.js（内置 `node:sqlite`）+ Express 4 + 原生 ES Modules 前端（零框架、零 CDN、零构建）

---

## 一、快速启动

```bash
cd voice-circle
npm install        # 仅安装 express，无任何原生编译依赖
npm start          # 首次启动自动建表并写入演示数据
```

| 地址 | 说明 |
|---|---|
| http://localhost:5173/ | 用户前台 |
| http://localhost:5173/admin | 管理后台（需管理员账号） |
| http://localhost:5173/api/health | 健康检查 |

端口冲突时：`set PORT=8080 && npm start`（Windows）或 `PORT=8080 npm start`。

### 演示账号

| 账号 | 密码 | 角色 | 用途 |
|---|---|---|---|
| `admin` | `admin123` | 超级管理员 | 后台全部权限：平台/工具/板块/用户/审核/举报/日志 |
| `mod01` | `123456` | 审核员 | 内容与招聘审核、举报处理（无用户权限管理） |
| `hall01` | `123456` | 招聘方/厅主 | 发布招聘、体验「我发布的岗位」与续期 |
| `host01` | `123456` | 从业者 | 发帖、投简历、点赞收藏订阅 |
| `newbie` | `123456` | 新用户 | 注册登录、求职浏览视角 |

重置演示数据：`npm run reset`（清库并重新灌入种子数据）。

---

## 二、核心功能与演示路径

### 1. 平台资料库（后台可维护）
前台：`平台资料库` → 支持按分类、关键词筛选 → 详情页展示 **平台特色 / 入驻条件 / 分成政策 / 结算周期 / 规则红线 / 官方入口 / 风险提示**，并显示「档案最后更新时间」与免责声明；可订阅平台、查看关联岗位与讨论、对资料纠错举报。

后台：`管理后台 → 平台资料库` → 新增 / 编辑（结构化表单） / 下架，保存动作写入操作日志。

### 2. 行业工具包（分类 + 上下架）
前台：`行业工具包` → 六大分类（话术模板 / 运营表格 / 合同协议 / 素材资源 / 软件工具 / 避坑指南）→ 详情页可直接 **一键复制正文**，记录使用次数；种子数据含开场白话术、排麦表、薪资结算核对表、合同要点清单、诈骗识别手册等 8 份（其中 1 份处于下架状态用于演示）。

后台：`行业工具包` → 新增 / 编辑 / 上架 / 下架 / 置顶 / 删除。

### 3. 社区交流区
- 注册登录（`scrypt` 加盐哈希 + 会话 token，7 天有效）
- 五大板块：平台讨论 / 运营经验 / 资源分享 / 避坑曝光 / 新人问答
- 发帖支持关联平台、内容类型、标签；**命中风控词自动进入人工审核**
- 评论、点赞（可取消）、收藏、个人中心（我的帖子 / 我的岗位 / 收藏 / 平台订阅）
- 首页「我的订阅」页签：信息流只聚合你订阅平台的相关内容

### 4. 招聘求职区
- 招聘 / 求职双视角；岗位字段：所属平台、岗位类型（主播/主持/运营/厅管/星探/美工/音频后期）、薪资区间与单位、结算周期、排班麦时、城市/线上、联系方式
- 多维筛选：平台、岗位类型、结算方式、薪资排序、热度、**「仅看无收取费用」**
- 风控闭环：发布 → 敏感词扫描 + 风险标记（押金 / 培训费 / 未核验 / 薪资虚高）→ 后台人工审核 → 上架展示 → **到期自动下架** → 举报 → 下架处置 / 驳回举报 → 作者可续期 30 天重新上架
- 风险岗位在列表与详情页强制展示红色风险横幅并降低曝光

### 5. 管理后台
概览看板（用户/内容/待办统计 + 近 7 天趋势 SVG 折线图）、审核队列（帖子/岗位/评论）、举报处理、平台资料库维护、工具包维护、板块管理、用户角色与封禁管理（仅超管）、操作日志（全部动作留痕）。

---

## 三、目录结构（分层架构，依赖严格单向）

```
voice-circle/
├─ server/
│  ├─ boot.js              启动引导（自动补 --experimental-sqlite / --seed 重置）
│  ├─ app.js               Express 装配：中间件 → 领域路由 → 静态资源 → 错误收敛
│  ├─ config.js            端口 / 路径 / 会话有效期等配置
│  ├─ lib/                 http(统一响应) auth(密码/会话/角色) risk(风控词) bus(变更事件) util
│  ├─ data/
│  │  ├─ db.js             SQLite 连接 + 自动建表 + 空库自动灌种子
│  │  ├─ schema.sql        全部表结构
│  │  └─ seed.js           演示数据（真实平台名 + 示例标注）
│  └─ domains/             领域模块：仓储层 → 服务逻辑 → 路由（单文件内自上而下）
│     auth / platform / tool / community / job / interaction / admin / meta / audit / stream
├─ public/
│  ├─ index.html / admin.html
│  ├─ assets/css/main.css  暗色 + 霓虹强调主题，PC 三栏 / 移动底部 Tab
│  ├─ assets/js/core.js    api 封装、路由、UI 组件、内联 SVG 图标
│  ├─ assets/js/realtime.js 实时层：SSE 优先 + 轮询兜底，列表/评论增量刷新
│  ├─ assets/js/pages/     discover(首页/平台/工具) community community jobs components
│  └─ assets/js/admin.js   后台全部页面
└─ test/
   ├─ smoke.js             后端 49 项端到端断言（npm run smoke）
   ├─ ui-smoke.js          Playwright 前端页面冒烟 + 截图（npm run ui-smoke）
   └─ live-smoke.js        双浏览器上下文验证实时更新（npm run live-smoke）
```

**扩展性设计**：所有 SQL 收敛在各领域仓储层，更换 MySQL/PostgreSQL 只需替换 `data/db.js` 的驱动与占位符方言；新增业务领域只需新增一个 `domains/*.js` 并在 `app.js` 挂载一行。

---

## 四、API 概览（统一返回 `{code, message, data}`）

| 模块 | 端点 |
|---|---|
| 认证 | `POST /api/auth/register` `POST /api/auth/login` `GET /api/auth/me` `PUT /api/auth/me` `POST /api/auth/me/subscribe` |
| 首页聚合 | `GET /api/home?sort=latest|hot` |
| 平台库 | `GET /api/platforms` `GET /api/platforms/:id` `POST /api/platforms/admin/save|remove` |
| 工具包 | `GET /api/tools` `GET /api/tools/:id` `POST /api/tools/:id/download` `POST /api/tools/admin/save|toggle|remove` |
| 社区 | `GET /api/posts` `GET /api/posts/:id` `POST /api/posts` `DELETE /api/posts/:id` `POST /api/posts/admin/status|flag` |
| 互动 | `GET/POST /api/interaction/comments` `POST /api/interaction/reaction` `POST /api/interaction/reports` |
| 招聘 | `GET /api/jobs` `GET /api/jobs/:id` `POST /api/jobs` `POST /api/jobs/:id/renew|close` `POST /api/jobs/admin/status` |
| 后台 | `GET /api/admin/overview|pending|reports|users|logs` `POST /api/admin/reports/handle` `POST /api/admin/users/save` `POST /api/admin/comments/status` |
| 字典 | `GET /api/meta/options` `GET/POST/PUT/DELETE /api/meta/boards` |
| 实时 | `GET /api/updates`（版本号快照，轮询兜底） `GET /api/stream`（SSE 推送 change 事件） |

---

## 五、质量保障

- `npm run smoke`：49 项端到端断言，覆盖注册登录、发帖评论点赞收藏、招聘发布→审核→上架、风控标记、举报处理、到期下架、后台 CRUD、日志留痕、首页聚合、实时版本号与 SSE 推送等核心链路。
- `npm run ui-smoke`：Playwright 逐路由加载 PC / 移动端 / 后台共 19 个页面，捕获控制台错误与未捕获异常（当前 0 错误），截图输出至 `test/shots/`。
- `npm run live-smoke`：开两个浏览器上下文，A 停在列表/详情页，B 登录发帖与评论，验证 A 无需手动刷新即可看到新内容（需先 `npm i -D playwright && npx playwright install chromium`，本地服务需已在 5173 运行）。
- 安全基线：密码 scrypt 加盐、会话过期、角色中间件、富文本入库前转义、举报与审计日志。

### 实时更新是怎么做的

别人发了新帖 / 新评论 / 新岗位，你这边不用刷新就能看到：

1. **服务端打版本号**：`server/lib/bus.js` 维护全局 `revision` 与 `post / job / comment / reaction` 四类版本号，发帖、评论、点赞收藏、岗位发布、审核、举报下架等写操作都会 `publish()`。
2. **两条通道自动择优**：`GET /api/stream` 是 SSE 长连接（15 秒心跳、`X-Accel-Buffering: no` 防反代缓冲），收到 `hello` 首帧即认定为可用；托管环境的反向代理可能缓冲长连接，此时自动降级到轮询 `GET /api/updates`（12 秒一次，页面切到后台时暂停，切回来立刻补一次）。
3. **不打扰式的 UI**：列表页在顶部附近才直接插入新卡片（带 `live-new` 高亮），正在往下翻时用顶部胶囊提示「N 条新帖 · 查看」，点了才滚动上去；详情页的评论区是增量追加，正文和输入框都不会被重置。
4. **自己的操作不回推**：事件带 `actorId`，SSE 连接携带登录态时会跳过本人触发的事件，避免本地已渲染的内容重复插入。

## 六、提交到 GitHub

仓库地址：https://github.com/lcoer/voice-circle

```bash
npm run push                 # 自动根据改动文件生成提交信息并提交推送
npm run push -- "修复登录跳转" # 自定义提交信息
npm run push -- --dry        # 只预览改动，不提交不推送
```

脚本为 `scripts/push.js`，流程是 `git add -A` → 生成/使用提交信息 → `git commit` → **`git push` 带 8 次重试**。
加重试的原因：本机沙箱环境下 `git push` 到 github.com 会间歇性遇到代理 502，单次成功率约 1/3，重试即可通过（不是仓库或凭据问题）。

## 七、上线部署（让别人访问）

### 前提已满足

- 服务监听 `PORT` 环境变量，绑定 `0.0.0.0`（`server/boot.js`）。
- 前端所有请求走相对路径 `/api`，换域名无需改动任何代码。
- 依赖只有 express，**没有** MySQL / Redis 等外部服务，符合部署平台的前置检查。

### 登录态走 Cookie（重要）

托管平台的反向代理会**为每个请求注入并覆盖 `Authorization` 头**，业务 token 若只走该头会失效（表现为「登录成功但一操作就提示未登录」）。

因此会话 token 同时通过三种通道传递，服务端按优先级读取：**Cookie `vc_token` → `x-token` 头 → `Authorization` 头**（且会忽略形如 `eyJ…` 的注入 JWT）。前端 `fetch` 已带 `credentials: 'include'`，浏览器自动携带 Cookie，无需额外配置。

### 数据存在哪

默认使用项目内的 SQLite（`data/voice-circle.db`），运行在云端沙箱里。

- 访客注册、发帖、评论、点赞都会写入这个文件，**重新打开页面依然存在**。
- ⚠️ **每次「重新发布」会上传本地源码包，其中可能包含本地的数据库文件，从而覆盖线上已经产生的数据。**

### 重新发布前请先备份线上数据

发布后如果要更新代码，按这个顺序来：

1. 先把线上的数据库文件导出/复制出来（部署平台提供文件管理时直接下载 `data/voice-circle.db`）。
2. 本地 `npm run reset` 之前，确认备份已保存。
3. 更新代码后再发布；若线上数据被覆盖，用备份文件覆盖回去即可恢复。

### 静态资源缓存：发新版前先 bump 版本号（重要）

托管平台前置 CDN 会缓存静态资源。重新发布后可能出现「新的 `app.js` + 旧的 `components.js`」混着返回，
浏览器直接报 `does not provide an export named 'xxx'` 并白屏。

- 前端所有相对 import 与入口 `<script src>` 都带版本后缀：`./components.js?v=2`。
- 改完前端后发布前运行 `npm run bump-assets`（脚本在 `scripts/bump-asset-version.js`，可传版本号），
  URL 变化即可让所有 CDN 节点回源。
- 服务端已对静态资源与 HTML 下发 `Cache-Control: no-store`；`index.html` / `admin.html` 还带 4 秒兜底重试（一次），
  即使偶尔命中脏缓存也能自愈。

### 想要真正的长期持久化

SQLite 在沙箱内适合演示和小范围内测。如果要长期运营、保证容器重启也不丢数据，需要把数据层换成云数据库（仓储层已隔离，改造范围可控）。

## 八、已知边界（演示范围）

- 图片上传为本地磁盘存储（base64 → `public/uploads/`），生产环境应替换为对象存储。
- 未实现邮件/短信验证码与图形验证码；风控词表为示例级。
- 平台入驻条件、分成政策等均为**示例数据**（页面已标注），不代表各平台官方口径。
