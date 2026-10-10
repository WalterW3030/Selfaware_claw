// common/recommend.js
// 饮食推荐系统 —— L0 会话层 + L1 装配层 实现
// 依据：推荐系统结构设计v1.0（文档1）/ 详细卡097（文档2）/ 快速卡098（文档3）
//       / 初始化prompt099（文档4）/ 路由头v2（文档5）/ aiGateway原文（文档6）
//       / 识图卡096（图像信息识别前置，文档7）
//
// 任务52配置外置：可配置项已移至 ./assets.config.js（清单部署副本，置于 miniprogram/common/ 同目录；母本 cloudfunctions/shared/assets.config.js）
//   PROMPT_INIT/CARD_DEEP/CARD_FAST/PROMPT_RECOGNIZE 四个常量改从清单 PROMPT_BINDINGS 角色绑定读取；
//   清单缺对应卡 → 报错列出缺项，不猜默认。
//
// 红线（与设计文档一致）：
//   1) prompt 全文禁止硬编码 —— 一律按版本号从 DB（prompt_assets）读取
//   2) 速查表按需拉取（ref_tables），不全量装载；缺表 → 如实报缺，不编造
//   3) 候选数值只来自营养库/dish_summary，模型不得自产数字（nutrition 红线）
//   4) 硬约束双保险：规则层前置过滤 + agent步骤2再过滤；不一致以规则层为准并记录
//
// 六项要求 → 实现位置：
//   ① mealSession 状态机            → §1 createMealSession / transition / 各阶段
//   ② prompt 装配器                 → §2 assemblePrompt / loadPrompt / loadTables
//   ③ 卡选择逻辑（默认097，显式"快速"才098） → §3 selectCard / cardToMode
//   ④ 无支持项查证二次独立调用编排   → §4 verifyUnsupportedItems
//   ⑤ 规则层硬过滤双保险             → §5 ruleLayerFilter / reconcileFilters
//   ⑥ 识图前置链（含图先识图，096）  → §6 recognizeImages / beginRecognizing
// ---------------------------------------------------------------------------

'use strict'

// ── 清单加载（任务52：可配置项外置）────────────────────────────────
const assetsConfig = require('./assets.config.js')

// 清单自检：不通过则拒绝执行（错误信息列出全部缺项，绝不猜默认值）
const _cfgCheck = assetsConfig.checkConfig()
if (!_cfgCheck.ok) {
  throw new Error(
    'assets.config.js 清单自检不通过，拒绝执行；缺项：' + _cfgCheck.missing.join('、')
  )
}

/** 按角色从清单取 prompt 资产 id：先查 PROMPT_BINDINGS 角色绑定，再查 EXPECTED_PROMPTS 资产行。
 *  缺绑定或缺资产行 → 报错列出缺项，不猜默认 */
function requirePromptRole(role) {
  const promptId = assetsConfig.PROMPT_BINDINGS && assetsConfig.PROMPT_BINDINGS[role]
  if (!promptId) {
    throw new Error('assets.config.js 清单缺 prompt 角色绑定：' + role + '（不猜默认）')
  }
  const hit = (assetsConfig.EXPECTED_PROMPTS || []).find((p) => p && p.promptId === promptId)
  if (!hit) {
    throw new Error('assets.config.js 清单缺 prompt 资产：' + promptId + '（' + role + ' 绑定指向，不猜默认）')
  }
  return { id: hit.promptId }
}

// ── 常量：prompt 资产（只存 ID，正文从 DB 读；任务52改从清单 PROMPT_BINDINGS 角色绑定读）──
const PROMPT_INIT = requirePromptRole('PROMPT_INIT')     // 每轮初始化 prompt（新链尾）
const CARD_DEEP   = requirePromptRole('CARD_DEEP')       // 详细卡（默认，新链尾）
const CARD_FAST   = requirePromptRole('CARD_FAST')       // 快速卡（仅显式"快速"，新链尾）
const PROMPT_RECOGNIZE = requirePromptRole('PROMPT_RECOGNIZE') // 识图任务卡（图像前置）

