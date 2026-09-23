=====【文档1: 点餐助手双模式增补_任务32（二期设计_任务23-29/）】=====
# 点餐助手双模式增补（任务32：任务26设计增补·双模式）

> **派发**：Coordinator（kimi）| 2026-09-19 19:53:07 GMT+8；追加要求 20:05:27 GMT+8（Walter 20:32 确认为验收标准）
> **执行**：ds_kimi | v2.1脚本 direct 一轮 + context三份拼接（任务26点餐助手设计文档 20125B + 识图模板复核_任务31 5785B + 点餐双模式调研_任务32输入 2226B = 28302B）+ K2P6_MAX_TOKENS=8192
> **性质**：纯模型产出（本轮 12499B 完整无截断）；题面五要求（快速/深度两层调控、时间约束、既有机制处置、入口切换）+ 追加要求（快速速度优先/深度图片效能性价比优先保调参），范围只动点餐助手
> **原始产物**：`/tmp/k2p6_task32_reply.txt`，SHA-256 `c1a4c3a1…f343880`（运行证据存档）

---

# 任务26设计增补：双模式

## 元信息

| 项 | 值 |
|---|---|
| 文档性质 | 任务26《点餐助手设计》**增补**，仅更新"点餐助手"这一功能域，不动其他部分 |
| 日期 | 2026-09-19 |
| 输入 | 任务26设计（上下文记录）、任务31识图模板复核、任务32输入《点餐双模式调研》 |
| 追加要求 | 快速模式模型选择**以处理速度为优先**；深度模式模型选择**以图片处理效能和性价比为优先**，但保留一定参数调整空间 |
| 落点 | 在任务26既有三轮设计（识别/排序/搭配）之上，横向叠加"模式"这一调控维度 |

> 定位说明：双模式**不是第二套功能**，而是在既有管线（识别→确认→排序→搭配）外再包一层"性能档位开关"。它只调**模型配置、prompt、输出裁剪、图片处理**四类旋钮；对既有机制（双标准排序、硬约束过滤、确认门禁）是**增强或降级**，不是替换。

---

## 一、双模式总览

| 维度 | 快速模式 | 深度模式 |
|---|---|---|
| 情境 | 排队点餐（事务流，时间压力） | 堂食慢点（坐定，可等待） |
| 时间约束 | 首结果 **≤4秒**（上限8秒） | 完整结果 **≤15秒**（可接受10–30秒） |
| 功能范围 | 仅保留**饮食禁忌、成分、基本搭配** | 任务26**完整功能全保留** |
| 模型倾向 | **速度优先** | **图片处理效能 + 性价比优先**（保留调参空间） |
| 思考档位 | off（必要时 low） | low / medium（可上探 high） |
| 输出 | 字段裁剪（只留必要项） | 全字段 |
| 图片 | 降采样 / 单遍 | 全分辨率 / 可选分区复识别 |
| 排序 | 硬过滤 + 轻量单标准 | 完整双标准（S_taste + S_nutrition）加权 |
| 确认门禁 | 精简门禁（只拦低置信+价格缺失） | 完整门禁 |
| 硬约束 | **规则层过滤，不裁剪** | **规则层过滤，不裁剪** |

**贯穿原则（对齐任务32调研§三.4）**：过敏原、素食为硬约束，**两种模式都在规则层过滤，不随模式裁剪**。

---

## 二、时间预算与设计约束

**依据（任务32调研§一）**：<1秒为即时感；3秒是移动端放弃阈值（53%流失）；>10秒失焦但坐定场景可延展。

**快速模式预算拆解（目标 ≤4秒）**

| 环节 | 预算 | 手段 |
|---|---|---|
| 图片编码 + 上传 | ≤0.8s | 降采样、云存储临时路径（非 base64 入包） |
| 模型首 token（TTFT） | ≤1.0s | 思考 off、固定前缀缓存（deepseek-flash TTFT 实测 ~0.9s） |
| 生成 + 结构化 | ≤1.5s | 输出字段裁剪、`max_tokens` 收紧 |
| 门禁交互（精简） | ≤0.7s | 仅低置信项强制过目，高置信批量确认 |
| **合计** | **≤4.0s** | 锚点：qwen3-vl-flash 全链路实测 ~2.9s，可行 |

