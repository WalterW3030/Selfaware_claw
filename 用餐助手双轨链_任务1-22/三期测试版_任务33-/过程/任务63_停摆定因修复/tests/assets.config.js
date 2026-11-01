// cloudfunctions/shared/assets.config.js
// 任务52配置外置：可配置项已移至本清单（母本在 cloudfunctions/shared/）
// 单一配置清单（CommonJS 导出，三消费方共用：aiGateway / importRefTables / common/recommend）
//
// 部署模型（2026-10-10 复核裁决，依据 devtools 单函数打包实测）：
//   微信开发者工具按单个函数文件夹打包上传，跨目录 require('../shared/...') 在云端不存在，
//   必然 Cannot find module。故三消费方一律 require('./assets.config.js')，
//   部署前置动作 = 把本母本复制一份到各消费方同目录：
//     cloudfunctions/aiGateway/assets.config.js
//     cloudfunctions/importRefTables/assets.config.js
//     common/assets.config.js（前端件，miniprogram 包内路径）
//   四处必须同版本（部署前 diff 校验，见 配置变更操作说明.md §四）。
//
// 铁律：本文件是唯一可配置源。更新模型或参考文件时只改本文件（及三处副本同步），不得改脚本。
//       清单自检不通过 → 调用方报错拒绝执行并列出全部缺项，绝不猜默认值。

'use strict'

// ── ① MODEL_MAP 六位（取值与 aiGateway 现状逐字一致）────────────────
// mode: recognize | order_fast | order_deep | chat | recommend_fast | recommend_deep
// channel: 'extend'（默认托管通道）/ 'selfhost'（自备 OpenAI 兼容端点）
// 注：thinking 档位为设计意图说明，调用时一律不下发（cloudbase 通道不支持）。
const MODEL_MAP = {
  recognize:      { channel: 'extend', model: 'deepseek/deepseek-flash' },
  order_fast:     { channel: 'extend', model: 'deepseek/deepseek-flash' },
  order_deep:     { channel: 'extend', model: 'deepseek/deepseek-flash' },
  chat:           { channel: 'extend', model: 'deepseek/deepseek-flash' },
  recommend_fast: { channel: 'extend', model: 'deepseek/deepseek-flash' },
  recommend_deep: { channel: 'extend', model: 'deepseek/deepseek-flash' }
}

// MODEL_MAP 必备位（自检基准）
const REQUIRED_MODES = [
  'recognize', 'order_fast', 'order_deep',
  'chat', 'recommend_fast', 'recommend_deep'
]

// ── ② EXPECTED_TABLES 九项（任务55：各加 nameSeg 固定名称段，编号不参与匹配）──
// 匹配规则（任务55改造，importRefTables）：basename 是否包含 nameSeg 判定命中，编号完全不参与。
// 多文件命中同名段 → 不猜，进 missing 并注明"多命中歧义"+命中列表。
// nameSeg 逐字取自 Walter 卡链指令（2026-10-13），017/026 映射锚=部署台账.md
// 第35行（Good2Eat prompts/ 实际文件名：味相互作用原理_017、机制原理手册_026）。
// fileName 字段保留为来源登记（任务50 R系列精确名），不再参与匹配。
const EXPECTED_TABLES = [
  { tableNo: '016', title: '口味负荷速查表', nameSeg: '口味负荷速查表' },
  { tableNo: '020', title: '场景速查表',     nameSeg: '场景速查表' },
  { tableNo: '033', title: '稳定性判定',     nameSeg: '菜品稳定性判定' },
  { tableNo: '051', title: '辣度标注惯例',   nameSeg: '辣度标注惯例',   fileName: '辣度标注惯例_R8.md' },
  { tableNo: '062', title: '通用维度底线',   nameSeg: '通用维度底线表', fileName: '通用维度底线表_R9.md' },
  { tableNo: '058', title: '口味搭配方法',   nameSeg: '口味搭配方法',   fileName: '口味搭配方法_R3.md' },
  { tableNo: '068', title: '情景速查表',     nameSeg: '情景速查表',     fileName: '情景速查表_R7.md' },
  { tableNo: '017', title: '机制原理',       nameSeg: '味相互作用原理' },
  { tableNo: '026', title: '机制原理',       nameSeg: '机制原理手册' }
]

