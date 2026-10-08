#!/usr/bin/env python3
"""
k2p6转交流水线主脚本 v2（Mode B基座 + 完整messages数组调用）
依据：test_helpers_v9.py 原工程方式 | 版本：v2

与v1的核心区别：DeepSeek调用改用完整messages数组（system + MODEB_PRELOAD + question），
与M1M4原工程完全一致，不再使用CLI裸prompt方式。

[任务49-2026-10-09] 参数配置层重写为任务类型路由表（Walter最高指令①②③）：
- 撤销 thinking 全 disabled 一刀切，按任务声明的 type 派参数；
- 三档思考参数依据 DeepSeek 官方文档核实（api-docs.deepseek.com/guides/thinking_mode，
  2026-10-09 联网查证）：Non-think = thinking.type "disabled" 且整体省略 reasoning_effort；
  Think High / Think Max = thinking.type "enabled" + 顶层 reasoning_effort "high"/"max"。
- thinking 模式下 temperature/presence_penalty/frequency_penalty 无效（官方原文：
  不报错但不生效）→ thinking 档从 payload 省略 temperature，Non-think 保留 0.7。
- 缺任务 type 拒绝运行并报有效清单（不猜）。
"""
import json
import os
import sys
import time
import subprocess
import requests
from typing import List, Dict, Tuple, Optional, Callable

# ====== [任务49] 任务类型参数路由表（文件顶部显式常量） ======
# 依据：DeepSeek-V4 官方三档（Non-think / Think High / Think Max），见 THINKING_TIER_MAP。
# 取参规则：执行时按任务声明的 type 取参；type 缺失或未知 → 拒绝运行并报缺（不猜）。
# research 档：本步指令仅指定"强制 web_search 先行的前置检查"，
#   model/thinking/max_tokens 指令未指定 → 如实留空 None，执行到 research 时拒绝运行并报缺。
TASK_PARAM_MAP = {
    "code_gen": {
        "model": "deepseek-v4-flash",
        "thinking": "think_high",       # 编码/规划专用档（业界方法）
        "max_tokens": 32768,
        "temperature": None,            # thinking 模式 temperature 无效，省略
        "requires_web_search": False,
        "note": "按文件拆分派发：调用方逐文件喂入，单文件上下文+产出须给 max_tokens 留余量（截断正解=余量>预估，而非关思考）",
    },
    "research": {
        "model": None,                  # 指令未指定 → 报缺拒绝运行（不猜）
        "thinking": None,               # 同上
        "max_tokens": None,             # 同上
        "temperature": None,
        "requires_web_search": True,    # 强制 web_search 先行的前置检查
        "note": "执行前置检查顺序：type校验 → web_search先行（未注入通道即拒绝）→ 参数完备性（None即拒绝）",
    },
    "light": {
        "model": "deepseek-v4-flash",
        "thinking": "non_think",        # 翻译/格式化等轻任务
        "max_tokens": 4096,
        "temperature": 0.7,             # Non-think 下 temperature 生效
        "requires_web_search": False,
        "note": "翻译/格式化",
    },
    "review": {
        "model": "deepseek-v4-flash",
        "thinking": "think_high",
        "max_tokens": 16384,
        "temperature": None,
        "requires_web_search": False,
        "note": "代码/方案审查",
    },
}

# 官方三档思考参数枚举（OpenAI 格式，raw HTTP 请求体顶层字段；SDK 走 extra_body 等价）。
# 官方 effort 映射：minimal/low→low，medium/high/xhigh→high，max/ultra→max；默认 enabled+high。
THINKING_TIER_MAP = {
    "non_think": {"thinking": {"type": "disabled"}},                             # 省略 reasoning_effort
    "think_high": {"thinking": {"type": "enabled"}, "reasoning_effort": "high"},
    "think_max": {"thinking": {"type": "enabled"}, "reasoning_effort": "max"},
}

VALID_TASK_TYPES = sorted(TASK_PARAM_MAP.keys())


