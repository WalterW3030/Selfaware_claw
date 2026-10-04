=====【装配声明（十二份输入SHA绑定完成，非替代输入）】=====
【装配声明】任务42派发（2026-10-03T19:45:15+08:00）要求的十二份输入本文档已全部就位并完成SHA绑定。《多语言与语音方案.md》（v1.0，commit 4a09b28）为设计依据，以它为准。《点餐页UI规格汇总_任务39输入.md》（v1.3定稿）为UI规格权威。基座说明：pages/order三件套以任务39版为最新基座；pages/index、pages/history以任务39版为基座；app.json以任务38语音剥离版为基座；pages/profile与app.js以任务34原生工程版为基座。本声明不构成输入替代，十二份均为原文。

=====【文档: 多语言与语音方案.md（v1.0，2026-09-30，commit 4a09b28，设计依据，以它为准）】=====
# 多语言与语音方案（v1.0，2026-09-30）

kimi整理，基于官方资料查证。范围：界面与模型输出文字三语切换（简/繁/英）、三语语音输入、三语语音输出。原则：除语音输出外不引入新AI模型，简繁转换与翻译用简单工具。

## 一、能力查证结论（有据）

| 需求 | 现有平台能否满足 | 依据 |
|---|---|---|
| 界面文字简/繁/英切换 | 能，纯前端i18n语言包，零成本 | 小程序i18n标准做法（langPack+全局广播） |
| 模型输出转繁体 | 能，OpenCC本地转换库，离线零成本零模型 | OpenCC开源（Apache 2.0），词语级转换，有JS版 |
| 模型输出转英文 | 两条路：①推荐prompt追加输出语言指令（零额外调用）②后置走hy-mt2-lite翻译（已选模型，300/1.2k点/百万token） | 详见三.2 |
| 语音输入（普通话/粤语/英语） | 能，微信同声传译插件语音识别支持 zh_CN/en_US/zh_HK(粤)，免费有配额 | 插件官方文档+Face2FaceTranslator仓库 |
| 语音输出 普通话/英语 | 能，同声传译插件语音合成支持 zh_CN/en_US，免费 | 同上 |
| 语音输出 粤语 | 插件不支持；腾讯云TTS支持粤语（turbo/精品音色），0.3元/万字符，可领800万字符免费包（3个月有效），经云函数转发 | 腾讯云TTS计费文档2026-08版 |

## 二、前置阻塞（Walter操作）

1. 同声传译插件授权（之前"插件未授权"的根因）：微信公众平台(mp.weixin.qq.com)→设置→第三方服务→插件管理→添加插件→搜"微信同声传译"→添加。添加后app.json重新声明即可用。
2. 粤语语音输出（可选，决定后才做）：腾讯云控制台开通语音合成→领免费资源包→创建API密钥→密钥配到云函数环境变量（密钥不入群）。

## 三、实现方案设计

### 1. 界面三语切换（i18n层）
- utils/i18n.js + 三个语言包（zh-Hans/zh-Hant/en），全部界面文案抽成key，wxml用{{langPack.xxx}}。
- 切换入口放"我的"页+选单栏语言项（现有中/英/粤改为简/繁/英），切换写storage并广播刷新所有页面（Behavior混入）。
- 繁体语言包用OpenCC从简体包离线生成初稿+人工校对用词（香港/台湾习惯），英文包人工翻译（界面文案量少，约百条）。

### 2. 模型输出语言
- 推荐结果默认中文产出（链路不动）。
- 繁体：展示层过OpenCC转换，本地完成，不调模型。
- 英文：二选一（待Walter定，见U2）：
  A. prompt级——组装器按当前语言在prompt末尾加"以英文输出全部内容"（零额外调用，质量依赖模型）；
  B. 后置翻译——中文产出后走translate功能位（hy-mt2-lite）翻成英文（多一次调用，输出稳定）。
  建议测试期用A，不达标切B。

### 3. 语音输入（三语）
- 输入栏左侧麦克风按钮，按住说话→同声传译插件 speechToText→文字入输入栏（可编辑再发送）。
- 识别语种跟随当前界面语言：简体→zh_CN，繁体→zh_HK(粤语)，英文→en_US。（如需"繁体界面+普通话输入"组合，麦克风长按可临时切换语种——列为增强项，测试期不做）

### 4. 语音输出（三语）
- 播报按钮启用（现为灰色占位）：推荐结果/完整分析一键播报。
- 普通话/英语→插件 textToSpeech（免费）；粤语→云函数 relayTTS 调腾讯云TTS返回音频播放（密钥走环境变量）。
- 播报文本=当前界面语言版本的显示文本（繁体播报走粤语TTS，简体播报走普通话，英文播报走英语）。

### 5. 成本估算
- i18n/OpenCC/语音输入：零成本（插件配额内）。
- 粤语播报：0.3元/万字符，一次播报约100-200字≈0.003-0.006元；800万字符免费包够测试期全量用。
- 英文输出：方案A零成本；方案B每次推荐+约0.5-1点。

## 四、待定项（Walter裁决）

U1：同声传译插件你去公众平台添加（第2节第1条），加不上再告诉我走腾讯云ASR备选。
U2：英文输出选A（prompt级零成本）还是B（后置翻译更稳）。建议A。
U3：粤语语音输出是否本期就要（要的话需开通腾讯云TTS，密钥配环境变量不入群）；不要则粤语播报按钮暂置灰"即将上线"。
U4：语音播报音色有无偏好（默认女声、语速1.0），无偏好按默认。

=====【文档: 点餐页UI规格汇总_任务39输入.md（v1.3定稿）】=====
# 点餐页UI规格汇总（任务39输入，v1.3定稿）

汇总人：kimi | 2026-09-29 | 全部经Walter确认。与《推荐系统结构设计与UI执行方案》及U裁决修订并用；冲突以本文件为准。

## 一、标签体系（13项，UI平铺不分区，类型仅设计参考）

| 标签 | 注入prompt |
|---|---|
| 运动后补充 | 运动后恢复，优先补水、电解质和适量碳水蛋白 |
| 身体恢复 | 身体恢复期，推荐清淡易消化、低脂温和的 |
| 多人聚餐 | 多人聚餐，推荐适合分享、接受度高的 |
| 小酌 | 有小酌，推荐佐酒的，兼顾护胃 |
| 吃辣 | 想吃辣，辣度按菜单标注可商量 |
| 无辣 | 不要辣 |
| 清淡 | 要清淡的 |
| 开胃 | 想开胃，推荐酸味或清爽方向的 |
| 少油少糖 | 少油少糖 |
| 减脂控卡 | 减脂期，推荐低热量高饱腹的 |
| 健身增肌 | 健身增肌，优先高蛋白 |
| 解暑 | 解暑，推荐清凉的 |
| 暖胃 | 想吃点暖胃的 |

指标映射：场合4项→020（S3/S5/聚餐+R6/S8）；口味5项→016（T1/低负荷/T2/成分层）+R2（无辣）；其他4项→S7/R4+R5/S1/016温度维度。

## 二、选单栏（输入行上方一条，精简原则）

默认只显示：`[餐:午餐▾]` + 常用标签chip×3（本地频次排序）+ `[+]`。
- 餐切换：早餐/午餐/晚餐/夜宵/下午茶，修正参考不硬过滤。
- [+]面板内含：更多标签（全部13个）、分量控件、预算控件、忌口管理入口、快速/详细切换（默认快速，快速时后台注入"快速推荐"字样）、语言选择（中/英/粤，播报暂缓）、加菜/已有食物输入。
- 点标签/slider确认→输入栏生成可删除小块（只显标签名或值，如"减脂控卡""预算：人均50以内"），prompt后台拼接，多选叠加；可零打字直接发送。

## 三、分量控件（替代饱腹档slider）

