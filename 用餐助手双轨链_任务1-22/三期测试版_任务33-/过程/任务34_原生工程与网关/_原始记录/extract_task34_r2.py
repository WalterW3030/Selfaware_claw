#!/usr/bin/env python3
"""任务34 r2 程序化抽取落库 + 机械QC。源=/tmp/k2p6_task34_r2_reply.txt，目标=三期/过程/任务34_原生工程与网关/"""
import re, json, os, sys

REPLY = '/tmp/k2p6_task34_r2_reply.txt'
DEST = '/root/Selfaware_claw/用餐助手双轨链_任务1-22/三期测试版_任务33-/过程/任务34_原生工程与网关'
t = open(REPLY, encoding='utf-8').read()

# ---- 切段 ----
secs = re.split(r'^===== Cycle (\d+) \| outcome=(\w+) handoff=(\w+) =====\n', t, flags=re.M)
bodies = {}
i = 1
while i < len(secs):
    bodies[int(secs[i])] = secs[i+3]
    i += 4

files = {}  # path -> content

def save(path, content):
    content = content.rstrip('\n') + '\n'
    files[path] = content

# ---- 通用状态机（代码块内不含围栏，适用cycle1/2）----
def run_state_machine(body, cycle_id):
    cur_file, cur_dir, cap, buf = None, '', False, []
    for line in body.split('\n'):
        m = re.match(r'^#{2,3}[^`]*`([^`]+)`', line.strip())
        if m:
            p = m.group(1).strip()
            if p.endswith('/'):
                cur_dir, cur_file = p.rstrip('/'), None
            else:
                cur_file = p
            continue
        m = re.match(r'^\*\*([A-Za-z0-9_]+\.(?:wxml|js|wxss|json))\*\*', line.strip())
        if m and cur_dir:
            cur_file = f"{cur_dir}/{m.group(1)}"
            continue
        if line.strip().startswith('```'):
            if not cap:
                cap, buf = True, []
            else:
                cap = False
                if cur_file:
                    save(f"c{cycle_id}::{cur_file}", '\n'.join(buf))
                    cur_file = None
            continue
        if cap:
            buf.append(line)

run_state_machine(bodies[1], 1)
run_state_machine(bodies[2], 2)
run_state_machine(bodies[3], 3)

# ---- cycle3 说明文档（markdown大块，内含嵌套围栏：取## 四、之后到## 五、之前的最后一个围栏）----
seg = bodies[3].split('## 四、', 1)[1]
seg = seg.split('## 五、本轮交付说明', 1)[0]
inner = seg.split('```markdown\n', 1)[1]
doc = inner[:inner.rfind('```')].rstrip('\n') + '\n'
save('doc::网关部署与联调说明.md', doc)

# ---- cycle1 连带修改与映射说明（第四节起至轮末）----
c1 = bodies[1]
notes = c1.split('## 四、需同步修改的文档', 1)
if len(notes) == 2:
    save('notes::骨架原生化_连带修改与映射说明.md', '## 四、需同步修改的文档' + notes[1].split('需要我继续', 1)[0].rstrip() + '\n')

# ---- 冲突裁决：index.js 取cycle3完整版；config/package 取cycle2并与cycle3交叉核对 ----
def pick(name):
    c2k = [k for k in files if k.startswith('c2::') and k.endswith('/' + name)]
    c3k = [k for k in files if k.startswith('c3::') and k.endswith('/' + name)]
    return c2k, c3k

final = {}
# cycle1 全部（前缀 c1::）
for k, v in files.items():
    if k.startswith('c1::'):
        final[k[4:]] = v
for k, v in files.items():
    if k.startswith('doc::') or k.startswith('notes::'):
        final[k.split('::', 1)[1]] = v
c2i, c3i = pick('index.js')
final['cloudfunctions/aiGateway/index.js'] = files[c3i[0]]
c2c, c3c = pick('config.json')
c2p, c3p = pick('package.json')
final['cloudfunctions/aiGateway/config.json'] = files[c2c[0]]
final['cloudfunctions/aiGateway/package.json'] = files[c3p[0]]  # 定稿版（c3描述同步为双通道）
cross_config = files[c3c[0]].strip() == files[c2c[0]].strip()
# package的c2/c3差异仅为description语义更新；实质校验=依赖锁不变
pkg_dep_ok = '"wx-server-sdk": "~4.0.1"' in files[c3p[0]] and files[c2p[0]].split('"dependencies"')[1] == files[c3p[0]].split('"dependencies"')[1]