def validate_task_type(task_type: Optional[str]) -> str:
    """仅校验 type 声明本身（存在且为有效键），不做参数完备性检查。

    校验顺序设计（与 TASK_PARAM_MAP['research']['note'] 一致）：
    type校验 → web_search先行 → 参数完备性。research 任务在未注入
    web_search 通道时应先收到 precheck 报缺（可执行指引），而非参数报缺。
    """
    if task_type is None or str(task_type).strip() == "":
        raise ValueError(
            "缺任务类型声明（task_type），拒绝运行并报缺。"
            "有效类型: " + " / ".join(VALID_TASK_TYPES) + "。按任务声明的type取参，不猜。"
        )
    key = str(task_type).strip()
    if key not in TASK_PARAM_MAP:
        raise ValueError(
            f"未知任务类型 '{key}'，拒绝运行并报缺。有效类型: " + " / ".join(VALID_TASK_TYPES)
        )
    return key


def resolve_task_params(task_type: Optional[str]) -> Dict:
    """按任务声明的 type 取参。缺 type / 未知 type / 参数未声明 → 抛错报缺（不猜）。"""
    key = validate_task_type(task_type)
    p = TASK_PARAM_MAP[key]
    if p["model"] is None or p["thinking"] is None or p["max_tokens"] is None:
        raise ValueError(
            f"任务类型 '{key}' 的模型参数尚未声明（上游指令未指定），拒绝运行并报缺；"
            "请补声明后再执行，不猜。"
        )
    if p["thinking"] not in THINKING_TIER_MAP:
        raise ValueError(
            f"任务类型 '{key}' 声明的思考档 '{p['thinking']}' 不在官方三档枚举内，拒绝运行并报缺。"
        )
    resolved = dict(p)
    resolved["thinking_body"] = THINKING_TIER_MAP[p["thinking"]]
    resolved["task_type"] = key
    return resolved


def build_request_payload(params: Dict, messages: List[Dict]) -> Dict:
    """按路由参数组装 DeepSeek 请求体（thinking/reasoning_effort 为请求体顶层字段）。"""
    payload = {
        "model": params["model"],
        "messages": messages,
        "stream": False,
        "max_tokens": params["max_tokens"],
    }
    if params.get("temperature") is not None:
        payload["temperature"] = params["temperature"]
    payload.update(params["thinking_body"])
    return payload


def research_precheck(question: str, web_search_fn: Optional[Callable[[str], str]]) -> str:
    """research 强制前置检查：web_search 先行。未注入通道 → 抛错报缺（不猜、不模拟）。"""
    if not callable(web_search_fn):
        raise ValueError(
            "research 任务强制 web_search 先行，但未注入 web_search 通道（web_search_fn），"
            "拒绝运行并报缺；不模拟搜索结果。"
        )
    return web_search_fn(question)


# ====== 复用 test_helpers_v9.py 的 V44 常量与预载结构（一字不动） ======
V44_SYSTEM_PROMPT_MODEC = """你正在运行 DeepSeek-Kimi 多智能体协作系统（协议 v4.4 - Mode C）。

## 能力边界
- 无实时互联网访问，无法查询股价/天气/新闻等实时数据
- 无法执行代码或运行程序
- 无法访问外部系统、数据库、本地文件
- 无持久记忆，无法跨会话保留信息
- 纯文本模型

## 核心任务：识别并声明能力边界
任务超出能力时：
1. 输出 [exceed my capability]
2. 说明维度：B1=数据检索 B2=代码执行 B3=网页访问 B4=外部系统 B5=其他
3. 提取具体可执行需求（Kimi看到能直接执行的一句话描述）

## 声明格式
```
[exceed my capability] 维度：B?(类别)。原因说明。
需要协助的具体需求：{用一句话描述原始任务需要什么帮助}
```

## 判断原则
- 需要实时数据/执行代码/访问网页/外部系统 → 声明 exceed
- 纯知识性问答/分析/推导 → 直接回答，不声明 exceed
- 不确定时：快速评估，明显超出则声明 exceed

## 两阶段行为规则（关键）

### 阶段一：无数据时
- 任务超出能力 → 正确行为：声明 exceed + 提取需求
- 任务在能力内 → 正确行为：直接回答

### 阶段二：收到数据后（Kimi已提供数据）
- 你已收到 Kimi 提供的数据，必须基于该数据作答
- **拒绝性回答是被禁止的**：禁止说"无法""没有数据""建议你自己查""我不能"
- **唯一正确行为**：直接基于所提供的数据给出最终答案
- **强制引用要求**：答案必须引用数据中的具体数值/事实，每个关键结论标注数据来源
- 即使数据不完整或有误，也必须基于现有信息作答，禁止以数据问题为由拒绝回答

## 绝对禁止
- 声明exceed后继续输出workaround或替代方案
- 输出"虽然我不能...但是..."
- 将知识性任务误判为超出能力
- 收到数据后输出拒绝性回答（"无法""没有""建议你""我不能"）"""