**深度模式预算拆解（目标 ≤15秒）**

| 环节 | 预算 | 手段 |
|---|---|---|
| 图片编码（全分辨率） | ≤2.0s | 原图/高分辨率 |
| 模型（思考 low/medium） | ≤9.0s | 推理型锚点 ~10.9–21s，取中档 |
| 全字段输出 + 营养/偏好 join | ≤3.0s | 规则引擎算缺口，模型只生成文案 |
| 进度反馈 | 全程 | "深度分析中"分步提示，把等待转成可感知进度 |
| **合计** | **≤15s** | |

---

## 三、模型层调控

### 3.1 快速模式（**速度优先**）

- **首选：qwen3-vl-flash**——任务32实测**最快VL档 ~2.9s**（百炼线），契合"速度优先"。
- **备选：deepseek-flash（V4.1 Flash）思考 off**——extend.AI **单链路**同时覆盖文本+识图（任务31结论），免挂独立VL；文本侧 TTFT ~0.9s，工程最简。
- **思考档位：off**（识图是感知任务、不需深推理链；默认开思考会拖慢端到端并挤占输出预算——任务31①③）。
- **不换模型跑双模型**：快速模式模态单一，避免"按模态切"的交接开销。

> 选型权衡：若工程已接 extend.AI 单链路，用 **deepseek-flash 思考 off** 换简单；若要榨取极速且有 OpenAI 兼容端点，用 **qwen3-vl-flash**。

### 3.2 深度模式（**图片处理效能 + 性价比优先，保留调参空间**）

- **首选：Qwen3-VL-235B**——图片处理效能强、**性价比高（~$0.25 / $0.75）**，满足"效能+性价比"双优先。
- **备选：GLM-4.6V（$0.30 / $0.90）**；或 **deepseek-flash 思考 low/medium**（单链路、缓存命中 $0.003、闲时 $0.15/$0.60，性价比优）。
- **保留参数调整空间（追加要求）**：
  - **思考档位**：low / medium 起，必要时上探 **high**（如手写菜单、艺术字复杂版面）；
  - **输出预算** `max_tokens`：全字段需上调，防推理 token 挤占 schema（任务31①.3）；
  - **图片分辨率**：全分辨率，可对低置信区做**分区复识别**；
  - **重试/多遍**：允许对低置信项二次识别。
- 深度模式可**同模型升档**实现（deepseek-flash 三档思考覆盖两模式——任务32§三.2），不强制换模型。

### 3.3 模型选型表

| 模式 | 优先 | 首选模型 | 备选 | 思考档位 | 说明 |
|---|---|---|---|---|---|
| 快速 | 速度 | qwen3-vl-flash (~2.9s) | deepseek-flash 思考off（单链路） | off | 感知任务不需推理 |
| 深度 | 图片效能+性价比 | Qwen3-VL-235B (~$0.25/$0.75) | GLM-4.6V / deepseek-flash | low→medium→high | 保留档位/max_tokens/分辨率调参 |

---

## 四、Prompt 层调控

### 4.1 快速模式 prompt

- **极简系统前缀 + 固定前缀缓存**：system 只含角色、硬约束、字段裁剪规则；前缀固定以命中缓存（降 TTFT）。
- **字段裁剪指令**：只要求输出 `{菜名, 禁忌成分标记, 基本搭配}`，明确禁止输出营养数值、长理由。
- **图前提示保留**：任务31②指出——**低思考档下位置敏感度上升**，图前提示承担主要识别先验，位置设计必须精确；并附一条"仅依据图片证据"防确认偏差。
- **硬约束写在最前**（"候选不得含过敏原/荤素违规"），避免模型自由发挥。

### 4.2 深度模式 prompt

