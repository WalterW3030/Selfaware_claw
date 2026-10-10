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

// ── ② EXPECTED_TABLES 九项（取值与 importRefTables 现状逐字一致）──────
// 匹配顺序：精确 fileName（basename === fileName，大小写敏感）优先
//           → 无则数字段模糊匹配兜底（fileMatchesTableNo，非数字边界精确切分）
//           → 再不中如实报缺并列出缺项（不编造）。
// 051/062/058/068 带精确 fileName（R 系列文件名不含表号，数字段模糊匹配认不出）；
// 016/020/033/017/026 无 fileName，按数字段模糊匹配兜底。
const EXPECTED_TABLES = [
  { tableNo: '016', title: '口味负荷速查表' },
  { tableNo: '020', title: '场景速查表' },
  { tableNo: '033', title: '稳定性判定' },
  { tableNo: '051', title: '辣度标注惯例', fileName: '辣度标注惯例_R8.md' },
  { tableNo: '062', title: '通用维度底线', fileName: '通用维度底线表_R9.md' },
  { tableNo: '058', title: '口味搭配方法', fileName: '口味搭配方法_R3.md' },
  { tableNo: '068', title: '情景速查表',   fileName: '情景速查表_R7.md' },
  { tableNo: '017', title: '机制原理' },
  { tableNo: '026', title: '机制原理' }
]

// EXPECTED_TABLES 必备项数（自检基准）
const REQUIRED_TABLE_COUNT = 9

// ── ③ EXPECTED_PROMPTS 四项（取值与 importRefTables 现状逐字一致）────
// 匹配顺序：basename === fileName 精确匹配（大小写敏感），多张命中取字典序第一张。
// 云存储默认目录 prompt_assets。
const EXPECTED_PROMPTS = [
  { promptId: 'AGT-0924-w8n-096', title: '识图任务执行卡',            fileName: '识图任务执行卡-AGT-0924-w8n-096.md' },
  { promptId: 'AGT-0924-w8n-097', title: '详细推荐执行卡',            fileName: '详细推荐执行卡-AGT-0924-w8n-097.md' },
  { promptId: 'AGT-0924-w8n-098', title: '快速推荐执行卡',            fileName: '快速推荐执行卡-AGT-0924-w8n-098.md' },
  { promptId: 'AGT-0924-w8n-099', title: '饮食推荐agent初始化prompt', fileName: '饮食推荐agent初始化prompt-AGT-0924-w8n-099.md' }
]

// EXPECTED_PROMPTS 必备项数（自检基准）
const REQUIRED_PROMPT_COUNT = 4

// ── ③b PROMPT_BINDINGS：角色 → promptId（recommend.js 四常量改从本绑定读）──
// 换卡 = 改本处指向的 promptId + EXPECTED_PROMPTS 对应行 fileName，recommend.js 一行不动。
const PROMPT_BINDINGS = {
  PROMPT_INIT:      'AGT-0924-w8n-099', // 每轮初始化 prompt
  CARD_DEEP:        'AGT-0924-w8n-097', // 详细卡（默认，新链尾）
  CARD_FAST:        'AGT-0924-w8n-098', // 快速卡（仅显式"快速"）
  PROMPT_RECOGNIZE: 'AGT-0924-w8n-096'  // 识图任务卡（图像前置）
}

// PROMPT_BINDINGS 必备角色（自检基准）
const REQUIRED_PROMPT_ROLES = ['PROMPT_INIT', 'CARD_DEEP', 'CARD_FAST', 'PROMPT_RECOGNIZE']

// ── ④ 通道默认值 ─────────────────────────────────────────────────
const DEFAULT_CHANNEL = 'extend'          // 默认托管通道
const DEFAULT_DIR = 'ref_tables'          // 速查表云存储约定目录
const DEFAULT_PROMPT_DIR = 'prompt_assets' // prompt 资产云存储约定目录

// ── 清单自检函数 ─────────────────────────────────────────────────
// 校验 MODEL_MAP 六位齐全 / EXPECTED_TABLES 九项 / EXPECTED_PROMPTS 四项。
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
  checkConfig
}
