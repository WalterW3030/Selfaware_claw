// [任务42-第2轮] order页接入i18n与语音
// 依据：《多语言与语音方案.md》v1.0（设计依据）；《点餐页UI规格汇总_任务39输入.md》v1.3定稿（UI规格权威）
// 基座：任务39版 pages/order/order.js（第2轮改造基座）
// 红线：三屏状态机、推荐链路接线、硬约束逻辑逐字不动；只改显示层与新增语音交互。
// 语音（2026-10-04二次变更）：Walter指令语音降级为占位——语音输入/播报按钮点击统一toast
// 「语音功能即将上线」（走langPack三语key order.voice.soonToast），不接实际识别/合成调用。
// 框架保留：relayASR/relayTTS云函数骨架、接口层函数（uploadAndRecognize/speakViaRelayTTS）、
// 音色选择占位弹层全部保留，框架搭好即可；app.json维持不声明插件（个人主体不可用）。

const { callAI } = require('../../common/gateway.js')
const rec = require('../../common/recommend.js')
const i18n = require('../../utils/i18n.js')
const i18nBehavior = require('../../utils/i18nBehavior.js')
const opencc = require('../../utils/opencc.js')

// ── 语言标签（旧字段兼容，映射到 i18n 语言键）──
const LANG_LABEL = { zh_CN: '普通话', en_US: '英语', yue: '粤语' }

// ── [任务42] 语言按钮循环顺序：简体→繁体→English ──
const LANG_CYCLE = ['zh-Hans', 'zh-Hant', 'en']
const LANG_BTN_TEXT = { 'zh-Hans': '简', 'zh-Hant': '繁', 'en': 'En' }

// ── [任务42] 界面语言 → 腾讯云一句话识别引擎（2026-10-04变更：替代插件语种）──
const LANG_TO_ASR_ENGINE = { 'zh-Hans': '16k_zh', 'zh-Hant': '16k_yue', 'en': '16k_en' }
// ── [任务42] 界面语言 → 播报未配置文案（按语言分别 toast）──
const LANG_TTS_PENDING = { 'zh-Hans': '普通话播报即将上线', 'zh-Hant': '粤语播报即将上线', 'en': '英语播报即将上线' }
// ── [任务42] 界面语言 → 输出指令（简体不加）──
const LANG_TO_OUTPUT_INSTR = {
  'zh-Hans': '',
  'zh-Hant': '以繁體中文輸出全部內容',
  'en': 'Respond entirely in English'
}

// ── 规格文档 §一 标签体系（13项，注入prompt文案逐字以表格为准）──
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
// 餐次 → i18n key
const MEAL_KEYS = ['order.meal.breakfast', 'order.meal.lunch', 'order.meal.dinner', 'order.meal.lateNight', 'order.meal.afternoonTea']

// ── 规格文档 §三 分量控件四类 ──
const PORTION_TYPES = [
  { key: 'staple',  name: '主食', i18nKey: 'order.portion.staple' },
  { key: 'main',    name: '主菜', i18nKey: 'order.portion.main' },
  { key: 'snack',   name: '小吃', i18nKey: 'order.portion.snack' },
  { key: 'drink_p', name: '饮料', i18nKey: 'order.portion.drink' }
]

// ── 规格文档 §六 停摆态兜底文案（逐字）──
const STALL_TEXT = '这类情况我还没学会，先用简单推荐'

// ── 本地存储键 ──
const LS_TAG_FREQ = 'order_tag_freq'
const LS_DIET     = 'order_diet_profile'
const LS_MEAL     = 'order_last_meal'

// ── 三屏常量 ──
const SCREEN = { MENU: 1, RESULT: 2, ANALYSIS: 3 }

// ── 角标固定三句说明（逐字按Walter裁决原文）──
const BADGE_EXPLAIN = {
  '✓': '来自真实资料',
  '?': '结果基于真实资料推断，注意甄别',
  '⚠': '结果主要来自ai生成信息，注意甄别'
}
// 角标 → i18n key
const BADGE_I18N_KEY = {
  '✓': 'order.badge.real',
  '?': 'order.badge.inferred',
  '⚠': 'order.badge.ai'
}