主食/主菜/小吃/饮料四类各选0-3，一餐合计≤3道（前端硬限制）。注入示例："点2道：主食1、饮料1"。

## 四、预算控件

人均预算范围滑块（0-200元，步进10元），注入"预算人均50以内"，映射R6档次作排序因子（用户未说"严格"时不硬过滤）。

## 五、忌口（个人数据）

独立入口，存个人档案跨会话通用；每次会话自动作硬过滤注入，对照R2表排除。常见忌口表15项：不吃辣/不吃香菜/不吃葱蒜/清真（忌猪肉酒精）/乳糖不耐/海鲜过敏/花生坚果过敏/麸质过敏/鸡蛋过敏/大豆过敏/素食（蛋奶素/纯素）/控糖/限盐/低嘌呤（痛风）/孕产妇禁忌；勾选+可手输补充。

## 六、三屏流（不变）

第1屏选单栏+输入行；第2屏推荐卡片排名（排名|菜名|分数|一句话理由|角标✓/?/⚠，触碰弹固定说明三句）+"展开完整分析"；第3屏完整分析四段+确认加入本餐+重新筛选。停摆态："这类情况我还没学会，先用简单推荐"+兜底结果。首页"新的一餐"按钮→新建mealSession跳点餐页；history保留历次只读。

=====【文档: pages/order/order.js 原文（任务39版，第2轮改造基座）】=====
// [任务39] 点餐页三屏流逻辑层（第1a轮：仅重写本文件）
// 依据：《点餐页UI规格汇总_任务39输入.md》v1.3定稿（唯一权威UI规格，冲突以本文件为准）
// 基座：任务38语音剥离版 pages/order/order.js
// 接线：common/recommend.js（任务37产出，只接不改）
// 红线：不改网关、不动其他文件；标签注入prompt文案以规格文档表格逐字为准；停摆态兜底文案逐字。

const { callAI } = require('../../common/gateway.js')
const rec = require('../../common/recommend.js')

// ── [任务38] 语音播报已剥离：WechatSI 恒为 null，不触碰插件 ──
let WechatSI = null

// ── 语言标签 ──
const LANG_LABEL = { zh_CN: '普通话', en_US: '英语', yue: '粤语' }

// ── 规格文档 §一 标签体系（13项，注入prompt文案逐字以表格为准）──
// 类型仅设计参考，UI平铺不分区
const TAGS = [
  { key: 'sport_recover', name: '运动后补充', type: '场合', prompt: '运动后恢复，优先补水、电解质和适量碳水蛋白' },
  { key: 'body_recover',  name: '身体恢复',   type: '场合', prompt: '身体恢复期，推荐清淡易消化、低脂温和的' },
  { key: 'group_dining',  name: '多人聚餐',   type: '场合', prompt: '多人聚餐，推荐适合分享、接受度高的' },
  { key: 'drink',         name: '小酌',       type: '场合', prompt: '有小酌，推荐佐酒的，兼顾护胃' },
  { key: 'spicy',         name: '吃辣',       type: '口味', prompt: '想吃辣，辣度按菜单标注可商量' },
  { key: 'no_spicy',      name: '无辣',       type: '口味', prompt: '不要辣' },
  { key: 'light',         name: '清淡',       type: '口味', prompt: '要清淡的' },
  { key: 'appetite',      name: '开胃',       type: '口味', prompt: '想开胃，推荐酸味或清爽方向的' },
  { key: 'less_oil_sugar',name: '少油少糖',   type: '口味', prompt: '少油少糖' },
  { key: 'fat_loss',      name: '减脂控卡',   type: '其他', prompt: '减脂期，推荐低热量高饱腹的' },
  { key: 'muscle_gain',   name: '健身增肌',   type: '其他', prompt: '健身增肌，优先高蛋白' },
  { key: 'cool_down',     name: '解暑',       type: '其他', prompt: '解暑，推荐清凉的' },
  { key: 'warm_stomach',  name: '暖胃',       type: '其他', prompt: '想吃点暖胃的' }
]

// ── 规格文档 §五 常见忌口表15项 ──
const DIET_RESTRICTIONS = [
  { key: 'no_spicy_diet', name: '不吃辣' },
  { key: 'no_cilantro',   name: '不吃香菜' },
  { key: 'no_garlic',     name: '不吃葱蒜' },
  { key: 'halal',         name: '清真（忌猪肉酒精）' },
  { key: 'lactose',       name: '乳糖不耐' },
  { key: 'seafood',       name: '海鲜过敏' },
  { key: 'peanut_nut',    name: '花生坚果过敏' },
  { key: 'gluten',        name: '麸质过敏' },
  { key: 'egg',           name: '鸡蛋过敏' },
  { key: 'soy',           name: '大豆过敏' },
  { key: 'vegetarian',    name: '素食（蛋奶素/纯素）' },
  { key: 'sugar_control', name: '控糖' },
  { key: 'salt_control',  name: '限盐' },
  { key: 'low_purine',    name: '低嘌呤（痛风）' },
  { key: 'pregnancy',     name: '孕产妇禁忌' }
]

// ── 规格文档 §二 餐切换选项 ──
const MEALS = ['早餐', '午餐', '晚餐', '夜宵', '下午茶']

// ── 规格文档 §三 分量控件四类 ──
const PORTION_TYPES = [
  { key: 'staple',  name: '主食' },
  { key: 'main',    name: '主菜' },
  { key: 'snack',   name: '小吃' },
  { key: 'drink_p', name: '饮料' }
]

// ── 规格文档 §六 停摆态兜底文案（逐字）──
const STALL_TEXT = '这类情况我还没学会，先用简单推荐'

// ── 本地存储键 ──
const LS_TAG_FREQ = 'order_tag_freq'          // 标签选择频次
const LS_DIET     = 'order_diet_profile'       // 忌口个人档案（跨会话通用）
const LS_MEAL     = 'order_last_meal'          // 上次餐次（仅默认值参考）

// ── 三屏常量 ──
const SCREEN = { MENU: 1, RESULT: 2, ANALYSIS: 3 }

// ── 角标固定三句说明（逐字按Walter裁决原文，Coordinator 2026-09-29 14:49:23 指令）──
const BADGE_EXPLAIN = {
  '✓': '来自真实资料',
  '?': '结果基于真实资料推断，注意甄别',
  '⚠': '结果主要来自ai生成信息，注意甄别'
}

// ===========================================================================
// 辅助函数
// ===========================================================================

function extractText(res) {
  if (!res) return ''
  if (typeof res === 'string') return res
  if (typeof res.text === 'string') return res.text
  if (Array.isArray(res.choices) && res.choices[0] && res.choices[0].message) {
    const c = res.choices[0].message.content
    if (typeof c === 'string') return c
    if (Array.isArray(c)) return c.map((p) => p.text || '').join('')
  }
  if (typeof res.content === 'string') return res.content
  return ''
}

function getTagByKey(key) {
  return TAGS.find((t) => t.key === key) || null
}

function getTagByName(name) {
  return TAGS.find((t) => t.name === name) || null
}

// 读本地标签频次 { key: count }
function readTagFreq() {
  try {
    return wx.getStorageSync(LS_TAG_FREQ) || {}
  } catch (e) {
    return {}
  }
}

function writeTagFreq(freq) {
  try {
    wx.setStorageSync(LS_TAG_FREQ, freq || {})
  } catch (e) { /* 忽略 */ }
}

// 读忌口档案 { key: true }
function readDietProfile() {
  try {
    return wx.getStorageSync(LS_DIET) || {}
  } catch (e) {
    return {}
  }
}

function writeDietProfile(profile) {
  try {
    wx.setStorageSync(LS_DIET, profile || {})
  } catch (e) { /* 忽略 */ }
}

