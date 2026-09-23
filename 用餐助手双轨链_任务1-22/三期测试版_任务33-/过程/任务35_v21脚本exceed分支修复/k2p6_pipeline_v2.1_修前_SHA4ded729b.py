#!/usr/bin/env python3
"""
k2p6转交流水线主脚本 v2.1(Mode B基座 + 完整messages数组调用)
依据:test_helpers_v9.py 原工程方式 | 版本:v2 → v2.1

v2.1 更正(2026-09-15,按Walter任务20):
1. exceed判定改为行锚定结构化检测:只认行首 EXCEED:: 声明,匹配前先剥离代码块与引用块
   (修复v2把回复中引用的 exceed 模板示例误判为声明的漏洞--任务18事故根因)
2. 新增 --context-file 历史注入通道:指定文件内容作为上下文注入 system 之后、问题之前
   (修复v2跨任务/跨进程上下文缺失--核查2查明)
3. 附带修正:multi_turn 模式此前实际不累积历史(process_cycle忽略history参数),现已接通

与v1的核心区别:DeepSeek调用改用完整messages数组(system + MODEB_PRELOAD + question),
与M1M4原工程完全一致,不再使用CLI裸prompt方式。
"""
import json
import os
import sys
import time
import subprocess
import requests
from typing import List, Dict, Tuple, Optional

# ====== 复用 test_helpers_v9.py 的 V44 常量与预载结构(一字不动) ======
V44_SYSTEM_PROMPT_MODEC = """你正在运行 DeepSeek-Kimi 多智能体协作系统(协议 v4.4 - Mode C)。

## 能力边界
- 无实时互联网访问,无法查询股价/天气/新闻等实时数据
- 无法执行代码或运行程序
- 无法访问外部系统、数据库、本地文件
- 无持久记忆,无法跨会话保留信息
- 纯文本模型

## 核心任务:识别并声明能力边界
任务超出能力时:
1. 单独一行、行首输出声明(EXCEED:: 开头)
2. 说明维度:B1=数据检索 B2=代码执行 B3=网页访问 B4=外部系统 B5=其他
3. 提取具体可执行需求(Kimi看到能直接执行的一句话描述)

## 声明格式
EXCEED:: 维度:B?(类别)。原因说明。
需要协助的具体需求:{用一句话描述原始任务需要什么帮助}

注意:声明必须单独成行且位于行首;不要把它写进代码块或引用块内;能力内的任务直接回答,不要输出本声明。

## 判断原则
- 需要实时数据/执行代码/访问网页/外部系统 → 声明 exceed
- 纯知识性问答/分析/推导 → 直接回答,不声明 exceed
- 不确定时:快速评估,明显超出则声明 exceed

## 两阶段行为规则(关键)

### 阶段一:无数据时
- 任务超出能力 → 正确行为:声明 exceed + 提取需求
- 任务在能力内 → 正确行为:直接回答

### 阶段二:收到数据后(Kimi已提供数据)
- 你已收到 Kimi 提供的数据,必须基于该数据作答
- **拒绝性回答是被禁止的**:禁止说"无法""没有数据""建议你自己查""我不能"
- **唯一正确行为**:直接基于所提供的数据给出最终答案
- **强制引用要求**:答案必须引用数据中的具体数值/事实,每个关键结论标注数据来源
- 即使数据不完整或有误,也必须基于现有信息作答,禁止以数据问题为由拒绝回答

## 绝对禁止
- 声明exceed后继续输出workaround或替代方案
- 输出"虽然我不能...但是..."
- 将知识性任务误判为超出能力
- 收到数据后输出拒绝性回答("无法""没有""建议你""我不能")"""

MODEB_PRELOAD = [
    {"role": "user", "content": "你好,我需要你的帮助处理一些任务。"},
    {"role": "assistant", "content": "你好!我可以帮你处理各种任务。不过我需要先说明我的能力范围--我没有实时互联网访问、不能执行代码、没有持久记忆。如果任务超出这些能力,我会明确告知。"},
    {"role": "user", "content": "了解了。那如果我们遇到超出你能力的任务怎么办?"},
    {"role": "assistant", "content": "如果任务超出我的能力,我会单独一行、行首输出 EXCEED:: 声明并说明具体原因和需要的帮助类型。我会尽量提取原始任务的具体需求,这样Kimi就能直接执行了。"},
    {"role": "user", "content": "能给我个例子吗?比如查询道琼斯指数。"},
    {"role": "assistant", "content": "好的。如果用户问'查询道琼斯指数',我会输出两行:\nEXCEED:: 维度:B1(数据检索)。原因:无法访问实时金融数据。\n需要协助的具体需求:查询纽约股市道琼斯指数实时行情。\n这样Kimi就知道要做什么了。"},
    {"role": "user", "content": "明白了。那如果Kimi帮你获取了数据,你会怎么用?"},
    {"role": "assistant", "content": "我会直接使用Kimi提供的数据回答。比如Kimi给我'道琼斯指数53,178.41',我会直接告诉用户这个数值,不会说'我没有数据'或'建议你自己查'。"},
]

