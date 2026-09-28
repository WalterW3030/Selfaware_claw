#!/usr/bin/env python3
"""任务37验收修正：以任务36八位版为基座，最小插入合并recommend两位。"""
import re, subprocess, sys

BASE = '/root/Selfaware_claw/用餐助手双轨链_任务1-22/三期测试版_任务33-'
SRC = f'{BASE}/过程/任务36_翻译与语音/cloudfunctions/aiGateway/index.js'
DST = f'{BASE}/过程/任务37_推荐后端/cloudfunctions/aiGateway/index.js'

orig = open(SRC, encoding='utf-8').read()

# 1) 头部mode清单注释追加一行（对齐任务37交付版的标注风格）
header_anchor = '// mode: recognize | copy | nutrition | order_fast | order_deep | chat | translate | order_phrase\n'
assert header_anchor in orig, 'header anchor missing'
merged = orig.replace(
    header_anchor,
    header_anchor + '//       + recommend_fast | recommend_deep            ← 【任务37】新增两位（推荐系统）\n'
)

# 2) MODEL_MAP最小插入：order_phrase行尾加逗号 + 追加注释块与两位
map_anchor = "  order_phrase: { channel: 'extend', model: 'hy3'                              }\n}"
assert map_anchor in merged, 'map anchor missing'
block = (
    "  order_phrase: { channel: 'extend', model: 'hy3'                              },\n"
    "\n"
    "  // ── 【任务37】新增：推荐两位（对齐 common/recommend.js 的 cardToMode 映射）──\n"
    "  // 快速卡080 → recommend_fast：思考 low（推理任务禁 off，见详细卡079/快速卡080）\n"
    "  recommend_fast: { channel: 'extend', model: 'deepseek-flash', thinking: 'low' },\n"
    "  // 详细卡079 → recommend_deep：默认思考 medium；复杂个案可上探 'high'\n"
    "  //   （上探方式：将该行 thinking 临时改 'high'，或调用侧显式覆盖；\n"
    "  //    常规个案保持 medium，勿默认上探以控成本）\n"
    "  recommend_deep: { channel: 'extend', model: 'deepseek-flash', thinking: 'medium' }\n"
    "}"
)
merged = merged.replace(map_anchor, block)

open(DST, 'w', encoding='utf-8').write(merged)

# QC：diff应仅为插入+order_phrase尾逗号；原8位取值逐字不动；共10位
import difflib
od, nd = orig.split('\n'), merged.split('\n')
op = difflib.SequenceMatcher(None, od, nd).get_opcodes()
pat = re.compile(r"(\w+):\s*\{[^{}]*?model:\s*'([^']+)'(?:[^{}]*?thinking:\s*'([^']+)')?")
om = {m: (md, th or None) for m, md, th in pat.findall(orig)}
nm = {m: (md, th or None) for m, md, th in pat.findall(merged)}
eight = ['recognize', 'copy', 'nutrition', 'order_fast', 'order_deep', 'chat', 'translate', 'order_phrase']
ok_diff = all(t in ('equal', 'insert', 'replace') for t, *_ in op)
ok8 = all(om.get(m) == nm.get(m) for m in eight)
ok10 = len(nm) == 10 and set(nm) == set(eight + ['recommend_fast', 'recommend_deep'])
okcomma = re.search(r"order_phrase:\s*\{[^}]*'hy3'\s*\},", merged) is not None
r = subprocess.run(['node', '--check', DST], capture_output=True, text=True)
oknode = r.returncode == 0
print('opcodes非equal:', [t for t, *_ in op if t != 'equal'], '(replace=尾逗号行)')
print('原8位取值不动:', ok8, '| 共10位:', ok10, '| 尾逗号:', okcomma, '| node --check:', oknode)
print('SIZE:', len(merged.encode('utf-8')), 'B')
sys.exit(0 if (ok8 and ok10 and okcomma and oknode) else 1)
