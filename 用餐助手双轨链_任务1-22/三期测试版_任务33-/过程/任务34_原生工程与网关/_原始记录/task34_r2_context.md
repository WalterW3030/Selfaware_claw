=====【第一部分总结报告】=====
# 第一部分总结报告：T1 工程骨架 + 模型列表与成本估算（最终模型确认）

版本：v1.0 | 2026-09-18 | 编制：kimi | 本文件为**结论**类文件（过程文件见 过程/ 目录）

## 一、T1 工程骨架结论

12 个文件已入库（过程/任务33_工程骨架/），验收通过：基库 3.15.1、五页面路由（首页入口）、CloudBase 初始化（env 待 Walter 填写）、点餐页默认快速模式、gateway 统一 AI 出口、AGENTS.md 落位、导入与运行说明齐备。待 Walter 本机导入运行验收（H1-H4）。

## 二、模型列表（按功能位，候选→评估）

选型优先级（Walter 指令）：**①满足所需功能 → ②易部署 → ③成本**。

| 功能位 | 候选模型 | 功能满足 | 部署难度 | 成本 |
|---|---|---|---|---|
| 识图（recognize） | extend.AI deepseek-flash（V4.1 Flash，原生多模态，思考off/low） | ✅ 识图+结构化 | 极低：云开发控制台现成，免key | 闲时$0.15/$0.60每1M |
| | 自备API qwen3-vl-flash（实测2.9s最快VL） | ✅ | 中：需百炼key+网关selfhost通道 | $0.07/$0.26档 |
| | 自备API GLM-4.6V-Flash | ✅ | 中 | 有免费档，限速 |
| 文案（copy） | extend.AI hy3 | ✅ 纯文本生成 | 极低 | 成长计划1亿token免费额度 |
| 营养建议（nutrition） | extend.AI hy3 | ✅ 只翻译不出数字（网关红线拦截） | 极低 | 同上免费额度 |
| 点餐快速（order_fast） | extend.AI deepseek-flash 思考off | ✅ 字段裁剪后输出短 | 极低 | 同上 |
| | 自备API qwen3-vl-flash | ✅ 更快2.9s | 中 | 低 |
| 点餐深度（order_deep） | extend.AI deepseek-flash 思考medium（可上探high） | ✅ 三档思考天然覆盖 | 极低 | 同上 |
| | 自备API Qwen3-VL-235B（$0.25/$0.75性价比高） | ✅ 更强 | 高：需额外接入 | 中 |
| 自由提问（chat） | extend.AI deepseek-flash 思考low | ✅ | 极低 | 同上 |

## 三、成本估算（测试版实际用量）

按每次调用估算：识图/点餐 ≈ 输入1500 token（图+提示）+ 输出300-800 token；文案/营养 ≈ 输入400 + 输出300。

| 场景 | 单次成本（deepseek-flash闲时） | 1000次 |
|---|---|---|
| 识图/点餐快速 | ≈ $0.0004（约0.003元） | ≈ 3元 |
| 点餐深度（思考medium） | ≈ $0.001（约0.007元） | ≈ 7元 |
| 文案/营养（hy3） | 0（成长计划免费额度内） | 0 |

**测试版结论：全部用量在成长计划免费额度+云开发免费环境内，现金成本≈0元/月**；即使自备API通道全开，月成本也在个位数元。成本不构成选型约束，按功能与部署难度定即可。

## 四、最终模型确认（六功能位）

| 功能位 | 最终模型 | 通道 | 思考档位 | 备选 |
|---|---|---|---|---|
| recognize | deepseek-flash | extend.AI | off | qwen3-vl-flash（自备通道） |
| copy | hy3 | extend.AI | — | deepseek-flash |
| nutrition | hy3 | extend.AI | — | deepseek-flash |
| order_fast | deepseek-flash | extend.AI | off | qwen3-vl-flash |
| order_deep | deepseek-flash | extend.AI | medium（可上探high） | Qwen3-VL-235B（自备通道，二期再评估） |
| chat | deepseek-flash | extend.AI | low | — |

理由一句话：全部首选 extend.AI 单链路（功能达标+部署最简+免费额度覆盖），自备API通道仅作备选与实测对照；Qwen3-VL-235B 因部署复杂度高按优先级原则后置。此表即 T2 网关 MODEL_MAP 的定稿值。

## 五、遗留事项

- P7（extend.AI 在售多模态模型控制台核查）环境就绪后一次核查关闭，若 deepseek-flash 多模态未开放则识图位切换到备选 qwen3-vl-flash。
- 个体户执照/上架合规顺延至发布期，测试版不阻塞。


=====【测试版工程总包】=====
# 食知测试版工程总包：设计流程·程序与脚本·人工协助点

版本：v1.0 | 2026-09-18 | 编制：kimi
范围：按逐步执行方案（T0-T9）把完整设计流程、需处理的程序与脚本一次成文；列出所有需人为协助的点。不涉及发布、收费、美术风格。