# ====== 配置(与test_helpers_v9.py一致) ======
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
DEEPSEEK_MODEL = "deepseek-v4-flash"

LOG_FILE = os.environ.get("K2P6_LOG_FILE", "/tmp/k2p6_pipeline_log.jsonl")
DRY_RUN = os.environ.get("K2P6_DRY_RUN", "false").lower() == "true"

# 缺工具判定:所需工具不在允许列表中
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
    """缺工具前置检查。返回缺工具声明文本,或None表示不缺。"""
    if "股价" in task_summary or "股票" in task_summary or "道琼斯" in task_summary:
        if "kimi_finance" not in AVAILABLE_TOOLS:
            return (
                "[tool_missing] 任务超出能力边界。\n"
                "原因:所需工具 kimi_finance 在当前环境中不可用。\n"
                "结论:无法完成,未做任何模拟。"
            )
    if "执行代码" in task_summary or "运行程序" in task_summary:
        if "exec" not in AVAILABLE_TOOLS:
            return (
                "[tool_missing] 任务超出能力边界。\n"
                "原因:所需工具 exec 在当前环境中不可用。\n"
                "结论:无法完成,未做任何模拟。"
            )
    return None


def strip_code_and_quote_blocks(text: str) -> str:
    """剥离代码块(``` ... ```)与引用块(行首> ),避免示例/引用内容参与声明判定。"""
    out_lines = []
    in_code = False
    for line in text.split("\n"):
        s = line.strip()
        if s.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if s.startswith(">"):
            continue
        out_lines.append(line)
    return "\n".join(out_lines)


def detect_exceed_declaration(response_text: str) -> bool:
    """行锚定结构化检测 exceed 声明:只认行首 EXCEED::。

    步骤:先剥离代码块与引用块,再逐行检查去空白后是否以 EXCEED:: 行首出现。
    旧协议子串 "[exceed my capability]" 不再作为判定依据(v2误判根因:
    回复中引用/示例里的模板字样被子串匹配命中)。
    """
    cleaned = strip_code_and_quote_blocks(response_text)
    for line in cleaned.split("\n"):
        if line.strip().startswith("EXCEED::"):
            return True
    return False


# ====== 模型调用(与test_helpers_v9.py完全一致的方式) ======
class ModelStub:
    """干跑桩:仅预设DeepSeek Step1响应形态,不处理k2p6调用。"""

    def __init__(self, scenario: str = "direct"):
        self.scenario = scenario

    def call_deepseek(self, messages: List[Dict]) -> Tuple[str, List[Dict]]:
        if self.scenario == "direct":
            response = "直接回答:5"
        elif self.scenario == "assisted":
            response = "EXCEED:: 维度:B1(数据检索)。原因:无法访问实时金融数据。\n需要协助的具体需求:查询道琼斯指数。"
        elif self.scenario == "error_exit":
            response = "[API_ERROR] requests.exceptions.ConnectionError: 连接超时"
        else:
            response = "未知场景"
        messages = list(messages)
        messages.append({"role": "assistant", "content": response})
        return response, messages


def build_messages(question: str, context_text: Optional[str] = None,
                   history: Optional[List[Dict]] = None) -> List[Dict]:
    """构建完整 messages 数组:
    system + [context-file注入的上下文] + MODEB_PRELOAD + [multi_turn历史] + question
    (context 与 history 均为 v2.1 新增通道;direct 模式与 v2 完全一致)
    """
    messages = [{"role": "system", "content": V44_SYSTEM_PROMPT_MODEC}]
    if context_text:
        messages.append({
            "role": "user",
            "content": f"【上下文记录】\n{context_text}\n(以上为之前各轮的真实对话内容,供你参考)",
        })
    messages += MODEB_PRELOAD
    if history:
        messages += history
    messages.append({"role": "user", "content": question})
    return messages


def call_deepseek_messages(messages: List[Dict]) -> Tuple[str, List[Dict]]:
    """用已构建的 messages 数组 POST 到 /chat/completions(与test_helpers_v9.py方式一致)。"""
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "stream": False,
        "max_tokens": int(os.environ.get("K2P6_MAX_TOKENS", "4096")),
    }

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


def call_deepseek_step1(question: str, context_text: Optional[str] = None,
                        history: Optional[List[Dict]] = None) -> Tuple[str, List[Dict]]:
    """
    Step 1: DeepSeek 识别是否 exceed(与 test_helpers_v9.py 的 call_deepseek_step1_modeB 一致)

    构建完整 messages 数组:system + [context] + MODEB_PRELOAD + [history] + question
    POST 到 /chat/completions
    Returns: (response_text, messages_history)
    """
    messages = build_messages(question, context_text=context_text, history=history)
    return call_deepseek_messages(messages)