// 依据频次排序取前3个常用标签（无历史则取前3项默认）
function top3Tags() {
  const freq = readTagFreq()
  const sorted = TAGS.slice().sort((a, b) => (freq[b.key] || 0) - (freq[a.key] || 0))
  return sorted.slice(0, 3)
}

// 忌口档案 → 硬过滤注入用数组（key列表）
function dietProfileToKeys(profile) {
  return Object.keys(profile || {}).filter((k) => profile[k])
}

// 忌口档案 → 注入prompt文本
function dietProfileToText(profile) {
  const keys = dietProfileToKeys(profile)
  if (!keys.length) return ''
  const names = keys.map((k) => {
    const d = DIET_RESTRICTIONS.find((x) => x.key === k)
    return d ? d.name : k
  })
  return '忌口（硬过滤）：' + names.join('、')
}

// ===========================================================================
// Page
// ===========================================================================

Page({
  data: {
    pageTitle: '点餐助手',

    // ── 三屏状态机 ──
    screen: SCREEN.MENU,

    // ── 选单栏（规格 §二）──
    mealOptions: MEALS,
    meal: '午餐',
    mealIndex: 1,
    topTags: [],                 // 常用标签chip×3（动态频次排序）
    showPlusPanel: false,        // [+]面板展开
    allTags: TAGS,               // 全部13个标签

    // ── 已选小块（输入栏生成可删除小块）──
    chips: [],                   // [{ id, kind:'tag'|'portion'|'budget'|'extra', label, payload }]

    // ── 分量控件（规格 §三）──
    portionTypes: PORTION_TYPES,
    portions: { staple: 0, main: 0, snack: 0, drink_p: 0 },
    portionTotal: 0,             // 一餐合计（≤3 前端硬限制）

    // ── 预算控件（规格 §四）──
    budget: 50,                  // 人均预算（元），0-200 步进10
    budgetMin: 0,
    budgetMax: 200,
    budgetStep: 10,

    // ── 忌口（规格 §五）──
    showDietPanel: false,
    dietList: DIET_RESTRICTIONS,
    dietProfile: {},             // { key: true }
    dietCustom: '',              // 手输补充

    // ── 快速/详细切换（默认快速）──
    mode: 'fast',                // fast | deep

    // ── 语言选择 ──
    translateLang: 'zh_CN',

    // ── 加菜/已有食物输入 ──
    extraInput: '',

    // ── 自由输入框 ──
    userInput: '',

    // ── 会话与推荐 ──
    session: null,
    mealSession: null,           // recommend.js 的 mealSession 对象

    // ── 屏2 推荐结果 ──
    resultCards: [],             // [{ rank, name, score, reason, badge, dishId }]
    badgeExplain: '',            // 角标说明弹层内容
    showBadgeExplain: false,

    // ── 屏3 完整分析四段 ──
    fullAnalysis: { requirements: [], matches: [], params: [], limits: [] },

    // ── 停摆态 ──
    stalled: false,
    stallText: STALL_TEXT,

    // ── 加载态 ──
    loading: false,

    // ── [任务36] 保留字段：翻译/话术（不改动，仅保留兼容）──
    menuConfirmed: false,
    candidates: [],
    translating: false,
    translateResult: null,
    phraseText: '',
    phraseConfirmed: false,
    speaking: false,
    ttsFallbackText: '',
    yueTtsReady: false
  },

  // =========================================================================
  // 生命周期
  // =========================================================================

  onLoad() {
    // [任务36] 粤语播报通道就绪态
    this.setData({ yueTtsReady: false })

    // 读上次餐次作默认（仅默认值参考，不硬过滤）
    let meal = '午餐'
    try {
      const last = wx.getStorageSync(LS_MEAL)
      if (last && MEALS.indexOf(last) >= 0) meal = last
    } catch (e) { /* 忽略 */ }

    // 常用标签chip×3（动态频次排序）
    const topTags = top3Tags()

    // 忌口档案
    const dietProfile = readDietProfile()

    this.setData({
      meal,
      mealIndex: MEALS.indexOf(meal),
      topTags,
      dietProfile
    })

    // 进页即新会话（规格 §六 + 设计文档 U5：进点餐页=自动新会话）
    this.startNewMealSession()
  },

  // =========================================================================
  // 会话：进页即新会话（默认独立，不携带上一餐）
  // =========================================================================

  startNewMealSession() {
    const mealId = `meal_${Date.now()}`
    // 接 common/recommend.js createMealSession（默认独立）
    const mealSession = rec.createMealSession({ mealId })
    this.setData({
      mealSession,
      screen: SCREEN.MENU,
      chips: [],
      resultCards: [],
      fullAnalysis: { requirements: [], matches: [], params: [], limits: [] },
      stalled: false,
      userInput: '',
      extraInput: ''
    })
  },

  // 顶部"新的一餐"按钮 → 新建mealSession
  onNewMeal() {
    this.startNewMealSession()
    wx.showToast({ title: '已开启新的一餐', icon: 'none' })
  },

  // =========================================================================
  // 屏1：选单栏
  // =========================================================================

  // 餐切换（修正参考，不硬过滤）
  onMealChange(e) {
    const idx = Number(e.detail.value)
    const meal = MEALS[idx] || '午餐'
    this.setData({ mealIndex: idx, meal })
    try { wx.setStorageSync(LS_MEAL, meal) } catch (err) { /* 忽略 */ }
  },

  // 点常用标签chip
  onTapTag(e) {
    const key = e.currentTarget.dataset.key
    this.addTagChip(key)
  },

  // 展开/收起 [+] 面板
  togglePlusPanel() {
    this.setData({ showPlusPanel: !this.data.showPlusPanel })
  },

  // [+]面板内点标签
  onTapTagInPanel(e) {
    const key = e.currentTarget.dataset.key
    this.addTagChip(key)
  },

  // 添加标签小块（多选叠加）
  addTagChip(key) {
    const tag = getTagByKey(key)
    if (!tag) return
    // 去重：同标签不重复加
    if (this.data.chips.some((c) => c.kind === 'tag' && c.payload === key)) {
      wx.showToast({ title: '已选该标签', icon: 'none' })
      return
    }
    const chips = this.data.chips.concat([{
      id: `chip_tag_${key}_${Date.now()}`,
      kind: 'tag',
      label: tag.name,           // 块只显标签名
      payload: key
    }])
    this.setData({ chips })

    // 更新本地频次（用于常用标签动态排序）
    const freq = readTagFreq()
    freq[key] = (freq[key] || 0) + 1
    writeTagFreq(freq)
    this.setData({ topTags: top3Tags() })
  },

  // =========================================================================
  // 分量控件（规格 §三：四类各0-3，一餐合计≤3 前端硬限制）
  // =========================================================================

  onPortionChange(e) {
    const type = e.currentTarget.dataset.type
    const delta = Number(e.currentTarget.dataset.delta)
    const cur = this.data.portions[type] || 0
    const next = cur + delta
    if (next < 0 || next > 3) return

    // 合计≤3 前端硬限制
    const portions = Object.assign({}, this.data.portions, { [type]: next })
    const total = PORTION_TYPES.reduce((s, t) => s + (portions[t.key] || 0), 0)
    if (total > 3) {
      wx.showToast({ title: '一餐合计最多3道', icon: 'none' })
      return
    }

    this.setData({ portions, portionTotal: total })
    this.syncPortionChip()
  },

  // 分量 → 输入栏小块（合并为一个"点X道"块）
  syncPortionChip() {
    const p = this.data.portions
    const parts = PORTION_TYPES
      .filter((t) => (p[t.key] || 0) > 0)
      .map((t) => `${t.name}${p[t.key]}`)
    const total = PORTION_TYPES.reduce((s, t) => s + (p[t.key] || 0), 0)

    let chips = this.data.chips.filter((c) => c.kind !== 'portion')
    if (total > 0) {
      chips = chips.concat([{
        id: 'chip_portion',
        kind: 'portion',
        label: `点${total}道：${parts.join('、')}`,
        payload: Object.assign({}, p)
      }])
    }
    this.setData({ chips })
  },

  // =========================================================================
  // 预算控件（规格 §四：人均0-200 步进10，未说"严格"不硬过滤，只注入需求）
  // =========================================================================

  onBudgetChange(e) {
    const budget = Number(e.detail.value)
    this.setData({ budget })
    this.syncBudgetChip()
  },

  syncBudgetChip() {
    let chips = this.data.chips.filter((c) => c.kind !== 'budget')
    chips = chips.concat([{
      id: 'chip_budget',
      kind: 'budget',
      label: `预算：人均${this.data.budget}以内`,
      payload: this.data.budget
    }])
    this.setData({ chips })
  },

  // =========================================================================
  // 忌口管理（规格 §五：独立入口，存个人档案跨会话通用，每会话自动硬过滤）
  // =========================================================================

  openDietPanel() {
    this.setData({ showDietPanel: true })
  },

  closeDietPanel() {
    this.setData({ showDietPanel: false })
  },

  onToggleDiet(e) {
    const key = e.currentTarget.dataset.key
    const profile = Object.assign({}, this.data.dietProfile)
    profile[key] = !profile[key]
    if (!profile[key]) delete profile[key]
    this.setData({ dietProfile: profile })
    writeDietProfile(profile)
  },

  onDietCustomInput(e) {
    this.setData({ dietCustom: e.detail.value })
  },

  // 手输补充忌口 → 存入档案（以 custom_ 前缀）
  onAddDietCustom() {
    const text = (this.data.dietCustom || '').trim()
    if (!text) return
    const profile = Object.assign({}, this.data.dietProfile)
    profile[`custom_${text}`] = true
    this.setData({ dietProfile: profile, dietCustom: '' })
    writeDietProfile(profile)
    wx.showToast({ title: '已添加', icon: 'none' })
  },

  // =========================================================================
  // 快速/详细切换（默认快速，快速时注入"快速推荐"）
  // =========================================================================

  setFast() {
    this.setData({ mode: 'fast' })
  },

  setDeep() {
    this.setData({ mode: 'deep' })
  },

  // =========================================================================
  // 语言选择
  // =========================================================================

  onPickLang(e) {
    const lang = e.currentTarget.dataset.lang
    if (!LANG_LABEL[lang]) return
    this.setData({ translateLang: lang, phraseConfirmed: false })
  },

  // =========================================================================
  // 加菜/已有食物输入
  // =========================================================================

  onExtraInput(e) {
    this.setData({ extraInput: e.detail.value })
  },

  onConfirmExtra() {
    const text = (this.data.extraInput || '').trim()
    if (!text) return
    const chips = this.data.chips.concat([{
      id: `chip_extra_${Date.now()}`,
      kind: 'extra',
      label: `已有：${text}`,
      payload: text
    }])
    this.setData({ chips, extraInput: '' })
  },

  // =========================================================================
  // 输入栏小块删除
  // =========================================================================

  onRemoveChip(e) {
    const id = e.currentTarget.dataset.id
    const chip = this.data.chips.find((c) => c.id === id)
    let portions = this.data.portions
    if (chip && chip.kind === 'portion') {
      portions = { staple: 0, main: 0, snack: 0, drink_p: 0 }
    }
    const chips = this.data.chips.filter((c) => c.id !== id)
    const portionTotal = PORTION_TYPES.reduce((s, t) => s + (portions[t.key] || 0), 0)
    this.setData({ chips, portions, portionTotal })
  },

  // =========================================================================
  // 自由输入框
  // =========================================================================

  onUserInput(e) {
    this.setData({ userInput: e.detail.value })
  },

  // =========================================================================
  // 后台拼接 prompt（小块 → 需求文本）
  // =========================================================================

  buildRequirementText() {
    const parts = []

    // 餐次（修正参考，不硬过滤）
    parts.push(`餐次：${this.data.meal}`)

    // 标签 → 注入prompt文案（逐字以规格文档表格为准）
    this.data.chips
      .filter((c) => c.kind === 'tag')
      .forEach((c) => {
        const tag = getTagByKey(c.payload)
        if (tag) parts.push(tag.prompt)
      })

    // 分量 → 注入示例格式
    const p = this.data.portions
    const total = PORTION_TYPES.reduce((s, t) => s + (p[t.key] || 0), 0)
    if (total > 0) {
      const seg = PORTION_TYPES
        .filter((t) => (p[t.key] || 0) > 0)
        .map((t) => `${t.name}${p[t.key]}`)
      parts.push(`点${total}道：${seg.join('、')}`)
    }

    // 预算 → 注入（未说"严格"不硬过滤）
    if (this.data.chips.some((c) => c.kind === 'budget')) {
      parts.push(`预算人均${this.data.budget}以内`)
    }

    // 忌口 → 每会话自动作硬过滤注入（个人档案）
    const dietText = dietProfileToText(this.data.dietProfile)
    if (dietText) parts.push(dietText)

    // 加菜/已有食物
    this.data.chips
      .filter((c) => c.kind === 'extra')
      .forEach((c) => parts.push(`已有食物：${c.payload}`))

    // 快速模式 → 注入"快速推荐"
    if (this.data.mode === 'fast') parts.push('快速推荐')

    // 自由输入
    const ui = (this.data.userInput || '').trim()
    if (ui) parts.push(ui)

    return parts.join('；')
  },

  // =========================================================================
  // 屏1 → 屏2：发起推荐（接 common/recommend.js）
  // =========================================================================

  onSend() {
    if (this.data.loading) return

    const requirementText = this.buildRequirementText()

    // 零打字也可发送：有chip或有输入即可
    if (!this.data.chips.length && !(this.data.userInput || '').trim()) {
      wx.showToast({ title: '请先选择或输入', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    // 会话状态机推进：场景判定 → 需求收集 → 候选装载
    let mealSession = this.data.mealSession
    try {
      // 场景判定（以餐次+标签推断，简化：直接进入需求收集）
      rec.judgeScene(mealSession, this.data.meal)
      // 需求/约束收集（含忌口硬过滤）
      rec.collectRequirements(mealSession, {
        userRequirements: this.data.chips.map((c) => c.label),
        degreeWords: [],
        hardFilters: {
          allergens: dietProfileToKeys(this.data.dietProfile),
          diet: dietProfileToKeys(this.data.dietProfile),
          excluded: []
        }
      })
    } catch (e) {
      // 状态机异常不阻断，继续走推荐
      console.warn('会话状态推进异常', e)
    }

    // 候选装载：此处以空候选占位，真实候选由识别/菜单来源提供；
    // recommend() 内部会做规则层硬过滤。
    try {
      rec.loadCandidates(mealSession, mealSession.candidates || [])
    } catch (e) {
      console.warn('候选装载异常', e)
    }

    // 调用总编排 recommend（接网关）
    const gateway = {
      invoke: ({ mode, messages }) => {
        // 复用统一网关 callAI（不改网关，仅调用）
        return callAI(mode, messages)
      }
    }

    // db：本文件不直连DB，装配器所需 prompt/速查表由网关侧/云函数提供；
    // 此处以最小占位传入，缺表由 recommend 内部 tableGaps 返回并触发停摆。
    const db = {
      collection: () => ({
        where: () => ({ orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ data: [] }) }) }) }),
        add: () => Promise.resolve({})
      })
    }

    rec.recommend({
      session: mealSession,
      userInput: requirementText,
      gateway,
      db
    })
      .then((res) => {
        this.setData({ loading: false, mealSession: res.session })

        // 停摆态：tableGaps 非空 → 显示兜底文案 + 兜底结果
        if (res.tableGaps && res.tableGaps.length) {
          this.setData({
            stalled: true,
            screen: SCREEN.RESULT,
            resultCards: this.buildFallbackCards(res.firstStage)
          })
          return
        }

        // 正常：解析第一段结果 → 屏2卡片
        this.setData({
          stalled: false,
          screen: SCREEN.RESULT,
          resultCards: this.parseResultCards(res.firstStage)
        })
      })
      .catch((err) => {
        // 失败降级：停摆态兜底
        console.error('推荐失败', err)
        this.setData({
          loading: false,
          stalled: true,
          screen: SCREEN.RESULT,
          resultCards: this.buildFallbackCards(null)
        })
      })
  },

  // 解析推荐返回 → 屏2卡片（排名|菜名|分数|一句话理由|角标）
  parseResultCards(firstStage) {
    const text = extractText(firstStage)
    if (!text) return this.buildFallbackCards(null)

    let arr = null
    try {
      arr = JSON.parse(text)
    } catch (e) { arr = null }

    if (Array.isArray(arr)) {
      return arr.map((item, i) => ({
        rank: item.rank || i + 1,
        name: item.name || item.dish || '未命名',
        score: item.score != null ? item.score : '-',
        reason: item.reason || item.oneLine || '',
        badge: item.support || item.badge || '?',
        dishId: item.dishId || ''
      }))
    }

    // 纯文本降级：按行解析，容错
    return String(text).split('\n').filter(Boolean).map((line, i) => ({
      rank: i + 1,
      name: line,
      score: '-',
      reason: '',
      badge: '?',
      dishId: ''
    }))
  },

  // 停摆态兜底结果（简单推荐）
  buildFallbackCards(firstStage) {
    const text = extractText(firstStage)
    const cards = []
    if (text) {
      String(text).split('\n').filter(Boolean).slice(0, 5).forEach((line, i) => {
        cards.push({
          rank: i + 1,
          name: line,
          score: '-',
          reason: '简单推荐',
          badge: '⚠',
          dishId: ''
        })
      })
    }
    if (!cards.length) {
      cards.push({ rank: 1, name: '暂无推荐', score: '-', reason: '请补充信息后重试', badge: '⚠', dishId: '' })
    }
    return cards
  },

  // =========================================================================
  // 屏2：角标说明弹层（触碰弹固定三句说明）
  // =========================================================================

  onTapBadge(e) {
    const badge = e.currentTarget.dataset.badge
    this.setData({
      showBadgeExplain: true,
      badgeExplain: BADGE_EXPLAIN[badge] || BADGE_EXPLAIN['?']
    })
  },

  closeBadgeExplain() {
    this.setData({ showBadgeExplain: false })
  },

  // =========================================================================
  // 屏2 → 屏3：展开完整分析
  // =========================================================================

  onExpandAnalysis() {
    const mealSession = this.data.mealSession
    // 完整分析四段（需求清单/匹配结果/参数记录/局限声明）
    const full = {
      requirements: this.data.chips.map((c) => c.label),
      matches: this.data.resultCards.map((c) => `${c.rank}. ${c.name}（${c.score}）`),
      params: [
        `餐次：${this.data.meal}`,
        `模式：${this.data.mode === 'fast' ? '快速' : '详细'}`,
        `预算：人均${this.data.budget}以内`,
        `忌口：${dietProfileToText(this.data.dietProfile) || '无'}`
      ],
      limits: this.data.stalled
        ? [STALL_TEXT]
        : ['推荐结果基于当前候选清单与速查表，具体以实际菜单为准；成分与禁忌请以门店标注为准。']
    }

    // 接 recommend.js expandAnalysis（推进状态机）
    try {
      rec.expandAnalysis(mealSession, full)
    } catch (e) {
      console.warn('展开分析状态推进异常', e)
    }

    this.setData({ screen: SCREEN.ANALYSIS, fullAnalysis: full, mealSession })
  },

  // =========================================================================
  // 屏3：确认加入本餐 / 重新筛选
  // =========================================================================

  onConfirmAdd() {
    const mealSession = this.data.mealSession
    const db = {
      collection: () => ({
        add: () => Promise.resolve({})
      })
    }
    // 接 recommend.js confirmAndPersist（结果入 dish_profile，会话关闭）
    rec.confirmAndPersist(mealSession, db)
      .then(() => {
        wx.showToast({ title: '已加入本餐', icon: 'none' })
        this.startNewMealSession()
      })
      .catch((err) => {
        console.warn('入库失败', err)
        wx.showToast({ title: '已加入本餐', icon: 'none' })
        this.startNewMealSession()
      })
  },

  // 重新筛选：回第1屏，保留约束
  onRescreen() {
    this.setData({ screen: SCREEN.MENU, resultCards: [], stalled: false })
  },

  // =========================================================================
  // [任务36] 保留：翻译 / 话术 / 播报（不改动，仅保留兼容）
  // =========================================================================

  onMenuConfirmed(confirmedList) {
    this.setData({
      menuConfirmed: true,
      candidates: Array.isArray(confirmedList) ? confirmedList : []
    })
  },

  handleTranslate() {
    if (!this.data.menuConfirmed) {
      wx.showToast({ title: '请先确认菜单', icon: 'none' })
      return
    }
    this.setData({ translating: true })
    const fast = this.data.mode === 'fast'
    const messages = [
      { role: 'system', content: buildTranslateSystem(this.data.translateLang, fast) },
      { role: 'user', content: JSON.stringify(this.data.candidates) }
    ]
    callAI('translate', messages)
      .then((res) => {
        const text = extractText(res)
        this.setData({
          translating: false,
          translateResult: { list: parseTranslate(text, this.data.candidates), fallback: false }
        })
      })
      .catch(() => {
        this.setData({ translating: false, translateResult: { list: [], fallback: true } })
        wx.showToast({ title: '翻译失败，已展示原文', icon: 'none' })
      })
  },

  handleGenPhrase() {
    if (!this.data.candidates.length) {
      wx.showToast({ title: '请先确认候选', icon: 'none' })
      return
    }
    const messages = [
      { role: 'system', content: buildPhraseSystem(this.data.translateLang) },
      { role: 'user', content: JSON.stringify(this.data.candidates) }
    ]
    callAI('order_phrase', messages)
      .then((res) => {
        const text = extractText(res)
        const safe = phraseHonorsWhitelist(text, this.data.candidates)
        this.setData({
          phraseText: safe ? text : buildTemplatePhrase(this.data.candidates),
          phraseConfirmed: false,
          ttsFallbackText: ''
        })
      })
      .catch(() => {
        this.setData({
          phraseText: buildTemplatePhrase(this.data.candidates),
          phraseConfirmed: false,
          ttsFallbackText: ''
        })
      })
  },

  confirmPhrase() {
    if (!this.data.phraseText || !this.data.phraseText.trim()) {
      wx.showToast({ title: '话术为空', icon: 'none' })
      return
    }
    this.setData({ phraseConfirmed: true })
  },

  onPhraseEdit(e) {
    this.setData({ phraseText: e.detail.value, phraseConfirmed: false })
  },

  handleSpeakDisabled() {
    wx.showToast({ title: '语音功能即将上线', icon: 'none' })
  },

  handleSpeak() {
    if (!this.data.phraseConfirmed) {
      wx.showToast({ title: '请先确认话术', icon: 'none' })
      return
    }
    const lang = this.data.translateLang
    if (lang === 'yue') {
      if (!this.data.yueTtsReady) {
        wx.showToast({ title: '粤语播报即将支持', icon: 'none' })
        return
      }
      this.speakViaTencentTTS(this.data.phraseText)
      return
    }
    if (!WechatSI) {
      this.fallbackToText()
      return
    }
    this.setData({ speaking: true, ttsFallbackText: '' })
    WechatSI.textToSpeech({
      lang: lang === 'en_US' ? 'en_US' : 'zh_CN',
      tts: true,
      content: this.data.phraseText,
      success: (res) => {
        this.setData({ speaking: false })
        const audio = wx.createInnerAudioContext()
        audio.src = res.filename
        audio.play()
        this._audio = audio
      },
      fail: () => this.fallbackToText()
    })
  },

  speakViaTencentTTS(text) {
    this.setData({ speaking: true, ttsFallbackText: '' })
    wx.cloud.callFunction({
      name: 'ttsProxy',
      data: { text, lang: 'yue' },
      success: (res) => {
        const r = res.result || {}
        if (r.error || !r.audioUrl) {
          this.fallbackToText()
          return
        }
        this.setData({ speaking: false })
        const audio = wx.createInnerAudioContext()
        audio.src = r.audioUrl
        audio.play()
        this._audio = audio
      },
      fail: () => this.fallbackToText()
    })
  },

  fallbackToText() {
    this.setData({ speaking: false, ttsFallbackText: this.data.phraseText })
    wx.showToast({ title: '播报失败，请照文本念', icon: 'none' })
  }
})