---

## 第一部分：完整设计流程（从设计文档到可运行测试版）

```
设计资产（已完成）                    工程落地（本文件）
─────────────────                  ─────────────────
任务24 数据层五表设计    ──────→    DB初始化脚本 + 安全规则（T3）
任务25+31 识图模板体系   ──────→    prompt模板文件 + 识图页面（T4）
任务26+32 点餐助手双模式 ──────→    点餐页面 + 双模式路由（T8）
任务27 健康管理          ──────→    二期，不在本测试版
任务28 外部接入          ──────→    二期，不在本测试版
v3设计方案 页面流程       ──────→    页面路由骨架（T1）
背景调研/特化指南        ──────→    AI网关云函数双通道（T2）
```

执行序列（严格串行，一次一步）：T0人工前置 → T1骨架 → T2网关 → T3数据层 → T4识图 → T5营养 → T6文案+搭配 → T7储存 → T8点餐双模式 → T9端到端测试。

---

## 第二部分：程序与脚本（按T序，含关键代码）

### T1 工程骨架

目录结构（uni-app + Vue3）：
```
src/
  pages/
    index/index.vue        # 首页：拍照入口+三预设模板
    result/result.vue      # 识别/分析结果页
    history/history.vue    # 历史记录
    profile/profile.vue    # 我的（身体数据/偏好/授权管理）
    order/order.vue        # 点餐助手（快速/深度双模式）
  common/
    gateway.js             # 前端调云函数的统一封装
    confirm.js             # 置信度分档+确认门禁组件逻辑
cloudfunctions/
  aiGateway/               # T2
  dbInit/                  # T3（一次性）
  importNutrition/         # T3（一次性）
AGENTS.md                  # 项目规则（已备稿：AGENTS_项目规则文件_草案.md）
```

### T2 AI网关云函数（核心脚本，完整代码）

`cloudfunctions/aiGateway/index.js`：
```javascript
// 食知AI网关：双通道（extend.AI平台模型 / 自备API），密钥只在环境变量
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const ai = cloud.ai()  // wx-server-sdk>=4.0.1

// mode: 'recognize'|'copy'|'nutrition'|'order_fast'|'order_deep'|'chat'
// 每模式的模型与思考档位在此集中配置（改这里即全链路生效）
const MODEL_MAP = {
  recognize:  { channel:'extend', model:'deepseek-flash', thinking:'off' },   // 或 fastVL 通道
  copy:       { channel:'extend', model:'hy3' },
  nutrition:  { channel:'extend', model:'hy3' },          // 只翻译不出数字
  order_fast: { channel:'extend', model:'deepseek-flash', thinking:'off' },   // 备选 selfhost:qwen3-vl-flash
  order_deep: { channel:'extend', model:'deepseek-flash', thinking:'medium' },// 可上探high
  chat:       { channel:'extend', model:'deepseek-flash', thinking:'low' },
}

async function callExtend(cfg, messages, stream) {
  const m = ai.createModel('cloudbase')
  const data = { model: cfg.model, messages }
  if (cfg.thinking) data.thinking = { type: cfg.thinking === 'off' ? 'disabled' : 'enabled', effort: cfg.thinking }
  return stream ? m.streamText({ data }) : m.generateText(data)
}

async function callSelfhost(cfg, messages) {
  // 自备API通道（OpenAI兼容端点，如百炼/硅基流动）；key在环境变量 SELFHOST_API_KEY
  const resp = await fetch(process.env.SELFHOST_BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.SELFHOST_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: cfg.model, messages, stream: false })
  })
  return resp.json()
}

exports.main = async (event) => {
  const { mode, messages } = event
  const cfg = MODEL_MAP[mode]
  if (!cfg) return { error: 'unknown mode' }
  // 红线：nutrition模式返回值前做数字泄漏检查
  const res = cfg.channel === 'extend' ? await callExtend(cfg, messages, false) : await callSelfhost(cfg, messages)
  if (mode === 'nutrition') {
    const text = res.choices?.[0]?.message?.content || ''
    if (/\d+(\.\d+)?\s*(kcal|千卡|克|g|mg)/.test(text) && !event.allowNumbers) {
      return { error: 'numeric_leak_blocked', note: '营养数值必须来自数据库，模型输出数字被拦截' }
    }
  }
  return res
}
```
注意：识图消息的图片以 `{type:'image_url', image_url:{url:'data:image/jpeg;base64,...'}}` 进 messages（与官方教程一致）；图片先传云存储取临时URL或直接base64，禁入代码包。

### T3 数据层脚本（两个一次性云函数）

`dbInit`：建五个集合（dish_profile/diet_record/daily_nutrition_summary/nutrition_audit_log/user_profile），写入安全规则（未登录拒绝一切；登录用户按_openid隔离；nutrition库集合全员只读、仅云函数可写）。