def call_deepseek_step4(step1_messages: List[Dict], kimi_result: str) -> str:
    """
    Step 4: DeepSeek 整合 Kimi 结果(连续对话版本)
    与 test_helpers_v9.py 的 call_deepseek_step4_continuous 一致
    """
    messages = list(step1_messages)
    helper_msg = f"""Kimi已提供数据:
{kimi_result}

请基于以上数据直接回答原始问题,禁止拒绝。"""
    messages.append({"role": "user", "content": helper_msg})

    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "stream": False,
        "max_tokens": int(os.environ.get("K2P6_MAX_TOKENS", "4096")),
    }

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
    """k2p6调用--脚本层不可执行。

    此函数在纯脚本层无可用通道,调用即报错。
    agent运行时层应直接使用 sessions_spawn 工具调用k2p6,
    不通过此函数。保留仅作类型签名和文档参考。
    """
    raise RuntimeError(
        "k2p6调用无法在脚本层执行。"
        "agent运行时请直接使用 sessions_spawn 工具。"
    )


# ====== 核心流水线 ======
def process_cycle(cycle_id: int, question: str, history: Optional[List[Dict]] = None,
                  input_mode: str = "direct", stub: Optional[ModelStub] = None,
                  context_text: Optional[str] = None) -> Tuple[str, List[Dict], Dict]:
    """处理一个回复周期。multi_turn 模式下 history 为此前各轮的 [user, assistant, ...] 序列。"""
    t1 = now_ms()
    summary = question[:50]

    # 1. 缺工具前置检查
    tool_missing_reply = check_tools_missing(question)
    if tool_missing_reply:
        t2 = now_ms()
        log = log_cycle(cycle_id, t1, t2, "tool_missing", False, summary)
        return tool_missing_reply, history or [], log

    # 2. DeepSeek Step1(v2.1:context/history 经 build_messages 注入)
    messages = build_messages(question, context_text=context_text,
                              history=history if input_mode == "multi_turn" else None)
    if DRY_RUN and stub:
        step1_response, step1_messages = stub.call_deepseek(messages)
    else:
        step1_response, step1_messages = call_deepseek_messages(messages)

    # 3. 判定结局分支(v2.1:行锚定结构化检测,替代子串匹配)
    if step1_response.startswith("[API_ERROR]"):
        t2 = now_ms()
        log = log_cycle(cycle_id, t1, t2, "error_exit", False, summary)
        return f"[error_exit] {step1_response}", step1_messages, log

    if detect_exceed_declaration(step1_response):
        # 转交k2p6 -- 脚本层无法执行,需agent运行时处理
        if DRY_RUN and stub:
            # 干跑:标记为需agent运行时处理,不生成假数据
            t2 = now_ms()
            log = log_cycle(cycle_id, t1, t2, "assisted_needs_agent", True, summary)
            return (
                "[assisted_needs_agent] Step1已声明exceed,"
                "需agent运行时通过sessions_spawn调用k2p6完成后续步骤。",
                step1_messages,
                log
            )
        else:
            # 生产环境:脚本层不应到达此处,直接报错
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
    if input_mode == "multi_turn":
        # v2.1:multi_turn 真实累积本轮问答,供下一周期注入
        new_history = list(history or []) + [
            {"role": "user", "content": question},
            {"role": "assistant", "content": step1_response},
        ]
        return step1_response, new_history, log
    return step1_response, step1_messages, log


def run_pipeline(questions: List[str], input_mode: str = "batch", dry_run: bool = False,
                 scenario: str = "direct", context_text: Optional[str] = None) -> List[Dict]:
    """运行流水线。context_text 为 --context-file 注入的上下文(v2.1)。"""
    global DRY_RUN
    DRY_RUN = dry_run

    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)
    reply_out = os.environ.get("K2P6_REPLY_FILE", "")
    if reply_out and os.path.exists(reply_out):
        os.remove(reply_out)

    logs = []
    history = []
    stub = ModelStub(scenario) if dry_run else None

    for i, q in enumerate(questions, 1):
        if input_mode == "multi_turn":
            reply, history, log = process_cycle(i, q, history=history, input_mode="multi_turn", stub=stub,
                                                context_text=context_text)
        else:
            reply, _, log = process_cycle(i, q, input_mode="direct", stub=stub,
                                          context_text=context_text)
        logs.append(log)
        print(f"[Cycle {i}] outcome={log['outcome']} handoff={log['handoff']} reply={reply[:60]}")
        if reply_out:
            with open(reply_out, "a", encoding="utf-8") as rf:
                rf.write(f"===== Cycle {i} | outcome={log['outcome']} handoff={log['handoff']} =====\n")
                rf.write(reply + "\n\n")

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
    parser.add_argument("--context-file", default=None,
                        help="历史注入通道:指定文件内容作为上下文注入 system 之后、问题之前")
    args = parser.parse_args()

    context_text = None
    if args.context_file:
        with open(args.context_file, "r", encoding="utf-8") as cf:
            context_text = cf.read()

    logs = run_pipeline(args.questions, input_mode=args.mode, dry_run=args.dry_run, scenario=args.scenario,
                        context_text=context_text)
    print("\n=== 全部日志 ===")
    for log in logs:
        print(json.dumps(log, ensure_ascii=False))