// ===========================================================================
// 辅助函数
// ===========================================================================

// [任务48] 已知结构→文本（可为空串）；未知/缺失结构→null（如实报缺，调用方须按 null 处理，不得当合法空文本）
function extractText(res) {
  if (!res) return null
  if (typeof res === 'string') return res
  if (typeof res.text === 'string') return res.text
  if (Array.isArray(res.choices) && res.choices[0] && res.choices[0].message) {
    const c = res.choices[0].message.content
    if (typeof c === 'string') return c
    if (Array.isArray(c)) return c.map((p) => p.text || '').join('')
  }
  if (typeof res.content === 'string') return res.content
  return null
}

function getTagByKey(key) {
  return TAGS.find((t) => t.key === key) || null
}

function getTagByName(name) {
  return TAGS.find((t) => t.name === name) || null
}

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

function top3Tags() {
  const freq = readTagFreq()
  const sorted = TAGS.slice().sort((a, b) => (freq[b.key] || 0) - (freq[a.key] || 0))
  return sorted.slice(0, 3)
}

function dietProfileToKeys(profile) {
  return Object.keys(profile || {}).filter((k) => profile[k])
}

function dietProfileToText(profile) {
  const keys = dietProfileToKeys(profile)
  if (!keys.length) return ''
  const names = keys.map((k) => {
    const d = DIET_RESTRICTIONS.find((x) => x.key === k)
    return d ? d.name : k
  })
  return '忌口（硬过滤）：' + names.join('、')
}

// [任务42] 展示层繁体兜底：当前语言为繁体时，对模型返回文本过 opencc
function applyDisplayLang(text, lang) {
  if (!text) return text
  if (lang === 'zh-Hant') return opencc.toTraditional(String(text))
  return text
}

// ===========================================================================
// Page
// ===========================================================================