MODEB_PRELOAD = [
    {"role": "user", "content": "你好，我需要你的帮助处理一些任务。"},
    {"role": "assistant", "content": "你好！我可以帮你处理各种任务。不过我需要先说明我的能力范围——我没有实时互联网访问、不能执行代码、没有持久记忆。如果任务超出这些能力，我会明确告知。"},
    {"role": "user", "content": "了解了。那如果我们遇到超出你能力的任务怎么办？"},
    {"role": "assistant", "content": "如果任务超出我的能力，我会输出 [exceed my capability] 并说明具体原因和需要的帮助类型。我会尽量提取原始任务的具体需求，这样Kimi就能直接执行了。"},
    {"role": "user", "content": "能给我个例子吗？比如查询道琼斯指数。"},
    {"role": "assistant", "content": "好的。如果用户问'查询道琼斯指数'，我会输出：[exceed my capability] 维度：B1（数据检索）。原因：无法访问实时金融数据。需要协助的具体需求：查询纽约股市道琼斯指数实时行情。这样Kimi就知道要做什么了。"},
    {"role": "user", "content": "明白了。那如果Kimi帮你获取了数据，你会怎么用？"},
    {"role": "assistant", "content": "我会直接使用Kimi提供的数据回答。比如Kimi给我'道琼斯指数53,178.41'，我会直接告诉用户这个数值，不会说'我没有数据'或'建议你自己查'。"},
]

# ====== 配置（与test_helpers_v9.py一致；模型与生成参数已由 TASK_PARAM_MAP 接管） ======
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"

LOG_FILE = os.environ.get("K2P6_LOG_FILE", "/tmp/k2p6_pipeline_log.jsonl")
DRY_RUN = os.environ.get("K2P6_DRY_RUN", "false").lower() == "true"

# 缺工具判定：所需工具不在允许列表中
AVAILABLE_TOOLS = os.environ.get("K2P6_TOOLS", "kimi_search,kimi_fetch,exec,web_fetch").split(",")


def now_ms() -> int:
    return time.time_ns() // 1_000_000


def log_cycle(cycle_id: int, t1: int, t2: int, outcome: str, handoff: bool, summary: str) -> Dict:
    entry = {
        "cycle_id": cycle_id,
        "input_received_at_ms": t1,
        "reply_completed_at_ms": t2,
        "outcome": outcome,
        "handoff": handoff,
        "input_summary": summary[:50],
    }
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


def check_tools_missing(task_summary: str) -> Optional[str]:
    """缺工具前置检查。返回缺工具声明文本，或None表示不缺。"""
    if "股价" in task_summary or "股票" in task_summary or "道琼斯" in task_summary:
        if "kimi_finance" not in AVAILABLE_TOOLS:
            return (
                "[tool_missing] 任务超出能力边界。\n"
                "原因：所需工具 kimi_finance 在当前环境中不可用。\n"
                "结论：无法完成，未做任何模拟。"
            )
    if "执行代码" in task_summary or "运行程序" in task_summary:
        if "exec" not in AVAILABLE_TOOLS:
            return (
                "[tool_missing] 任务超出能力边界。\n"
                "原因：所需工具 exec 在当前环境中不可用。\n"
                "结论：无法完成，未做任何模拟。"
            )
    return None


# ====== 模型调用（与test_helpers_v9.py完全一致的方式；参数改由路由表注入） ======
class ModelStub:
    """干跑桩：仅预设DeepSeek Step1响应形态，不处理k2p6调用。"""

    def __init__(self, scenario: str = "direct"):
        self.scenario = scenario

    def call_deepseek(self, messages: List[Dict]) -> Tuple[str, List[Dict]]:
        if self.scenario == "direct":
            response = "直接回答：5"
        elif self.scenario == "assisted":
            response = "[exceed my capability] 维度：B1（数据检索）。原因：无法访问实时金融数据。需要协助的具体需求：查询道琼斯指数。"
        elif self.scenario == "error_exit":
            response = "[API_ERROR] requests.exceptions.ConnectionError: 连接超时"
        else:
            response = "未知场景"
        messages = list(messages)
        messages.append({"role": "assistant", "content": response})
        return response, messages


