'use strict';
/**
 * 演示种子数据。
 * 说明：平台档案使用真实平台名称以便演示，但所有入驻条件 / 分成政策 / 规则类字段均为「示例数据」，
 *      页面统一标注「示例数据，以官方最新公告为准」，不作为实际决策依据。
 */

const crypto = require('node:crypto');
const { hashPassword } = require('../lib/auth');
const { nowISO, addDays } = require('../lib/util');

const DISCLAIMER = '示例数据，以官方最新公告为准';

function seedUsers(ctx) {
  const users = [
    { username: 'admin', pwd: 'admin123', nick: '平台管理员', role: 'admin', bio: '负责平台资料库与工具包维护' },
    { username: 'mod01', pwd: '123456', nick: '审核员小林', role: 'moderator', bio: '负责招聘信息复审与举报处理' },
    { username: 'hall01', pwd: '123456', nick: '夜航厅·老K', role: 'recruiter', bio: 'Hello语音 夜航厅厅主，常年招主持与歌手', contact: '微信 hallkeeper001' },
    { username: 'host01', pwd: '123456', nick: '麦上的阿七', role: 'user', bio: '兼职语音主播第 2 年，擅长情感电台与控场' },
    { username: 'newbie', pwd: '123456', nick: '刚入行的小白', role: 'user', bio: '准备入行语音厅，正在找靠谱的厅' }
  ];
  const map = {};
  users.forEach((u, i) => {
    const id = `u_seed_${i + 1}`;
    const { hash, salt } = hashPassword(u.pwd);
    ctx.run(
      `INSERT INTO users (id, username, nick, password_hash, password_salt, role, avatar, bio, contact, platforms, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, u.username, u.nick, hash, salt, u.role, u.nick.slice(0, 1), u.bio, u.contact || '', '[]', 'normal', nowISO()]
    );
    map[u.username] = id;
  });
  return map;
}

function seedPlatforms(ctx) {
  const list = [
    {
      id: 'p_yy', name: 'YY语音', alias: 'YY Live', category: '综合语音', logo_text: 'YY',
      summary: `老牌综合语音平台，频道生态成熟，公会体系与签约体系完整，适合有一定规模、走正规化管理的语音厅。${DISCLAIMER}。`,
      features: [
        { title: '频道体系成熟', desc: '子频道、麦序、场控权限分层清晰，适合多房间并行运营' },
        { title: '公会签约机制', desc: '支持公会入驻与主播签约，流水结算链路稳定' },
        { title: '用户基数大', desc: '存量语音用户多，冷启动相对容易' }
      ],
      entry_condition: '示例：需注册满一定时长的账号；公会入驻通常要求团队人数、历史流水或保证金材料。',
      payout_policy: '示例：公会与主播按约定比例分成，平台抽成后结算，具体比例以签约协议为准。',
      settlement_cycle: '示例：月结为主，部分公会支持周垫付',
      redlines: ['示例：严禁涉黄涉赌与低俗擦边', '示例：禁止跨频道恶意拉人', '示例：禁止虚假宣传诱导充值', '示例：未成年人禁止参与直播与打赏相关环节'],
      official_links: [{ label: 'YY 官方网站', url: 'https://www.yy.com' }, { label: '公会合作入口', url: 'https://www.yy.com' }],
      tags: ['老牌', '公会体系', '签约分佣'], risk_note: '示例：市面上存在冒充官方代入驻的中介，务必通过官方渠道核对资质。',
      verified: 1, featured: 1, views: 1820
    },
    {
      id: 'p_tt', name: 'TT语音', alias: 'TT', category: '游戏陪玩语音', logo_text: 'TT',
      summary: `以游戏开黑陪玩场景为主，房间即时组局、派单效率高，适合兼职陪玩与主持。${DISCLAIMER}。`,
      features: [
        { title: '组局效率高', desc: '按游戏分区匹配，用户进房间目的明确' },
        { title: '陪玩订单体系', desc: '按时长计费，结算颗粒度细' },
        { title: '新手友好', desc: '入驻门槛相对较低，适合兼职起步' }
      ],
      entry_condition: '示例：实名认证 + 技能标签审核；部分品类需试音或试玩。',
      payout_policy: '示例：陪玩订单按平台抽成后结算到个人账户。',
      settlement_cycle: '示例：订单完成后的 T+1 至 T+7 提现（具体以平台规则为准）',
      redlines: ['示例：禁止私下交易绕开平台', '示例：禁止代练类违规交易', '示例：禁止未成年人参与付费陪玩'],
      official_links: [{ label: 'TT语音官网', url: 'https://www.163.com' }],
      tags: ['陪玩', '组局', '兼职友好'], risk_note: '示例：注意识别私下转账的“代结算”骗局。',
      verified: 1, featured: 1, views: 1460
    },
    {
      id: 'p_hello', name: 'Hello语音', alias: 'Hello Voice', category: '综合语音', logo_text: 'HE',
      summary: `主打语音社交与陌生人相亲、派对房场景，房间玩法多、礼物互动重，适合主持型主播。${DISCLAIMER}。`,
      features: [
        { title: '玩法房间丰富', desc: '相亲房、派对房、PK房等模板化房间' },
        { title: '礼物互动重', desc: '用户付费习惯成熟，氪金场景多' },
        { title: '厅管需求大', desc: '房间秩序依赖主持/厅管，岗位机会多' }
      ],
      entry_condition: '示例：实名认证；部分房间类型需完成新人培训与试音。',
      payout_policy: '示例：房间流水分成 + 榜单奖励，具体以签约公会协议为准。',
      settlement_cycle: '示例：周结或半月结为主',
      redlines: ['示例：禁止诱导私下加好友进行诈骗', '示例：禁止未成年人出镜与打赏', '示例：禁止虚假人设引流'],
      official_links: [{ label: 'Hello语音官网', url: 'https://www.hellovoices.com' }],
      tags: ['语音社交', '派对房', '主持需求旺'], risk_note: '示例：警惕以“保底高薪”为名收取培训费的中介。',
      verified: 1, featured: 1, views: 2210
    },
    {
      id: 'p_yinjie', name: '网易云音乐·音街', alias: '音街', category: '综合内容', logo_text: '音',
      summary: `依托音乐社区生态的语音房场景，用户偏年轻、音乐氛围浓，适合歌手型主播与音乐电台厅。${DISCLAIMER}。`,
      features: [
        { title: '音乐属性强', desc: '歌单、一起听、翻唱场景天然契合' },
        { title: '内容推荐友好', desc: '优质房间有机会进入官方推荐池' },
        { title: '版权曲库支持', desc: '平台自带曲库，演唱环节合规成本低' }
      ],
      entry_condition: '示例：实名认证 + 音乐人/主播身份申请；部分需提交演唱样音。',
      payout_policy: '示例：按房间流水比例分成，活动额外激励另行计算。',
      settlement_cycle: '示例：月结为主',
      redlines: ['示例：禁止违规翻唱涉密/违规曲目', '示例：禁止录播冒充直播', '示例：禁止诱导线下交易'],
      official_links: [{ label: '网易云音乐官网', url: 'https://music.163.com' }],
      tags: ['音乐向', '一起听', '推荐位'], risk_note: '示例：注意版权合规，非授权音源不要作为直播伴奏。',
      verified: 1, featured: 0, views: 980
    },
    {
      id: 'p_missevan', name: '猫耳FM', alias: 'MissEvan', category: '二次元语音', logo_text: '喵',
      summary: `二次元与广播剧、声优向内容社区，直播以配音、电台为主，粉丝黏性高。${DISCLAIMER}。`,
      features: [
        { title: '垂类粉丝黏性高', desc: '广播剧、CV 相关内容自带受众' },
        { title: '声优资源集中', desc: '适合配音型主播积累作品集' },
        { title: '内容与直播联动', desc: '有声作品可为直播导流' }
      ],
      entry_condition: '示例：实名认证；部分直播分区需作品审核或试音。',
      payout_policy: '示例：礼物分成 + 付费内容分成并行。',
      settlement_cycle: '示例：月结',
      redlines: ['示例：禁止搬运他人作品', '示例：禁止未成年人打赏相关场景', '示例：禁止违规擦边内容'],
      official_links: [{ label: '猫耳FM官网', url: 'https://www.missevan.com' }],
      tags: ['二次元', '配音向', '粉丝黏性'], risk_note: '示例：警惕冒充剧组招配音收取“资料费”的情况。',
      verified: 1, featured: 0, views: 760
    },
    {
      id: 'p_kilakila', name: '克拉克拉', alias: 'KilaKila', category: '二次元语音', logo_text: 'K',
      summary: `虚拟形象 + 语音直播社区，虚拟主播土壤成熟，适合不想露脸的主播。${DISCLAIMER}。`,
      features: [
        { title: '虚拟形象友好', desc: '皮套生态成熟，非露脸也能稳定开播' },
        { title: '虚拟礼物玩法', desc: '互动道具与礼物体系丰富' },
        { title: '社区氛围轻松', desc: '新人进入门槛低' }
      ],
      entry_condition: '示例：实名认证 + 主播申请；虚拟形象需符合内容规范。',
      payout_policy: '示例：礼物流水分成，活动激励另计。',
      settlement_cycle: '示例：半月结或月结',
      redlines: ['示例：虚拟形象不得涉及违规内容', '示例：禁止私下诱导转账', '示例：禁止批量刷量'],
      official_links: [{ label: '克拉克拉官网', url: 'https://www.kilakila.cn' }],
      tags: ['虚拟形象', '不露脸', '二次元'], risk_note: '示例：皮套制作、账号代运营类服务需先验证对方信用。',
      verified: 1, featured: 0, views: 640
    },
    {
      id: 'p_soul', name: 'Soul', alias: 'Soul App', category: '社交语音', logo_text: 'SO',
      summary: `兴趣社交起家的语音群聊平台，群聊房、瞬间广场联动，适合聊天型、陪伴型主播。${DISCLAIMER}。`,
      features: [
        { title: '兴趣匹配', desc: '平台推荐机制偏兴趣标签匹配' },
        { title: '群聊房玩法', desc: '多人房、连麦互动形态丰富' },
        { title: '社交关系沉淀', desc: '用户倾向长期停留与回访' }
      ],
      entry_condition: '示例：实名认证；部分群聊权益需完成新手任务或达到活跃门槛。',
      payout_policy: '示例：以礼物流水分成为主，具体权益随版本调整。',
      settlement_cycle: '示例：周结 / 月结并行',
      redlines: ['示例：禁止诱导未成年人消费', '示例：禁止虚假交友进行诈骗', '示例：禁止恶意引流至站外'],
      official_links: [{ label: 'Soul 官网', url: 'https://www.soulapp.cn' }],
      tags: ['兴趣社交', '群聊房', '陪伴向'], risk_note: '示例：任何要求押金、保证金的“入职”都应直接拒绝。',
      verified: 1, featured: 0, views: 1180
    },
    {
      id: 'p_douyin_voice', name: '抖音语音直播', alias: '抖音直播·语音分区', category: '综合内容', logo_text: '抖',
      summary: `短视频大流量池下的语音直播分区，推荐流量红利明显，但对内容合规与稳定的要求也更高。${DISCLAIMER}。`,
      features: [
        { title: '流量池大', desc: '冷启动有机会获得公域推荐' },
        { title: '内容与直播联动', desc: '短视频可为语音直播导流' },
        { title: '变现链路成熟', desc: '礼物、任务、活动等机制完善' }
      ],
      entry_condition: '示例：实名认证 + 直播权限开通；语音分区需满足平台基础规范。',
      payout_policy: '示例：公会/主播按比例分成，平台抽成后结算。',
      settlement_cycle: '示例：月结为主',
      redlines: ['示例：禁止低俗擦边与敏感话题炒作', '示例：禁止录播 / 循环话术刷时长', '示例：禁止站外违规导流'],
      official_links: [{ label: '抖音官网', url: 'https://www.douyin.com' }],
      tags: ['流量红利', '合规要求高', '短直联动'], risk_note: '示例：签约前务必确认违约金与独家条款，口头承诺无效。',
      verified: 0, featured: 1, views: 2460
    }
  ];

  list.forEach((p) => {
    ctx.run(
      `INSERT INTO platforms (id, name, alias, category, logo_text, summary, features, entry_condition,
        payout_policy, settlement_cycle, redlines, official_links, tags, risk_note, verified, status, views, featured, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.id, p.name, p.alias, p.category, p.logo_text, p.summary, JSON.stringify(p.features), p.entry_condition,
        p.payout_policy, p.settlement_cycle, JSON.stringify(p.redlines), JSON.stringify(p.official_links),
        JSON.stringify(p.tags), p.risk_note, p.verified, 'published', p.views, p.featured, nowISO()]
    );
  });
  return list.map((p) => p.id);
}