- **完整骨架**：复用任务26第3节搭配 prompt 骨架（角色 + 硬约束 + 已点餐品 + **本餐剩余营养缺口** + 口味浓淡现状 + 意图 + 要求 + 候选清单）。
- **数值全部来自规则引擎/数据库**，模型只"选谁+讲理由"，不生成营养数值、不判过敏原（对齐任务26第3节要点）。
- **进度感**：可拆分为"识别中→分析营养中→生成搭配中"分步 prompt，配合前端进度态。
- **思考档位标注**：prompt 层显式声明 `thinking effort` 取值，防默认高档位挤占输出。

---

## 五、输出裁剪与字段清单

| 字段 | 快速 | 深度 |
|---|---|---|
| 菜名 / name_confidence | ✅ | ✅ |
| 过敏原/成分标记（禁忌成分） | ✅（核心） | ✅ |
| 基本搭配建议 | ✅ | ✅ |
| 价格 / price_type | ⚠️仅价格缺失拦截用 | ✅含置信度分档 |
| 类别 / category | ✅（仅硬约束所需） | ✅含 from_section 来源 |
| 完整营养缺口（正向+限制型） | ❌（仅限制型避雷） | ✅ |
| S_taste / S_nutrition 双分数 | ❌ | ✅ |
| 口味偏好向量 / 归一化细节 | ❌（用缓存，不重算） | ✅ |
| 逐条理由 / tags | ❌（单行） | ✅ |
| bbox / raw_text | ⚠️精简 | ✅ |

**裁剪红线**：无论怎么裁，**禁忌成分字段与硬约束结果不得裁掉**。

---

## 六、图片处理策略

| 手段 | 快速 | 深度 |
|---|---|---|
| 分辨率 | 降采样 | 全分辨率 |
| 编码方式 | 云存储 + 临时路径（**禁 base64 入包**，任务31修订#9 / 背景§1.3） | 同左 |
| 遍数 | 单遍 | 单遍 + 低置信区**分区复识别** |
| 花哨字体/手写 | 只保高置信，低置信转占位输入 | 输出候选字集、整体降档、严查价格（任务26第1轮） |

---

## 七、既有机制在双模式下的处置

### 7.1 硬约束过滤（过敏原 / 素食）——**任何模式不得裁剪**

- 两模式的"①硬约束过滤"**都在规则层完成**，且在**进入 prompt 前**即剔除候选（任务26第3节）。
- 快速模式即便裁字段、裁排序，**过敏原/素食过滤一步不减**；自由提问、任意滑块档位均不放行。
- 兜底话术统一："该菜含您的过敏原，已为您排除"+ 替代建议。

### 7.2 双标准排序

| | 快速 | 深度 |
|---|---|---|
| 硬过滤 | ✅ | ✅ |
| S_taste（口味相似度） | 用**缓存偏好向量**一次余弦，不重算不归一化 | 完整 cos + 时间衰减归纳 |
| S_nutrition | **仅限制型避雷**（钠/糖超限预警），不做补足型加权 | 完整补足型 Fulfill + 限制型 Penalty |
| 归一化 + 加权融合 | ❌ 退化为**轻量单标准** | ✅ 完整 S=w_t·S_taste+w_n·S_nutrition |
| 权重滑块 | 固定为"均衡"或折叠不显示 | 5 档全开放（0.80/0.20 → 0.20/0.80） |

> 依据：任务26第2轮"两分数必须先归一化再加权"。快速模式因时间预算放弃双标准融合，属**有意识的降级**；深度模式完整保留。

### 7.3 菜单识别确认门禁

| | 快速 | 深度 |
|---|---|---|
| 门禁存在 | ✅（精简） | ✅（完整） |
| 强制确认范围 | 仅 **低置信 + 价格缺失/时价** | 高/中/低全部按分档交互 |
| 高/中置信 | 一键批量确认（默认勾选） | 中置信黄标"请确认"+候选字 |
| 交互形态 | 列表 + 顶部原图回显 | 卡片 + bbox 高亮 + 增删改全动作 |
| 门禁不可跳过 | 价格缺失**未补全不进下一步**（任务26第1轮硬校验） | 同左 |