# ---- 落库 ----
os.makedirs(DEST, exist_ok=True)
for rel, content in sorted(final.items()):
    p = os.path.join(DEST, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(content)

# ---- 机械QC ----
qc = []
def check(name, cond, detail=''):
    qc.append({'item': name, 'pass': bool(cond), 'detail': detail})

expected = (['app.js','app.json','app.wxss','project.config.json','common/gateway.js','common/confirm.js']
    + [f'pages/{pg}/{pg}.{ext}' for pg in ['index','result','history','profile','order'] for ext in ['wxml','js','wxss','json']]
    + ['cloudfunctions/aiGateway/index.js','cloudfunctions/aiGateway/config.json','cloudfunctions/aiGateway/package.json'])
missing = [e for e in expected if e not in final or len(final[e].strip()) < 5]
check('30文件齐套（26原生+网关3+说明）', len(final) >= 30 and not missing, f"缺失:{missing}" if missing else f"共{len(final)}件")

pc = json.loads(final['project.config.json'])
check('libVersion=3.15.1', pc.get('libVersion') == '3.15.1', str(pc.get('libVersion')))
check('cloudfunctionRoot存在', bool(pc.get('cloudfunctionRoot')), str(pc.get('cloudfunctionRoot')))
check('appid占位存在', 'appid' in pc, repr(pc.get('appid')))

aj = json.loads(final['app.json'])
check('app.json五路由+cloud', len(aj.get('pages', [])) == 5 and aj.get('cloud') is True and aj['pages'][0] == 'pages/index/index', str(aj.get('pages')))

uni_pat = re.compile(r'createSSRApp|@dcloudio|v-if=|v-for=|@click|uni\.(chooseImage|navigateTo|showToast)')
uni_hits = [k for k, v in final.items() if not k.endswith('说明.md') and uni_pat.search(v)]
check('uni-app痕迹清零', not uni_hits, str(uni_hits))

check('common模块导出', 'module.exports' in final['common/gateway.js'] and 'module.exports' in final['common/confirm.js'])
check('app.js云初始化+env占位注释', 'wx.cloud.init' in final['app.js'] and 'Walter' in final['app.js'])

idx = final['cloudfunctions/aiGateway/index.js']
for mode, model in [('recognize','deepseek-flash'), ('copy','hy3'), ('nutrition','hy3'), ('order_fast','deepseek-flash'), ('order_deep','deepseek-flash'), ('chat','deepseek-flash')]:
    check(f'MODEL_MAP.{mode}={model}', re.search(rf"{mode}:\s*{{[^}}]*model:\s*'{model}'", idx) is not None)
check('thinking档位off/medium/low在位', all(s in idx for s in ["'off'", "'medium'", "'low'"]))
check('extend调用姿势', "cloud.ai()" in idx and "createModel('cloudbase')" in idx and 'generateText' in idx)
check('numeric_leak_blocked拦截', 'numeric_leak_blocked' in idx)
check('selfhost读环境变量+默认关闭', 'SELFHOST_BASE_URL' in idx and 'SELFHOST_API_KEY' in idx)
check('cycle2/3 config一致', cross_config)
check('package依赖锁不变(~4.0.1)', pkg_dep_ok, 'c3仅更新description为双通道表述，定稿取c3')

doc = final['网关部署与联调说明.md']
for kw in ['开发者工具', 'CodeBuddy', '本地调试', 'mode=chat', '环境ID', '基础库', '未开通']:
    check(f'说明文档含[{kw}]', kw in doc)
check('零TODO占位(代码文件)', not any('TODO' in v for k, v in final.items() if k.endswith('.js') and 'confirm' not in k))

os.makedirs(os.path.join(DEST, '_原始记录'), exist_ok=True)
json.dump(qc, open('/tmp/task34_r2_qc.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
fails = [q for q in qc if not q['pass']]
print(f"抽取落库 {len(final)} 件 -> {DEST}")
print(f"QC: {len(qc)-len(fails)}/{len(qc)} PASS; FAIL项: {len(fails)}")
for q in fails:
    print('  FAIL:', q['item'], '-', q['detail'][:120])
print("cross-check config一致:", cross_config, "| package依赖不变:", pkg_dep_ok)
sys.exit(0 if not fails else 1)