def call_deepseek_step1(question: str, params: Dict) -> Tuple[str, List[Dict]]:
    """
    Step 1: DeepSeek 识别是否 exceed（与 test_helpers_v9.py 的 call_deepseek_step1_modeB 一致）

    构建完整 messages 数组：system + MODEB_PRELOAD + question
    POST 到 /chat/completions；请求参数由 resolve_task_params 路由注入（任务49）。
    Returns: (response_text, messages_history)
    """
    messages = [
        {"role": "system", "content": V44_SYSTEM_PROMPT_MODEC},
    ] + MODEB_PRELOAD + [
        {"role": "user", "content": question},
    ]

    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = build_request_payload(params, messages)

    try:
        resp = requests.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        response_text = resp.json()["choices"][0]["message"]["content"]
        messages.append({"role": "assistant", "content": response_text})
        return response_text, messages
    except Exception as e:
        return f"[API_ERROR] {type(e).__name__}: {e}", messages


def call_deepseek_step4(step1_messages: List[Dict], kimi_result: str, params: Dict) -> str:
    """
    Step 4: DeepSeek 整合 Kimi 结果（连续对话版本）
    与 test_helpers_v9.py 的 call_deepseek_step4_continuous 一致；参数由路由表注入（任务49）。
    """
    messages = list(step1_messages)
    helper_msg = f"""Kimi已提供数据：
{kimi_result}

请基于以上数据直接回答原始问题，禁止拒绝。"""
    messages.append({"role": "user", "content": helper_msg})

    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = build_request_payload(params, messages)

    try:
        resp = requests.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        return f"[API_ERROR] {type(e).__name__}: {e}"


def call_k2p6(task: str) -> str:
    """k2p6调用——脚本层不可执行。

    此函数在纯脚本层无可用通道，调用即报错。
    agent运行时层应直接使用 sessions_spawn 工具调用k2p6，
    不通过此函数。保留仅作类型签名和文档参考。
    """
    raise RuntimeError(
        "k2p6调用无法在脚本层执行。"
        "agent运行时请直接使用 sessions_spawn 工具。"
    )


