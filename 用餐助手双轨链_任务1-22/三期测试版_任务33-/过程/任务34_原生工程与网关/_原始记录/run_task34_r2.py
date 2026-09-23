#!/usr/bin/env python3
"""任务34 r2执行器（Coordinator修订：context+骨架14文件、MAX_TOKENS=16384、payload显式thinking effort=low——运行时注入，脚本文件一字不改）。"""
import importlib.util, json, os, time, hashlib

os.environ["K2P6_MAX_TOKENS"] = "16384"
os.environ["K2P6_LOG_FILE"] = "/tmp/k2p6_task34_r2_log.jsonl"
os.environ["K2P6_REPLY_FILE"] = "/tmp/k2p6_task34_r2_reply.txt"

SCRIPT = "/root/.openclaw/workspace/k2p6_pipeline_v2.1.py"
CONTEXT = "/tmp/task34_r2_context.md"

spec = importlib.util.spec_from_file_location("k2p6_v21", SCRIPT)
k2p6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k2p6)
import requests

script_sha = hashlib.sha256(open(SCRIPT, "rb").read()).hexdigest()
context_sha = hashlib.sha256(open(CONTEXT, "rb").read()).hexdigest()
context_text = open(CONTEXT, encoding="utf-8").read()
questions = json.load(open("/tmp/task34_r2_questions.json", encoding="utf-8"))
assert len(questions) == 3

calls = []
# —— payload镜像原调用（同URL/headers/temperature/stream），仅追加thinking字段；脚本文件不改 ——
def call_with_thinking(messages):
    calls.append([dict(m) for m in messages])
    headers = {
        "Authorization": f"Bearer {k2p6.DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": k2p6.DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "stream": False,
        "max_tokens": int(os.environ.get("K2P6_MAX_TOKENS", "4096")),
        "thinking": {"type": "enabled", "effort": "low"},
    }
    try:
        resp = requests.post(
            f"{k2p6.DEEPSEEK_BASE_URL}/chat/completions",
            headers=headers, json=payload, timeout=120,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
        messages.append({"role": "assistant", "content": text})
        return text, messages
    except Exception as e:
        return f"[API_ERROR] {type(e).__name__}: {e}", messages

k2p6.call_deepseek_messages = call_with_thinking

print(f"[BIND] script_sha={script_sha} (脚本文件未改)")
print(f"[BIND] context_sha={context_sha} bytes={len(context_text.encode('utf-8'))} (四份+骨架14文件)")
print(f"[BIND] questions_sha={hashlib.sha256(open('/tmp/task34_r2_questions.json','rb').read()).hexdigest()}")
print(f"[BIND] env: MAX_TOKENS={os.environ['K2P6_MAX_TOKENS']} model=deepseek-v4-flash mode=multi_turn rounds=3 payload_thinking=enabled/low")
print("[ENV] 执行前环境声明：本轮5条缓冲已处理，无其他待处理消息；最新有效指令=任务34r2修订 2026-09-23T15:08:10+08:00（r1已停止登记并入库commit 57d1861，r2不销毁r1任何记录）")

t_start = time.time()
logs = k2p6.run_pipeline(questions, input_mode="multi_turn", context_text=context_text)
t_end = time.time()

with open("/tmp/k2p6_task34_r2_calls.jsonl", "w", encoding="utf-8") as f:
    for i, msgs in enumerate(calls, 1):
        f.write(json.dumps({"cycle": i, "messages": msgs}, ensure_ascii=False) + "\n")

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
