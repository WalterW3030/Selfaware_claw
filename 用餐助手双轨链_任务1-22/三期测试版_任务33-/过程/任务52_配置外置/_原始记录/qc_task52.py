#!/usr/bin/env python3
"""任务52交付件QC（只读检查，不抽取）：对 DEST 目录在盘文件跑全部机械检查。"""
import re, json, os, sys, subprocess, hashlib

BASE = '/root/Selfaware_claw/用餐助手双轨链_任务1-22/三期测试版_任务33-'
SRC_AIGW = f'{BASE}/过程/任务37_推荐后端/cloudfunctions/aiGateway/index.js'
SRC_IMP  = f'{BASE}/过程/任务43_识图卡接入/cloudfunctions/importRefTables/index.js'
SRC_REC  = f'{BASE}/过程/任务43_识图卡接入/common/recommend.js'
DEST = f'{BASE}/过程/任务52_配置外置'

files = {}
for rel in ['cloudfunctions/shared/assets.config.js', 'cloudfunctions/aiGateway/index.js',
            'cloudfunctions/importRefTables/index.js', 'common/recommend.js',
            '配置变更操作说明.md', 'tests/assets_config_negative_tests.js']:
    p = os.path.join(DEST, rel)
    files[rel] = open(p, encoding='utf-8').read() if os.path.exists(p) else None

cfg = files['cloudfunctions/shared/assets.config.js'] or ''
aigw = files['cloudfunctions/aiGateway/index.js'] or ''
imp = files['cloudfunctions/importRefTables/index.js'] or ''
rec = files['common/recommend.js'] or ''
doc = files['配置变更操作说明.md'] or ''

qc = []
def check(name, cond, detail=''):
    qc.append({'item': name, 'pass': bool(cond), 'detail': detail})

check('文件齐套6件（盘上）', all(v is not None for v in files.values()))

for mode in ['recognize', 'order_fast', 'order_deep', 'chat', 'recommend_fast', 'recommend_deep']:
    check(f'清单MODEL_MAP含[{mode}]', f"{mode}" in cfg)
check("清单MODEL_MAP六位model全deepseek/deepseek-flash", cfg.count('deepseek/deepseek-flash') >= 6,
      str(cfg.count('deepseek/deepseek-flash')))
for no in ['016', '020', '033', '051', '062', '058', '068', '017', '026']:
    check(f'清单EXPECTED_TABLES含表[{no}]', f"'{no}'" in cfg or f'"{no}"' in cfg)
for fn in ['辣度标注惯例_R8.md', '通用维度底线表_R9.md', '口味搭配方法_R3.md', '情景速查表_R7.md']:
    check(f'清单含精确fileName[{fn}]', fn in cfg)
for pid in ['AGT-0924-w8n-096', 'AGT-0924-w8n-097', 'AGT-0924-w8n-098', 'AGT-0924-w8n-099']:
    check(f'清单EXPECTED_PROMPTS含[{pid}]', pid in cfg)
check('清单含PROMPT_BINDINGS四角色', all(f"{r}:" in cfg for r in ['PROMPT_INIT', 'CARD_DEEP', 'CARD_FAST', 'PROMPT_RECOGNIZE']))
check('清单含通道默认值', ('CHANNEL_DEFAULT' in cfg or 'channelDefault' in cfg or '默认' in cfg))
check('清单含自检/报缺逻辑(含角色绑定校验)', ('缺' in cfg and 'PROMPT_BINDINGS' in cfg and 'validate' not in cfg.lower() or 'checkConfig' in cfg))

check('aiGateway改require清单', "require(" in aigw and 'assets.config.js' in aigw)
check('aiGateway本地MODEL_MAP硬编码已移除', not re.search(r"const\s+MODEL_MAP\s*=\s*\{[^}]*model:", aigw, re.S))
check('aiGateway保留normalizeDeepseekModel', 'normalizeDeepseekModel' in aigw)
check('aiGateway保留event.model单次覆盖', 'event.model' in aigw or 'cfg = { ...cfg, model' in aigw)
check('aiGateway保留callExtend错误透传', 'err.response' in aigw)
check('aiGateway清单缺件报缺拒绝(不猜默认)', '缺' in aigw and ('throw' in aigw or 'Error' in aigw))
check('aiGateway经变量访问MODEL_MAP（mode名动态查清单）', re.search(r'MODEL_MAP\s*\[\s*mode\s*\]', aigw) is not None)

