#!/usr/bin/env python3
"""任务52输入装配：四份context拼接（aiGateway+importRefTables+recommend.js+任务48审计报告）+ 两轮题面。"""
import json, hashlib

REPO = '/root/Selfaware_claw'
BASE = f'{REPO}/用餐助手双轨链_任务1-22/三期测试版_任务33-'
AIGW = f'{BASE}/过程/任务37_推荐后端/cloudfunctions/aiGateway/index.js'
IMP  = f'{BASE}/过程/任务43_识图卡接入/cloudfunctions/importRefTables/index.js'
REC  = f'{BASE}/过程/任务43_识图卡接入/common/recommend.js'
AUDIT= f'{BASE}/过程/任务48_硬编码假设普查/审计报告.md'

def sha(b): return hashlib.sha256(b).hexdigest()

parts, manifest = [], []
def add(title, text, src):
    b = text.encode('utf-8')
    parts.append(f'=====【{title}】=====\n{text}')
    manifest.append({'path': src, 'bytes': len(b), 'sha256': sha(b)})

decl = ('【装配声明】任务52派发（2026-10-10T11:15:39+08:00）要求的四份context输入本文档已全部就位，均为磁盘原文逐字拼接。'
        '四件=任务37 aiGateway/index.js（canonical）+任务43 importRefTables/index.js（canonical）+任务43 common/recommend.js（canonical）+任务48硬编码假设普查审计报告。'
        '本声明不构成输入替代。')
add('装配声明', decl, '<executor_declaration>')
add('文档1: cloudfunctions/aiGateway/index.js 原文（任务37目录，canonical）', open(AIGW, encoding='utf-8').read(), AIGW)
add('文档2: cloudfunctions/importRefTables/index.js 原文（任务43目录，canonical）', open(IMP, encoding='utf-8').read(), IMP)
add('文档3: common/recommend.js 原文（任务43目录，canonical）', open(REC, encoding='utf-8').read(), REC)
add('文档4: 任务48硬编码假设普查/审计报告.md', open(AUDIT, encoding='utf-8').read(), AUDIT)

ctx = '\n\n'.join(parts) + '\n'
open('/tmp/task52_context.md', 'w', encoding='utf-8').write(ctx)
json.dump(manifest, open('/tmp/task52_manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

Q1 = '''这是配置外置重构任务（Walter裁决：今后更新模型或参考文件时不得改脚本，故把全部可配置项抽离到单一清单）。基于context中三份脚本原文，产出4个完整文件，每个文件用"## 文件N：`路径`"作标题、完整代码放代码块：

【文件1】cloudfunctions/shared/assets.config.js —— 新建单一配置清单（CommonJS导出，三函数共用，部署时随各函数复制一份），内含：
① MODEL_MAP 六位：recognize/order_fast/order_deep/chat/recommend_fast/recommend_deep → {channel, model}，取值与文档1现状逐字一致（channel全'extend'，model全'deepseek/deepseek-flash'）；
② EXPECTED_TABLES 九项：tableNo→{title, fileName}，取值与文档2现状逐字一致（051/062/058/068带精确fileName，016/020/033/017/026按文档2现有title与无fileName形态照抄），并注明允许数字段模糊兜底；
③ EXPECTED_PROMPTS 四项：promptId→{title, fileName}（AGT-0924-w8n-096/097/098/099），取值与文档2现状逐字一致；
④ 通道默认值（默认channel等常量）。
附清单自检函数（校验MODEL_MAP六位齐全/EXPECTED_TABLES九项/EXPECTED_PROMPTS四项，缺项返回缺项清单）。

【文件2】cloudfunctions/aiGateway/index.js —— 改造版：删除本地MODEL_MAP硬编码，改为require('../shared/assets.config.js')读MODEL_MAP与通道默认值；清单加载自检不通过时报错拒绝执行，错误信息列出全部缺项，绝不猜默认值。normalizeDeepseekModel归一化、event.model单次覆盖、callExtend错误透传等现有功能全部保留。

【文件3】cloudfunctions/importRefTables/index.js —— 改造版：EXPECTED_TABLES/EXPECTED_PROMPTS改从清单读；匹配顺序与现状一致=表文件精确fileName（basename===fileName大小写敏感）优先→无则数字段模糊匹配→再不中如实报缺并列出缺项（不编造）；清单加载自检不通过时报缺拒绝。listCurrentDirectory列目录、downloadFile、envId解析、event.files/promptFiles覆盖通道全部保留。

【文件4】common/recommend.js —— 改造版：PROMPT_INIT/CARD_DEEP/CARD_FAST/PROMPT_RECOGNIZE四个常量{id}改从清单EXPECTED_PROMPTS按promptId读取；清单缺对应卡时报错列出缺项，不猜默认。卡选择/识图前置链/八态状态机/规则层硬过滤/日志埋点等现有逻辑全部保留。

约束：除上述改造点外不改任何现有行为与取值；每个改造文件头部注释注明"任务52配置外置：可配置项已移至cloudfunctions/shared/assets.config.js"。'''

Q2 = '''基于第1轮交付的4个文件，再产出2个文件（同样"## 文件N：`路径`"标题+完整内容代码块）：

【文件5】配置变更操作说明.md —— 面向运维/后续任务的操作说明，覆盖三种高频变更全程不动脚本：①换模型=只改assets.config.js清单里对应mode的model字段一处；②加/换速查表=清单EXPECTED_TABLES加/改一行（tableNo/title/fileName）+md文件传云存储ref_tables/；③换prompt卡=清单EXPECTED_PROMPTS改对应fileName+文件传prompt_assets/。附：部署注意（清单随各函数部署复制一份，三处副本必须同版本）、清单缺件时函数拒绝执行并列出缺项的行为说明。

【文件6】tests/assets_config_negative_tests.js —— 可直接node执行的负向单测（纯Node断言，零云依赖；用Module._load拦截wx-server-sdk与@cloudbase/manager-node替身；用fs/临时改写清单副本模拟缺件，不改仓库原件），至少覆盖：
①清单缺项报缺：清单分别缺MODEL_MAP某mode/EXPECTED_TABLES某tableNo/EXPECTED_PROMPTS某promptId时，三脚本加载即报错，错误信息含"缺"且点名缺项，且不猜默认值继续执行；
②改名不命中不误配：表文件改名后精确fileName不命中、数字段也模糊不中时必须报缺，不得错配到别的表；
③模糊兜底优先级：精确fileName与数字段模糊同时可命中时，必须选中精确fileName指向的文件。
测试结束打印"n/m PASS"。'''

qs = [Q1, Q2]
json.dump(qs, open('/tmp/task52_questions.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

cb = ctx.encode('utf-8'); qb = json.dumps(qs, ensure_ascii=False, indent=1).encode('utf-8')
print('context bytes:', len(cb), 'sha:', sha(cb))
print('questions bytes:', len(qb), 'sha:', sha(qb))
for m in manifest: print(f"  {m['path'].split('/')[-1]}  {m['bytes']}B  {m['sha256'][:16]}…")
print('Q1 tail:', repr(Q1[-30:]), 'Q2 tail:', repr(Q2[-30:]))