// 初始化块"将查的表"缺省集合（来自 099）
const DEFAULT_TABLES   = ['016', '020', '033', '051', '062']
// 支持度标注/查证（步骤4.5/4.6）所需表
const SUPPORT_TABLES   = ['058', '068']
// 机制原理表：仅用户质疑/需解释时查（常规推荐不引用）
const MECHANISM_TABLES = ['017', '026']

// ── 常量：卡 → 网关功能位 mode 映射（对应 aiGateway MODEL_MAP）───────
const CARD_TO_MODE = {
  [CARD_DEEP.id]: 'recommend_deep',
  [CARD_FAST.id]: 'recommend_fast'
}

// ── 常量：会话状态机 ──────────────────────────────────────────────
const SESSION_STATE = {
  CREATED:               'created',              // 新会话建立
  SCENE_JUDGED:          'scene_judged',          // 场景判定完成
  REQUIREMENTS_COLLECTED:'requirements_collected',// 需求/约束收集完成
  CANDIDATES_LOADED:     'candidates_loaded',     // 候选装载（规则层已过滤）
  RECOGNIZING:           'recognizing',           // 识图中（含图输入前置）
  RECOMMENDING:          'recommending',          // 卡管线推荐中
  TWO_STAGE_OUTPUT:      'two_stage_output',      // 两段式输出（第一段已出）
  CONFIRMED:             'confirmed',             // 用户确认，结果入库
  CLOSED:                'closed'                 // 会话关闭（只读）
}

const ALLOWED_TRANSITIONS = {
  [SESSION_STATE.CREATED]:                [SESSION_STATE.SCENE_JUDGED],
  [SESSION_STATE.SCENE_JUDGED]:           [SESSION_STATE.REQUIREMENTS_COLLECTED],
  // 需求收集完成：既可进候选装载，也可含图直接进识图（requirements_collected → recognizing）
  [SESSION_STATE.REQUIREMENTS_COLLECTED]: [SESSION_STATE.CANDIDATES_LOADED, SESSION_STATE.RECOGNIZING],
  // 候选装载完成：无图直接推荐；含图亦可转入识图（容错，兼容候选先装载的调用序）
  [SESSION_STATE.CANDIDATES_LOADED]:      [SESSION_STATE.RECOMMENDING, SESSION_STATE.RECOGNIZING],
  // 识图完成 → 推荐中（recognizing → recommending）
  [SESSION_STATE.RECOGNIZING]:            [SESSION_STATE.RECOMMENDING],
  [SESSION_STATE.RECOMMENDING]:           [SESSION_STATE.TWO_STAGE_OUTPUT],
  // 两段式后：可确认入库，或"重新筛选"回第1屏（保留约束）
  [SESSION_STATE.TWO_STAGE_OUTPUT]:       [SESSION_STATE.CONFIRMED, SESSION_STATE.REQUIREMENTS_COLLECTED],
  [SESSION_STATE.CONFIRMED]:              [SESSION_STATE.CLOSED],
  [SESSION_STATE.CLOSED]:                 []  // 只读，不可追加
}

// ===========================================================================
// §1 L0 会话层：mealSession 状态机
// ===========================================================================

/**
 * 新建一餐推荐会话。
 * 新餐 = 新会话，默认独立（不携带上一餐任何状态）；
 * 仅当用户显式声明"接着上一顿"（explicitContinue=true）且存在 prevSession 时，
 * 才按声明范围延续，并在会话中记录 continueFrom。
 */