### 7.4 搭配 / 预设 / 自由提问路由

- **预设清单**：两模式共用；快速仅暴露高频预设（"再加一个菜""推荐饮品""加主食"），深度全开。
- **自由提问**：快速模式**受限**（仅在预算内做品类/口味粗过滤）；深度模式完整（解析意图→抽约束→映射软约束权重）。
- **共用执行层不变**：两模式仍"硬过滤→候选→生成"同层，自由提问**不可覆盖硬约束**。

---

## 八、模式入口与切换

**1. 入口位置**
- 点餐页**首屏顶部**放置双模式选择，文案贴场景：
  - 「⚡ 快速分析（排队/赶时间）」
  - 「🍽 深度分析（堂食慢慢看）」

**2. 默认档位**
- **默认 = 快速模式**。理由：排队是高发场景、时间压力大；快速模式省时成本低，切深度是一键操作。
- 可选**场景自动推荐**：定位/时段（如午间高峰）倾向快速；坐定场景提示可切深度。

**3. 切换行为**
- **随时可切**，保留已识别/已确认数据，只重跑**打分 + 搭配**层：
  - 快 → 深：补算营养缺口、双分数、偏好归纳，门禁升为完整；
  - 深 → 快：裁字段、降思考、简化排序，门禁降为精简。
- **切换不清空已点购物车**，仅重算推荐。
- **短会话内记忆**上次选择，下次进入沿用。

**4. 与确认门禁的衔接**
- 切换若发生在门禁**未确认**时：已确认项保留，未确认项按新模式重列（快模式仅拦低置信，避免重复过目）。

---

## 九、降级与边界

| 场景 | 快速模式 | 深度模式 |
|---|---|---|
| 超时未出结果 | 8秒上限触发，降级为"仅硬约束+菜名"先出 | 超15秒给进度态延展，不截断 |
| 手写/艺术字菜单 | 快速可能不稳 → 提示"建议切深度" | 思考升档 + 候选字 + 复核价格 |
| 无历史偏好 | 中性分，跳过偏好归纳 | 大众热门兜底 + 提示点几道后生成 |
| 无身体数据 | 不做营养缺口 | DRI 默认目标 + 提示补全 |
| 极端廉价设备/弱网 | 图片进一步降采样 | 维持全分辨率，失败可重试 |

---

## 十、落地最小校验清单

1. 快速模式**端到端实测 ≤4秒**（qwen3-vl-flash / deepseek-flash 思考off）——锚点2.9s，留余量。
2. 深度模式**思考档位 × schema 兼容性**实测（任务31④：思考文本是否污染 JSON）。
3. **图片走云存储临时路径**，验证主包不超限（任务31修订#9 工程红线）。
4. 硬约束过滤在**两模式、自由提问、任意滑块**下均不放行——回归测试必测。
5. 模式切换**不丢已确认数据、不清购物车**。
6. 深度模式**进度态**在30秒窗口内可见（防>10秒失焦）。


=====【文档2: 任务36输入（调研文件缺失，以Kimi 17:04意图消息原文替代——装配声明）】=====
【装配声明】任务36派发（2026-09-23T17:06:37+08:00）指定的《菜单翻译与语音点单调研_任务36输入.md》在仓库、工作区、下载目录均不存在（已全盘搜索）。执行器不编造该文件，以下以 Coordinator Kimi 于 17:04:02 的功能意图消息原文作为本文档替代输入；两轮题面本身含完整规格，任务可执行。若该调研文件后续入库，本替代段特此声明其非原文。

[Buffered IM message, Time: [2026-09-23 Wed 17:04:02 GMT+8]] <@Kimi|kimi> 加入两个功能 菜单翻译和语音点单 即将最终候选转为一段点餐要求，并由ai speech说出，需要支持普通话，粤语和英文翻译，根据任务功能要求和复杂度，选择合适的模型，并将其作为选项加入，完善对应的设计方案和代码部分