function seedTools(ctx, adminId) {
  const list = [
    {
      id: 't_kaitou', title: '开场白 / 暖场话术 20 条', category: '话术模板', form: 'template',
      summary: '覆盖新人进房、冷场救急、礼物答谢、下播收尾四大场景，可直接复制使用。',
      tags: ['话术', '新人必备'],
      content: `【新人进房】\n你好呀，第一次来我们厅吗？先坐榜一那个位置，我给你介绍一下玩法～\n\n【冷场救急】\n今天在线的家人们举个手，我抽一位送一首点唱名额，唱歌不好听不许笑我。\n\n【礼物答谢】\n谢谢 xx 哥的火箭，这一嗓子我给你补上，公屏赶紧刷一波排面！\n\n【留住新客】\n喜欢这个氛围的话点个关注，明天同一时间我还在这儿等你。\n\n【下播收尾】\n今天到这里啦，没聊够的可以留在房间聊，明天 9 点准时开播，记得来。\n\n（共 20 条，按「进房 / 暖场 / 互动 / 答谢 / 收尾」五类分组）`
    },
    {
      id: 't_paimai', title: '排麦表 / 值班表模板（可直接复制）', category: '运营表格', form: 'template',
      summary: '周维度排班 + 麦时长统计 + 出勤标注，厅管排班与结算核对两用。',
      tags: ['排班', '厅管', '结算'],
      content: `表格字段建议：\n日期 | 时段 | 主播昵称 | 岗位(歌手/主持/控场) | 应到时长 | 实到时长 | 缺勤原因 | 备注\n\n使用要点：\n1. 固定时段拆分（如 20:00-22:00 / 22:00-24:00），避免跨天统计出错。\n2. 实到时长以平台后台数据为准，主播自报仅作参考。\n3. 缺勤必须当天标注，月末结算才不会扯皮。\n4. 每周导出一份存档，截图留存不少于 3 个月。`
    },
    {
      id: 't_settle', title: '薪资结算核对表（主播版）', category: '运营表格', form: 'template',
      summary: '底薪 + 提成 + 榜单奖励 + 扣款明细，一条公式核到底，避免月末对不上账。',
      tags: ['结算', '避坑'],
      content: `核对表字段：\n周期 | 流水合计 | 平台抽成 | 公会影响系数 | 底薪 | 提成比例 | 榜单奖励 | 罚款/扣款 | 实发金额\n\n核对顺序：\n1. 先拿平台后台原始数据，不要直接信运营发的截图。\n2. 逐项对照协议：抽成比例、结算周期、扣款条款是否与签约一致。\n3. 有垫付的，确认归还规则写进备注。\n4. 结算单让对方书面确认（哪怕是聊天记录），口说无凭。`
    },
    {
      id: 't_contract', title: '主播合作协议要点清单（非法律意见）', category: '合同协议', form: 'article',
      summary: '签约前必看的 10 个条款：独家范围、违约金、分成口径、结算周期、解约条件。',
      tags: ['合同', '避坑'],
      content: `签约前逐条确认：\n1. 合同主体：公司全称、统一社会信用代码，和收款方是否一致。\n2. 独家条款：独家范围是全部平台还是单平台？期限多久？\n3. 违约金：金额怎么算，是否与收入严重不对等。\n4. 分成口径：是按流水还是按平台结算后的净额？差别很大。\n5. 结算周期：几号结，逾期怎么处理。\n6. 是否有押金 / 培训费：正规签约不收取任何前置费用。\n7. 排班与时长要求：未达标是否影响底薪。\n8. 解约条件：提前多久通知，是否需要赔付。\n9. 账号归属：账号、粉丝资产归谁。\n10. 争议处理：争议解决方式与管辖地。\n\n注：本清单为经验整理，不构成法律意见，正式签署前建议咨询专业律师。`
    },
    {
      id: 't_cover', title: '房间封面 / 头图尺寸与排版规范', category: '素材资源', form: 'article',
      summary: '常见封面比例、文字安全区、禁用元素，配合模板套改即可。',
      tags: ['封面', '素材'],
      content: `尺寸建议：\n- 房间封面：1:1（常用），主体放在中心 60% 安全区内，避免被 UI 裁切。\n- 头图 / 横幅：16:9，左右各留 10% 边距。\n\n排版要点：\n1. 标题不超过 12 个字，字号占比不低于画面高度的 1/8。\n2. 背景做压暗处理，保证白字可读。\n3. 禁用：未授权明星肖像、敏感标识、夸大字眼（如“第一”“唯一”）。`
    },
    {
      id: 't_scam', title: '招聘诈骗识别清单（新人必读）', category: '避坑指南', form: 'article',
      summary: '收押金、代结算、保底高薪……十种高频套路一眼识别。',
      tags: ['避坑', '防骗'],
      content: `看到以下任一情形，请提高警惕并优先举报：\n1. 入职前要求缴纳押金、保证金、服装费、培训费。\n2. 承诺“保底月入过万”但拒绝写进协议。\n3. 要求提供身份证照片、银行卡照片之外的人脸认证截图。\n4. 引导到站外私聊，并以“名额有限”催促立刻转账。\n5. 所谓“代入职”“内部渠道”“包过审核”收取服务费。\n6. 结算时以各种名目扣款，且无法提供平台后台原始数据。\n\n本平台规则：招聘信息若勾选「收取押金 / 培训费」，列表与详情页将强制展示风险横幅，并降低曝光权重。`
    },
    {
      id: 't_device', title: '入门声卡 / 麦克风配置清单', category: '软件工具', form: 'article',
      summary: '三档预算配置方案（500 / 1500 / 4000 元）与调试要点。',
      tags: ['设备', '音质'],
      content: `500 元档：USB 电容麦 + 桌面支架 + 防喷罩，先用原生驱动，别急着装插件。\n1500 元档：入门独立声卡 + XLR 麦 + 悬臂支架，可做基础降噪与混响。\n4000 元档：中端声卡 + 动圈麦 + 监听耳机 + 简易吸音处理。\n\n调试要点：\n1. 先定增益，保证峰值不超过 -6dB，再谈美化。\n2. 房间回音大优先做软装（窗帘、地毯），比换设备有效。\n3. 录一段 30 秒干声试听再定参数。`
    },
    {
      id: 't_kongchang', title: '厅管控场 SOP（含违规处置口径）', category: '话术模板', form: 'template',
      summary: '从开播前检查到下播复盘的标准动作，附带违规处置的留痕要求。',
      tags: ['厅管', 'SOP'],
      content: `开播前 30 分钟：检查背景音乐版权、封面、房间标题、管理员在线。\n开播中：\n- 每 15 分钟巡一次公屏，广告、引流、谩骂按「提醒 → 禁言 → 踢出」三级处理。\n- 涉及钱财交易的言论，直接留屏举证并上报。\n下播后：填写当日记录（在线峰值、礼物流水、违规处置次数）。\n\n留痕要求：所有处置动作截图存档，注明时间、账号、原因，争议时有据可查。`
    }
  ];

  list.forEach((t, i) => {
    ctx.run(
      `INSERT INTO tools (id, title, category, form, summary, content, link, file_path, tags, status, pinned, views, downloads, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [t.id, t.title, t.category, t.form, t.summary, t.content, '', '', JSON.stringify(t.tags),
        i === list.length - 1 ? 'off' : 'on', i < 2 ? 1 : 0, 300 + i * 37, 60 + i * 13, adminId, nowISO(), nowISO()]
    );
  });
}

function seedBoards(ctx) {
  const boards = [
    { id: 'b_platform', name: '平台讨论', slug: 'platform', description: '各语音平台的规则变化、入驻体验、分成讨论', accent: 'violet', sort_order: 1 },
    { id: 'b_ops', name: '运营经验', slug: 'ops', description: '拉新、留存、排班、活动策划的一线打法', accent: 'cyan', sort_order: 2 },
    { id: 'b_resource', name: '资源分享', slug: 'resource', description: '话术、表格、素材、设备的共享交换', accent: 'green', sort_order: 3 },
    { id: 'b_expose', name: '避坑曝光', slug: 'expose', description: '行业骗局、欠薪跑路的证据曝光与讨论', accent: 'red', sort_order: 4 },
    { id: 'b_qa', name: '新人问答', slug: 'qa', description: '刚入行不知道该问谁？在这里问', accent: 'amber', sort_order: 5 }
  ];
  boards.forEach((b) => {
    ctx.run('INSERT INTO boards (id, name, slug, description, accent, sort_order) VALUES (?,?,?,?,?,?)',
      [b.id, b.name, b.slug, b.description, b.accent, b.sort_order]);
  });
  return boards.map((b) => b.id);
}

function seedPosts(ctx, users) {
  const posts = [
    {
      id: 'post_1', board: 'b_ops', author: 'hall01', title: '做厅两年，我把排班从“谁有空谁来”改成了三段式，流水涨了 40%',
      platform: 'p_hello', type: 'experience', tags: ['排班', '人力管理'], pinned: 1, essence: 1, days: 9,
      content: `背景：之前完全靠群里喊人，黄金时段一堆人，凌晨场没人，中间段经常断播。\n\n改法：\n1. 把一天切成 20-22、22-24、0-2 三段，每段固定 2 名主播 + 1 名控场。\n2. 排班表每周五发，主播自行认领，剩下空位由厅管补。\n3. 断播一次扣当周全勤，连续两次取消下周黄金时段排班资格。\n\n结果：月度有效开播时长从 92 小时涨到 138 小时，礼物流水提升约 40%。\n\n踩过的坑：一开始我用“谁先到谁先上”，结果大家互相卷起床后立即开始，反而把中段掏空，一定要先排再执行。`
    },
    {
      id: 'post_2', board: 'b_platform', author: 'host01', title: '三个平台同一个月前后的结算差异实录（纯个人体感）',
      platform: 'p_yy', type: 'experience', tags: ['结算', '平台对比'], pinned: 0, essence: 1, days: 6,
      content: `声明：以下为个人体感和数据，不构成任何建议，也不代表平台官方政策。\n\n我在三个平台同时挂着同一套内容（情感电台 + 点唱），一个月下来：\n- 平台 A：流水最稳，但结算周期最长，周中提现需要走流程。\n- 平台 B：单场波动大，遇到活动日能翻倍。\n- 平台 C：用户粘性最好，回访率高，但冷启动慢。\n\n结论：不要只看分成比例，要把「结算周期 + 波动率 + 回访率」三个一起看。\n另外，所有结算以平台后台原始数据为准，运营发的截图我一律要求导出原始表核对。`
    },
    {
      id: 'post_3', board: 'b_expose', author: 'newbie', title: '【曝光】“内部渠道保过审核”收 800 元服务费，交完就被拉黑',
      platform: 'p_hello', type: 'expose', tags: ['诈骗', '押金'], pinned: 1, essence: 0, days: 3,
      content: `完整经过：\n1. 对方在某群里主动私信，说认识平台内部人员，保证入驻审核通过。\n2. 收费 800，先付 400 定金，承诺不过退款。\n3. 付款后被要求再补 400 走“加急”，我拒绝，对方直接拉黑。\n\n教训：\n- 任何宣称「内部渠道」「包过审核」的都不要信。\n- 定金这个词本身就是在赌你不敢追责。\n- 已经报警并把聊天记录提交给平台了，也在这里提醒大家注意。\n\n补充：聊天记录、转账凭证我都留着，需要核实的可以私信我。`
    },
    {
      id: 'post_4', board: 'b_resource', author: 'hall01', title: '整理了一套排班 - 结算联动表，直接复制可用',
      platform: 'p_tt', type: 'resource', tags: ['模板', '表格'], pinned: 0, essence: 0, days: 5,
      content: `这套表解决两个问题：\n1. 排班和结算两张皮，月末对不上账。\n2. 缺勤扣款没有依据，全是口头的。\n\n表里包含：排班、实到、缺勤标注、流水导入、应付计算五个 sheet，公式都写好了，只填数据。\n需要的同学我放在工具包里了，直接搜“排麦表”就能找到，复制粘贴到自己的表格里改就行。`
    },
    {
      id: 'post_5', board: 'b_qa', author: 'newbie', title: '纯新手第一个月，是该先找一个厅还是自己慢慢摸索？',
      platform: 'p_soul', type: 'question', tags: ['新人'], pinned: 0, essence: 0, days: 2,
      content: `背景：完全没有经验，声卡刚到，连开场白都还没背。\n\n纠结的点：\n- 找个厅有人带，但怕遇到不靠谱的、被压流水。\n- 自己摸索自由度高，但可能三个月都起不来。\n\n想问问过来人：第一个月你们是怎么安排的？`
    },
    {
      id: 'post_6', board: 'b_ops', author: 'host01', title: '主持岗的能力模型拆解：不是嘴皮子利索就够了',
      platform: 'p_soul', type: 'experience', tags: ['主持', '岗位能力'], pinned: 0, essence: 1, days: 12,
      content: `拆解主持岗，我分成四层：\n1. 基础层：普通话、语速控制、不冷场。这个一个月能练出来。\n2. 控场层：能把话题从一个人的身上拉回全房，能处理冲突。这个要半年。\n3. 转化层：知道什么时候提礼物、什么时候提关注，不生硬。这个要靠数据复盘。\n4. 组织层：能带新人、能排班、能替补。这就是往运营走的路了。\n\n招聘时建议按层定薪，不要一概而论。`
    },
    {
      id: 'post_7', board: 'b_platform', author: 'mod01', title: '【版务】发帖前请先看这份社区公约',
      platform: null, type: 'normal', tags: ['版务'], pinned: 1, essence: 0, days: 30,
      content: `为了让这个社区能长期活下去，请遵守：\n1. 引用平台规则请注明时间，规则变动频繁，去年的截图可能是错的。\n2. 曝光类帖子必须附证据（聊天记录、转账凭证），只凭描述的一律降低曝光。\n3. 招聘信息请如实勾选是否收费，隐瞒的一经核实直接下架。\n4. 禁止人身攻击、禁止跨平台拉踩、禁止恶意引流。\n\n违规处理：删除 → 禁言 → 封号三级制。`
    },
    {
      id: 'post_8', board: 'b_resource', author: 'mod01', title: '开麦前十分钟的七个动作（新人版）',
      platform: 'p_yinjie', type: 'resource', tags: ['话术', '设备'], pinned: 0, essence: 0, days: 8,
      content: `1. 试音：录 30 秒干声听底噪。\n2. 检查伴奏合法性，不要用未授权音源。\n3. 封面和标题改一遍，不要今天昨天一样。\n4. 开场话术背熟前 3 句，剩下的临场发挥。\n5. 房间先放两分钟背景音乐，等第一批人进来。\n6. 手机静音，通知关掉。\n7. 倒一杯水。真的很影响状态。`
    },
    {
      id: 'post_9', board: 'b_ops', author: 'hall01', title: '活动复盘：一次“点唱排位赛”为什么失败了',
      platform: 'p_kilakila', type: 'experience', tags: ['活动', '复盘'], pinned: 0, essence: 0, days: 15,
      content: `目标：拉动公屏互动，提升礼物集中度。\n\n做法：给点唱排第一名的人奖励次日首位特权。\n\n结果：失败了，原因有三：\n1. 规则没讲清楚，一半人不知道怎么参与。\n2. 奖励只对头部用户有意义，中层完全没动力。\n3. 没有设置保底参与奖，导致第一名没悬念后全场冷掉。\n\n下次改法：把奖励分成「参与奖 + 名次奖」两层，且规则要在活动开始前播三遍。`
    },
    {
      id: 'post_10', board: 'b_qa', author: 'host01', title: '简历卡里到底该写什么？招聘方来告诉你',
      platform: null, type: 'question', tags: ['求职'], pinned: 0, essence: 0, days: 4,
      content: `作为招聘方说句实话，我看简历卡只看四件事：\n1. 你能上的时间段（这个决定你能不能排进班表）。\n2. 你的试音/作品链接（没有链接基本不看第二条）。\n3. 你能做的具体内容：唱歌、情感、游戏、控场，写具体，不要写“全能”。\n4. 你对结算方式的预期（日结/周结/月结），提前说清楚避免浪费彼此时间。\n\n最没用的写法：「热爱行业、吃苦耐劳」，这两个词我看一万次了。`
    }
  ];

  posts.forEach((p) => {
    const created = addDays(nowISO(), -p.days);
    const safeContent = String(p.content)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .split(/\n\n+/).map((b) => `<p>${b.replace(/\n/g, '<br>')}</p>`).join('');
    ctx.run(
      `INSERT INTO posts (id, board_id, author_id, title, content, platform_id, type, tags, cover, status, pinned, essence, views, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.id, p.board, users[p.author], p.title, safeContent, p.platform, p.type, JSON.stringify(p.tags), '',
        'published', p.pinned, p.essence, 120 + Math.floor(Math.random() * 900), created, created]
    );
  });
}