function createMealSession({ mealId, prevSession = null, scene = null, explicitContinue = false } = {}) {
  const carry = !!(explicitContinue && prevSession)
  return {
    mealId,
    // 场景：显式延续才继承上一餐场景；否则进页判定
    scene: carry ? prevSession.scene : scene,
    userRequirements: carry ? [...(prevSession.userRequirements || [])] : [],
    degreeWords: [],           // 程度词（"不太/别太"）→ 排序因子
    hardFilters: {             // 规则层硬约束（双保险第一层数据源）
      allergens: [],
      diet: [],                // 素食/忌口等
      excluded: []             // 重选（已选过的 dishId）
    },
    candidates: [],            // 候选清单（含成分摘要与数值负荷）
    recognition: null,         // 识图记录（含图输入时填充；无图保持 null）
    stage: SESSION_STATE.CREATED,
    results: null,             // { stage1, full }
    // ---- 独立/延续记录 ----
    independent: !carry,
    continueFrom: carry ? prevSession.mealId : null
  }
}

/** 状态转移守卫：非法转移 / 已关闭会话 → 抛错 */
function advance(session, next) {
  if (session.stage === SESSION_STATE.CLOSED) {
    throw new Error('会话已关闭，只读，不可追加')
  }
  const allowed = ALLOWED_TRANSITIONS[session.stage] || []
  if (!allowed.includes(next)) {
    throw new Error(`非法状态转移: ${session.stage} → ${next}`)
  }
  session.stage = next
  return session
}

// —— 各阶段薄封装 ——
function judgeScene(session, scene) {
  session.scene = scene
  return advance(session, SESSION_STATE.SCENE_JUDGED)
}

function collectRequirements(session, { userRequirements = [], degreeWords = [], hardFilters = {} } = {}) {
  session.userRequirements = userRequirements
  session.degreeWords = degreeWords
  session.hardFilters = {
    allergens: hardFilters.allergens || [],
    diet: hardFilters.diet || [],
    excluded: hardFilters.excluded || []
  }
  return advance(session, SESSION_STATE.REQUIREMENTS_COLLECTED)
}

/** 装载候选：进装配前先过规则层硬过滤（双保险第一层，见 §5） */
function loadCandidates(session, rawCandidates) {
  session.candidates = ruleLayerFilter(rawCandidates, session.hardFilters)  // §5
  return advance(session, SESSION_STATE.CANDIDATES_LOADED)
}

/** 进入识图（含图输入前置）：→ recognizing */
function beginRecognizing(session) {
  return advance(session, SESSION_STATE.RECOGNIZING)
}

function beginRecommend(session) {
  return advance(session, SESSION_STATE.RECOMMENDING)
}

/** 第一段输出（结果摘要，非简化分析；两段共用同一后台分析） */
function startTwoStageOutput(session, stage1) {
  advance(session, SESSION_STATE.TWO_STAGE_OUTPUT)
  session.results = { stage1, full: null }
  return session
}

/** 第二段输出（用户选择"展开完整分析"后） */
function expandAnalysis(session, fullAnalysis) {
  if (session.stage !== SESSION_STATE.TWO_STAGE_OUTPUT) {
    throw new Error('必须先输出第一段，再展开完整分析')
  }
  session.results.full = fullAnalysis
  return session
}

/** 用户确认 → 结果写入该 meal（dish_profile），随后关闭 */
async function confirmAndPersist(session, db) {
  advance(session, SESSION_STATE.CONFIRMED)
  await db.collection('dish_profile').add({
    data: {
      mealId: session.mealId,
      scene: session.scene,
      userRequirements: session.userRequirements,
      degreeWords: session.degreeWords,
      results: session.results,
      independent: session.independent,
      continueFrom: session.continueFrom,
      closedAt: Date.now()
    }
  })
  return session
}

function closeSession(session) {
  return advance(session, SESSION_STATE.CLOSED)
}

// ===========================================================================
// §3 卡选择逻辑（作用：决定 prompt 用哪张卡 + 网关用哪个 mode）
// ===========================================================================

/**
 * 卡选择：默认详细卡097；仅当用户输入"显式含快速"才用快速卡098。
 * 否定式（"不快速/别快速/没快速"）不触发快速卡。
 */
function selectCard(userInput) {
  const text = String(userInput || '')
  // 显式"快速"口令，排除紧邻否定词
  const explicitFast = /(^|[^不别没])快速/.test(text)
  return explicitFast ? CARD_FAST : CARD_DEEP
}