`importNutrition`：读云存储里的 `food_composition_full.csv`（中国食物成分表开源版1677条），逐行写入 `food_nutrition` 集合。关键字段映射：food_name/alias_name/energy/protein/fat/carbohydrate/dietary_fiber/sodium/钙铁等，单位统一为每100g。

### T4-T8 页面与prompt模板

prompt模板以文件存 `src/common/prompts/`，三模板骨架按任务25+31修订版（识图A：提示文字在图前、思考off、L6"仅依据图片证据"；文案B：三风格；营养C：数值占位符由数据库填充后模型只翻译）。点餐双模式prompt按任务32增补文档。页面逻辑要点全部已在设计文档，生成代码时逐条对照。

### T9 端到端测试用例（10条）

1.拍食物照→识别→确认→入库（主链路）2.拍非食物→is_food=false→提示重拍 3.低置信→纠正入口 4.过敏原菜品→搭配推荐中绝不出现 5.营养数值篡改检测（nutrition模式数字拦截触发）6.断网→本地缓存可读 7.快速模式≤4秒实测 8.深度模式进度态 9.模式切换购物车保留 10.数据导出与删除

---

## 第三部分：需人为协助的点（全部集中在此）

| # | 事项 | 谁 | 时机 | 说明 |
|---|---|---|---|---|
| H1 | 注册个人主体小程序、开通云开发 | Walter | T0 | 半小时；拿到AppID和环境ID |
| H2 | 创建API key（DeepSeek/GLM/百炼任一） | Walter | T0 | key不要发给任何人，T2时本机配进云函数环境变量（微信开发者工具→云函数→环境变量） |
| H3 | 安装微信开发者工具、导入工程、真机预览 | Walter | T1起每步 | 代码产出后在你本机跑；测试用例由你执行 |
| H4 | extend.AI在售多模态模型控制台核查 | Walter | T2前 | 云开发控制台看模型列表哪个支持图片输入，截图给我即可 |
| H5 | 营养成分表CSV上传云存储 | Walter | T3 | 文件我准备好放仓库，你拖到云存储 |
| H6 | 授权弹窗/隐私政策的最终措辞确认 | Walter | T7 | 框架稿已备（合规包_框架稿.md） |
| H7 | 个体户执照办理（仅上架需要，测试版不阻塞） | Walter | 并行可缓 | |
| H8 | 薄荷食物数据库商务询价（可选，上线前） | Walter | 二期 | bd@boohee.com |

原则：所有密钥、账号操作、真机测试在你侧；所有代码、文档、调研在我与流水线侧。


=====【第二部分T2网关_执行方案】=====
# 第二部分（T2 AI网关云函数）：逐步执行方案与人工协助清单

版本：v1.0 | 2026-09-18 | 编制：kimi | 依据：《食知小程序开发需求与工具选型.md》（Walter提供）+ 第一部分总结报告（模型定稿）+ 工程总包T2节

## 〇、工具建议对既有产出的影响判定（先说清）

工具建议文档结论：只做微信一端→维持**原生开发，不引入uni-app**。但任务33产出的骨架是 uni-app 目录结构（src/+manifest.json+vue页面）——与"原生"结论不符，必须先对齐，否则后续所有云函数/页面工作都建立在错误结构上。因此第二部分首步为**骨架原生化改造**，再进网关本体。工具链结论采纳：微信开发者工具（Nightly）+CodeBuddy/CloudBase Skills为主，外部编码助手攻复杂逻辑。

## 一、本部分目标

1. 骨架转为微信原生结构（app.js/app.json/app.wxss+project.config.json，五页面转 wxml/js/wxss/json 四件套），功能等价不增不减。
2. aiGateway 云函数落地：extend.AI 通道按第一部分总结报告的 MODEL_MAP 定稿实现六功能位；nutrition 数字泄漏红线拦截；selfhost 备选通道（代码备好、默认关闭）。
3. 产出部署与联调说明，Walter 本机可部署并在云函数本地调试中拿到真实模型响应。

## 二、所需材料核对（全部已具备）

| 材料 | 状态 | 来源 |
|---|---|---|
| MODEL_MAP 六功能位定稿 | ✅ | 第一部分总结报告§四 |
| 网关完整代码草稿（双通道+红线拦截） | ✅ | 工程总包第二部分T2 |
| extend.AI 调用姿势（createModel/streamText/generateText/thinking字段/图片base64进messages） | ✅ | 背景调研_模型与平台.md |
| 待改造骨架 | ✅ | 过程/任务33_工程骨架/ |
| 人工前置（环境ID/API key） | ⏳ 不阻塞代码生成 | 部署联调时才需要（见人工清单） |

## 三、逐步执行方案