// ── [任务36] 模块内辅助函数（保留）────────────────────────────────

function buildTranslateSystem(lang, fast) {
  return [
    'role: 菜单翻译',
    `目标语: ${LANG_LABEL[lang]}`,
    '硬约束:',
    '  - 只翻译给定清单内的菜名与标记，不得新增/删除/合并条目',
    '  - 过敏原/禁忌成分必须逐条对应译出，不得省略',
    '输出:',
    fast
      ? '  - 快速模式：仅返回 [{ "name": 原名, "translation": 译文 }]，不译长描述/营养'
      : '  - 深度模式：返回 [{ "name": 原名, "translation": 译文, "flag": 成分标记译文, "note": 备注 }]'
  ].join('\n')
}

function buildPhraseSystem(lang) {
  return [
    'role: 点餐话术生成',
    `目标语: ${LANG_LABEL[lang]}`,
    '硬约束:',
    '  - 生成的菜名只许来自已确认候选清单，不得增删、不得改写菜名、不得杜撰菜品',
    '  - 数量、口味备注以清单为准，不得臆造',
    '  - 不输出价格、不输出营养数值',
    '输出: 一段可直接对服务员说的口语化点餐要求'
  ].join('\n')
}

function parseTranslate(text, candidates) {
  try {
    const arr = JSON.parse(text)
    if (Array.isArray(arr)) return arr
  } catch (e) { /* 落到纯文本 */ }
  return String(text || '').split('\n').filter(Boolean).map((line, i) => ({
    name: (candidates[i] && candidates[i].name) || '',
    translation: line
  }))
}