function seedJobs(ctx, users) {
  const jobs = [
    {
      id: 'job_1', kind: 'recruit', author: 'hall01', title: '【Hello语音】夜航厅 招聘兼职歌手 / 情感主持（日结）',
      platform: 'p_hello', role_type: '主播', salary_min: 3000, salary_max: 8000, salary_unit: '元/月', salary_cycle: '日结',
      work_time: '每天 20:00-24:00，每周至少 4 天', city: '不限', remote: 1,
      contact_name: '老K', contact_value: '微信 hallkeeper001', days: 5, status: 'approved', days_to_expire: 24,
      risk_deposit: 0, risk_fee: 0, verified: 1,
      description: `【我们是谁】\nHello语音夜航厅，运营 2 年，稳定在榜房间，现有主播 28 人。\n\n【招什么】\n1. 歌手：能唱流行/民谣优先，会乐器加分。\n2. 情感主持：负责晚间情感电台环节，需要有控场经验。\n\n【薪资构成】\n底薪 1500 + 流水提成 + 榜单奖励，日结流水部分，月结底薪。\n\n【我们提供】\n话术包、排班表、新人陪跑 3 天，不收任何费用。\n\n【要求】\n设备齐全，能稳定开播，不接受三天打鱼。`
    },
    {
      id: 'job_2', kind: 'recruit', author: 'hall01', title: '【TT语音】游戏陪玩 / 开麦主持 若干名',
      platform: 'p_tt', role_type: '主持', salary_min: 2000, salary_max: 6000, salary_unit: '元/月', salary_cycle: '周结',
      work_time: '晚间 19:00-23:00，弹性排班', city: '不限', remote: 1,
      contact_name: '老K', contact_value: '微信 hallkeeper001', days: 3, status: 'approved', days_to_expire: 20,
      risk_deposit: 0, risk_fee: 0, verified: 1,
      description: `招游戏陪玩主持：\n- 熟悉主流竞技 / 派对类游戏，能带节奏。\n- 会聊天，能处理冷场和冲突。\n- 有陪玩经验优先，新手可带。\n\n结算：周结，周日晚 24 点前到账本周流水。\n不收押金、不收培训费，任何收费请先举报。`
    },
    {
      id: 'job_3', kind: 'recruit', author: 'hall01', title: '【抖音语音分区】急招运营助理 1 名（短视频 + 直播双端）',
      platform: 'p_douyin_voice', role_type: '运营', salary_min: 6000, salary_max: 12000, salary_unit: '元/月', salary_cycle: '月结',
      work_time: '灵活，按项目节点交付', city: '不限', remote: 1,
      contact_name: '老K', contact_value: '微信 hallkeeper001', days: 1, status: 'approved', days_to_expire: 15,
      risk_deposit: 0, risk_fee: 0, verified: 1,
      description: `岗位内容：\n1. 负责短视频选题与剪辑（提供素材与模板）。\n2. 负责直播间排期与数据统计。\n3. 参与活动策划与复盘。\n\n要求：会用剪映 / PR，会做基础数据表，有直播行业经验优先。\n\n薪资：底薪 6000 + 绩效，具体面谈。`
    },
    {
      id: 'job_4', kind: 'recruit', author: 'hall01', title: '【Soul】新手扶持计划，零经验可报名',
      platform: 'p_soul', role_type: '主播', salary_min: 2000, salary_max: 5000, salary_unit: '元/月', salary_cycle: '周结',
      work_time: '每天 3 小时以上，时段自选', city: '不限', remote: 1,
      contact_name: '阿哲', contact_value: 'QQ 待发送：请先投递简历卡', days: 2, status: 'pending', days_to_expire: 28,
      risk_deposit: 0, risk_fee: 0, verified: 0,
      description: `面向零经验新人的扶持计划：\n- 提供话术、设备调试、试播陪跑。\n- 前两周有保底，具体以协议为准。\n- 不收取任何费用。`
    },
    {
      id: 'job_5', kind: 'recruit', author: 'host01', title: '【YY语音】某公会招募音频后期 / 封面设计（外包）',
      platform: 'p_yy', role_type: '美工', salary_min: 80, salary_max: 300, salary_unit: '元/小时', salary_cycle: '周结',
      work_time: '按单结算，接单制', city: '不限', remote: 1,
      contact_name: '阿七', contact_value: '邮箱 host07@example.com', days: 7, status: 'approved', days_to_expire: 18,
      risk_deposit: 0, risk_fee: 0, verified: 0,
      description: `招封面设计外包：\n- 熟练 PS / AI，能做竖版封面、头图。\n- 有语音厅封面经验优先。\n\n按张结算，长期合作可谈月包。`
    },
    {
      id: 'job_6', kind: 'recruit', author: 'host01', title: '【克拉克拉】虚拟主播招募（不露脸）',
      platform: 'p_kilakila', role_type: '主播', salary_min: 3000, salary_max: 9000, salary_unit: '元/月', salary_cycle: '半月结',
      work_time: '每晚 21:00-01:00', city: '不限', remote: 1,
      contact_name: '阿七', contact_value: '微信 host07_v', days: 4, status: 'pending', days_to_expire: 26,
      risk_deposit: 0, risk_fee: 0, verified: 1,
      description: `虚拟主播招募：\n- 无需露脸，需要自行准备皮套（可协助对接画师）。\n- 擅长闲聊、电台、翻唱任一方向。\n\n薪资：底薪 + 分成，半月结。`
    },
    {
      id: 'job_7', kind: 'recruit', author: 'host01', title: '【风险标记示例】高保底招聘，需缴纳培训费 500 元',
      platform: 'p_soul', role_type: '主播', salary_min: 8000, salary_max: 15000, salary_unit: '元/月', salary_cycle: '月结',
      work_time: '每天 6 小时', city: '不限', remote: 1,
      contact_name: '某招聘号', contact_value: '私信索取，注意甄别', days: 6, status: 'approved', days_to_expire: 12,
      risk_deposit: 1, risk_fee: 1, verified: 0,
      description: `本条为演示「风险标记」效果保留的示例数据，用于展示系统会如何给收费类岗位打上风险横幅。\n\n真实招聘中，任何前置收费都应谨慎对待。`
    },
    {
      id: 'job_8', kind: 'recruit', author: 'hall01', title: '【已过期示例】猫耳FM 广播剧配音招募',
      platform: 'p_missevan', role_type: '音频后期', salary_min: 500, salary_max: 2000, salary_unit: '元/月', salary_cycle: '月结',
      work_time: '按项目周期', city: '不限', remote: 1,
      contact_name: '老K', contact_value: '微信 hallkeeper001', days: 45, status: 'expired', days_to_expire: -15,
      risk_deposit: 0, risk_fee: 0, verified: 0,
      description: `这条岗位已过期自动下架，用于演示到期处理机制。`
    },
    {
      id: 'job_9', kind: 'seek', author: 'host01', title: '求职：两年电台/点唱经验，可 20-24 点稳定开播',
      platform: 'p_hello', role_type: '主播', salary_min: 4000, salary_max: 0, salary_unit: '元/月', salary_cycle: '周结',
      work_time: '每天 20:00-24:00', city: '不限', remote: 1,
      contact_name: '阿七', contact_value: '微信 host07_v', days: 3, status: 'approved', days_to_expire: 25,
      risk_deposit: 0, risk_fee: 0, verified: 1,
      description: `自我介绍：\n- 语音主播第 2 年，擅长情感电台与点唱。\n- 设备：独立声卡 + XLR 电容麦，有安静房间。\n- 试音作品：可提供 3 段 60 秒干声。\n\n期望：周结或半月结，不接受任何形式的前置收费。`
    },
    {
      id: 'job_10', kind: 'seek', author: 'newbie', title: '求职：零经验新人，求一个愿意带人的厅',
      platform: 'p_soul', role_type: '主持', salary_min: 2000, salary_max: 0, salary_unit: '元/月', salary_cycle: '周结',
      work_time: '每晚 21:00-24:00', city: '不限', remote: 1,
      contact_name: '小白', contact_value: 'QQ 123456789', days: 2, status: 'approved', days_to_expire: 22,
      risk_deposit: 0, risk_fee: 0, verified: 0,
      description: `刚接触语音厅，做过两周兼职主持，会基础控场，愿意学。\n希望找一个有培训、不收费的厅，能接受前期收入低。`
    },
    {
      id: 'job_11', kind: 'seek', author: 'host01', title: '求职：兼职厅管，可长期稳定值班',
      platform: 'p_tt', role_type: '厅管', salary_min: 2500, salary_max: 0, salary_unit: '元/月', salary_cycle: '月结',
      work_time: '每天 19:00-23:00', city: '不限', remote: 1,
      contact_name: '阿七', contact_value: '微信 host07_v', days: 8, status: 'approved', days_to_expire: 19,
      risk_deposit: 0, risk_fee: 0, verified: 1,
      description: `有 1 年厅管经验，熟悉 SOP、违规处置留痕、日常排班。\n可接受兼职，同时最多带 2 个厅。`
    },
    {
      id: 'job_12', kind: 'recruit', author: 'hall01', title: '【驳回示例】招聘要求与薪资明显不符（已被审核驳回）',
      platform: 'p_yy', role_type: '主播', salary_min: 10000, salary_max: 30000, salary_unit: '元/月', salary_cycle: '日结',
      work_time: '每天 2 小时', city: '不限', remote: 1,
      contact_name: '待定', contact_value: '未提供', days: 10, status: 'rejected', days_to_expire: 10,
      risk_deposit: 1, risk_fee: 0, verified: 0,
      description: `该岗位因「承诺薪资明显偏离行业水平且未填写有效联系方式」被审核驳回，用于演示驳回后的作者提示。`,
      reject_reason: '薪资承诺缺乏依据且联系方式不完整，请补充真实信息后重新提交'
    }
  ];

  jobs.forEach((j) => {
    const created = addDays(nowISO(), -j.days);
    ctx.run(
      `INSERT INTO jobs (id, kind, title, platform_id, role_type, salary_min, salary_max, salary_unit, salary_cycle,
        work_time, city, remote, contact_name, contact_value, description, risk_deposit, risk_fee, real_name_verified,
        status, expires_at, reject_reason, author_id, views, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [j.id, j.kind, j.title, j.platform, j.role_type, j.salary_min, j.salary_max, j.salary_unit, j.salary_cycle,
        j.work_time, j.city, j.remote, j.contact_name, j.contact_value, j.description, j.risk_deposit, j.risk_fee, j.verified,
        j.status, j.days_to_expire ? addDays(created, j.days_to_expire) : null, j.reject_reason || '',
        users[j.author], 80 + Math.floor(Math.random() * 400), created, created]
    );
  });
}

function seedComments(ctx, users) {
  const rows = [
    { id: 'c_1', target_type: 'post', target_id: 'post_1', author: 'host01', content: '三段式排班确实靠谱，我们也是这么切的，关键是排班表要提前发，临时改最伤士气。', days: 8 },
    { id: 'c_2', target_type: 'post', target_id: 'post_1', author: 'newbie', content: '想问下新人能直接要求排凌晨场吗？我白天要上课。', days: 7 },
    { id: 'c_3', target_type: 'post', target_id: 'post_1', author: 'hall01', content: '可以，但建议先从 20-22 做起，凌晨场对主播体力消耗大，新人容易掉数据。', days: 7 },
    { id: 'c_4', target_type: 'post', target_id: 'post_3', author: 'mod01', content: '已按流程处理，感谢提供完整凭证。提醒大家：任何前置收费都先举报。', days: 3 },
    { id: 'c_5', target_type: 'post', target_id: 'post_5', author: 'hall01', content: '建议先找一个厅待两个月，别急着签约，看清结算和排班再决定。', days: 2 },
    { id: 'c_6', target_type: 'post', target_id: 'post_6', author: 'newbie', content: '受教了，原来主持还分这么多层，我以为就是会说话就行。', days: 11 },
    { id: 'c_7', target_type: 'job', target_id: 'job_1', author: 'newbie', content: '请问零经验可以投吗？设备刚买齐。', days: 4 },
    { id: 'c_8', target_type: 'job', target_id: 'job_1', author: 'hall01', content: '可以投递，先在简历卡里放一段 60 秒试音链接。', days: 4 },
    { id: 'c_9', target_type: 'job', target_id: 'job_9', author: 'hall01', content: '方便把试音链接发我一份吗？时间对得上。', days: 3 }
  ];
  rows.forEach((c) => {
    const created = addDays(nowISO(), -c.days);
    ctx.run(
      `INSERT INTO comments (id, target_type, target_id, parent_id, author_id, content, status, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [c.id, c.target_type, c.target_id, null, users[c.author], c.content, 'published', created]
    );
  });
}

function seedReactions(ctx, users) {
  const rows = [
    ['post_1', 'like', 'host01'], ['post_1', 'like', 'newbie'], ['post_1', 'fav', 'newbie'],
    ['post_2', 'like', 'hall01'], ['post_2', 'fav', 'newbie'],
    ['post_3', 'fav', 'host01'],
    ['post_4', 'like', 'newbie'], ['post_4', 'fav', 'host01'],
    ['post_6', 'fav', 'hall01'],
    ['job_1', 'fav', 'newbie'], ['job_9', 'fav', 'hall01'],
    ['tool:t_kaitou', 'fav', 'newbie'], ['tool:t_paimai', 'fav', 'hall01']
  ];
  rows.forEach((r, i) => {
    const parts = r[0].split(':');
    const targetType = parts.length > 1 ? parts[0] : 'post';
    const targetId = parts[parts.length - 1];
    ctx.run(
      `INSERT OR IGNORE INTO reactions (id, user_id, target_type, target_id, type, created_at) VALUES (?,?,?,?,?,?)`,
      [`r_seed_${i}`, users[r[2]], targetType, targetId, r[1], nowISO()]
    );
  });
}

function seedReports(ctx, users) {
  const rows = [
    { target_type: 'job', target_id: 'job_7', reason_type: '收取押金', detail: '对方在沟通中要求先缴 500 元培训费，与「不收费」描述不符', reporter: 'newbie', status: 'pending', days: 1 },
    { target_type: 'post', target_id: 'post_3', reason_type: '诈骗风险', detail: '希望平台协助核实该中介账号', reporter: 'host01', status: 'resolved', action: '下架', handler: 'mod01', days: 2 },
    { target_type: 'job', target_id: 'job_12', reason_type: '虚假信息', detail: '薪资明显虚高且无有效联系方式', reporter: 'host01', status: 'resolved', action: '下架', handler: 'mod01', days: 9 }
  ];
  rows.forEach((r, i) => {
    const created = addDays(nowISO(), -r.days);
    ctx.run(
      `INSERT INTO reports (id, target_type, target_id, reason_type, reason_detail, reporter_id, status, action, handler_id, handled_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [`rep_${i + 1}`, r.target_type, r.target_id, r.reason_type, r.detail, users[r.reporter], r.status, r.action || '',
        r.handler ? users[r.handler] : null, r.handler ? created : null, created]
    );
  });
}

module.exports = function seed(ctx) {
  const users = seedUsers(ctx);
  const adminId = users.admin;
  seedPlatforms(ctx);
  seedTools(ctx, adminId);
  seedBoards(ctx);
  seedPosts(ctx, users);
  seedJobs(ctx, users);
  seedComments(ctx, users);
  seedReactions(ctx, users);
  seedReports(ctx, users);

  ctx.run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, target_type, target_id, detail, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [`log_seed_1`, adminId, '平台管理员', '初始化演示数据', 'system', 'seed', '写入平台 8 条 / 工具 8 条 / 帖子 10 条 / 岗位 12 条', nowISO()]
  );
  return { users };
};

module.exports.DISCLAIMER = DISCLAIMER;