| 步 | 动作 | 产出 | 验收线 |
|---|---|---|---|
| 2.1 | 骨架原生化改造 | 原生工程全套 | 与T1骨架功能等价：五路由、env占位、order默认快速、gateway唯一出口；uni-app痕迹清零 |
| 2.2 | aiGateway 云函数 extend.AI 通道 | cloudfunctions/aiGateway/{index.js,config.json,package.json} | 六功能位映射=定稿表；nutrition数字拦截在；图片base64进messages；零占位 |
| 2.3 | selfhost 备选通道 + 部署联调说明 | 同上文件内通道开关 + 《网关部署与联调说明.md》 | 默认走extend；selfhost仅当环境变量存在才启用；说明含CodeBuddy/控制台两种部署路径 |
| 2.4 | 我核验后通知Walter部署联调 | — | 云函数本地调试返回真实模型响应 |

执行方式：任务34 派发流水线，三轮 multi_turn（2.1改造/2.2网关/2.3备选+说明）。

## 四、人工协助清单（本部分）

| # | 事项 | 谁 | 时机 | 阻塞性 |
|---|---|---|---|---|
| T2-H1 | 微信开发者工具升级到 Nightly 版并装 CodeBuddy 扩展（可选但推荐） | Walter | 部署前 | 不阻塞，提效 |
| T2-H2 | 云开发控制台核查在售模型里哪个开了图片输入（P7项，截图模型列表给我） | Walter | 2.4联调前 | 阻塞识图位最终确认；若deepseek-flash无图则切备选 |
| T2-H3 | 部署 aiGateway 云函数（说明文档两种路径任选），本地调试发一条测试消息，回报返回内容 | Walter | 2.4 | 本部分验收 |
| T2-H4 | （可选）备一个百炼/智谱API key配进云函数环境变量，测selfhost通道 | Walter | 2.4后任意 | 不阻塞主线 |


=====【背景调研_模型与平台】=====
# 背景调研报告：模型与平台（开发方案前置参考）

日期：2026-09-18 | 编制：kimi（指挥直接调研）| 优先级：高于其他任务，结论作为后续开发方案的参考基线
覆盖：模型层（文本/多模态/价格/接入通道）、平台层（主体/类目/成长计划）、工具链；全部来源注明日期。

## 一、模型层

### 1.1 extend.AI 官方售卖模型清单（微信官方文档，2026-09 核）

小程序内 `wx.cloud.extend.AI.createModel("cloudbase")`（基础库≥3.15.1）可直调：**hy3、deepseek-v4-flash、deepseek-v4-pro、hy3-preview、glm-5.1、kimi-k2.6、minimax-m2.7** 等。清单以文本模型为主，开通状态以云开发环境实际为准。
来源：微信开放文档"大模型接入"页（2026-09-08 更新）。

### 1.2 关键变化：DeepSeek V4.1 Flash（2026-09-10 发布）

- API名 `deepseek-flash`，**原生多模态（文本+图片）**，1M 上下文，384K 最大输出，思考默认开启（low/high/max 三档）。
- 旧 `deepseek-v4-flash` 已退役并路由到 V4.1 Flash；`deepseek-v4-pro` 自 2026-09-14 起路由到 V4.1 Flash 并按 Flash 计费（直到 V4.1 Pro 发布）。
- 价格：闲时 $0.15 输入 / $0.60 输出 / 缓存命中 $0.003（每百万token），高峰×2（UTC 01-04、06-10）。
来源：DeepSeek官方更新日志转述（github.com/can1357 目录issue，2026-09-10）；aipricing.guru（2026-09-18核验）。
**对本项目的两个直接影响**：①识图不必强上独立VL供应商——若CloudBase跟进上架 deepseek-flash（V4.1），extend.AI 一条链路可覆盖文本+识图；②我们的 ds_kimi 流水线用 deepseek-v4-flash，现已实际跑在 V4.1 Flash 上（思考默认开，与流水线 K2P6_MAX_TOKENS 设置的交互需留意，当前 8192 配置继续有效）。

### 1.3 多模态/识图通道（识图功能的核心查证项）

- **extend.AI 多模态可行**：CloudBase官方教程《用 DeepSeek V4-Pro 做图片理解（多模态）》——图片转 base64 进 messages，小程序端 wx.chooseMedia+readFile 转 base64，消息结构一致。即"extend.AI 支不支持图片"答案=**支持，但取决于所用模型是否多模态**。
- 备选VL及价格：GLM-4.6V（$0.30/$0.90，128K，Z.ai官方，2026-08-27核验）；Qwen3-VL-235B（约$0.25/$0.75，256K，2025-09核验；百炼/硅基流动等OpenAI兼容端点可挂）。
- **实战坑位（必须写进开发方案）**：Trae论坛真实案例（2026-04-16）——extend.AI 配置自定义视觉模型反复报"模型无法识别"，工单才定位；另有主包超限（图片转base64膨胀）案例。结论：识图链路必须先做最小验证再铺开。
- Gemini 3.8 Flash（2026-09发布）多模态分88居前列，但境外模型需自建后端代理，人力成本高，不首选。