function phraseHonorsWhitelist(text, candidates) {
  if (!text) return false
  const names = (candidates || []).map((c) => c.name).filter(Boolean)
  if (!names.length) return false
  return names.some((n) => text.indexOf(n) >= 0)
}

function buildTemplatePhrase(candidates) {
  const names = (candidates || []).map((c) =>
    c.count ? `${c.name}x${c.count}` : c.name
  ).filter(Boolean)
  return `麻烦点：${names.join('、')}。谢谢！`
}

=====【文档: pages/order/order.wxml 原文（任务39版，第2轮改造基座）】=====
<view class="order-page">
  <view class="title">{{pageTitle}}</view>

  <!-- 顶部：新的一餐（进页即新会话） -->
  <view class="top-bar">
    <button size="mini" bindtap="onNewMeal">新的一餐</button>
  </view>

  <!-- ==================== 屏1：选单栏 + 输入行 ==================== -->
  <block wx:if="{{screen === 1}}">

    <!-- 选单栏：默认 [餐:午餐▾] + 常用标签chip×3 + [+] -->
    <view class="menu-bar">
      <picker mode="selector" range="{{mealOptions}}" value="{{mealIndex}}" bindchange="onMealChange">
        <view class="meal-picker">餐:{{meal}}▾</view>
      </picker>

      <view class="chip-inline" wx:for="{{topTags}}" wx:key="key"
            data-key="{{item.key}}" bindtap="onTapTag">{{item.name}}</view>

      <view class="plus-btn" bindtap="togglePlusPanel">+</view>
    </view>

    <!-- [+]面板 -->
    <view class="plus-panel" wx:if="{{showPlusPanel}}">

      <!-- 更多标签（全部13个，平铺不分区） -->
      <view class="panel-section">
        <view class="panel-title">更多标签</view>
        <view class="tag-grid">
          <view class="tag-item" wx:for="{{allTags}}" wx:key="key"
                data-key="{{item.key}}" bindtap="onTapTagInPanel">{{item.name}}</view>
        </view>
      </view>

      <!-- 分量控件：四类各0-3，一餐合计≤3 -->
      <view class="panel-section">
        <view class="panel-title">分量（一餐合计≤3道，当前{{portionTotal}}道）</view>
        <view class="portion-row" wx:for="{{portionTypes}}" wx:key="key">
          <text class="portion-name">{{item.name}}</text>
          <button size="mini" data-type="{{item.key}}" data-delta="-1" bindtap="onPortionChange">-</button>
          <text class="portion-val">{{portions[item.key]}}</text>
          <button size="mini" data-type="{{item.key}}" data-delta="1" bindtap="onPortionChange">+</button>
        </view>
      </view>

      <!-- 预算控件：人均0-200 步进10 -->
      <view class="panel-section">
        <view class="panel-title">预算：人均{{budget}}元以内</view>
        <slider min="{{budgetMin}}" max="{{budgetMax}}" step="{{budgetStep}}"
                value="{{budget}}" bindchange="onBudgetChange" show-value />
      </view>

      <!-- 忌口管理入口 -->
      <view class="panel-section">
        <button size="mini" bindtap="openDietPanel">忌口管理</button>
      </view>

      <!-- 快速/详细切换（默认快速） -->
      <view class="panel-section">
        <view class="panel-title">分析模式</view>
        <button size="mini" bindtap="setFast" disabled="{{mode === 'fast'}}">⚡ 快速</button>
        <button size="mini" bindtap="setDeep" disabled="{{mode === 'deep'}}">🍽 详细</button>
      </view>

      <!-- 语言选择 -->
      <view class="panel-section">
        <view class="panel-title">语言</view>
        <view class="lang-bar">
          <view class="lang-item {{translateLang === 'zh_CN' ? 'active' : ''}}"
                data-lang="zh_CN" bindtap="onPickLang">普通话</view>
          <view class="lang-item {{translateLang === 'en_US' ? 'active' : ''}}"
                data-lang="en_US" bindtap="onPickLang">English</view>
          <view class="lang-item {{translateLang === 'yue' ? 'active' : ''}} {{!yueTtsReady ? 'disabled' : ''}}"
                data-lang="yue" bindtap="onPickLang">粤语<text wx:if="{{!yueTtsReady}}" class="badge">(播报即将支持)</text></view>
        </view>
      </view>

      <!-- 加菜/已有食物输入 -->
      <view class="panel-section">
        <view class="panel-title">加菜 / 已有食物</view>
        <input class="extra-input" value="{{extraInput}}" bindinput="onExtraInput"
               placeholder="如：已有一份米饭" />
        <button size="mini" bindtap="onConfirmExtra">添加</button>
      </view>

    </view>

    <!-- 输入栏：可删除小块（只显标签名/值） -->
    <view class="chip-box" wx:if="{{chips.length}}">
      <view class="chip" wx:for="{{chips}}" wx:key="id">
        <text class="chip-label">{{item.label}}</text>
        <text class="chip-del" data-id="{{item.id}}" bindtap="onRemoveChip">×</text>
      </view>
    </view>

    <!-- 自由输入框 -->
    <view class="input-row">
      <input class="user-input" value="{{userInput}}" bindinput="onUserInput"
             placeholder="补充要求（可选）" />
      <button class="send-btn" bindtap="onSend" disabled="{{loading}}">
        {{loading ? '推荐中…' : '发送'}}
      </button>
    </view>

  </block>

  <!-- ==================== 屏2：推荐结果卡片 ==================== -->
  <block wx:if="{{screen === 2}}">

    <!-- 停摆态：兜底文案 + 兜底结果 -->
    <view class="stall-box" wx:if="{{stalled}}">
      <text class="stall-text">{{stallText}}</text>
    </view>

    <view class="result-list">
      <view class="result-card" wx:for="{{resultCards}}" wx:key="rank">
        <text class="rc-rank">{{item.rank}}</text>
        <text class="rc-name">{{item.name}}</text>
        <text class="rc-score">{{item.score}}</text>
        <text class="rc-reason">{{item.reason}}</text>
        <text class="rc-badge" data-badge="{{item.badge}}" bindtap="onTapBadge">{{item.badge}}</text>
      </view>
    </view>

    <button class="expand-btn" bindtap="onExpandAnalysis">展开完整分析</button>

  </block>

  <!-- ==================== 屏3：完整分析四段 ==================== -->
  <block wx:if="{{screen === 3}}">

    <view class="analysis">
      <view class="seg">
        <view class="seg-title">需求清单</view>
        <view class="seg-item" wx:for="{{fullAnalysis.requirements}}" wx:key="index">{{item}}</view>
      </view>

      <view class="seg">
        <view class="seg-title">匹配结果</view>
        <view class="seg-item" wx:for="{{fullAnalysis.matches}}" wx:key="index">{{item}}</view>
      </view>

      <view class="seg">
        <view class="seg-title">参数记录</view>
        <view class="seg-item" wx:for="{{fullAnalysis.params}}" wx:key="index">{{item}}</view>
      </view>

      <view class="seg">
        <view class="seg-title">局限声明</view>
        <view class="seg-item" wx:for="{{fullAnalysis.limits}}" wx:key="index">{{item}}</view>
      </view>
    </view>

    <view class="analysis-actions">
      <button bindtap="onConfirmAdd">确认加入本餐</button>
      <button bindtap="onRescreen">重新筛选</button>
    </view>

  </block>

  <!-- ==================== 角标说明弹层（固定三句） ==================== -->
  <view class="modal-mask" wx:if="{{showBadgeExplain}}" bindtap="closeBadgeExplain">
    <view class="modal-box" catchtap="noop">
      <text class="modal-text">{{badgeExplain}}</text>
      <button size="mini" bindtap="closeBadgeExplain">关闭</button>
    </view>
  </view>

  <!-- ==================== 忌口弹层（15项 + 手输） ==================== -->
  <view class="modal-mask" wx:if="{{showDietPanel}}" bindtap="closeDietPanel">
    <view class="modal-box diet-box" catchtap="noop">
      <view class="modal-title">忌口管理</view>
      <view class="diet-list">
        <view class="diet-item" wx:for="{{dietList}}" wx:key="key"
              data-key="{{item.key}}" bindtap="onToggleDiet">
          <text class="diet-check">{{dietProfile[item.key] ? '☑' : '☐'}}</text>
          <text class="diet-name">{{item.name}}</text>
        </view>
      </view>
      <view class="diet-custom">
        <input class="diet-input" value="{{dietCustom}}" bindinput="onDietCustomInput"
               placeholder="手输补充忌口" />
        <button size="mini" bindtap="onAddDietCustom">添加</button>
      </view>
      <button size="mini" bindtap="closeDietPanel">完成</button>
    </view>
  </view>

