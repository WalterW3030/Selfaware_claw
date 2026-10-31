// 食知 AI 网关云函数（T2 / 2.2+2.3）
// 职责：六功能位统一出口，密钥零硬编码。
// 通道：extend（extend.AI 托管，默认）/ selfhost（自备 OpenAI 兼容端点，环境变量存在才启用）。
// 依赖：wx-server-sdk >= 4.0.1（cloud.ai() 需此版本起）
//
// 任务52配置外置：可配置项已移至 ./assets.config.js（清单部署副本，随本函数目录上传；母本 cloudfunctions/shared/assets.config.js）
//   MODEL_MAP 与通道默认值改从清单读；清单加载自检不通过 → 报错拒绝执行，列出全部缺项，绝不猜默认值。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const ai = cloud.ai()

// ── 清单加载（任务52：可配置项外置）────────────────────────────────
const assetsConfig = require('./assets.config.js')
const MODEL_MAP = assetsConfig.MODEL_MAP
const DEFAULT_CHANNEL = assetsConfig.DEFAULT_CHANNEL
const PERSONA = assetsConfig.PERSONA
const IMAGE_MAX_BYTES = assetsConfig.IMAGE_MAX_BYTES

// 清单自检：不通过则拒绝执行（错误信息列出全部缺项，绝不猜默认值）
const _cfgCheck = assetsConfig.checkConfig()
if (!_cfgCheck.ok) {
  throw new Error(
    'assets.config.js 清单自检不通过，拒绝执行；缺项：' + _cfgCheck.missing.join('、')
  )
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
// 【任务51，2026-10-09】model 归一化（Walter 指令）：不带 "/" 且以 deepseek 开头的值，
// 调用 extend 前自动补 "deepseek/" provider 前缀（Walter 实测控制台实名 deepseek/deepseek-flash，
// 防旧写法侧漏再触发 400）。hy3、已带前缀等其余值原样透传；selfhost 通道不归一化（端点命名自理）。
function normalizeDeepseekModel(model) {
  if (typeof model === 'string' && model.indexOf('/') < 0 && /^deepseek/i.test(model)) {
    return 'deepseek/' + model
  }
  return model
}

// ── cloud:// 图址转换（任务61识图链贯通，2026-11-01）────────────────
// 背景：CloudBase 多模态 image_url 仅接受公网 http(s) 直链或 base64 DataURL，
//       cloud:// 不在合法形态内（docs.cloudbase.net/ai/model/multimodal，2026-11-01 检索；
//       非 DataURL 会被判 invalid image_url）。
// 做法：image_url 块 url 以 cloud:// 开头者 → cloud.downloadFile 取 Buffer（fileContent）→
//       大小闸（清单 IMAGE_MAX_BYTES，依据官方 base64 单张建议 ≤5MB）→ 按扩展名定 mime →
//       替换为 data URL 后再发 generateText。http(s)/data:image 原样放行；其余形态显式报错。
const IMAGE_MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif'
}

function guessImageMime(fileID) {
  const lower = String(fileID).toLowerCase()
  for (const ext of Object.keys(IMAGE_MIME_BY_EXT)) {
    if (lower.endsWith(ext)) return IMAGE_MIME_BY_EXT[ext]
  }
  // R6 兜底必须带显式告警：未识别扩展名按 jpeg 内联，云函数日志可见降级
  console.warn('[任务61] 未识别扩展名按 image/jpeg 内联：' + fileID)
  return 'image/jpeg'
}

async function resolveCloudImageUrl(fileID) {
  let res
  try {
    res = await cloud.downloadFile({ fileID })
  } catch (e) {
    throw new Error(`cloud.downloadFile 失败：fileID=${fileID}；errMsg=${e && e.message ? e.message : String(e)}`)
  }
  const buf = res && res.fileContent
  if (!Buffer.isBuffer(buf)) {
    throw new Error(`cloud.downloadFile 返回结构异常：缺 fileContent(Buffer)，fileID=${fileID}；实际类型=${typeof buf}`)
  }
  if (buf.length > IMAGE_MAX_BYTES) {
    throw new Error(`图片超大小闸：fileID=${fileID}；实际 ${buf.length} 字节，上限 ${IMAGE_MAX_BYTES} 字节`)
  }
  return `data:${guessImageMime(fileID)};base64,${buf.toString('base64')}`
}

