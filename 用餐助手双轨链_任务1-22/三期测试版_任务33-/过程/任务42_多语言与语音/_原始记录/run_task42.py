#!/usr/bin/env python3
"""任务42执行器：三轮multi_turn；v2.1修后版脚本(SHA 2f82c900)；MAX_TOKENS=16384；thinking一律disabled；spy持久化。机制与任务39执行器一致。"""
import importlib.util, json, os, time, hashlib

os.environ["K2P6_MAX_TOKENS"] = "16384"
os.environ["K2P6_LOG_FILE"] = "/tmp/k2p6_task42_log.jsonl"
os.environ["K2P6_REPLY_FILE"] = "/tmp/k2p6_task42_reply.txt"

SCRIPT = "/root/Selfaware_claw/ds_kimi侧运行证据/k2p6_pipeline_v2.1.py"
CONTEXT = "/tmp/task42_context.md"
QUESTIONS = "/tmp/task42_questions.json"

spec = importlib.util.spec_from_file_location("k2p6_v21", SCRIPT)
k2p6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(k2p6)
import requests

script_sha = hashlib.sha256(open(SCRIPT, "rb").read()).hexdigest()
context_sha = hashlib.sha256(open(CONTEXT, "rb").read()).hexdigest()
context_text = open(CONTEXT, encoding="utf-8").read()
questions = json.load(open(QUESTIONS, encoding="utf-8"))
assert len(questions) == 3
q_file_sha = hashlib.sha256(open(QUESTIONS, "rb").read()).hexdigest()

calls = []
meta = []

def call_disabled(messages):
    calls.append([dict(m) for m in messages])
    headers = {"Authorization": f"Bearer {k2p6.DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": k2p6.DEEPSEEK_MODEL, "messages": messages, "temperature": 0.7,
               "stream": False, "max_tokens": 16384, "thinking": {"type": "disabled"}}
    t0 = time.time()
    resp = requests.post(f"{k2p6.DEEPSEEK_BASE_URL}/chat/completions", headers=headers, json=payload, timeout=300)
    t1 = time.time()
    resp.raise_for_status()
    j = resp.json()
    choice = j["choices"][0]
    text = choice["message"].get("content") or ""
    usage = j.get("usage") or {}
    rt = (usage.get("completion_tokens_details") or {}).get("reasoning_tokens")
    meta.append({"call": len(calls), "thinking": "disabled", "wall_clock_s": round(t1 - t0, 3),
                 "finish_reason": choice.get("finish_reason"),
                 "reasoning_tokens": rt, "completion_tokens": usage.get("completion_tokens"),
                 "content_len": len(text)})
    messages.append({"role": "assistant", "content": text})
    return text, messages

k2p6.call_deepseek_messages = call_disabled

print(f"[BIND] script_sha={script_sha} (修后版2f82c900…)")
print(f"[BIND] context_sha={context_sha} bytes={len(context_text.encode('utf-8'))} (十二份拼接：方案v1.0设计依据+规格v1.3+任务39三页七件+任务38 app.json+任务34 profile/app.js)")
print(f"[BIND] questions_sha={q_file_sha} bytes={sum(len(q) for q in questions)} rounds=3")
for i, q in enumerate(questions, 1):
    print(f"[BIND] Q{i}_sha={hashlib.sha256(q.encode('utf-8')).hexdigest()} len={len(q)}")
print("[BIND] env: MAX_TOKENS=16384 model=deepseek-v4-flash mode=multi_turn rounds=3 thinking=disabled(三轮一律)")
print("[ENV] 执行前环境声明：群复扫最新有效指令=任务42派发2026-10-03T19:45:15+08:00，其后无停止令；仓库已pull至4a09b28；单会话执行")

t_start = time.time()
logs = k2p6.run_pipeline(questions, input_mode="multi_turn", context_text=context_text)
t_end = time.time()

with open("/tmp/k2p6_task42_calls.jsonl", "w", encoding="utf-8") as f:
    for i, msgs in enumerate(calls, 1):
        f.write(json.dumps({"cycle": i, "messages": msgs}, ensure_ascii=False) + "\n")
with open("/tmp/k2p6_task42_meta.json", "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=1)

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
for m in meta:
    print(f"[META] call{m['call']}: finish={m['finish_reason']} reasoning={m['reasoning_tokens']}/{m['completion_tokens']} content_len={m['content_len']} wall={m['wall_clock_s']}s")
for lg in logs:
    dur = lg["reply_completed_at_ms"] - lg["input_received_at_ms"]
    print(f"[CYCLE] id={lg['cycle_id']} outcome={lg['outcome']} handoff={lg['handoff']} dur_ms={dur}")
print("[STRUCT_ASSERT]" + ("ALL_PASS" if ok else "HAS_FAILURE"))