// EXPECTED_TABLES 必备项数（自检基准）
const REQUIRED_TABLE_COUNT = 9

// ── ③ EXPECTED_PROMPTS 五项（任务55：卡链108-112，各含 nameSeg 固定名称段）──
// 匹配规则（任务55改造，importRefTables）：basename 是否包含 nameSeg 判定命中，编号不参与。
// fileName = 附件送达原始文件名逐字（修复指令 2026-10-14，kimi 群派发）；
// 卡标题 nameSeg 逐字取自五卡 H1（结论/执行卡_108-112/ 副本 SHA 与附件一致）。
// 云存储默认目录 prompt_assets。
const EXPECTED_PROMPTS = [
  { promptId: 'AGT-0924-w8n-108', title: '详细推荐执行卡',            nameSeg: '详细推荐执行卡',            fileName: '详细推荐执行卡-AGT-0924-w8n-108.md' },
  { promptId: 'AGT-0924-w8n-109', title: '快速推荐执行卡',            nameSeg: '快速推荐执行卡',            fileName: '快速推荐执行卡-AGT-0924-w8n-109.md' },
  { promptId: 'AGT-0924-w8n-110', title: '识图任务执行卡',            nameSeg: '识图任务执行卡',            fileName: '识图任务执行卡-AGT-0924-w8n-110.md' },
  { promptId: 'AGT-0924-w8n-111', title: '饮食百科任务执行卡',        nameSeg: '饮食百科任务执行卡',        fileName: '饮食百科任务执行卡-AGT-0924-w8n-111.md' },
  { promptId: 'AGT-0924-w8n-112', title: '饮食推荐agent初始化prompt', nameSeg: '饮食推荐agent初始化prompt', fileName: '饮食推荐agent初始化prompt-AGT-0924-w8n-112.md' }
]

// EXPECTED_PROMPTS 必备项数（自检基准）
const REQUIRED_PROMPT_COUNT = 5

// ── ③b PROMPT_BINDINGS：角色 → promptId（recommend.js 常量改从本绑定读）──
// 换卡 = 改本处指向的 promptId + EXPECTED_PROMPTS 对应行，recommend.js 一行不动。
// 任务55新链：INIT=112 / DEEP=108（默认）/ FAST=109（显式"快速"）/ RECOGNIZE=110（图像前置）/ WIKI=111（百科记录分析）
const PROMPT_BINDINGS = {
  PROMPT_INIT:      'AGT-0924-w8n-112', // 每轮初始化 prompt
  CARD_DEEP:        'AGT-0924-w8n-108', // 详细卡（默认卡）
  CARD_FAST:        'AGT-0924-w8n-109', // 快速卡（仅显式"快速"）
  PROMPT_RECOGNIZE: 'AGT-0924-w8n-110', // 识图任务卡（图像前置，先行）
  CARD_WIKI:        'AGT-0924-w8n-111'  // 百科任务卡（记录/分析/为什么搭，无快速模式）
}

// PROMPT_BINDINGS 必备角色（自检基准）
const REQUIRED_PROMPT_ROLES = ['PROMPT_INIT', 'CARD_DEEP', 'CARD_FAST', 'PROMPT_RECOGNIZE', 'CARD_WIKI']

// ── ④ 通道默认值 ─────────────────────────────────────────────────
const DEFAULT_CHANNEL = 'extend'          // 默认托管通道
const DEFAULT_DIR = 'ref_tables'          // 速查表云存储约定目录
const DEFAULT_PROMPT_DIR = 'prompt_assets' // prompt 资产云存储约定目录

