# [任务49] 参数路由层负向用例（独立 harness，不共享生产假设）
# 【任务58更新】research 档参数已按 Walter 2026-10-14 定稿填值（model=deepseek-v4-flash、
#   thinking=enabled、reasoning_effort=High、max_tokens=30000）；第6例由"未声明→报缺"改写为
#   "resolve成功+读出值与清单一致"；第7例 web_search precheck 拒绝保留不动。
# 运行：python3 tests/test_routing.py（在任务49目录下，依 importlib 按路径加载canonical）
import importlib.util
import os
import sys

CANONICAL = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "k2p6_pipeline_v2_核查.py")
spec = importlib.util.spec_from_file_location("k2p6_pipeline_v2", os.path.abspath(CANONICAL))
pipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipe)

pipe.LOG_FILE = "/tmp/k2p6_task49_test_log.jsonl"
pipe.DRY_RUN = True

pass_n = 0
fail_n = 0
def ok(name, cond, extra=None):
    global pass_n, fail_n
    if cond:
        pass_n += 1
        print("PASS  " + name)
    else:
        fail_n += 1
        print("FAIL  " + name + ("" if extra is None else "  | " + str(extra)))

# 1. 缺type拒绝运行并报缺
reply, _, log = pipe.process_cycle(1, "2+3等于几", stub=pipe.ModelStub("direct"), task_type=None)
ok("缺type→task_type_missing", log["outcome"] == "task_type_unknown" or log["outcome"] == "task_type_missing", log["outcome"])
ok("缺type→报缺文案含'缺任务类型'与有效清单", "缺任务类型" in reply and "code_gen" in reply and "review" in reply, reply[:80])

# 2. 未知type拒绝运行
reply, _, log = pipe.process_cycle(2, "写一首诗", stub=pipe.ModelStub("direct"), task_type="poem")
ok("未知type→task_type_unknown", log["outcome"] == "task_type_unknown", log["outcome"])
ok("未知type→文案点名poem并报有效清单", "'poem'" in reply and "light" in reply, reply[:80])

# 3. light档payload：Non-think=disabled+省略reasoning_effort+temperature 0.7
p = pipe.resolve_task_params("light")
pay = pipe.build_request_payload(p, [])
ok("light→thinking disabled", pay.get("thinking", {}).get("type") == "disabled", pay)
ok("light→无reasoning_effort键", "reasoning_effort" not in pay, pay)
ok("light→temperature=0.7", pay.get("temperature") == 0.7, pay)
ok("light→max_tokens=4096/model", pay.get("max_tokens") == 4096 and pay.get("model") == "deepseek-v4-flash", pay)

# 4. code_gen档：Think High=enabled+effort high+32768+无temperature
p = pipe.resolve_task_params("code_gen")
pay = pipe.build_request_payload(p, [])
ok("code_gen→enabled+high", pay.get("thinking", {}).get("type") == "enabled" and pay.get("reasoning_effort") == "high", pay)
ok("code_gen→32768且无temperature", pay.get("max_tokens") == 32768 and "temperature" not in pay, pay)

# 5. review档：16384
p = pipe.resolve_task_params("review")
pay = pipe.build_request_payload(p, [])
ok("review→16384+high", pay.get("max_tokens") == 16384 and pay.get("reasoning_effort") == "high", pay)

# 6. research参数已声明（任务58：Walter 2026-10-14定稿四值）→ 不再拒绝执行，读出值与清单一致
try:
    p6 = pipe.resolve_task_params("research")
    pay6 = pipe.build_request_payload(p6, [])
    ok("research→resolve成功（不再报缺）", p6.get("task_type") == "research", p6)
    ok("research→model逐字deepseek-v4-flash", pay6.get("model") == "deepseek-v4-flash", pay6)
    ok("research→thinking=enabled（Walter定稿）", pay6.get("thinking", {}).get("type") == "enabled", pay6)
    ok("research→reasoning_effort=high（Walter定稿High）", pay6.get("reasoning_effort") == "high", pay6)
    ok("research→max_tokens逐字30000且无temperature", pay6.get("max_tokens") == 30000 and "temperature" not in pay6, pay6)
except ValueError as e:
    ok("research→resolve成功（不再报缺）", False, "仍抛缺参错: " + str(e)[:80])

# 7. research未注入web_search通道→precheck拒绝（且先于参数报缺）
reply, _, log = pipe.process_cycle(7, "查最新新闻", stub=pipe.ModelStub("direct"), task_type="research", web_search_fn=None)
ok("research→precheck_failed", log["outcome"] == "research_precheck_failed", log["outcome"])
ok("research→文案含'未注入web_search通道'", "未注入 web_search 通道" in reply, reply[:100])

# 8. 官方三档枚举完整
ok("tier枚举=官方三档", sorted(pipe.THINKING_TIER_MAP.keys()) == ["non_think", "think_high", "think_max"], sorted(pipe.THINKING_TIER_MAP.keys()))
ok("think_max=enabled+max（备档正确）", pipe.THINKING_TIER_MAP["think_max"].get("reasoning_effort") == "max", pipe.THINKING_TIER_MAP["think_max"])

# 9. 干跑端到端（light+direct场景）路由生效且结局不变
reply, _, log = pipe.process_cycle(9, "2+3等于几", stub=pipe.ModelStub("direct"), task_type="light")
ok("e2e light→direct结局", log["outcome"] == "direct" and "直接回答" in reply, log["outcome"])

print("\n结果: %d/%d" % (pass_n, pass_n + fail_n))
sys.exit(1 if fail_n else 0)