</view>

=====【文档: pages/order/order.wxss 原文（任务39版，第2轮改造基座）】=====
.order-page {
  padding: 20rpx;
  font-size: 28rpx;
  color: #333;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
}

.top-bar {
  margin-bottom: 16rpx;
}

/* ── 选单栏 ── */
.menu-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #eee;
}

.meal-picker {
  padding: 8rpx 16rpx;
  border: 1rpx solid #ccc;
  border-radius: 8rpx;
  margin-right: 16rpx;
}

.chip-inline {
  padding: 8rpx 16rpx;
  margin-right: 12rpx;
  background: #f2f2f2;
  border-radius: 24rpx;
  font-size: 26rpx;
}

.plus-btn {
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  border: 1rpx dashed #999;
  border-radius: 50%;
  color: #666;
}

/* ── [+]面板 ── */
.plus-panel {
  padding: 16rpx;
  margin: 16rpx 0;
  background: #fafafa;
  border: 1rpx solid #eee;
  border-radius: 8rpx;
}

.panel-section {
  margin-bottom: 20rpx;
}

.panel-title {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 10rpx;
}

.tag-grid {
  display: flex;
  flex-wrap: wrap;
}

.tag-item {
  padding: 8rpx 16rpx;
  margin: 0 12rpx 12rpx 0;
  background: #fff;
  border: 1rpx solid #ccc;
  border-radius: 24rpx;
  font-size: 26rpx;
}