Page({
  behaviors: [i18nBehavior],

  data: {
    pageTitle: '点餐助手',

    // ── 三屏状态机 ──
    screen: SCREEN.MENU,

    // ── 选单栏（规格 §二）──
    mealOptions: MEALS,
    meal: '午餐',
    mealIndex: 1,
    topTags: [],
    showPlusPanel: false,
    allTags: TAGS,

    // ── [任务42] 语言按钮 ──
    langBtnText: '简',

    // ── 已选小块 ──
    chips: [],

    // ── 分量控件（规格 §三）──
    portionTypes: PORTION_TYPES,
    portions: { staple: 0, main: 0, snack: 0, drink_p: 0 },
    portionTotal: 0,

    // ── 预算控件（规格 §四）──
    budget: 50,
    budgetMin: 0,
    budgetMax: 200,
    budgetStep: 10,

    // ── 忌口（规格 §五）──
    showDietPanel: false,
    dietList: DIET_RESTRICTIONS,
    dietProfile: {},
    dietCustom: '',

    // ── 快速/详细切换 ──
    mode: 'fast',

    // ── 语言选择（旧字段兼容）──
    translateLang: 'zh_CN',

    // ── 加菜/已有食物输入 ──
    extraInput: '',

    // ── 自由输入框 ──
    userInput: '',

    // ── 会话与推荐 ──
    session: null,
    mealSession: null,

    // ── 屏2 推荐结果 ──
    resultCards: [],
    badgeExplain: '',
    showBadgeExplain: false,

    // ── 屏3 完整分析四段 ──
    fullAnalysis: { requirements: [], matches: [], params: [], limits: [] },

    // ── 停摆态 ──
    stalled: false,
    stallText: STALL_TEXT,

    // ── 加载态 ──
    loading: false,

    // ── [任务42] 语音输入 ──
    recording: false,

    // ── [任务42] 播报 ──
    speaking: false,

    // ── [任务42] 音色选择窗（占位弹层，仅"默认音色"一项）──
    showVoicePanel: false,
    voiceOptions: [{ key: 'default', name: '默认音色' }],
    voiceSelected: 'default',

    // ── [任务36] 保留字段（兼容）──
    menuConfirmed: false,
    candidates: [],
    translating: false,
    translateResult: null,
    phraseText: '',
    phraseConfirmed: false
  },

  // =========================================================================
  // 生命周期
  // =========================================================================

  onLoad() {
    let meal = '午餐'
    try {
      const last = wx.getStorageSync(LS_MEAL)
      if (last && MEALS.indexOf(last) >= 0) meal = last
    } catch (e) { /* 忽略 */ }

    const topTags = top3Tags()
    const dietProfile = readDietProfile()

    this.setData({
      meal,
      mealIndex: MEALS.indexOf(meal),
      topTags,
      dietProfile,
      langBtnText: LANG_BTN_TEXT[i18n.getLang()] || '简'
    })

    this.startNewMealSession()
  },

  // [任务42] 语言变更时刷新按钮文字与角标说明（其余由 i18nBehavior 处理）
  onLangChanged(lang) {
    this.setData({
      langBtnText: LANG_BTN_TEXT[lang] || '简',
      // 兼容旧字段
      translateLang: lang === 'en' ? 'en_US' : (lang === 'zh-Hant' ? 'yue' : 'zh_CN')
    })
  },

  // =========================================================================
  // 会话
  // =========================================================================

  startNewMealSession() {
    const mealId = `meal_${Date.now()}`
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

  onNewMeal() {
    this.startNewMealSession()
    wx.showToast({ title: i18n.t('order.newMealToast'), icon: 'none' })
  },

  // =========================================================================
  // 屏1：选单栏
  // =========================================================================

  onMealChange(e) {
    const idx = Number(e.detail.value)
    const meal = MEALS[idx] || '午餐'
    this.setData({ mealIndex: idx, meal })
    try { wx.setStorageSync(LS_MEAL, meal) } catch (err) { /* 忽略 */ }
  },

  onTapTag(e) {
    const key = e.currentTarget.dataset.key
    this.addTagChip(key)
  },

  togglePlusPanel() {
    this.setData({ showPlusPanel: !this.data.showPlusPanel })
  },

  onTapTagInPanel(e) {
    const key = e.currentTarget.dataset.key
    this.addTagChip(key)
  },

  addTagChip(key) {
    const tag = getTagByKey(key)
    if (!tag) return
    if (this.data.chips.some((c) => c.kind === 'tag' && c.payload === key)) {
      wx.showToast({ title: i18n.t('order.input.alreadyTagToast'), icon: 'none' })
      return
    }
    const chips = this.data.chips.concat([{
      id: `chip_tag_${key}_${Date.now()}`,
      kind: 'tag',
      label: tag.name,
      payload: key
    }])
    this.setData({ chips })

    const freq = readTagFreq()
    freq[key] = (freq[key] || 0) + 1
    writeTagFreq(freq)
    this.setData({ topTags: top3Tags() })
  },

  // =========================================================================
  // [任务42] 语言按钮：循环切换 简体→繁体→English
  // =========================================================================

  onTapLangBtn() {
    const cur = i18n.getLang()
    const idx = LANG_CYCLE.indexOf(cur)
    const next = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length]
    i18n.setLang(next)   // 写 storage + 全局广播
    this.onLangChanged(next)
  },

  // =========================================================================
  // 分量控件
  // =========================================================================

  onPortionChange(e) {
    const type = e.currentTarget.dataset.type
    const delta = Number(e.currentTarget.dataset.delta)
    const cur = this.data.portions[type] || 0
    const next = cur + delta
    if (next < 0 || next > 3) return

    const portions = Object.assign({}, this.data.portions, { [type]: next })
    const total = PORTION_TYPES.reduce((s, t) => s + (portions[t.key] || 0), 0)
    if (total > 3) {
      wx.showToast({ title: i18n.t('order.panel.portionLimitToast'), icon: 'none' })
      return
    }

    this.setData({ portions, portionTotal: total })
    this.syncPortionChip()
  },

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
  // 预算控件
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
  // 忌口管理
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

  onAddDietCustom() {
    const text = (this.data.dietCustom || '').trim()
    if (!text) return
    const profile = Object.assign({}, this.data.dietProfile)
    profile[`custom_${text}`] = true
    this.setData({ dietProfile: profile, dietCustom: '' })
    writeDietProfile(profile)
    wx.showToast({ title: i18n.t('order.dietPanel.addedToast'), icon: 'none' })
  },

  // =========================================================================
  // 快速/详细切换
  // =========================================================================

  setFast() {
    this.setData({ mode: 'fast' })
  },

  setDeep() {
    this.setData({ mode: 'deep' })
  },

  // =========================================================================
  // 语言选择（旧入口，兼容保留）
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
  // [任务42-2026-10-04二次变更] 语音输入按钮=占位：点击toast，不接实际识别
  // =========================================================================

  onMicStart() {
    wx.showToast({ title: i18n.t('order.voice.soonToast'), icon: 'none' })
  },

  onMicEnd() {
    // 占位：无录音进行，无需处理
  },

  // ── 接口层函数（框架保留，按钮未接线；配好密钥并接回按钮后即可用）──
  // 上传录音到云存储 → 云函数 relayASR 识别 → 识别文本入输入栏（可编辑）
  uploadAndRecognize(tempFilePath, engine) {
    wx.cloud.uploadFile({
      cloudPath: `asr/${Date.now()}-${Math.floor(Math.random() * 100000)}.mp3`,
      filePath: tempFilePath,
      success: (up) => {
        wx.cloud.callFunction({
          name: 'relayASR',
          data: { fileID: up.fileID, engine: engine, format: 'mp3' },
          success: (res) => {
            const r = (res && res.result) || {}
            if (r.error === 'asr_not_configured') {
              wx.showToast({ title: '语音输入即将上线', icon: 'none' })
              return
            }
            if (r.error || !r.text) {
              wx.showToast({ title: '识别失败，请重试', icon: 'none' })
              return
            }
            this.setData({ userInput: r.text })
          },
          fail: () => {
            wx.showToast({ title: '识别失败，请重试', icon: 'none' })
          }
        })
      },
      fail: () => {
        wx.showToast({ title: '识别失败，请重试', icon: 'none' })
      }
    })
  },

  // =========================================================================
  // 后台拼接 prompt（小块 → 需求文本）
  // =========================================================================

  buildRequirementText() {
    const parts = []

    parts.push(`餐次：${this.data.meal}`)

    this.data.chips
      .filter((c) => c.kind === 'tag')
      .forEach((c) => {
        const tag = getTagByKey(c.payload)
        if (tag) parts.push(tag.prompt)
      })

    const p = this.data.portions
    const total = PORTION_TYPES.reduce((s, t) => s + (p[t.key] || 0), 0)
    if (total > 0) {
      const seg = PORTION_TYPES
        .filter((t) => (p[t.key] || 0) > 0)
        .map((t) => `${t.name}${p[t.key]}`)
      parts.push(`点${total}道：${seg.join('、')}`)
    }

    if (this.data.chips.some((c) => c.kind === 'budget')) {
      parts.push(`预算人均${this.data.budget}以内`)
    }

    const dietText = dietProfileToText(this.data.dietProfile)
    if (dietText) parts.push(dietText)

    this.data.chips
      .filter((c) => c.kind === 'extra')
      .forEach((c) => parts.push(`已有食物：${c.payload}`))

    if (this.data.mode === 'fast') parts.push('快速推荐')

    const ui = (this.data.userInput || '').trim()
    if (ui) parts.push(ui)

    // [任务42] 模型输出语言：按当前界面语言追加输出指令（简体不加）
    const lang = i18n.getLang()
    const instr = LANG_TO_OUTPUT_INSTR[lang]
    if (instr) parts.push(instr)

    return parts.join('；')
  },

  // =========================================================================
  // 屏1 → 屏2：发起推荐
  // =========================================================================

  onSend() {
    if (this.data.loading) return

    const requirementText = this.buildRequirementText()

    if (!this.data.chips.length && !(this.data.userInput || '').trim()) {
      wx.showToast({ title: i18n.t('order.input.needSelectToast'), icon: 'none' })
      return
    }

    this.setData({ loading: true })

    let mealSession = this.data.mealSession
    try {
      rec.judgeScene(mealSession, this.data.meal)
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
      console.warn('会话状态推进异常', e)
    }

    try {
      rec.loadCandidates(mealSession, mealSession.candidates || [])
    } catch (e) {
      console.warn('候选装载异常', e)
    }

    const gateway = {
      invoke: ({ mode, messages }) => {
        return callAI(mode, messages)
      }
    }

    // [任务48] 真实云数据库（原恒空 stub 已废止：该 stub 硬编码"DB恒空"假设，使 loadTables/loadPrompt
    // 必得空、recommend 必 reject，推荐链永远走停摆兜底——属环境假设混入生产的最严重形态）
    let db = null
    try {
      db = wx.cloud.database()
    } catch (e) {
      console.error('云数据库未初始化，无法发起推荐', e)
    }
    if (!db) {
      this.setData({ loading: false })
      wx.showToast({ title: '云服务未就绪，请重启小程序', icon: 'none' })
      return
    }

    rec.recommend({
      session: mealSession,
      userInput: requirementText,
      gateway,
      db
    })
      .then((res) => {
        this.setData({ loading: false, mealSession: res.session })

        if (res.tableGaps && res.tableGaps.length) {
          this.setData({
            stalled: true,
            screen: SCREEN.RESULT,
            resultCards: this.buildFallbackCards(res.firstStage)
          })
          return
        }

        this.setData({
          stalled: false,
          screen: SCREEN.RESULT,
          resultCards: this.parseResultCards(res.firstStage)
        })
      })
      .catch((err) => {
        console.error('推荐失败', err)
        this.setData({
          loading: false,
          stalled: true,
          screen: SCREEN.RESULT,
          resultCards: this.buildFallbackCards(null)
        })
      })
  },

  // 解析推荐返回 → 屏2卡片（[任务42] 展示层繁体兜底）
  parseResultCards(firstStage) {
    const raw = extractText(firstStage)
    const lang = i18n.getLang()
    const text = applyDisplayLang(raw, lang)
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

    return String(text).split('\n').filter(Boolean).map((line, i) => ({
      rank: i + 1,
      name: line,
      score: '-',
      reason: '',
      badge: '?',
      dishId: ''
    }))
  },

  // 停摆态兜底结果（[任务42] 展示层繁体兜底）
  buildFallbackCards(firstStage) {
    const raw = extractText(firstStage)
    const lang = i18n.getLang()
    const text = applyDisplayLang(raw, lang)
    const cards = []
    if (text) {
      String(text).split('\n').filter(Boolean).slice(0, 5).forEach((line, i) => {
        cards.push({
          rank: i + 1,
          name: line,
          score: '-',
          reason: i18n.t('order.stall.fallbackReason'),
          badge: '⚠',
          dishId: ''
        })
      })
    }
    if (!cards.length) {
      cards.push({
        rank: 1,
        name: i18n.t('order.stall.noResult'),
        score: '-',
        reason: i18n.t('order.stall.retryHint'),
        badge: '⚠',
        dishId: ''
      })
    }
    return cards
  },

  // =========================================================================
  // 屏2：角标说明弹层
  // =========================================================================

  onTapBadge(e) {
    const badge = e.currentTarget.dataset.badge
    const key = BADGE_I18N_KEY[badge] || BADGE_I18N_KEY['?']
    this.setData({
      showBadgeExplain: true,
      badgeExplain: i18n.t(key)
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
    const lang = i18n.getLang()
    const modeText = this.data.mode === 'fast'
      ? i18n.t('order.param.modeFast')
      : i18n.t('order.param.modeDeep')
    const dietText = dietProfileToText(this.data.dietProfile) || i18n.t('order.param.dietNone')

    const full = {
      requirements: this.data.chips.map((c) => c.label),
      matches: this.data.resultCards.map((c) => `${c.rank}. ${c.name}（${c.score}）`),
      params: [
        i18n.t('order.param.meal').replace('{meal}', this.data.meal),
        i18n.t('order.param.mode').replace('{mode}', modeText),
        i18n.t('order.param.budget').replace('{amount}', String(this.data.budget)),
        i18n.t('order.param.diet').replace('{diet}', dietText)
      ],
      limits: this.data.stalled
        ? [i18n.t('order.stall.text')]
        : [i18n.t('order.limit.normal')]
    }

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
    // [任务48] 真实云数据库（原 no-op stub 已废止：写入静默丢失；且原 catch 弹成功 toast 掩盖失败）
    let db = null
    try {
      db = wx.cloud.database()
    } catch (e) {
      console.error('云数据库未初始化，无法写入', e)
    }
    if (!db) {
      wx.showToast({ title: '云服务未就绪，请重启小程序', icon: 'none' })
      return
    }
    rec.confirmAndPersist(mealSession, db)
      .then(() => {
        wx.showToast({ title: i18n.t('order.analysis.addedToast'), icon: 'none' })
        this.startNewMealSession()
      })
      .catch((err) => {
        // [任务48] 失败如实告知（原行为：失败也弹"已加入"）
        console.error('入库失败', err)
        wx.showToast({ title: i18n.t('order.analysis.addFailToast'), icon: 'none' })
      })
  },

  onRescreen() {
    this.setData({ screen: SCREEN.MENU, resultCards: [], stalled: false })
  },

  // =========================================================================
  // [任务42-2026-10-04二次变更] 播报按钮=占位：点击toast，不接实际合成
  // =========================================================================

  // 取当前界面语言版本的播报文本（屏3完整分析优先，否则用话术）
  buildSpeakText() {
    // 优先播报当前屏3的完整分析文本
    const fa = this.data.fullAnalysis
    if (fa && (fa.requirements.length || fa.matches.length)) {
      const segs = [
        i18n.t('order.analysis.requirements') + '：' + fa.requirements.join('、'),
        i18n.t('order.analysis.matches') + '：' + fa.matches.join('；')
      ]
      return segs.join('\n')
    }
    // 退回到话术文本
    return this.data.phraseText || ''
  },

  handleSpeak() {
    wx.showToast({ title: i18n.t('order.voice.soonToast'), icon: 'none' })
  },

  // ── 接口层函数（框架保留，按钮未接线；配好密钥并接回按钮后即可用）──
  // 云函数 relayTTS：未配置密钥返回 error=tts_not_configured，按语言 toast"即将上线"
  speakViaRelayTTS(text, lang) {
    this.setData({ speaking: true })
    wx.cloud.callFunction({
      name: 'relayTTS',
      data: { text: text, lang: lang },
      success: (res) => {
        const r = (res && res.result) || {}
        if (r.error === 'tts_not_configured') {
          this.setData({ speaking: false })
          wx.showToast({ title: LANG_TTS_PENDING[lang] || '语音播报即将上线', icon: 'none' })
          return
        }
        if (r.error || !r.audioBase64) {
          this.setData({ speaking: false })
          wx.showToast({ title: '播报失败，请稍后重试', icon: 'none' })
          return
        }
        // base64 音频写入本地临时文件后播放
        const fs = wx.getFileSystemManager()
        const filePath = `${wx.env.USER_DATA_PATH}/relay_tts_${Date.now()}.mp3`
        try {
          fs.writeFileSync(filePath, r.audioBase64, 'base64')
          this.setData({ speaking: false })
          const audio = wx.createInnerAudioContext()
          audio.src = filePath
          audio.play()
          this._audio = audio
        } catch (e) {
          this.setData({ speaking: false })
          wx.showToast({ title: '播报失败，请稍后重试', icon: 'none' })
        }
      },
      fail: () => {
        this.setData({ speaking: false })
        wx.showToast({ title: '播报失败，请稍后重试', icon: 'none' })
      }
    })
  },

  // =========================================================================
  // [任务42] 音色选择窗（占位弹层，仅"默认音色"一项，不可修改）
  // =========================================================================

  openVoicePanel() {
    this.setData({ showVoicePanel: true })
  },

  closeVoicePanel() {
    this.setData({ showVoicePanel: false })
  },

  onTapVoiceOption() {
    // 占位：仅"默认音色"，不可修改
    this.setData({ voiceSelected: 'default' })
  },

  // =========================================================================
  // [任务36] 保留：翻译 / 话术（不改动，仅保留兼容）
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
          phraseConfirmed: false
        })
      })
      .catch(() => {
        this.setData({
          phraseText: buildTemplatePhrase(this.data.candidates),
          phraseConfirmed: false
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