/** 卡 → 网关功能位 mode */
function cardToMode(card) {
  if (!card || !card.id) throw new Error('cardToMode: card 为空或无 id')
  const mode = CARD_TO_MODE[card.id]
  // [任务48] 未知卡 id 如实报错（原行为：静默回退 recommend_deep，掩盖新增卡接线错误）
  if (!mode) throw new Error('cardToMode: 未知识图卡 id: ' + card.id)
  return mode
}

// ===========================================================================
// §2 L1 装配层：prompt 装配器
// ===========================================================================

/** 按版本号从 DB 读 prompt 正文（禁硬编码；缺资产不回退硬编码，直接报错） */
async function loadPrompt(db, promptId) {
  const r = await db.collection('prompt_assets')
    .where({ id: promptId, active: true })  // DB 存"当前生效版本"
    .orderBy('version', 'desc')
    .limit(1)
    .get()
  if (!r.data || !r.data.length) {
    // 依路由头1.11d：读到链中间文件沿链走到链尾——此处 DB 无生效版本→如实报缺
    throw new Error(`prompt 资产缺失: ${promptId}（禁止回退硬编码）`)
  }
  return r.data[0].content
}

/**
 * 按需拉取速查表。缺表 → 收集进 missing，不编造，交由上层声明缺口（合法停摆）。
 */
async function loadTables(db, tableNos) {
  const found = []
  const missing = []
  for (const no of tableNos) {
    const r = await db.collection('ref_tables')
      .where({ tableNo: no, active: true })
      .limit(1)
      .get()
    if (r.data && r.data.length) found.push(r.data[0])
    else missing.push(no)
  }
  return { found, missing }
}

/** 解析本轮"将查的表"：默认表 + 支持度表（+ 质疑时机制原理表） */
function resolveTableNos({ needMechanism = false } = {}) {
  const set = new Set(DEFAULT_TABLES)
  SUPPORT_TABLES.forEach((t) => set.add(t))          // 步骤4.5/4.6
  if (needMechanism) MECHANISM_TABLES.forEach((t) => set.add(t))
  return [...set]
}

/** 渲染速查表节选（含缺口声明——缺表时明确标注，供 agent 合法停摆） */
function renderTables({ found, missing }) {
  const parts = found.map((t) => `【速查表 ${t.tableNo}｜v${t.version || '-'}】\n${t.content}`)
  if (missing.length) {
    parts.push(
      `【速查表缺口声明】以下表在库缺失：${missing.join('、')}。` +
      `涉及未覆盖场景时按铁律停摆，不得凭记忆编造机制或稳定性。`
    )
  }
  return parts.join('\n\n')
}

/** 渲染候选清单：每项含成分摘要 + 数值负荷（数值只来自 dish_summary） */
function renderCandidates(candidates) {
  if (!candidates || !candidates.length) return '候选清单：（空）—— 无候选如实说，不凑数'
  const lines = candidates.map((c, i) => {
    const load = c.numericLoad && Object.keys(c.numericLoad).length
      ? Object.entries(c.numericLoad).map(([k, v]) => `${k}=${v}`).join('，')  // 菜单内相对量，不绝对化
      : '未标注'
    return `${i + 1}. ${c.name}｜成分摘要：${c.ingredientSummary || '缺'}｜` +
           `数值负荷：${load}｜支持度：${c.support || '待标注'}`
  })
  return '候选清单：\n' + lines.join('\n')
}

/**
 * 渲染 user content：用户输入原文（+ 含图时附加【识图记录】与处理规则）。
 * 识图记录为唯一图像信息来源——推荐 system prompt 不变，图片不再直接进入推荐调用。
 */
