# -*- coding: utf-8 -*-
"""v2.1 更正验证：检测逻辑回归 + 干跑冒烟。不打印任何密钥。"""
import importlib.util

spec = importlib.util.spec_from_file_location("pipe", "/root/.openclaw/workspace/k2p6_pipeline_v2.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

failures = []

def check(name, got, expect):
    ok = got == expect
    print(f"{'PASS' if ok else 'FAIL'} | {name}: got={got} expect={expect}")
    if not ok:
        failures.append(name)

# 1. 回归：任务18真实误判文本（含旧格式模板引用）→ 不得判定exceed
task18_raw = open("/tmp/k2p6_task18_raw.txt", encoding="utf-8").read()
check("task18 raw old-substring present (sanity)", "[exceed my capability]" in task18_raw, True)
check("task18 raw v2.1 detects exceed (expect False)", m.detect_exceed_declaration(task18_raw), False)

# 2. 真声明：行首 EXCEED::
decl = "嗯，这个任务我做不到。\nEXCEED:: 维度：B1（数据检索）。原因：无法访问实时金融数据。\n需要协助的具体需求：查询道琼斯指数。"
check("true EXCEED:: line-start declaration", m.detect_exceed_declaration(decl), True)

# 3. 仅旧格式行首标记（无EXCEED::）→ 不触发（新协议）
old_line = "[exceed my capability] 维度：B1（数据检索）。"
check("old-format line-start marker only", m.detect_exceed_declaration(old_line), False)

# 4. EXCEED:: 在代码块内 → 不触发
in_code = "```\nEXCEED:: 维度：B1。示例。\n```\n这是文档说明。"
check("EXCEED:: inside code fence", m.detect_exceed_declaration(in_code), False)

# 5. EXCEED:: 在引用块内 → 不触发
in_quote = "> EXCEED:: 维度：B1。引用示例。\n正文回答。"
check("EXCEED:: inside quote block", m.detect_exceed_declaration(in_quote), False)

# 6. build_messages 结构：context 注入位置（system之后、问题之前）
msgs = m.build_messages("Q", context_text="CTX", history=[{"role": "user", "content": "H1"}])
roles = [x["role"] for x in msgs]
check("context present", any("CTX" in x["content"] for x in msgs), True)
check("history present", any(x["content"] == "H1" for x in msgs), True)
check("question last", msgs[-1]["content"] == "Q", True)
ctx_idx = next(i for i, x in enumerate(msgs) if "CTX" in x["content"])
sys_idx = next(i for i, x in enumerate(msgs) if x["role"] == "system")
check("context after system", ctx_idx > sys_idx, True)

# 7. 无 context 时 direct 模式与v2一致：system+preload+question
msgs2 = m.build_messages("Q")
check("no-context msg count = 1+len(PRELOAD)+1", len(msgs2), 1 + len(m.MODEB_PRELOAD) + 1)

print()
print("RESULT:", "ALL PASS" if not failures else f"FAILURES: {failures}")
