#!/usr/bin/env python3
"""任务34执行器：v2.1脚本 multi_turn三轮 + context注入（第一部分总结报告+工程总包+T2执行方案+背景调研），P3结构断言+计时。工程路径同任务24-33。"""
import importlib.util, json, os, time, hashlib

os.environ["K2P6_MAX_TOKENS"] = "8192"
os.environ["K2P6_LOG_FILE"] = "/tmp/k2p6_task34_log.jsonl"
os.environ["K2P6_REPLY_FILE"] = "/tmp/k2p6_task34_reply.txt"

SCRIPT = "/root/.openclaw/workspace/k2p6_pipeline_v2.1.py"
CONTEXT = "/tmp/task34_context.md"

spec = importlib.util.spec_from_file_location("k2p6_v21", SCRIPT)
k2p6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k2p6)

script_sha = hashlib.sha256(open(SCRIPT, "rb").read()).hexdigest()
context_sha = hashlib.sha256(open(CONTEXT, "rb").read()).hexdigest()
context_text = open(CONTEXT, encoding="utf-8").read()

questions = json.load(open("/tmp/task34_questions.json", encoding="utf-8"))
assert len(questions) == 3

calls = []
orig = k2p6.call_deepseek_messages
def spy(messages):
    calls.append([dict(m) for m in messages])
    return orig(messages)
k2p6.call_deepseek_messages = spy

print(f"[BIND] script_sha={script_sha}")
print(f"[BIND] context_sha={context_sha} bytes={len(context_text.encode('utf-8'))}")
print(f"[BIND] env: MAX_TOKENS={os.environ['K2P6_MAX_TOKENS']} model=deepseek-v4-flash mode=multi_turn rounds=3")
print("[ENV] 执行前环境声明：无待处理缓冲消息（7条缓冲已全部处理，最新指令=任务34派发 2026-09-23T14:26:51+08:00）")

t_start = time.time()
logs = k2p6.run_pipeline(questions, input_mode="multi_turn", context_text=context_text)
t_end = time.time()

ok = True
for i, msgs in enumerate(calls, 1):
    expected = 1 + 1 + 8 + 2 * (i - 1) + 1
    a1 = msgs[0]["role"] == "system" and "v4.4" in msgs[0]["content"]
    a2 = msgs[1]["role"] == "user" and "【上下文记录】" in msgs[1]["content"]
    a3 = len(msgs) == expected
    a4 = msgs[-1]["role"] == "user" and msgs[-1]["content"] == questions[i - 1]
    status = "PASS" if (a1 and a2 and a3 and a4) else "FAIL"
    if status == "FAIL":
        ok = False
    print(f"[ASSERT {status}] cycle{i}: len={len(msgs)}(exp={expected}) system_v44={a1} context_injected={a2} tail_verbatim={a4}")

elapsed = t_end - t_start
print(f"[TIMING] wall_clock_total={elapsed:.3f}s start={t_start:.3f} end={t_end:.3f}")
for lg in logs:
    dur = lg["reply_completed_at_ms"] - lg["input_received_at_ms"]
    print(f"[CYCLE] id={lg['cycle_id']} outcome={lg['outcome']} handoff={lg['handoff']} dur_ms={dur}")
print("[STRUCT_ASSERT]" + ("ALL_PASS" if ok else "HAS_FAILURE"))