function buildUserBlock({ userInput, recognitionRecord = null }) {
  const parts = [`用户输入原文：${extractUserText(userInput)}`]

  if (recognitionRecord) {
    parts.push('【识图记录】')
    if (recognitionRecord.failed) {
      parts.push(recognitionRecord.text || '（识图失败，无记录）')
    } else {
      parts.push(recognitionRecord.text || '（识图记录为空）')
    }
    parts.push('【图像信息处理规则】')
    parts.push('- 识图记录为本轮唯一图像信息来源，推荐分析只引用记录清单内条目，不得自行识图或脑补；')
    parts.push('- 记录中标注"无法辨认"的条目按信息不足处理；忌口场景按含有处理；')
    parts.push('- 识图记录缺失或识图失败时，所有图像相关条目一律按信息不足处理，不得凭记忆补全。')
  }

  return parts.join('\n')
}

/**
 * 装配器主函数：按序拼装
 *  初始化prompt(099) + 当次卡(097/098) + 速查表相关节选 + 候选清单 + 用户输入原文(+识图记录)
 */
async function assemblePrompt({ session, userInput, db, needMechanism = false, recognitionRecord = null } = {}) {
  // 1) 初始化 prompt（按版本号从 DB 读）
  const initPrompt = await loadPrompt(db, PROMPT_INIT.id)

  // 2) 当次执行卡（卡选择依据用户文本；对象输入取 text 字段）
  const card = selectCard(extractUserText(userInput))
  const cardPrompt = await loadPrompt(db, card.id)

  // 3) 按"将查的表"声明按需拉取
  const tableNos = resolveTableNos({ needMechanism })
  const tableDocs = await loadTables(db, tableNos)
  const tableBlock = renderTables(tableDocs)

  // 4) 候选清单（含成分摘要与数值负荷）
  const candidateBlock = renderCandidates(session.candidates)

  // 5) 用户输入原文（含图时附加识图记录，图片不直接进入本调用）
  const userBlock = buildUserBlock({ userInput, recognitionRecord })

  return {
    card,                                  // 便于上层取 mode
    tableGaps: tableDocs.missing,          // 缺口清单，供上层声明停摆
    prompt: [initPrompt, cardPrompt, tableBlock, candidateBlock, userBlock]
      .join('\n\n---\n\n')
  }
}

// ===========================================================================
// §4 无支持项查证的二次独立调用编排（步骤4.6，同 mode，新开消息，不携带初稿）
// ===========================================================================

/**
 * 对每个标注"无支持"的推荐项，发起独立查证调用。
 * 关键：新开 messages 数组（绝不含初稿内容），与初稿隔离作答。
 * @param gateway { invoke({mode, messages}) } —— apiGateway 出口
 */
async function verifyUnsupportedItems({ gateway, mode, unsupportedItems = [], tableContext = '' } = {}) {
  const results = []
  for (const item of unsupportedItems) {
    // 全新消息，仅含查证问题与必要表节选；不携带初稿分析
    const messages = [
      {
        role: 'user',
        content:
          `查证以下推荐项的关键特性（口味强度/成分/禁忌/适用人群），` +
          `判断其是否符合各维度基本要求；通过→保留并附依据，未通过→判定移除。\n` +
          `待查证项：${typeof item === 'string' ? item : item.name}\n` +
          (tableContext ? `参考表节选：\n${tableContext}` : '')
      }
    ]
    const res = await gateway.invoke({ mode, messages })  // 同一 mode，新开消息
    results.push({ item, verdict: res })
  }
  return results
}

// ===========================================================================
// §5 双保险：规则层硬过滤 + 与 agent 结果比对（不一致以规则层为准并记录）
// ===========================================================================

/**
 * 规则层硬过滤（双保险第一层，进装配前执行）：
 *  - 过敏原命中 → 剔除
 *  - 忌口/素食命中 → 剔除
 *  - 重选（已选过）→ 剔除
 *  - 成分信息不足 → 按含有处理，移出（初始化prompt099 忌口前置过滤口径）
 */
function ruleLayerFilter(candidates = [], hardFilters = {}) {
  const { allergens = [], diet = [], excluded = [] } = hardFilters
  return candidates.filter((c) => {
    // 信息不足按含有处理
    if (!c.allergens) return false
    if (allergens.some((a) => (c.allergens || []).includes(a))) return false
    if (diet.some((d) => (c.tags || []).includes(d))) return false
    if (excluded.includes(c.dishId)) return false
    return true
  })
}