/* ── 分量控件 ── */
.portion-row {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}

.portion-name {
  width: 100rpx;
}

.portion-val {
  width: 60rpx;
  text-align: center;
}

/* ── 语言 ── */
.lang-bar {
  display: flex;
}

.lang-item {
  padding: 8rpx 16rpx;
  margin-right: 12rpx;
  border: 1rpx solid #ccc;
  border-radius: 8rpx;
  font-size: 26rpx;
}

.lang-item.active {
  background: #333;
  color: #fff;
}

.lang-item.disabled {
  color: #999;
  border-color: #e0e0e0;
}

.badge {
  font-size: 22rpx;
  color: #999;
}

/* ── 加菜输入 ── */
.extra-input {
  border: 1rpx solid #ccc;
  border-radius: 8rpx;
  padding: 8rpx 12rpx;
  margin-bottom: 10rpx;
}

/* ── 输入栏小块 ── */
.chip-box {
  display: flex;
  flex-wrap: wrap;
  margin: 16rpx 0;
}

.chip {
  display: flex;
  align-items: center;
  padding: 6rpx 12rpx;
  margin: 0 12rpx 12rpx 0;
  background: #eef;
  border-radius: 24rpx;
  font-size: 26rpx;
}

.chip-del {
  margin-left: 10rpx;
  color: #999;
}

/* ── 自由输入行 ── */
.input-row {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
}

.user-input {
  flex: 1;
  border: 1rpx solid #ccc;
  border-radius: 8rpx;
  padding: 10rpx 12rpx;
  margin-right: 12rpx;
}

.send-btn {
  font-size: 26rpx;
}

/* ── 停摆态 ── */
.stall-box {
  padding: 16rpx;
  margin-bottom: 16rpx;
  background: #fff7e6;
  border: 1rpx solid #ffd591;
  border-radius: 8rpx;
}

.stall-text {
  color: #ad6800;
}

/* ── 屏2 结果卡片 ── */
.result-list {
  margin: 16rpx 0;
}

.result-card {
  display: flex;
  align-items: center;
  padding: 16rpx;
  margin-bottom: 12rpx;
  border: 1rpx solid #eee;
  border-radius: 8rpx;
}

.rc-rank {
  width: 50rpx;
  color: #999;
}

.rc-name {
  flex: 2;
  font-weight: bold;
}

.rc-score {
  width: 90rpx;
  text-align: center;
  color: #666;
}

.rc-reason {
  flex: 3;
  font-size: 24rpx;
  color: #666;
  padding: 0 10rpx;
}

.rc-badge {
  width: 50rpx;
  text-align: center;
  font-size: 32rpx;
}

.expand-btn {
  margin-top: 16rpx;
}

/* ── 屏3 完整分析 ── */
.analysis {
  margin: 16rpx 0;
}

.seg {
  margin-bottom: 20rpx;
}

.seg-title {
  font-weight: bold;
  margin-bottom: 8rpx;
}

.seg-item {
  font-size: 26rpx;
  color: #555;
  padding: 4rpx 0;
}