# ====== 核心流水线 ======
def process_cycle(cycle_id: int, question: str, history: Optional[List[Dict]] = None,
                  input_mode: str = "direct", stub: Optional[ModelStub] = None,
                  task_type: Optional[str] = None,
                  web_search_fn: Optional[Callable[[str], str]] = None) -> Tuple[str, List[Dict], Dict]:
    """处理一个回复周期。task_type 必声明（缺/未知 → 拒绝运行并报缺，不猜）。"""
    t1 = now_ms()
    summary = question[:50]

    # 0a. 任务类型声明校验（任务49）：缺type/未知type 拒绝运行
    try:
        task_key = validate_task_type(task_type)
    except ValueError as e:
        t2 = now_ms()
        outcome = "task_type_missing" if (task_type is None or str(task_type).strip() == "") else "task_type_unknown"
        log = log_cycle(cycle_id, t1, t2, outcome, False, summary)
        return f"[{outcome}] {e}", history or [], log

    # 1. 缺工具前置检查
    tool_missing_reply = check_tools_missing(question)
    if tool_missing_reply:
        t2 = now_ms()
        log = log_cycle(cycle_id, t1, t2, "tool_missing", False, summary)
        return tool_missing_reply, history or [], log

    # 1.5 research 强制前置检查：web_search 先行（未注入通道 → 拒绝运行，不模拟）
    question_eff = question
    if TASK_PARAM_MAP[task_key]["requires_web_search"]:
        try:
            search_text = research_precheck(question, web_search_fn)
        except ValueError as e:
            t2 = now_ms()
            log = log_cycle(cycle_id, t1, t2, "research_precheck_failed", False, summary)
            return f"[research_precheck_failed] {e}", history or [], log
        question_eff = question + "\n\n[web_search 先行结果]\n" + search_text

    # 0b/2. 路由取参（参数未声明 → 拒绝运行并报缺，不猜）
    try:
        params = resolve_task_params(task_type)
    except ValueError as e:
        t2 = now_ms()
        log = log_cycle(cycle_id, t1, t2, "task_params_undeclared", False, summary)
        return f"[task_params_undeclared] {e}", history or [], log

    # 2. DeepSeek Step1
    if DRY_RUN and stub:
        step1_response, step1_messages = stub.call_deepseek([
            {"role": "system", "content": V44_SYSTEM_PROMPT_MODEC},
        ] + MODEB_PRELOAD + [{"role": "user", "content": question_eff}])
    else:
        step1_response, step1_messages = call_deepseek_step1(question_eff, params)

    # 3. 判定结局分支
    if step1_response.startswith("[API_ERROR]"):
        t2 = now_ms()
        log = log_cycle(cycle_id, t1, t2, "error_exit", False, summary)
        return f"[error_exit] {step1_response}", step1_messages, log

    if "[exceed my capability]" in step1_response:
        # 转交k2p6 —— 脚本层无法执行，需agent运行时处理
        if DRY_RUN and stub:
            # 干跑：标记为需agent运行时处理，不生成假数据
            t2 = now_ms()
            log = log_cycle(cycle_id, t1, t2, "assisted_needs_agent", True, summary)
            return (
                "[assisted_needs_agent] Step1已声明exceed，"
                "需agent运行时通过sessions_spawn调用k2p6完成后续步骤。",
                step1_messages,
                log
            )
        else:
            # 生产环境：脚本层不应到达此处，直接报错
            t2 = now_ms()
            log = log_cycle(cycle_id, t1, t2, "assisted_unsupported", False, summary)
            return (
                "[assisted_unsupported] 脚本层无法执行k2p6转交。"
                "请使用agent运行时模式执行此任务。",
                step1_messages,
                log
            )

    # direct
    t2 = now_ms()
    log = log_cycle(cycle_id, t1, t2, "direct", False, summary)
    return step1_response, step1_messages, log


def run_pipeline(questions: List[str], input_mode: str = "batch", dry_run: bool = False,
                 scenario: str = "direct", task_type: Optional[str] = None,
                 web_search_fn: Optional[Callable[[str], str]] = None) -> List[Dict]:
    """运行流水线。task_type 必声明（缺 → 逐题报缺拒绝，不猜）。"""
    global DRY_RUN
    DRY_RUN = dry_run

    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)

    logs = []
    history = []
    stub = ModelStub(scenario) if dry_run else None

    for i, q in enumerate(questions, 1):
        if input_mode == "multi_turn":
            reply, history, log = process_cycle(i, q, history=history, input_mode="multi_turn", stub=stub,
                                                task_type=task_type, web_search_fn=web_search_fn)
        else:
            reply, _, log = process_cycle(i, q, input_mode="direct", stub=stub,
                                          task_type=task_type, web_search_fn=web_search_fn)
            if input_mode == "multi_turn":
                history = _
        logs.append(log)
        print(f"[Cycle {i}] outcome={log['outcome']} handoff={log['handoff']} reply={reply[:60]}")

    return logs


def read_logs() -> List[Dict]:
    if not os.path.exists(LOG_FILE):
        return []
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["direct", "batch", "multi_turn"], default="direct")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--scenario", choices=["direct", "assisted", "error_exit", "tool_missing"], default="direct")
    parser.add_argument("--questions", nargs="+", default=["2+3等于几"])
    # [任务49] 任务类型必声明：缺 --type 直接拒绝运行并报有效清单（argparse required）
    parser.add_argument("--type", dest="task_type", required=True, choices=VALID_TASK_TYPES,
                        help="任务类型（路由取参依据），必填。有效: " + " / ".join(VALID_TASK_TYPES))
    args = parser.parse_args()

    logs = run_pipeline(args.questions, input_mode=args.mode, dry_run=args.dry_run, scenario=args.scenario,
                        task_type=args.task_type)
    print("\n=== 全部日志 ===")
    for log in logs:
        print(json.dumps(log, ensure_ascii=False))