=====【骨架源文件: cloudfunctions/aiGateway/index.js（任务34产出，任务36第2轮改造对象）】=====
// 食知 AI 网关云函数（T2 / 2.2+2.3）
// 职责：六功能位统一出口，密钥零硬编码。
// 通道：extend（extend.AI 托管，默认）/ selfhost（自备 OpenAI 兼容端点，环境变量存在才启用）。
// 依赖：wx-server-sdk >= 4.0.1（cloud.ai() 需此版本起）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const ai = cloud.ai()

// ── 功能位配置（严格按《第一部分总结报告》§四 定稿表）──────────────
// mode: recognize | copy | nutrition | order_fast | order_deep | chat
// channel: 'extend'（默认托管通道）
// 备选：为某功能位切 selfhost，把该行 channel 改 'selfhost' 并配 model，
//       同时确保环境变量 SELFHOST_BASE_URL / SELFHOST_API_KEY 已配（见 callSelfhost 守卫）。
// thinking: 'off' | 'low' | 'medium'（无该字段=不传思考参数；selfhost 通道忽略此字段）
const MODEL_MAP = {
  recognize:  { channel: 'extend', model: 'deepseek-flash', thinking: 'off'     },
  copy:       { channel: 'extend', model: 'hy3'                              },
  nutrition:  { channel: 'extend', model: 'hy3'                              },
  order_fast: { channel: 'extend', model: 'deepseek-flash', thinking: 'off'     },
  order_deep: { channel: 'extend', model: 'deepseek-flash', thinking: 'medium'  },
  chat:       { channel: 'extend', model: 'deepseek-flash', thinking: 'low'     }
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
  const thinking = buildThinking(cfg.thinking)
  if (thinking) data.thinking = thinking
  return model.generateText({ data })
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
  const cfg = MODEL_MAP[mode]
  if (!cfg) {
    return { error: 'unknown_mode', mode }
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

  return res
}


=====【骨架源文件: pages/order/order.js（任务34产出，任务36第2轮改造对象）】=====
Page({
  data: {
    pageTitle: '点餐助手',
    mode: 'fast'
  },

  setFast() {
    this.setData({ mode: 'fast' })
  },

  setDeep() {
    this.setData({ mode: 'deep' })
  },

  // 拍菜单 → 上传云存储 → 待接 aiGateway order_fast / order_deep(T2/T8)
  handleMenuCapture() {
    wx.chooseImage({
      count: 1,
      sourceType: ['camera', 'album'],
      success: (res) => {
        const filePath = res.tempFilePaths[0]
        wx.cloud.uploadFile({
          cloudPath: `order/${Date.now()}.jpg`,
          filePath,
          success: () => {
            console.log('菜单已上传, 当前模式:', this.data.mode)
          },
          fail: (err) => {
            console.error('菜单上传失败', err)
          }
        })
      }
    })
  }
})


=====【骨架源文件: common/gateway.js（任务34产出，任务36第2轮改造对象）】=====
// 食知 AI 调用统一入口
// 规则:所有页面只允许通过 callAI() 调 AI,禁止前端直连任何模型 API(AGENTS.md 技术约束)
// 实际模型路由在云函数 aiGateway 的 MODEL_MAP 集中配置(T2)

// mode: 'recognize'|'copy'|'nutrition'|'order_fast'|'order_deep'|'chat'
function callAI(mode, messages) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'aiGateway',
      data: { mode, messages },
      success: (res) => {
        const result = res.result || {}
        // 网关侧红线拦截反馈(nutrition 模式数字泄漏等)
        if (result.error) {
          reject(result)
          return
        }
        resolve(result)
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

// 便捷封装:识图模式(图片走云存储 fileID 或 base64,禁入代码包)
function callRecognize(messages, allowNumbers = false) {
  return callAI('recognize', messages)
}

// 便捷封装:营养模式(默认拦截模型自产数字,见 T2 红线)
function callNutrition(messages, allowNumbers = false) {
  return callAI('nutrition', messages)
}

module.exports = { callAI, callRecognize, callNutrition }