// ── ⑤ 云环境 ID（任务53新增）────────────────────────────────────
// 用途：importRefTables 的 manager-node 列目录/下载需要 envId；云端实测存在
//       getWXContext().ENV 与 TCB_ENV 均拿不到的环境（裸 manager.init({}) 报
//       [DescribeEnvInfo] EnvId is required），故清单显式兜底。
// 取值：Walter 云环境 ID（从其云存储文件完整路径 cloud://cloud1-d6giun5fd1af7fe74.636c-… 实证）。
// 语义：非空字符串 → resolveEnvId 第一优先；空字符串/空白 → 自动降级走运行时
//       上下文与 TCB_ENV，不阻断执行（本项不入 checkConfig 必填）。
const ENV_ID = 'cloud1-d6giun5fd1af7fe74'

// ── ⑥ PERSONA 角色定位（任务54新增）────────────────────────────
// 用途：aiGateway 的 mode==='chat' 在 messages 头部注入 system 角色定位
//       （Walter 实测 mode=chat 问自我介绍，模型答 deepseek——chat 位原样透传无角色注入）。
// 铁律：chat_system 非空 → 注入；缺失/空白 → 按群规则拒绝本次 chat 调用并点名缺项
//       （只拒 chat 位，不拖垮其他 mode，故不入 checkConfig 全局必填）。
// 长度：全文 ≤ 80 字。换人设 = 改本处一处，四处副本同步。
const PERSONA = {
  chat_system: '你是食知小程序的用餐助手，由Walter团队开发，帮用户记录每餐、看懂搭配，按速查表给点餐建议。'
}

// ── ⑦ HEALTH_NOTICE 医疗健康免责声明（任务56新增，Walter 2026-10-13 定稿指令）──
// 用途：aiGateway 返回出口按双保险规则计算 health_notice 结构化标记字段；
//       前端检测到 true 时在对话框下方独立一行显示声明文本（不折叠、不拼进模型输出）。
// 双保险OR关系：①推荐链结果（recommend_deep/recommend_fast）一律标记；
//               ②其他输出（chat等）用宽口径关键词表扫描结果文本，命中即标记。
// 判别门槛：允许多判（非医疗出声明可以），杜绝少判（医疗相关必须有）。
// 铁律：声明文本与关键词表唯一来源 = 本清单（禁硬编码），脚本零字面量。
const HEALTH_NOTICE = {
  enabled: true, // 机制总开关（false = 全链关闭，网关返回 false，前端不显示）
  text: '以上内容为AI生成，仅供点餐参考，不能替代医生诊疗意见，请以医嘱为准。',
  keywords: [
    '忌口', '过敏', '疾病', '症状', '血糖', '血压', '糖尿病',
    '孕妇', '哺乳', '医嘱', '治疗', '营养', '慢病', '吃药', '药物', '清淡', '养胃'
  ]
}

