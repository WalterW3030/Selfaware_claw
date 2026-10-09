# 任务49·流水线脚本重写·第1步：参数路由层

日期：2026-10-09
执行：ds_kimi
改动文件（canonical）：`用餐助手双轨链_任务1-22/k2p6_pipeline_v2_核查.py`（参数配置层重写，其余逻辑一字不动）

## 一、联网核实结论（先查后写）

来源：DeepSeek 官方文档 `api-docs.deepseek.com/guides/thinking_mode`（2026-10-09 联网查证，辅以 2026-04-24 发布后的第三方实现交叉验证）：

1. **三档思考模式**（OpenAI 兼容格式，请求体顶层字段；SDK 对应 `extra_body`）：
   | 档 | thinking | reasoning_effort |
   |---|---|---|
   | Non-think | `{"type":"disabled"}` | **整体省略**（传 None 可能触发校验错误） |
   | Think High | `{"type":"enabled"}` | `"high"` |
   | Think Max | `{"type":"enabled"}` | `"max"` |
2. **官方 effort 映射**：minimal/low→low，medium/high/xhigh→high，max/ultra→max。默认 enabled + effort=high。
3. **thinking 模式下 `temperature`/`presence_penalty`/`frequency_penalty` 无效**（不报错但不生效）→ 本实现 thinking 档从 payload 省略 temperature，Non-think 保留 0.7（生效）。
4. 截断正解（Walter 指令③）：`max_tokens` 余量高于预估，而非关闭思考。

## 二、路由表定义（文件顶部显式常量）

`TASK_PARAM_MAP`（四档，按任务声明 type 取参；缺 type/未知 type 拒绝运行并报有效清单，**不猜**）：

| type | model | thinking | max_tokens | temperature | 前置检查 |
|---|---|---|---|---|---|
| code_gen | deepseek-v4-flash | think_high | 32768 | 省略 | 无；note=按文件拆分派发 |
| research | **None（指令未指定）** | **None** | **None** | 省略 | **强制 web_search 先行**（未注入通道即拒绝，不模拟） |
| light | deepseek-v4-flash | non_think | 4096 | 0.7 | 无 |
| review | deepseek-v4-flash | think_high | 16384 | 省略 | 无 |

`THINKING_TIER_MAP`：官方三档枚举（non_think/think_high/think_max），本步四档仅用前两档，think_max 作为官方枚举备档存在（非自造清单）。

**research 档的诚实报缺**：本步指令只给了"强制 web_search 先行"，未给 model/thinking/max_tokens。
按"取不到如实报缺（不猜）"原则，三字段显式留 None，`resolve_task_params` 遇到即抛错拒绝运行；
且 precheck 顺序为 type校验 → web_search先行 → 参数完备性，三道门各自独立报缺。

## 三、改动点清单

1. 新增 `TASK_PARAM_MAP` / `THINKING_TIER_MAP` / `VALID_TASK_TYPES`（文件顶部）。
2. 新增 `resolve_task_params(task_type)`：缺/未知/参数未声明 → ValueError 报缺。
3. 新增 `build_request_payload(params, messages)`：按档组装 thinking/reasoning_effort/temperature。
4. 新增 `research_precheck(question, web_search_fn)`：research 强制 web_search 先行；结果以 `[web_search 先行结果]` 注入 question（与两阶段"基于提供的数据作答"规则一致），前置证据写入日志 outcome。
5. `call_deepseek_step1/step4` 改收 `params`（删除内联 `max_tokens:4096/temperature:0.7` 散配置）。
6. 删除全局 `DEEPSEEK_MODEL`（由路由表接管）。
7. `process_cycle/run_pipeline` 增 `task_type`（必声明）与 `web_search_fn`；拒绝路径记日志 outcome：`task_type_missing` / `task_type_unknown` / `research_precheck_failed`。
8. CLI 增 `--type`（`required=True, choices=VALID_TASK_TYPES`，缺了 argparse 直接拒绝并报清单）。

未动：V44 system prompt、MODEB_PRELOAD、ModelStub、check_tools_missing、log_cycle、转交/日志结构——逐字保留。

## 四、QC 记录

- `python3 -m py_compile k2p6_pipeline_v2_核查.py` 通过。
- 负向用例 `tests/test_routing.py`：**17/17 PASS**（缺type/未知type/参数未声明/precheck拒绝四道报缺门 + 三档payload组装 + 干跑端到端）。
- CLI 冒烟：缺 `--type` 时 argparse 拒绝运行并打印有效清单（exit 2）。
- 诚实声明：路由拒绝路径与 payload 组装均本地验证；真实 API 联通未实测（需 DEEPSEEK_API_KEY，云侧 200 待实测）。