// 扫描 messages 内数组型 content 的 image_url 块；cloud:// 就地替换为 data URL（替换块为新对象，不动其它字段）
async function resolveCloudImages(messages) {
  if (!Array.isArray(messages)) return messages
  for (const msg of messages) {
    const content = msg && msg.content
    if (!Array.isArray(content)) continue
    for (let i = 0; i < content.length; i++) {
      const block = content[i]
      if (!block || block.type !== 'image_url' || typeof block.image_url !== 'object') continue
      const url = block.image_url.url
      if (typeof url !== 'string' || url === '') {
        throw new Error(`image_url 块缺 url 字符串：消息 content 第 ${i} 块；实际类型=${typeof url}（R5 显式报缺）`)
      }
      if (url.indexOf('cloud://') === 0) {
        const dataUrl = await resolveCloudImageUrl(url)
        content[i] = Object.assign({}, block, { image_url: { url: dataUrl } })
      } else if (/^(https?:\/\/|data:image\/)/.test(url)) {
        // CloudBase 多模态合法形态（公网直链 / base64 DataURL）：放行不动
      } else {
        throw new Error(`image_url 形态不受理（仅 cloud://、http(s)、data:image）：${url.slice(0, 80)}`)
      }
    }
  }
  return messages
}

async function callExtend(cfg, messages) {
  const modelId = normalizeDeepseekModel(cfg.model)
  const client = ai.createModel('cloudbase')
  // [任务61] 注入前转换：cloud:// 图址转 base64 DataURL；转换异常显式上抛（错误信息含定位要素）
  const data = { model: modelId, messages: await resolveCloudImages(messages) }
  // 【任务40，2026-09-29】cloudbase通道不支持thinking参数，思考档位仅selfhost通道生效。
  // 以下两行原 thinking 注入已注释：往 generateText 的 data 里塞 thinking 字段
  // 会被 CloudBase 模型接口拒绝（云端实测 mode=chat 返回 400；429 阶段已验证
  // 路由到模型本身正常，400 与模型名无关）。buildThinking 保留备用。
  // const thinking = buildThinking(cfg.thinking)
  // if (thinking) data.thinking = thinking
  try {
    return await client.generateText(data)
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
  // [任务48] HTTP 状态如实上报（原行为：直接 .json()，5xx/HTML 错误页被当正常响应透传）
  if (!resp.ok) {
    return { error: 'selfhost_http_' + resp.status, detail: 'selfhost 返回 HTTP ' + resp.status }
  }
  return resp.json()
}

// ── 通道分派（extend 优先且为默认；selfhost 仅当配置就绪且被显式指定）──
async function dispatch(cfg, messages) {
  if (cfg.channel === 'selfhost') {
    if (!selfhostReady()) {
      // [任务48] 环境变量缺失时回退 extend：回退结果如实标注（原行为：静默回退无痕迹，调用方无法区分通道）
      const r = await callExtend({ ...cfg, channel: 'extend' }, messages)
      if (r && typeof r === 'object' && !Array.isArray(r)) {
        try { r._channelNote = 'selfhost_not_configured_fallback_to_extend' } catch (e) {}
      }
      return r
    }
    return callSelfhost(cfg, messages)
  }
  return callExtend(cfg, messages)
}

// ── 返回文本提取（兼容多种返回结构，联调以实测为准）────────────────
// [任务48] 已知结构→文本（可为空串）；未知/缺失结构→null（如实报缺，与合法空文本区分）
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

// ── 任务56：健康免责声明标记计算 ─────────────────────────────────
// 双保险OR关系：①推荐链结果（recommend_deep/recommend_fast）一律标记；
//               ②其他输出（chat等）用清单关键词表扫描结果文本，命中即标记。
// 判别门槛：允许多判（非医疗出声明可以），杜绝少判（医疗相关必须有）。
// 声明文本与关键词表唯一来源 = 清单 HEALTH_NOTICE（本脚本零字面量）。
const RECOMMEND_MODES = ['recommend_deep', 'recommend_fast']
function computeHealthNotice(mode, text) {
  const hn = assetsConfig.HEALTH_NOTICE
  if (!hn || hn.enabled !== true) return false
  // 双保险①：推荐链结果一律标记（详细卡108/快速卡109产出的推荐结果）
  if (RECOMMEND_MODES.indexOf(mode) >= 0) return true
  // 双保险②：其他输出（chat等）——宽口径关键词表扫描结果文本，命中即标记
  if (typeof text !== 'string' || !text) return false
  const kws = Array.isArray(hn.keywords) ? hn.keywords : []
  for (let i = 0; i < kws.length; i++) {
    if (typeof kws[i] === 'string' && kws[i].length > 0 && text.indexOf(kws[i]) >= 0) return true
  }
  return false
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

  // 【任务54】chat 位角色定位注入（Walter 指令）：mode==='chat' 时 messages 头部插
  // system（PERSONA.chat_system 唯一来源 = 清单，本脚本零人设字面量）。
  // PERSONA/chat_system 缺失或空白 → 按群规则拒绝本次调用并点名缺项（只拒 chat 位，
  // 不拖垮其他 mode）。新数组注入，不改调用方原 messages。
  let msgs = messages
  if (mode === 'chat') {
    const personaText = (PERSONA && typeof PERSONA.chat_system === 'string')
      ? PERSONA.chat_system.trim()
      : ''
    if (!personaText) {
      return {
        error: 'assets_config_missing',
        mode,
        note: 'assets.config.js 清单缺 PERSONA.chat_system（chat位角色定位），拒绝本次调用；缺项：PERSONA.chat_system'
      }
    }
    msgs = [{ role: 'system', content: PERSONA.chat_system }]
      .concat(Array.isArray(messages) ? messages : [])
  }

  // 【任务45】event.model 覆盖：非空字符串时，本次调用用 event.model 替换该 mode 的 model（仅本次，不改配置）
  if (typeof event.model === 'string' && event.model.trim()) {
    cfg = { ...cfg, model: event.model.trim() }
  }

  let res
  try {
    res = await dispatch(cfg, msgs)
  } catch (err) {
    return { error: 'upstream_error', mode, detail: String((err && err.message) || err) }
  }

  if (res && res.error) return res  // 通道级错误直接透传（如 selfhost_not_configured）

  if (mode === 'nutrition' && !event.allowNumbers) {
    const text = extractText(res)
    if (text === null) {
      // [任务48] 结构无法解析=如实报缺（原行为：静默放行，营养闸对未知结构失效）
      return { error: 'unknown_response_shape', mode, detail: 'nutrition返回结构无法解析（无 choices/message/content/text 字段）' }
    }
    if (hasNumericLeak(text)) {
      return {
        error: 'numeric_leak_blocked',
        note: '营养数值必须来自数据库，模型输出数字被拦截'
      }
    }
  }

  // [任务36] 说明：translate / order_phrase 走默认分支透传，不触发数字泄漏红线
  // （order_phrase 的价格/营养“不输出”由前端 prompt 约束 + 前端白名单校验承担，见 order.js）

  // 【任务56】健康免责声明双保险标记：声明独立于对话回复，不拼进模型输出文本；
  // 结构化字段 health_notice 随返回带出（true/false），前端检测到 true 时独立一行显示。
  // 错误响应（res.error 已上方直返）不含 AI 生成内容，不打标。
  const healthNoticeFlag = computeHealthNotice(mode, extractText(res))
  if (res && typeof res === 'object' && !Array.isArray(res)) {
    res.health_notice = healthNoticeFlag
  }

  return res
}