### 1.4 文本模型价格锚点（2026-09 核验）

| 模型 | 输入/输出（$每百万token，闲时） | 备注 |
|---|---|---|
| deepseek-flash (V4.1) | 0.15 / 0.60 | 缓存命中0.003；多模态 |
| glm-5.1 / kimi-k2.6 等 | extend.AI在售，价格以控制台为准 | 成长计划内hy3有1亿免费token |
| GLM-4.6V | 0.30 / 0.90 | VL备选 |

## 二、平台层

### 2.1 主体红线（确认，无变化）

"深度合成"类目**仅向非个人主体开放**（CloudBase官方文档明示；微信成长计划公告同口径，2025-12-30）。食知含AI生成文案/识别→若走深度合成类目，需个体工商户或企业主体（个体户约300元/年认证）。
补充新信息：第三方模型接入深度合成类目时，需**模型方的算法备案信息+合作协议**（如阿里云合作协议+通义备案号）；用微信云开发在售模型则走"微信云开发在用证明"路径（免鲜章）。页面须加"AI生成"显著标识，否则审核打回。
来源：CloudBase算法备案文档；Xuan's blog实操记录（2026-07-17）。

### 2.2 成长计划（直接可用的降本项）

2026全年：新开发者免费个人版云开发环境6个月；**1亿token混元（hy3）+1万张文生图额度**（二期补发至9亿/9万张）；We分析专业版免费1年；全终端虚拟支付优惠费率；一期生文模型已下线（2026-05-31）、hy3-preview即将下线→直接用 hy3。一个账号只能参加一次。
来源：微信官方公告（2025-12-30）；CloudBase成长计划页（2026年）；量子位报道（2026-04-16，4月起全类目开放申请）。

### 2.3 虚拟支付

个人主体2026-09起开放虚拟支付（月限10万）；涉AI类目则主体已是个体户/企业，不受此限。iOS端不露头原则不变。

## 三、工具链

- CodeBuddy：深度集成微信云开发，可配置云开发AI模型（Base URL+API Key）驱动编码Agent（官方文档，2026）；Agent SDK支持子Agent权限隔离（如code-reviewer只读）。
- miniprogram-ci 自动化上传不变。
- **主包体积红线**：图片base64入包是超限高发点——图片走云存储+临时路径，不进代码包。

## 四、对现有设计与执行计划的影响（更新点）

1. **任务25模型选型结论需要打一个补丁**：原结论"DeepSeek文本模型不能识图，识图必须外部VL"在2026-09-10后过时——deepseek-flash（V4.1）已原生多模态。新建议：识图首选 extend.AI+deepseek-flash（若CloudBase已上架）或 deepseek-v4-pro 多模态路径（官方教程已验证），外部VL（GLM-4.6V/Qwen3-VL）降为备选。
2. **执行计划步1（VL验证）目标收窄**：验证项从"extend.AI能否传图"（已证实可以）收窄为"CloudBase环境内哪个在售模型当前支持图片输入、deepseek-flash是否已上架"——一次控制台核查即可关闭。
3. **步0主体决策不变**，但补一条：若注册个体户走深度合成类目，模型备案材料优先用"微信云开发在用证明"路径，省掉第三方合作协议环节。
4. **成本结构**：MVP期AI算力≈0元（1亿token免费额度，hy3为文本主力）+云环境免费6个月；识图如用付费VL按量计（量级见§1.4）。
5. **流水线侧**：deepseek-v4-flash已路由V4.1 Flash，思考默认开启——后续流水线任务留意推理token占用输出预算的现象是否加剧，必要时显式设 thinking effort=low。

## 五、免责

全部结论基于2026-09-18前公开资料；extend.AI在售模型清单、DeepSeek路由策略、成长计划细则变动频繁，执行前以官方文档当日版本为准。


=====【骨架源文件: 任务33_工程骨架/AGENTS.md】=====
# 项目规则（AI 必读）——食知小程序

版本：v1.0 | 2026-09-18 | 放置位置：项目根目录 AGENTS.md

## 技术约束
- 框架：uni-app + Vue3 组合式 API，目标平台微信小程序（基础库≥3.15.1）
- 后端：微信云开发（CloudBase），数据库集合设计见 docs/数据层设计文档_任务24.md
- AI接入：一律走 wx.cloud.extend.AI，禁止前端直连任何模型API
- 禁止：前端代码写入任何密钥/AppSecret；禁止直接操作生产数据库；图片资源必须走云存储/临时文件，禁止打进代码包