// ── 清单自检函数 ─────────────────────────────────────────────────
// 校验 MODEL_MAP 六位齐全 / EXPECTED_TABLES 九项（含 nameSeg）/ EXPECTED_PROMPTS 五项（含 nameSeg）。
// 通过 → { ok: true, missing: [] }
// 不通过 → { ok: false, missing: [...] }（列出全部缺项，供调用方报错拒绝执行）
function checkConfig() {
  const missing = []

  // ① MODEL_MAP 六位齐全
  for (const mode of REQUIRED_MODES) {
    const cfg = MODEL_MAP[mode]
    if (!cfg || typeof cfg !== 'object') {
      missing.push(`MODEL_MAP.${mode}`)
      continue
    }
    if (!cfg.channel) missing.push(`MODEL_MAP.${mode}.channel`)
    if (!cfg.model)   missing.push(`MODEL_MAP.${mode}.model`)
  }

  // ② EXPECTED_TABLES 九项
  if (!Array.isArray(EXPECTED_TABLES) || EXPECTED_TABLES.length < REQUIRED_TABLE_COUNT) {
    missing.push(`EXPECTED_TABLES（应有 ${REQUIRED_TABLE_COUNT} 项，实得 ` +
      `${Array.isArray(EXPECTED_TABLES) ? EXPECTED_TABLES.length : 0} 项）`)
  } else {
    EXPECTED_TABLES.forEach((t, i) => {
      if (!t || !t.tableNo) missing.push(`EXPECTED_TABLES[${i}].tableNo`)
      if (!t || !t.title)   missing.push(`EXPECTED_TABLES[${i}].title`)
      // 任务55：nameSeg 为命中匹配的唯一依据，缺失即报缺（不猜默认段）
      if (!t || typeof t.nameSeg !== 'string' || t.nameSeg.trim() === '') {
        missing.push(`EXPECTED_TABLES[${i}].nameSeg`)
      }
    })
  }

  // ③ EXPECTED_PROMPTS 四项
  if (!Array.isArray(EXPECTED_PROMPTS) || EXPECTED_PROMPTS.length < REQUIRED_PROMPT_COUNT) {
    missing.push(`EXPECTED_PROMPTS（应有 ${REQUIRED_PROMPT_COUNT} 项，实得 ` +
      `${Array.isArray(EXPECTED_PROMPTS) ? EXPECTED_PROMPTS.length : 0} 项）`)
  } else {
    EXPECTED_PROMPTS.forEach((p, i) => {
      if (!p || !p.promptId) missing.push(`EXPECTED_PROMPTS[${i}].promptId`)
      if (!p || !p.title)    missing.push(`EXPECTED_PROMPTS[${i}].title`)
      if (!p || !p.fileName) missing.push(`EXPECTED_PROMPTS[${i}].fileName`)
      // 任务55：nameSeg 为命中匹配的唯一依据，缺失即报缺（不猜默认段）
      if (!p || typeof p.nameSeg !== 'string' || p.nameSeg.trim() === '') {
        missing.push(`EXPECTED_PROMPTS[${i}].nameSeg`)
      }
    })
  }

  // ③b PROMPT_BINDINGS 角色绑定齐全，且各绑定指向必须存在于 EXPECTED_PROMPTS
  const promptIdSet = new Set((Array.isArray(EXPECTED_PROMPTS) ? EXPECTED_PROMPTS : []).map((p) => p && p.promptId))
  for (const role of REQUIRED_PROMPT_ROLES) {
    const pid = PROMPT_BINDINGS[role]
    if (!pid) {
      missing.push(`PROMPT_BINDINGS.${role}`)
    } else if (!promptIdSet.has(pid)) {
      missing.push(`PROMPT_BINDINGS.${role}→${pid}（EXPECTED_PROMPTS 无此卡）`)
    }
  }

  // ⑦ HEALTH_NOTICE 段（任务56）：声明文本 + 关键词表 + 开关
  if (!HEALTH_NOTICE || typeof HEALTH_NOTICE !== 'object') {
    missing.push('HEALTH_NOTICE')
  } else {
    if (HEALTH_NOTICE.enabled !== true && HEALTH_NOTICE.enabled !== false) {
      missing.push('HEALTH_NOTICE.enabled（必须是布尔值）')
    }
    if (typeof HEALTH_NOTICE.text !== 'string' || HEALTH_NOTICE.text.trim() === '') {
      missing.push('HEALTH_NOTICE.text（声明文本，非空字符串）')
    }
    if (!Array.isArray(HEALTH_NOTICE.keywords) || HEALTH_NOTICE.keywords.length === 0) {
      missing.push('HEALTH_NOTICE.keywords（关键词表，至少一项）')
    } else {
      HEALTH_NOTICE.keywords.forEach((k, i) => {
        if (typeof k !== 'string' || k.trim() === '') {
          missing.push(`HEALTH_NOTICE.keywords[${i}]（非空字符串）`)
        }
      })
    }
  }

  return { ok: missing.length === 0, missing }
}

// ── 导出 ─────────────────────────────────────────────────────────
module.exports = {
  MODEL_MAP,
  REQUIRED_MODES,
  EXPECTED_TABLES,
  REQUIRED_TABLE_COUNT,
  EXPECTED_PROMPTS,
  REQUIRED_PROMPT_COUNT,
  PROMPT_BINDINGS,
  REQUIRED_PROMPT_ROLES,
  DEFAULT_CHANNEL,
  DEFAULT_DIR,
  DEFAULT_PROMPT_DIR,
  ENV_ID,
  PERSONA,
  HEALTH_NOTICE,
  checkConfig
}