/**
 * 比对规则层与 agent 步骤2过滤结果；不一致 → 以规则层为准并记录冲突。
 */
function reconcileFilters(ruleLayerKept = [], agentLayerKept = []) {
  const ruleSet = new Set(ruleLayerKept.map((c) => c.dishId))
  const agentSet = new Set(agentLayerKept.map((c) => c.dishId))

  const onlyInAgent = agentLayerKept.filter((c) => !ruleSet.has(c.dishId))  // agent放过、规则层剔除
  const onlyInRule  = ruleLayerKept.filter((c) => !agentSet.has(c.dishId))  // 规则层保留、agent剔除
  const conflicts = [...onlyInAgent, ...onlyInRule]

  const log = conflicts.length
    ? [{ at: Date.now(), reconciledBy: 'rule_layer', conflicts: conflicts.map((c) => c.dishId) }]
    : []

  return {
    final: ruleLayerKept,     // 以规则层为准
    conflicts,
    reconciledBy: 'rule_layer',
    log
  }
}

// ===========================================================================
// §6 识图前置链（含图输入：先走 096 识图卡，产出【识图记录】作为唯一图像来源）
// ===========================================================================

/** 从 userInput 提取图片（image 字段 / 非空 images 数组） */
function extractImages(userInput) {
  if (!userInput || typeof userInput !== 'object') return []
  const imgs = []
  if (userInput.image) imgs.push(userInput.image)
  if (Array.isArray(userInput.images)) {
    userInput.images.forEach((x) => { if (x) imgs.push(x) })
  }
  return imgs
}

/** 是否含图输入 */
function hasImages(userInput) {
  return extractImages(userInput).length > 0
}

/** 取用户文本（字符串原样；对象取 text 字段） */
function extractUserText(userInput) {
  if (typeof userInput === 'string') return userInput
  if (userInput && typeof userInput === 'object') return String(userInput.text || '')
  return ''
}

/** 兼容多种返回结构的文本提取（联调以实测为准）。
 * [任务48] 已知结构→文本（可为空串）；未知/缺失结构→null（如实报缺，与合法空文本区分）。 */
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

/** 粗略统计识图记录条目数（按非空行计，供日志摘要） */
function countRecordEntries(text) {
  if (!text) return 0
  return String(text).split('\n').filter((l) => l.trim()).length
}

/**
 * 识图前置链：调用 recognize 功能位（aiGateway 既有 recognize 位；模型ID以网关 MODEL_MAP 为准，
 * 本层不改网关）。
 *  - system prompt = 096 卡全文 + 099 初始化块要求
 *  - user content   = 用户图片（原样透传）
 *  - 失败/异常 → 标记"识图失败"，按信息不足处理（依 096 铁律）
 *  - 结果写入 session.recognition，供推荐调用注入
 */