## 设计规范（微信官方设计指南摘要）
- 每个页面只设一个视觉重点，删除与主任务无关的元素
- 字号仅用 22/17/15/14/12pt 五档；基准宽度 375px
- 主流程中不得插入打断性弹窗；所有加载必须有状态反馈（骨架屏优先）
- 用户输入优先用拍照/选择器/语音替代键盘输入
- 次级页面左上角必须有返回；右上角为官方菜单预留区，禁止放置交互元素
- 适老化：文字与背景对比度 ≥ 4.5:1，可点击热区不小于 44px
- 页面间控件与交互方式保持一致

## 业务红线（本项目特有，违反即返工）
- 营养数值、热量、营养素数据一律来自营养数据库查询，模型输出中禁止出现任何自行生成的数字
- 过敏原与用户素食等硬性约束在规则引擎过滤层执行，禁止放进模型打分或提示词里"商量"
- 识别结果未经用户确认禁止写入饮食记录
- 所有营养/健康建议文案必须带"非医疗建议，以医嘱为准"
- AI生成内容页面必须有"AI生成"显著标识
- 识图结果必须带 is_food 字段，非食物图片走提示重拍路径，禁止硬答

## 安全红线（AI 生成代码必须通过以下检查）
- 所有用户输入必须校验与转义（防注入/XSS）
- 云函数权限最小化；数据库安全规则禁止未登录读写
- 密钥只存在于云函数环境变量/extend.AI托管，禁止硬编码
- 身体数据、饮食记录属敏感个人信息：传输加密、最小收集、可导出可删除

## 工作方式
- 一次只做一个功能点；完成后先自查上述红线再提交
- 遇到小程序平台特有的疑难问题，先检索 docs/ 目录下的本地参考文档（含背景调研报告中的坑位记录）
- 自定义模型配置类问题卡住超过30分钟，直接提腾讯云工单，不死磕
- 拿不准的类目/合规问题，标记 [需人工确认]，不得自行假设


=====【骨架源文件: 任务33_工程骨架/cloudfunctions/README.md】=====
# cloudfunctions/

云函数根目录。aiGateway（AI网关云函数）在 T2 按《测试版工程总包.md》第二部分落位，本目录当前为空（T1 骨架阶段）。


=====【骨架源文件: 任务33_工程骨架/src/App.vue】=====
<script>
export default {
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
}
</script>

<style>
/* 全局样式：字号五档 + 适老化对比（对照 AGENTS.md 设计规范） */
page {
  --font-xl: 22pt;
  --font-lg: 17pt;
  --font-md: 15pt;
  --font-sm: 14pt;
  --font-xs: 12pt;
  --color-text: #1A1A1A;
  --color-bg: #F7F7F7;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-md);
}
</style>


=====【骨架源文件: 任务33_工程骨架/src/common/confirm.js】=====
// 置信度分档 + 确认门禁状态机骨架
// 真实阈值属 T4 业务逻辑,TODO 处待任务25+31修订版模板确定后填入

// TODO(T4): 三档阈值待定,示例区间,需按识别模板实测校准
const THRESHOLD_HIGH = 0.85   // TODO: 高置信下限
const THRESHOLD_MEDIUM = 0.6  // TODO: 中置信下限(低于此为低)

// 分档判定:返回 'high' | 'medium' | 'low'
export function classifyConfidence(score) {
  if (typeof score !== 'number') return 'low'
  if (score >= THRESHOLD_HIGH) return 'high'
  if (score >= THRESHOLD_MEDIUM) return 'medium'
  return 'low'
}

// 确认门禁状态机
// 状态流转: idle → pending → confirmed
//                     ↘ (low 档) manual_input → confirmed
export function createConfirmGate() {
  const state = {
    status: 'idle',      // idle | pending | manual_input | confirmed
    candidates: [],       // 识别候选列表(含 name/score/is_food)
    chosen: null          // 用户确认结果
  }

  // 载入识别候选
  function loadCandidates(candidates) {
    state.candidates = candidates || []
    state.status = 'pending'
    return state.status
  }

  // 按分档决定下一步:高直接展示/中请用户纠正/低转手动输入
  function actionFor(score) {
    const tier = classifyConfidence(score)
    if (tier === 'high') return 'show_directly'
    if (tier === 'medium') return 'ask_correct'
    return 'manual_input'
  }

  // 用户确认后置为 confirmed(确认前禁止写入饮食记录,AGENTS 业务红线)
  function confirm(item) {
    state.chosen = item
    state.status = 'confirmed'
    return state.chosen
  }

  // 非食物硬答拦截(is_food=false 走重拍路径)
  function isFood(item) {
    return item && item.is_food !== false
  }

  return {
    state,
    loadCandidates,
    actionFor,
    confirm,
    isFood
  }
}


=====【骨架源文件: 任务33_工程骨架/src/common/gateway.js】=====
// 食知 AI 调用统一入口
// 规则:所有页面只允许通过 callAI() 调 AI,禁止前端直连任何模型 API(AGENTS.md 技术约束)
// 实际模型路由在云函数 aiGateway 的 MODEL_MAP 集中配置(T2)