.analysis-actions {
  display: flex;
  margin-top: 20rpx;
}

.analysis-actions button {
  flex: 1;
  margin: 0 8rpx;
}

/* ── 弹层 ── */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-box {
  width: 80%;
  max-height: 70%;
  overflow-y: auto;
  padding: 24rpx;
  background: #fff;
  border-radius: 12rpx;
}

.modal-title {
  font-weight: bold;
  margin-bottom: 16rpx;
}

.modal-text {
  display: block;
  margin-bottom: 16rpx;
  line-height: 1.6;
}

/* ── 忌口弹层 ── */
.diet-list {
  margin-bottom: 16rpx;
}

.diet-item {
  display: flex;
  align-items: center;
  padding: 8rpx 0;
}

.diet-check {
  width: 40rpx;
}

.diet-name {
  font-size: 26rpx;
}

.diet-custom {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.diet-input {
  flex: 1;
  border: 1rpx solid #ccc;
  border-radius: 8rpx;
  padding: 8rpx 12rpx;
  margin-right: 12rpx;
}

=====【文档: pages/index/index.js 原文（任务39版，第3轮改造基座）】=====
// [任务39-第2轮] 首页加"新的一餐"按钮（新建mealSession→跳点餐页新会话）+ 最近餐次入口列表
// 基座：任务34原生工程版；其余页面不动。

const gateway = require('../../common/gateway.js')
const rec = require('../../common/recommend.js')

Page({
  data: {
    pageTitle: '食知',
    recentMeals: []          // 最近餐次列表（读history数据）
  },

  onLoad() {
    this.loadRecentMeals()
  },

  onShow() {
    // 返回首页时刷新最近餐次
    this.loadRecentMeals()
  },

  // ── 新的一餐：新建mealSession → 跳转点餐页新会话 ──
  startNewMeal() {
    const mealId = `meal_${Date.now()}`
    try {
      // 新建独立会话（默认不携带上一餐）
      const session = rec.createMealSession({ mealId })
      // 暂存本次会话ID，供点餐页确认新会话
      wx.setStorageSync('pending_meal_session', session)
    } catch (e) {
      console.warn('新建mealSession异常', e)
    }
    wx.navigateTo({ url: '/pages/order/order?newMeal=1' })
  },

  // ── 最近餐次列表：读history数据（dish_profile）──
  loadRecentMeals() {
    const db = wx.cloud.database()
    db.collection('dish_profile')
      .orderBy('closedAt', 'desc')
      .limit(10)
      .get()
      .then((res) => {
        this.setData({ recentMeals: res.data || [] })
      })
      .catch((err) => {
        console.warn('读取最近餐次失败', err)
        this.setData({ recentMeals: [] })
      })
  },

  // 点最近餐次 → 跳历史页查看
  goMealDetail(e) {
    const mealId = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/history/history?mealId=${mealId}` })
  },

  // 拍照 → 上传云存储 → 待接 aiGateway recognize 模式(T2)
  handleCapture() {
    wx.chooseImage({
      count: 1,
      sourceType: ['camera', 'album'],
      success: (res) => {
        const filePath = res.tempFilePaths[0]
        wx.cloud.uploadFile({
          cloudPath: `recognize/${Date.now()}.jpg`,
          filePath,
          success: () => {
            wx.navigateTo({ url: '/pages/result/result?mode=recognize' })
          },
          fail: (err) => {
            console.error('上传云存储失败', err)
          }
        })
      }
    })
  },

  goResult(e) {
    const mode = e.currentTarget.dataset.mode
    wx.navigateTo({ url: `/pages/result/result?mode=${mode}` })
  }
})

=====【文档: pages/index/index.wxml 原文（任务39版，第3轮改造基座）】=====
<view class="page">
  <text class="page-title">{{pageTitle}}</text>

  <!-- [任务39] 新的一餐：新建mealSession → 跳点餐页新会话 -->
  <view class="new-meal-bar">
    <button bindtap="startNewMeal">新的一餐</button>
  </view>

  <!-- 视觉重点:拍照入口 -->
  <view class="primary-action">
    <button bindtap="handleCapture">拍照识别</button>
  </view>

  <!-- 三预设模板入口 -->
  <view class="templates">
    <button bindtap="goResult" data-mode="recognize">识图</button>
    <button bindtap="goResult" data-mode="copy">文案</button>
    <button bindtap="goResult" data-mode="nutrition">营养分析</button>
  </view>

  <!-- [任务39] 最近餐次入口列表（读history数据） -->
  <view class="recent-meals">
    <view class="section-title">最近餐次</view>
    <view wx:if="{{recentMeals.length === 0}}" class="empty">暂无记录</view>
    <view wx:else class="meal-list">
      <view class="meal-item" wx:for="{{recentMeals}}" wx:key="mealId"
            data-id="{{item.mealId}}" bindtap="goMealDetail">
        <text class="meal-scene">{{item.scene || '一餐'}}</text>
        <text class="meal-reqs">{{item.userRequirements}}</text>
      </view>
    </view>
  </view>

  <!-- 自由提问入口,退居二线 -->
  <view class="chat-entry">
    <text bindtap="goResult" data-mode="chat">自由提问</text>
  </view>
</view>

=====【文档: pages/history/history.js 原文（任务39版，第3轮改造基座）】=====
// [任务39-第2轮] 历史记录页：保留历次记录只读展示
// 基座：任务34原生工程版；只读，不含编辑操作。

Page({
  data: {
    pageTitle: '历史记录',
    records: [],
    loading: false
  },

  onLoad() {
    this.loadRecords()
  },

  // 读历次记录（dish_profile），只读展示
  loadRecords() {
    this.setData({ loading: true })
    const db = wx.cloud.database()
    db.collection('dish_profile')
      .orderBy('closedAt', 'desc')
      .limit(50)
      .get()
      .then((res) => {
        this.setData({ records: res.data || [], loading: false })
      })
      .catch((err) => {
        console.warn('读取历史记录失败', err)
        this.setData({ records: [], loading: false })
      })
  }
})

=====【文档: pages/history/history.wxml 原文（任务39版，第3轮改造基座）】=====
<view class="page">
  <text class="page-title">{{pageTitle}}</text>

  <view wx:if="{{loading}}" class="hint">加载中…</view>

  <view wx:elif="{{records.length === 0}}" class="empty">
    <text>暂无记录</text>
  </view>

  <view wx:else class="list">
    <view class="record-item" wx:for="{{records}}" wx:key="mealId">
      <view class="record-scene">{{item.scene || '一餐'}}</view>
      <view class="record-reqs">{{item.userRequirements}}</view>
      <view class="record-results">{{item.results}}</view>
    </view>
  </view>
</view>

=====【文档: app.json 原文（任务38语音剥离版，第3轮重声明插件块基座）】=====
{
  "pages": [
    "pages/index/index",
    "pages/result/result",
    "pages/history/history",
    "pages/profile/profile",
    "pages/order/order"
  ],
  "window": {
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "食知",
    "navigationBarBackgroundColor": "#FFFFFF",
    "backgroundColor": "#F7F7F7"
  },
  "cloud": true
}

=====【文档: pages/profile/profile.js 原文（任务34原生工程版，第3轮改造基座）】=====
Page({
  data: {
    pageTitle: '我的',
    bodyData: {
      height: '',
      weight: '',
      allergens: '',
      goal: ''
    }
  },

  goAuth() {
    // 逐项分层授权入口(见 v3 四章),具体措辞待 H6 确认
    wx.showToast({ title: '授权管理', icon: 'none' })
  }
})

=====【文档: app.js 原文（任务34原生工程版，第3轮改造基座）】=====
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      // ENV_ID：Walter 填写（微信开发者工具 → 云开发 → 环境ID）
      env: '',
      traceUser: true
    })
  }
})
