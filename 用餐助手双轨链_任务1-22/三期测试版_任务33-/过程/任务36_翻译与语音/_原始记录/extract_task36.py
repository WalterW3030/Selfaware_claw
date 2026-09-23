#!/usr/bin/env python3
"""任务36程序化抽取落库+机械QC。"""
import re, json, os, sys

REPLY = '/tmp/k2p6_task36_reply.txt'
T34 = '/root/Selfaware_claw/用餐助手双轨链_任务1-22/三期测试版_任务33-/过程/任务34_原生工程与网关'
DEST = '/root/Selfaware_claw/用餐助手双轨链_任务1-22/三期测试版_任务33-/过程/任务36_翻译与语音'

t = open(REPLY, encoding='utf-8').read()
parts = re.split(r'^===== Cycle (\d+) \| outcome=(\w+) handoff=(\w+) =====\n', t, flags=re.M)
doc_body, c2 = parts[4].strip() + '\n', parts[8]

files = {}
def run_state_machine(body):
    cur, cap, buf = None, False, []
    for line in body.split('\n'):
        m = re.match(r'^#{2,3}[^`]*`([^`]+)`', line.strip())
        if m:
            cur = m.group(1).strip()
            continue
        if line.strip().startswith('```'):
            if not cap:
                cap, buf = True, []
            else:
                cap = False
                if cur:
                    files[cur] = '\n'.join(buf).rstrip('\n') + '\n'
                    cur = None
            continue
        if cap:
            buf.append(line)
run_state_machine(c2)

final = {'点餐助手翻译与语音增补_任务36.md': doc_body}
final.update(files)

aj_raw = json.loads(files['app.json'])  # 模型给出的是plugins声明片段(pages仅order)——保留原文入原始记录
import shutil
os.makedirs(os.path.join(DEST, '_原始记录'), exist_ok=True)
open(os.path.join(DEST, '_原始记录', 'appjson_模型原始片段.json'), 'w', encoding='utf-8').write(
    json.dumps(aj_raw, ensure_ascii=False, indent=2) + '\n')
aj_base = json.load(open(f'{T34}/app.json', encoding='utf-8'))  # 任务34全量app.json
aj_base['plugins'] = aj_raw['plugins']  # 机械合并：仅插入plugins块，其余逐字保留
final['app.json'] = json.dumps(aj_base, ensure_ascii=False, indent=2) + '\n'

os.makedirs(DEST, exist_ok=True)
for rel, content in sorted(final.items()):
    p = os.path.join(DEST, rel)
    os.makedirs(os.path.dirname(p) or DEST, exist_ok=True)
    open(p, 'w', encoding='utf-8').write(content)

qc = []
def check(name, cond, detail=''):
    qc.append({'item': name, 'pass': bool(cond), 'detail': detail})

check('文件齐套(设计文档+index.js+order.js+order.wxml+app.json+gateway.js)',
      set(final) == {'点餐助手翻译与语音增补_任务36.md','cloudfunctions/aiGateway/index.js',
                     'pages/order/order.js','pages/order/order.wxml','app.json','common/gateway.js'},
      str(sorted(final)))

idx = final['cloudfunctions/aiGateway/index.js']
for mode, model in [('translate','hy3'), ('order_phrase','hy3')]:
    check(f'MODEL_MAP新增{mode}=hy3', re.search(rf"{mode}:\s*{{[^}}]*model:\s*'{model}'", idx) is not None)
for mode in ['recognize','copy','nutrition','order_fast','order_deep','chat']:
    check(f'原有mode保留:{mode}', f"{mode}:" in idx)
check('extend姿势未破坏', "createModel('cloudbase')" in idx and 'generateText' in idx)
check('selfhost通道保留', 'SELFHOST_BASE_URL' in idx and 'numeric_leak_blocked' in idx)

oj = final['pages/order/order.js']
for kw in ['textToSpeech', 'InnerAudioContext', 'order_phrase', 'translate', 'requirePlugin', '[任务36]']:
    check(f'order.js含[{kw}]', kw in oj)

ow = final['pages/order/order.wxml']
for kw in ['[任务36]', '粤语']:
    check(f'order.wxml含[{kw}]', kw in ow)
check('粤语置灰/即将支持标注', ('即将支持' in ow) or ('disabled' in ow), '')

aj = json.loads(final['app.json'])
wj = aj.get('plugins', {}).get('WechatSI', {})
check('app.json plugins.WechatSI=0.3.5(provider=官方appid)',
      wj.get('version') == '0.3.5' and wj.get('provider') == 'wx069ba97219f66d99', str(wj))
check('app.json五路由+cloud保留(合并后)', len(aj.get('pages', [])) == 5 and aj.get('cloud') is True)

gw_ctx = open(f'{T34}/common/gateway.js', encoding='utf-8').read()
check('gateway.js与任务34版逐字一致(未改动声明属实)', final['common/gateway.js'] == gw_ctx)

doc = final['点餐助手翻译与语音增补_任务36.md']
for kw in ['translate', 'order_phrase', 'WechatSI', '粤语', '普通话', '英语', 'hy3', '降级', '快速', '深度', '置灰']:
    check(f'设计文档含[{kw}]', kw in doc)
check('设计文档注明插件版本0.3.5(信息项)', '0.3.5' in doc, '文档未写版本号，版本以app.json为准（信息项，不阻断）')

os.makedirs(os.path.join(DEST, '_原始记录'), exist_ok=True)
json.dump(qc, open('/tmp/task36_qc.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
fails = [q for q in qc if not q['pass']]
hard_fails = [q for q in fails if '信息项' not in q['item']]
print(f"抽取落库 {len(final)} 件 -> {DEST}")
print(f"QC: {len(qc)-len(fails)}/{len(qc)} PASS; FAIL: {len(fails)}（其中信息项{len(fails)-len(hard_fails)}条不阻断）")
for q in fails:
    print('  FAIL:', q['item'], '-', q['detail'][:100])
sys.exit(0 if not hard_fails else 1)