// mode: 'recognize'|'copy'|'nutrition'|'order_fast'|'order_deep'|'chat'
export function callAI(mode, messages) {
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
export function callRecognize(messages, allowNumbers = false) {
  return callAI('recognize', messages)
}

// 便捷封装:营养模式(默认拦截模型自产数字,见 T2 红线)
export function callNutrition(messages, allowNumbers = false) {
  return callAI('nutrition', messages)
}


=====【骨架源文件: 任务33_工程骨架/src/main.js】=====
import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  return { app }
}


=====【骨架源文件: 任务33_工程骨架/src/manifest.json】=====
{
  "name": "食知",
  "appid": "",
  "description": "食物识别与营养分析小程序",
  "versionName": "1.0.0",
  "versionCode": "100",
  "transformPx": false,
  "uniStatistics": {
    "enable": false
  },
  "mp-weixin": {
    "appid": "",
    "setting": {
      "urlCheck": false,
      "es6": true,
      "postcss": true,
      "minified": true
    },
    "usingComponents": true,
    "libVersion": "3.15.1",
    "cloudfunctionRoot": "cloudfunctions/",
    "permission": {},
    "requiredPrivateInfos": []
  },
  "vueVersion": "3"
}


=====【骨架源文件: 任务33_工程骨架/src/pages.json】=====
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "食知"
      }
    },
    {
      "path": "pages/result/result",
      "style": {
        "navigationBarTitleText": "识别结果"
      }
    },
    {
      "path": "pages/history/history",
      "style": {
        "navigationBarTitleText": "历史记录"
      }
    },
    {
      "path": "pages/profile/profile",
      "style": {
        "navigationBarTitleText": "我的"
      }
    },
    {
      "path": "pages/order/order",
      "style": {
        "navigationBarTitleText": "点餐助手"
      }
    }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "食知",
    "navigationBarBackgroundColor": "#FFFFFF",
    "backgroundColor": "#F7F7F7"
  }
}


=====【骨架源文件: 任务33_工程骨架/src/pages/history/history.vue】=====
<template>
  <view class="page">
    <text class="page-title">{{ pageTitle }}</text>

    <view v-if="records.length === 0" class="empty">
      <text>暂无记录</text>
    </view>
    <view v-else class="list">
      <view v-for="item in records" :key="item.id">{{ item.dish }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const pageTitle = '历史记录'
const records = ref([])
</script>

<style></style>


=====【骨架源文件: 任务33_工程骨架/src/pages/index/index.vue】=====
<template>
  <view class="page">
    <text class="page-title">{{ pageTitle }}</text>

    <!-- 视觉重点:拍照入口 -->
    <view class="primary-action">
      <button @click="handleCapture">拍照识别</button>
    </view>

    <!-- 三预设模板入口 -->
    <view class="templates">
      <button @click="goResult('recognize')">识图</button>
      <button @click="goResult('copy')">文案</button>
      <button @click="goResult('nutrition')">营养分析</button>
    </view>

    <!-- 自由提问入口,退居二线 -->
    <view class="chat-entry">
      <text @click="goResult('chat')">自由提问</text>
    </view>
  </view>
</template>

<script setup>
const pageTitle = '食知'

// 拍照 → 上传云存储 → 待接 aiGateway recognize 模式(T2)
const handleCapture = () => {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera', 'album'],
    success: (res) => {
      const filePath = res.tempFilePaths[0]
      wx.cloud.uploadFile({
        cloudPath: `recognize/${Date.now()}.jpg`,
        filePath,
        success: () => {
          uni.navigateTo({ url: '/pages/result/result?mode=recognize' })
        },
        fail: (err) => {
          console.error('上传云存储失败', err)
        }
      })
    }
  })
}

const goResult = (mode) => {
  uni.navigateTo({ url: `/pages/result/result?mode=${mode}` })
}
</script>

<style></style>


=====【骨架源文件: 任务33_工程骨架/src/pages/order/order.vue】=====
<template>
  <view class="page">
    <text class="page-title">{{ pageTitle }}</text>

    <!-- 顶部双模式选择器,默认快速 -->
    <view class="mode-switch">
      <button :class="{ active: mode === 'fast' }" @click="mode = 'fast'">快速</button>
      <button :class="{ active: mode === 'deep' }" @click="mode = 'deep'">深度</button>
    </view>

    <!-- 菜单拍照入口 -->
    <view class="menu-capture">
      <button @click="handleMenuCapture">拍菜单</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const pageTitle = '点餐助手'
const mode = ref('fast')

