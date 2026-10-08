// 食知 AI 网关云函数（T2 / 2.2+2.3）
// 职责：六功能位统一出口，密钥零硬编码。
// 通道：extend（extend.AI 托管，默认）/ selfhost（自备 OpenAI 兼容端点，环境变量存在才启用）。
// 依赖：wx-server-sdk >= 4.0.1（cloud.ai() 需此版本起）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const ai = cloud.ai()

// ── 功能位配置（严格按《第一部分总结报告》§四 定稿表）──────────────
// mode: recognize | copy | nutrition | order_fast | order_deep | chat | translate | order_phrase
//       + recommend_fast | recommend_deep            ← 【任务37】新增两位（推荐系统）
// channel: 'extend'（默认托管通道）
// 备选：为某功能位切 selfhost，把该行 channel 改 'selfhost' 并配 model，
//       同时确保环境变量 SELFHOST_BASE_URL / SELFHOST_API_KEY 已配（见 callSelfhost 守卫）。
// thinking（原档位说明）：'off' | 'low' | 'medium'
// 【任务40，2026-09-29】cloudbase通道不支持thinking参数，思考档位仅selfhost通道生效。
// 各功能位原 thinking 档保留为行内注释说明（设计意图档位），调用时一律不下发。
const MODEL_MAP = {
  recognize:  { channel: 'extend', model: 'deepseek-v4-flash' /* thinking: 'off' — 注释说明位，调用时不下发 */ },
  copy:       { channel: 'extend', model: 'hy3'                              },
  nutrition:  { channel: 'extend', model: 'hy3'                              },
  order_fast: { channel: 'extend', model: 'deepseek-v4-flash' /* thinking: 'off' — 注释说明位，调用时不下发 */ },
  order_deep: { channel: 'extend', model: 'deepseek-v4-flash' /* thinking: 'medium' — 注释说明位，调用时不下发 */ },
  chat:       { channel: 'extend', model: 'deepseek-v4-flash' /* thinking: 'low' — 注释说明位，调用时不下发 */ },
  // ── [任务36] 新增两个功能位：菜单翻译 / 点餐话术生成，均走 hy3、extend 通道 ──
  translate:    { channel: 'extend', model: 'hy3'                              },
  order_phrase: { channel: 'extend', model: 'hy3'                              },

  // ── 【任务37】新增：推荐两位（对齐 common/recommend.js 的 cardToMode 映射）──
  // 快速卡080 → recommend_fast：设计意图 low（推理任务禁 off，见详细卡079/快速卡080）
  recommend_fast: { channel: 'extend', model: 'deepseek-v4-flash' /* thinking: 'low' — 注释说明位，调用时不下发 */ },
  // 详细卡079 → recommend_deep：默认设计意图 medium；复杂个案可上探 'high'
  //   （上探方式：将该行 thinking 临时改 'high' 并恢复下发逻辑，或调用侧显式覆盖；
  //    常规个案保持 medium，勿默认上探以控成本）
  recommend_deep: { channel: 'extend', model: 'deepseek-v4-flash' /* thinking: 'medium' — 注释说明位，调用时不下发 */ }
}

// ── 思考档位 → API 字段映射 ────────────────────────────────────────
function buildThinking(thinking) {
  if (!thinking) return null
  if (thinking === 'off') return { type: 'disabled' }
  return { type: 'enabled', effort: thinking }
}

// ── selfhost 通道是否可用（默认关闭：两个环境变量都在才启用）──────
function selfhostReady() {
  return !!(process.env.SELFHOST_BASE_URL && process.env.SELFHOST_API_KEY)
}

