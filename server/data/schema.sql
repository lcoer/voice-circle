-- 声圈 VoiceCircle 数据模型
-- 说明：所有 JSON 字段以 TEXT 存储（便于 SQLite 兼容），读写时在 repository 层做解析。

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  nick          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',        -- user | recruiter | moderator | admin
  avatar        TEXT,
  bio           TEXT,
  contact       TEXT,
  platforms     TEXT,                                -- JSON: 订阅的平台 id 数组
  status        TEXT NOT NULL DEFAULT 'normal',      -- normal | banned
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platforms (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  alias            TEXT,
  category         TEXT,          -- 语音直播 | 游戏陪玩 | 社交语音 | 二次元语音 | 综合内容
  logo_text        TEXT,          -- 文字 Logo（避免外链图片）
  summary          TEXT,
  features         TEXT,          -- JSON: [{title, desc}]
  entry_condition  TEXT,          -- 入驻条件
  payout_policy    TEXT,          -- 分成政策
  settlement_cycle TEXT,          -- 结算周期
  redlines         TEXT,          -- JSON: [string] 规则红线
  official_links   TEXT,          -- JSON: [{label, url}]
  tags             TEXT,          -- JSON: [string]
  risk_note        TEXT,          -- 风险提示
  verified         INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'published',  -- published | draft
  views            INTEGER NOT NULL DEFAULT 0,
  featured         INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tools (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  category   TEXT,               -- 话术模板 | 运营表格 | 合同协议 | 素材资源 | 软件工具 | 避坑指南
  form       TEXT NOT NULL DEFAULT 'template',  -- template(模板正文) | link(外部链接) | file(附件) | article(图文)
  summary    TEXT,
  content    TEXT,               -- 模板正文 / 图文内容
  link       TEXT,               -- 外部链接
  file_path  TEXT,               -- 附件路径
  tags       TEXT,
  status     TEXT NOT NULL DEFAULT 'on',   -- on | off（上下架）
  pinned     INTEGER NOT NULL DEFAULT 0,
  views      INTEGER NOT NULL DEFAULT 0,
  downloads  INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  accent      TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  board_id    TEXT NOT NULL,
  author_id   TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,     -- 已转义的安全 HTML
  platform_id TEXT,
  type        TEXT NOT NULL DEFAULT 'normal',  -- normal | experience | resource | expose | question
  tags        TEXT,
  cover       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | published | rejected | removed
  pinned      INTEGER NOT NULL DEFAULT 0,
  essence     INTEGER NOT NULL DEFAULT 0,
  views       INTEGER NOT NULL DEFAULT 0,
  reject_reason TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,     -- post | job | platform | tool
  target_id   TEXT NOT NULL,
  parent_id   TEXT,
  author_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'published',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reactions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id  TEXT NOT NULL,
  type       TEXT NOT NULL,      -- like | fav
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reaction_unique
  ON reactions(user_id, target_type, target_id, type);

CREATE TABLE IF NOT EXISTS jobs (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,                  -- recruit(招聘) | seek(求职)
  title         TEXT NOT NULL,
  platform_id   TEXT,
  role_type     TEXT,                           -- 主播 | 主持 | 运营 | 厅管 | 星探 | 美工 | 音频后期
  salary_min    INTEGER,
  salary_max    INTEGER,
  salary_unit   TEXT DEFAULT '元/月',            -- 元/月 | 元/小时 | 分成%
  salary_cycle  TEXT,                           -- 日结 | 周结 | 半月结 | 月结
  work_time     TEXT,                           -- 排班 / 麦时要求
  city          TEXT,
  remote        INTEGER NOT NULL DEFAULT 1,
  contact_name  TEXT,
  contact_value TEXT,
  description   TEXT,
  risk_deposit  INTEGER NOT NULL DEFAULT 0,     -- 是否收押金
  risk_fee      INTEGER NOT NULL DEFAULT 0,     -- 是否收培训费/入职费
  real_name_verified INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | expired | removed
  expires_at    TEXT,
  reject_reason TEXT,
  author_id     TEXT NOT NULL,
  views         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id           TEXT PRIMARY KEY,
  target_type  TEXT NOT NULL,   -- post | job | comment
  target_id    TEXT NOT NULL,
  reason_type  TEXT NOT NULL,   -- 虚假信息 | 收取押金 | 诈骗风险 | 广告引流 | 人身攻击 | 其他
  reason_detail TEXT,
  reporter_id  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | resolved | rejected
  action       TEXT,            -- 下架 | 驳回举报 | 提醒整改
  handler_id   TEXT,
  handled_at   TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT,
  actor_name  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  detail      TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_board ON posts(board_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(kind, status);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