// 拍菜单 → 上传云存储 → 待接 aiGateway order_fast / order_deep(T2/T8)
const handleMenuCapture = () => {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera', 'album'],
    success: (res) => {
      const filePath = res.tempFilePaths[0]
      wx.cloud.uploadFile({
        cloudPath: `order/${Date.now()}.jpg`,
        filePath,
        success: () => {
          console.log('菜单已上传, 当前模式:', mode.value)
        },
        fail: (err) => {
          console.error('菜单上传失败', err)
        }
      })
    }
  })
}
</script>

<style></style>


=====【骨架源文件: 任务33_工程骨架/src/pages/profile/profile.vue】=====
<template>
  <view class="page">
    <text class="page-title">{{ pageTitle }}</text>

    <view class="section body-data">
      <text class="section-title">身体数据</text>
      <input placeholder="身高 (cm)" />
      <input placeholder="体重 (kg)" />
      <input placeholder="过敏原" />
      <input placeholder="饮食目标" />
    </view>

    <view class="section auth">
      <text class="section-title">授权管理</text>
      <button @click="goAuth">隐私与授权</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const pageTitle = '我的'
const bodyData = ref({
  height: '',
  weight: '',
  allergens: '',
  goal: ''
})

const goAuth = () => {
  // 逐项分层授权入口(见 v3 四章),具体措辞待 H6 确认
  uni.showToast({ title: '授权管理', icon: 'none' })
}
</script>

<style></style>


=====【骨架源文件: 任务33_工程骨架/src/pages/result/result.vue】=====
<template>
  <view class="page">
    <text class="page-title">{{ pageTitle }}</text>

    <!-- 结构化结果:识别候选 + 置信度角标 -->
    <view class="candidate">
      <text class="dish-name">识别候选</text>
      <text class="confidence-tag">置信度角标</text>
    </view>

    <!-- 确认门禁:未经确认不入库(v3 2.1 / AGENTS 业务红线) -->
    <view class="actions">
      <button @click="goConfirm">确认</button>
      <button>纠正</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const pageTitle = '识别结果'
const mode = ref('')

onLoad((options) => {
  mode.value = options.mode || 'recognize'
})

const goConfirm = () => {
  uni.navigateTo({ url: '/pages/history/history' })
}
</script>

<style></style>


=====【骨架源文件: 任务33_工程骨架/导入与运行说明.md】=====
# 食知小程序 导入与运行说明

适用:测试版工程骨架(T1 完成后) | 平台:微信小程序 | 框架:uni-app + Vue3

## 一、环境准备
- 安装 HBuilderX(uni-app 官方 IDE)
- 安装微信开发者工具(用于预览/真机调试)
- Node 环境(若需 npm 依赖)

## 二、导入步骤
1. 打开 HBuilderX → 文件 → 导入 → 从本地目录导入,选择工程根目录
2. 确认根目录含 `src/`、`cloudfunctions/`、`AGENTS.md`
3. HBuilderX 顶部运行 → 运行到小程序模拟器 → 微信开发者工具

## 三、AppID 与测试号区别
- **测试号**:无 AppID,仅能本地调试,**不能**调用云开发、不能用真机完整流程
- **正式 AppID**:`manifest.json → mp-weixin.appid` 填入(对应 H1,Walter 注册主体后获取)
- 云能力必须用正式 AppID,测试号无法替代

## 四、云环境 ID 填哪
- 位置:`src/App.vue` 的 `wx.cloud.init({ env: '' })`
- 取值:微信开发者工具 → 云开发 → 环境 → 环境ID
- 对应人工点 H1;填错会导致 `callFunction` 报 env 不存在

## 五、真机预览"不校验合法域名"开关位置
- 微信开发者工具 → 右上角 **详情** → **本地设置** → 勾选
  **"不校验合法域名、web-view(业务域名)、TLS 版本以及 HTTPS 证书"**
- 用途:开发期访问自备 API 通道(T2 selfhost)时绕过域名白名单
- 注意:上线前需在微信公众平台配置合法域名,此开关仅调试用

## 六、五页面跳转自查清单
| 起点 | 动作 | 目标页 | 预期 |
|---|---|---|---|
| index | 点"拍照识别" | result?mode=recognize | 走 chooseImage→上云存储→跳转 |
| index | 点"识图/文案/营养分析" | result?mode=xxx | 带对应 mode |
| index | 点"自由提问" | result?mode=chat | 自由提问入口可用 |
| result | 点"确认" | history | 入记录流 |
| history | 直接进入 | history | 空态显示"暂无记录" |
| profile | 点"隐私与授权" | — | 弹授权提示(H6 待定措辞) |
| order | 切"快速/深度" | order | 默认 fast,可切换 |
| order | 点"拍菜单" | — | 走 chooseImage→上云存储 |

## 七、自检后置 (T0/T1 人工点)
- [ ] H1:AppID 已填 manifest.json
- [ ] H1:ENV_ID 已填 App.vue
- [ ] H3:开发者工具已导入、真机预览通过
- [ ] H4:T2 前核查 extend.AI 在售多模态模型列表