check('importRefTables从清单读表/prompt', 'assets.config.js' in imp and 'EXPECTED_TABLES' in imp)
check('importRefTables本地EXPECTED_TABLES硬编码已移除', not re.search(r"const\s+EXPECTED_TABLES\s*=\s*\[", imp))
check('importRefTables保留精确fileName优先', 'fileName' in imp)
check('importRefTables保留数字段模糊兜底', '数字' in imp or 'numeric' in imp.lower() or re.search(r'\\d\+', imp))
check('importRefTables保留listCurrentDirectory列目录', 'listCurrentDirectory' in imp)
check('importRefTables保留envId解析(getWXContext)', 'getWXContext' in imp)
check('importRefTables保留event.files/promptFiles覆盖', 'event.files' in imp and 'event.promptFiles' in imp)
check('importRefTables报缺不编造', '缺' in imp and '编造' in imp)

check('recommend.js从清单读卡id(PROMPT_BINDINGS)', 'assets.config.js' in rec and 'PROMPT_BINDINGS' in rec)
check('recommend.js本地四常量硬编码已移除', not re.search(r"PROMPT_INIT\s*=\s*\{\s*id:\s*'", rec))
check('recommend.js无AGT卡id字面量残留', 'AGT-0924' not in rec)
check('recommend.js保留八态状态机', 'SESSION_STATE' in rec or 'mealSession' in rec)
check('recommend.js保留识图前置链', 'recognizeImages' in rec)
check('recommend.js保留规则层硬过滤', '过敏原' in rec)
check('recommend.js报缺不猜默认', '缺' in rec and ('throw' in rec or 'Error' in rec))

def code_lines(s):
    out = []
    for ln in s.split('\n'):
        s2 = ln.strip()
        if s2.startswith('//') or s2.startswith('*') or s2.startswith('/*'):
            continue
        out.append(ln)
    return '\n'.join(out)

def count_hits(s, pats):
    body = code_lines(s)
    hits = []
    for p in pats:
        hits += re.findall(p, body)
    return hits

model_hits = count_hits(aigw, [r"deepseek/deepseek-flash", r"'deepseek-[^']+'"])
tbl_hits = count_hits(imp, [r'[\u4e00-\u9fffA-Za-z0-9_]+_R\d\.md', r'[\u4e00-\u9fff]+_\d{3}\.md'])
rec_hits = count_hits(rec, [r'AGT-0924-w8n-09[6789]', r'[\u4e00-\u9fffA-Za-z0-9_]+\.md'])
check('grep零残留:aiGateway无硬编码模型名(非注释行)', len(model_hits) == 0, str(model_hits[:5]))
check('grep零残留:importRefTables无硬编码表文件名(非注释行)', len(tbl_hits) == 0, str(tbl_hits[:5]))
check('grep零残留:recommend.js无硬编码卡id/文件名(非注释行)', len(rec_hits) == 0, str(rec_hits[:5]))

check('说明文档含换模型/加速查表/换prompt卡三变更+部署注意+报缺说明',
      all(k in doc for k in ['换模型', '速查表', '换 prompt 卡', '不动', '副本', '缺']))

for rel in ['cloudfunctions/shared/assets.config.js', 'cloudfunctions/aiGateway/index.js',
            'cloudfunctions/importRefTables/index.js', 'common/recommend.js',
            'tests/assets_config_negative_tests.js']:
    p = os.path.join(DEST, rel)
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    check(f'{rel}语法检查(node --check)', r.returncode == 0, r.stderr[:300])

r = subprocess.run(['node', os.path.join(DEST, 'tests', 'assets_config_negative_tests.js')],
                   capture_output=True, text=True, cwd=DEST, timeout=120)
check('负向单测全部PASS', r.returncode == 0 and re.search(r'\d+/\d+ PASS', r.stdout) is not None,
      (r.stdout[-200:] + r.stderr[-300:]).strip())

hashes = {}
for rel in sorted(files):
    p = os.path.join(DEST, rel)
    hashes[rel] = hashlib.sha256(open(p, 'rb').read()).hexdigest()

json.dump(qc, open('/tmp/task52_qc.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
os.makedirs(os.path.join(DEST, '_原始记录'), exist_ok=True)
json.dump(hashes, open(os.path.join(DEST, '_原始记录', 'task52_file_hashes.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

fails = [q for q in qc if not q['pass']]
print(f"QC(盘上复核): {len(qc)-len(fails)}/{len(qc)} PASS; FAIL: {len(fails)}")
for q in fails:
    print('  FAIL:', q['item'], '-', q['detail'][:200])
print('\n负向单测输出尾部:')
print(r.stdout[-300:] if 'r' in dir() else '')
sys.exit(0 if not fails else 1)
