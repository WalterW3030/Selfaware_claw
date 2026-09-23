#!/usr/bin/env python3
"""任务36执行器：两轮multi_turn；v2.1修后版脚本(SHA 2f82c900)；MAX_TOKENS=16384；payload镜像+thinking low注入；spy持久化。"""
import importlib.util, json, os, time, hashlib

os.environ["K2P6_MAX_TOKENS"] = "16384"
os.environ["K2P6_LOG_FILE"] = "/tmp/k2p6_task36_log.jsonl"
os.environ["K2P6_REPLY_FILE"] = "/tmp/k2p6_task36_reply.txt"

SCRIPT = "/root/.openclaw/workspace/k2p6_pipeline_v2.1.py"
CONTEXT = "/tmp/task36_context.md"

spec = importlib.util.spec_from_file_location("k2p6_v21", SCRIPT)
k2p6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k2p6)
import requests

script_sha = hashlib.sha256(open(SCRIPT, "rb").read()).hexdigest()
context_sha = hashlib.sha256(open(CONTEXT, "rb").read()).hexdigest()
context_text = open(CONTEXT, encoding="utf-8").read()
questions = json.load(open("/tmp/task36_questions.json", encoding="utf-8"))
assert len(questions) == 2

calls = []
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

print(f"[BIND] script_sha={script_sha} (修后版2f82c900…)")
print(f"[BIND] context_sha={context_sha} bytes={len(context_text.encode('utf-8'))} (任务32增补+任务36输入[替代声明]+三文件原文)")
print(f"[BIND] questions_sha={hashlib.sha256(open('/tmp/task36_questions.json','rb').read()).hexdigest()}")
print(f"[BIND] env: MAX_TOKENS={os.environ['K2P6_MAX_TOKENS']} model=deepseek-v4-flash mode=multi_turn rounds=2 payload_thinking=enabled/low")
print("[ENV] 执行前环境声明：本轮5条缓冲已处理，无其他待处理消息；最新有效指令=任务36派发 2026-09-23T17:06:37+08:00；调研文件缺失已发替代声明（Kimi 17:04意图原文）")

t_start = time.time()
logs = k2p6.run_pipeline(questions, input_mode="multi_turn", context_text=context_text)
t_end = time.time()

with open("/tmp/k2p6_task36_calls.jsonl", "w", encoding="utf-8") as f:
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
