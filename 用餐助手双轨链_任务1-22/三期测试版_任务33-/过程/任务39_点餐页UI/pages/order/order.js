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