// ── extend.AI 通道调用 ────────────────────────────────────────────
// 图片以 base64 进 messages（前端组装），云函数原样透传，不落盘、不入包。
async function callExtend(cfg, messages) {
  const model = ai.createModel('cloudbase')
  const data = { model: cfg.model, messages }
  // 【任务40，2026-09-29】cloudbase通道不支持thinking参数，思考档位仅selfhost通道生效。
  // 以下两行原 thinking 注入已注释：往 generateText 的 data 里塞 thinking 字段
  // 会被 CloudBase 模型接口拒绝（云端实测 mode=chat 返回 400；429 阶段已验证
  // 路由到模型本身正常，400 与模型名无关）。buildThinking 保留备用。
  // const thinking = buildThinking(cfg.thinking)
  // if (thinking) data.thinking = thinking
  try {
    return await model.generateText(data)
  } catch (err) {
    // 【任务45】诊断增强：带出上游响应体，便于云端排查 400 真实原因
    let detail
    if (err && err.response) {
      detail = `status=${err.response.status} body=${JSON.stringify(err.response.data || {})}`.slice(0, 500)
    } else {
      detail = String((err && err.message) || err).slice(0, 500)
    }
    const wrapped = new Error(detail)
    wrapped.originalError = err
    throw wrapped
  }
}

// ── selfhost 通道调用（OpenAI 兼容端点，如百炼/硅基流动）───────────
// 仅在环境变量存在时被选择到；key 只读环境变量，永不硬编码。
async function callSelfhost(cfg, messages) {
  if (!selfhostReady()) {
    return { error: 'selfhost_not_configured',
             note: '未配置 SELFHOST_BASE_URL / SELFHOST_API_KEY，无法走自备通道' }
  }
  const base = process.env.SELFHOST_BASE_URL.replace(/\/+$/, '')
  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SELFHOST_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: cfg.model, messages, stream: false })
  })
  return resp.json()
}

// ── 通道分派（extend 优先且为默认；selfhost 仅当配置就绪且被显式指定）──
async function dispatch(cfg, messages) {
  if (cfg.channel === 'selfhost') {
    if (!selfhostReady()) {
      // 环境变量缺失时回退 extend，保证主线不被备选通道阻塞
      return callExtend({ ...cfg, channel: 'extend' }, messages)
    }
    return callSelfhost(cfg, messages)
  }
  return callExtend(cfg, messages)
}

// ── 返回文本提取（兼容多种返回结构，联调以实测为准）────────────────
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

// ── 红线：营养模式数字泄漏拦截 ────────────────────────────────────
const NUMERIC_LEAK = /\d+(\.\d+)?\s*(kcal|千卡|大卡|千焦|kj|克|g|mg|微克|ug|μg)/i
function hasNumericLeak(text) {
  return NUMERIC_LEAK.test(text || '')
}

// ── 入口 ─────────────────────────────────────────────────────────
exports.main = async (event) => {
  const { mode, messages } = event || {}
  let cfg = MODEL_MAP[mode]
  if (!cfg) {
    return { error: 'unknown_mode', mode }
  }

  // 【任务45】event.model 覆盖：非空字符串时，本次调用用 event.model 替换该 mode 的 model（仅本次，不改配置）
  if (typeof event.model === 'string' && event.model.trim()) {
    cfg = { ...cfg, model: event.model.trim() }
  }

  let res
  try {
    res = await dispatch(cfg, messages)
  } catch (err) {
    return { error: 'upstream_error', mode, detail: String((err && err.message) || err) }
  }

  if (res && res.error) return res  // 通道级错误直接透传（如 selfhost_not_configured）

  if (mode === 'nutrition' && !event.allowNumbers) {
    const text = extractText(res)
    if (hasNumericLeak(text)) {
      return {
        error: 'numeric_leak_blocked',
        note: '营养数值必须来自数据库，模型输出数字被拦截'
      }
    }
  }

  // [任务36] 说明：translate / order_phrase 走默认分支透传，不触发数字泄漏红线
  // （order_phrase 的价格/营养“不输出”由前端 prompt 约束 + 前端白名单校验承担，见 order.js）

  return res
}
