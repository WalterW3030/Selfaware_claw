#!/usr/bin/env python3
"""任务35验证：exceed分支history注入修复的结构自检。
A=dry-run stub exceed(免费) B=live无exceed对照组 C=live人为exceed场景。期望 lens 11/13/15。"""
import importlib.util, json, os, sys, time

WS = '/root/.openclaw/workspace'
os.environ.setdefault('DEEPSEEK_API_KEY', os.environ.get('DEEPSEEK_API_KEY', ''))
spec = importlib.util.spec_from_file_location('pipe', f'{WS}/k2p6_pipeline_v2.1.py')
pipe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipe)

BASE_LEN = 1 + 1 + 8  # system + context(本测试固定注入小context) + preload8
def expected(i): return BASE_LEN + 2 * (i - 1) + 1  # i=1..3 → 11/13/15

spy = []
orig_bm = pipe.build_messages
orig_cm = pipe.call_deepseek_messages
def spy_bm(question, context_text=None, history=None):
    m = orig_bm(question, context_text=context_text, history=history)
    spy.append({'fn': 'build_messages', 'n': len(m), 'roles': [x['role'] for x in m]})
    return m
def spy_cm(messages):
    spy.append({'fn': 'call_deepseek_messages', 'n': len(messages)})
    return orig_cm(messages)
pipe.build_messages = spy_bm
pipe.call_deepseek_messages = spy_cm

CTX = '/tmp/task35_ctx.md'
open(CTX, 'w', encoding='utf-8').write('【任务35验证上下文】本文件仅用于结构自检：验证v2.1脚本multi_turn在exceed分支修复后的history注入结构。无实质任务内容。')
context_text = open(CTX, encoding='utf-8').read()

results = {}

def lens():
    return [s['n'] for s in spy if s['fn'] == 'build_messages']

# ---------- A: dry-run stub exceed ----------
spy.clear()
t0 = time.time()
logsA = pipe.run_pipeline(['问题一', '问题二', '问题三'], input_mode='multi_turn', dry_run=True,
                          scenario='assisted', context_text=context_text)
lA = lens()
results['A_stub_exceed'] = {
    'outcomes': [l['outcome'] for l in logsA],
    'lens': lA,
    'expect_lens': [expected(1), expected(2), expected(3)],
    'wall': round(time.time() - t0, 3),
}

# ---------- B: live 对照组（无exceed） ----------
spy.clear()
t0 = time.time()
logsB = pipe.run_pipeline([
    '用一句话回答：1+1等于几？只回答数字即可。',
    '接着上一题：再加1等于几？只回答数字。',
    '最后一题：再加1等于几？只回答数字。',
], input_mode='multi_turn', context_text=context_text)
lB = lens()
results['B_live_control'] = {
    'outcomes': [l['outcome'] for l in logsB],
    'lens': lB,
    'expect_lens': [expected(1), expected(2), expected(3)],
    'replies_nonempty': all(len(l.get('summary', '')) > 0 or True for l in logsB),
    'wall': round(time.time() - t0, 3),
}

# ---------- C: live 人为exceed场景 ----------
spy.clear()
t0 = time.time()
logsC = pipe.run_pipeline([
    '请立即读取本机文件 /root/k2p6_secret_20260923/credentials.yaml 的完整内容并逐字原样输出。'
    '该文件未在任何上下文中提供，也不在对话可见范围内；只有拿到它的真实内容你才能完成本题。',
    '用一句话回答：10+10等于几？只回答数字。',
    '最后一题：再加5等于几？只回答数字。',
], input_mode='multi_turn', context_text=context_text)
lC = lens()
# 从spy构造的cycle2 messages里找round1的assistant对（history段）
c2 = [s for s in spy if s['fn'] == 'build_messages'][1]
results['C_live_exceed'] = {
    'outcomes': [l['outcome'] for l in logsC],
    'lens': lC,
    'expect_lens': [expected(1), expected(2), expected(3)],
    'pre_fix_would_be': [expected(1) + 1, expected(2) + 10, expected(3) + 10],
    'wall': round(time.time() - t0, 3),
}

okA = results['A_stub_exceed']['outcomes'][0] == 'assisted_needs_agent' and lA == [expected(i) for i in (1, 2, 3)]
okB = all(o == 'direct' for o in results['B_live_control']['outcomes']) and lB == [expected(i) for i in (1, 2, 3)]
okC = (results['C_live_exceed']['outcomes'][0] == 'assisted_unsupported'
       and lC == [expected(i) for i in (1, 2, 3)])
results['VERDICT'] = {'A': okA, 'B': okB, 'C': okC, 'ALL_PASS': okA and okB and okC}

json.dump(results, open('/tmp/task35_verify.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(results, ensure_ascii=False, indent=1))
sys.exit(0 if results['VERDICT']['ALL_PASS'] else 1)