async function recognizeImages({ session, userInput, gateway, db } = {}) {
  console.log('[识图前置链] 进入识图前置链')
  const images = extractImages(userInput)

  let record
  // 从 DB 读 096 识图卡正文
  let recognizePrompt = ''
  try {
    recognizePrompt = await loadPrompt(db, PROMPT_RECOGNIZE.id)
  } catch (e) {
    // [任务48] 识图卡缺失=如实报缺：记 failed 并跳过网关调用（原行为：catch 后空 prompt 硬跑，静默降级）
    record = { failed: true, text: '【识图记录】识图卡缺失：' + (e && e.message ? e.message : String(e)) + '。按信息不足处理。', entries: 0 }
    session.recognition = record
    console.log('[识图前置链] 识图卡缺失，跳过识图调用: ' + (e && e.message ? e.message : String(e)))
    return record
  }

  try {
    const recognizeMessages = [
      { role: 'system', content: recognizePrompt + '\n\n---\n\n初始化块要求：输出须含【识图记录】标记，含图N主题、分区转录清单、符号计数、置信标注与遗漏声明。' },
      { role: 'user', content: [
        { type: 'text', text: '请识别以下图片，按096卡输出【识图记录】' },
        ...images.map((img) => ({ type: 'image_url', image_url: { url: img } }))
      ] }
    ]
    const res = await gateway.invoke({ mode: 'recognize', messages: recognizeMessages })
    const text = extractText(res)

    if (res && res.error) {
      record = { failed: true, text: '【识图记录】识图调用失败：' + JSON.stringify(res.error) + '。按信息不足处理。', entries: 0 }
    } else if (text === null) {
      // [任务48] 结构无法解析与合法空文本区分报缺
      record = { failed: true, text: '【识图记录】识图返回结构无法解析（无 choices/message/content/text 字段）。按信息不足处理。', entries: 0 }
    } else if (!text) {
      record = { failed: true, text: '【识图记录】识图返回为空。按信息不足处理。', entries: 0 }
    } else {
      record = { failed: false, text, entries: countRecordEntries(text) }
    }
  } catch (e) {
    record = { failed: true, text: '【识图记录】识图异常：' + String(e && e.message || e) + '。按信息不足处理。', entries: 0 }
  }

  session.recognition = record
  console.log('[识图前置链] 识图完成: failed=' + record.failed + ' entries=' + record.entries)
  return record
}

// ===========================================================================
// §7 总编排：把上面各层串成一次完整推荐
// ===========================================================================

async function recommend({ session, userInput, gateway, db, needMechanism = false } = {}) {
  // —— 双保险第一层：候选进装配前先规则层硬过滤（loadCandidates 已做，二次兜底）——
  session.candidates = ruleLayerFilter(session.candidates, session.hardFilters)

  // —— 识图前置链：含图输入先执行 096 识图卡 ——
  let recognitionRecord = null
  if (hasImages(userInput)) {
    beginRecognizing(session)
    recognitionRecord = await recognizeImages({ session, userInput, gateway, db })
  }

  // —— 装配（含图时注入识图记录） ——
  const { card, prompt, tableGaps } = await assemblePrompt({ session, userInput, db, needMechanism, recognitionRecord })
  const mode = cardToMode(card)

  console.log('[推荐调用] mode=' + mode + ' card=' + card.id + ' hasImages=' + !!hasImages(userInput))

  beginRecommend(session)

  // 缺表且影响本轮覆盖 → 仅装配器已内置缺口声明；上层据 tableGaps 决定停摆展示
  const res = await gateway.invoke({ mode, messages: [{ role: 'user', content: prompt }] })

  // —— 两段式：第一段默认输出（结果摘要）——
  startTwoStageOutput(session, res)

  console.log('[两段式] 第一段输出完成 mode=' + mode)

  // 返回结构供 UI 层（第2屏卡片 / 停摆态）使用
  return {
    session,
    mode,
    card: card.id,
    tableGaps,          // 非空 → UI 显示"先用简单推荐"+兜底排序
    firstStage: res     // 排名 | 候选 | 分数 | 一句话理由 + "展开完整分析"
  }
}

// ── 导出 ─────────────────────────────────────────────────────────
module.exports = {
  // 常量
  SESSION_STATE, PROMPT_INIT, CARD_DEEP, CARD_FAST, PROMPT_RECOGNIZE,
  // ① 会话状态机
  createMealSession, advance,
  judgeScene, collectRequirements, loadCandidates,
  beginRecognizing, beginRecommend, startTwoStageOutput, expandAnalysis,
  confirmAndPersist, closeSession,
  // ② 装配器
  assemblePrompt, loadPrompt, loadTables, resolveTableNos, renderTables, renderCandidates,
  buildUserBlock,
  // ③ 卡选择
  selectCard, cardToMode,
  // ④ 无支持项查证编排
  verifyUnsupportedItems,
  // ⑤ 双保险
  ruleLayerFilter, reconcileFilters,
  // ⑥ 识图前置链
  recognizeImages, hasImages, extractImages,
  // ⑦ 总编排
  recommend
}
