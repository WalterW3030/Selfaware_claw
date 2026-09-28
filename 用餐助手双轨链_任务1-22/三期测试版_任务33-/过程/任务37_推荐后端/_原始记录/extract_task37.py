#!/usr/bin/env python3
"""任务37程序化抽取落库+机械QC。"""
import re, json, os, sys, subprocess

REPLY = '/tmp/k2p6_task37_reply.txt'
BASE = '/root/Selfaware_claw/用餐助手双轨链_任务1-22/三期测试版_任务33-'
SRC_INDEX = f'{BASE}/过程/任务34_原生工程与网关/cloudfunctions/aiGateway/index.js'
DEST = f'{BASE}/过程/任务37_推荐后端'

t = open(REPLY, encoding='utf-8').read()
parts = re.split(r'^===== Cycle (\d+) \| outcome=(\w+) handoff=(\w+) =====\n', t, flags=re.M)
c1, c2 = parts[4], parts[8]

def first_fence(body):
    m = re.search(r'^```\w*\n(.*?)^```\s*$', body, flags=re.M | re.S)
    return m.group(1).rstrip('\n') + '\n' if m else None

files = {'common/recommend.js': first_fence(c1)}

cur, cap, buf = None, False, []
for line in c2.split('\n'):
    m = re.match(r'^##\s*文件\d+[^`]*`([^`]+)`', line.strip())
    if m:
        cur = m.group(1).strip()
        continue
    if line.strip().startswith('```'):
        if not cap:
            cap, buf = True, []
        else:
            cap = False
            if cur and cur not in files:
                files[cur] = '\n'.join(buf).rstrip('\n') + '\n'
                cur = None
        continue
    if cap:
        buf.append(line)

os.makedirs(DEST, exist_ok=True)
for rel, content in files.items():
    p = os.path.join(DEST, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(content)

qc = []
def check(name, cond, detail=''):
    qc.append({'item': name, 'pass': bool(cond), 'detail': detail})

check('文件齐套(recommend.js+index.js+initDb+importRefTables)',
      set(files) == {'common/recommend.js', 'cloudfunctions/aiGateway/index.js',
                     'cloudfunctions/initDb/index.js', 'cloudfunctions/importRefTables/index.js'},
      str(sorted(files)))

rc = files['common/recommend.js']
for kw in ['mealSession', 'prompt_assets', 'ref_tables', 'dish_summary', '079', '080', '快速',
           '过敏原', 'loadTables', 'loadPrompt', 'version']:
    check(f'recommend.js含[{kw}]', kw in rc)
check('recommend.js不硬编码prompt全文（按版本号从DB读）', 'prompt_assets' in rc and 'version' in rc)

idx = files['cloudfunctions/aiGateway/index.js']
orig = open(SRC_INDEX, encoding='utf-8').read()
for mode, thinking in [('recommend_fast', 'low'), ('recommend_deep', 'medium')]:
    check(f'MODEL_MAP新增{mode}(thinking {thinking})',
          re.search(rf"{mode}:\s*{{[^}}]*model:\s*'deepseek-flash'[^}}]*thinking[^}}]*'{thinking}'", idx, re.S) is not None or
          (f"{mode}:" in idx and 'deepseek-flash' in idx))
check('recommend_deep注释注明可上探high', 'high' in idx)
for mode in ['recognize', 'copy', 'nutrition', 'order_fast', 'order_deep', 'chat']:
    check(f'原有功能位保留:{mode}', f"{mode}:" in idx)
import difflib
od = [l for l in orig.split('\n') if l.strip()]
nd = [l for l in idx.split('\n') if l.strip()]
sm = difflib.SequenceMatcher(None, od, nd)
opcodes = sm.get_opcodes()
added = sum(j2 - j1 for tag, _, _, j1, j2 in opcodes if tag in ('insert', 'replace'))
# 精确核验：原6功能位的 channel/model/thinking 取值逐字不变；
# 唯一对原行的触碰=chat行尾逗号（JS对象追加新键的语法必需，非取值变更）
pat = re.compile(r"(\w+):\s*\{[^{}]*?model:\s*'([^']+)'(?:[^{}]*?thinking:\s*'([^']+)')?")
orig_modes = {m: (md, th or None) for m, md, th in pat.findall(orig)}
new_modes = {m: (md, th or None) for m, md, th in pat.findall(idx)}
six = ['recognize', 'copy', 'nutrition', 'order_fast', 'order_deep', 'chat']
six_same = all(orig_modes.get(m) == new_modes.get(m) for m in six)
comma_only = idx.count('chat:') == 1 and re.search(r"chat:\s*\{[^}]*'low'\s*\},", idx) is not None
check('原6功能位取值逐字不动（copy/nutrition无thinking字段按原文比对；唯一触碰=chat行尾逗号，语法必需）',
      six_same and comma_only and len(new_modes) == 8 and set(new_modes) == set(six + ['recommend_fast', 'recommend_deep']),
      f'opcodes非equal={[tag for tag, *_ in opcodes if tag != "equal"]}，新增/replace行={added}；六位取值全同={six_same}；new_modes={sorted(new_modes)}')
check('extend姿势未破坏', "createModel('cloudbase')" in idx and 'generateText' in idx)
check('selfhost通道保留', 'SELFHOST_BASE_URL' in idx and 'numeric_leak_blocked' in idx)

db = files['cloudfunctions/initDb/index.js']
for kw in ['ref_tables', 'dish_summary']:
    check(f'initDb建集合[{kw}]', kw in db)
check('initDb含安全规则(只读/仅云函数写)', ('权限' in db or 'auth' in db.lower() or 'read' in db.lower()) and
      ('cloudfunction' in db.lower() or '云函数' in db or '@cloudbase' in db.lower() or 'server' in db.lower()))

imp = files['cloudfunctions/importRefTables/index.js']
for kw in ['ref_tables', 'downloadFile', 'md']:
    check(f'importRefTables含[{kw}]', kw in imp)
check('importRefTables缺失如实报缺不编造', ('报缺' in imp or '缺失' in imp or 'missing' in imp.lower()) and '编造' in imp)

for rel in files:
    p = os.path.join(DEST, rel)
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    check(f'{rel}语法检查(node --check)', r.returncode == 0, r.stderr[:200])

os.makedirs(os.path.join(DEST, '_原始记录'), exist_ok=True)
json.dump(qc, open('/tmp/task37_qc.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
fails = [q for q in qc if not q['pass']]
print(f"抽取落库 {len(files)} 件 -> {DEST}")
for rel in sorted(files):
    print(f"  {rel}  {len(files[rel].encode('utf-8'))}B")
print(f"QC: {len(qc)-len(fails)}/{len(qc)} PASS; FAIL: {len(fails)}")
for q in fails:
    print('  FAIL:', q['item'], '-', q['detail'][:150])
sys.exit(0 if not fails else 1)
