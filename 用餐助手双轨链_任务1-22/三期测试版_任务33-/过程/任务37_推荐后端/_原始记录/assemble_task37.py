#!/usr/bin/env python3
"""任务37输入装配：结论设计文档 + 卡与prompt_v2四文件 + aiGateway/index.js原文 + manifest + 题面两轮。"""
import json, hashlib

REPO = '/root/Selfaware_claw'
BASE = f'{REPO}/用餐助手双轨链_任务1-22/三期测试版_任务33-'
DOC_DESIGN = f'{BASE}/结论/推荐系统结构设计与UI执行方案.md'
CARD_DIR = f'{BASE}/过程/推荐系统_卡与prompt_v2'
INDEX_JS = f'{BASE}/过程/任务34_原生工程与网关/cloudfunctions/aiGateway/index.js'

def sha(b): return hashlib.sha256(b).hexdigest()

parts, manifest = [], []
def add(title, text, src):
    b = text.encode('utf-8')
    parts.append(f'=====【{title}】=====\n{text}')
    manifest.append({'path': src, 'bytes': len(b), 'sha256': sha(b)})

decl = ('【装配声明】任务37派发（2026-09-28T19:48:48+08:00）要求的六份输入本文档已全部就位。'
        '另如实声明：速查表源文件（口味负荷速查表016、场景速查表020及033/051/062）经在库全盘搜索均不存在，'
        '与Coordinator评估（commit 1357efa）所指缺口一致；第2轮题面要求的速查表导入脚本须按"表文件缺失时如实报缺不编造"口径设计。'
        '本声明不构成输入替代，六份均为原文。')
add('装配声明（速查表源文件缺失报备，非替代输入）', decl, '<executor_declaration>')

add('文档1: 推荐系统结构设计与UI执行方案（三期/结论/）',
    open(DOC_DESIGN, encoding='utf-8').read(), DOC_DESIGN)
for title, fn in [('文档2: 详细推荐执行卡_079', '详细推荐执行卡_079.md'),
                  ('文档3: 快速推荐执行卡_080', '快速推荐执行卡_080.md'),
                  ('文档4: 初始化prompt_081', '初始化prompt_081.md'),
                  ('文档5: project_instruction_v2（路由头v2）', 'project_instruction_v2.md')]:
    add(title, open(f'{CARD_DIR}/{fn}', encoding='utf-8').read(), f'{CARD_DIR}/{fn}')
add('文档6: cloudfunctions/aiGateway/index.js 原文（任务34产出，第2轮改造对象）',
    open(INDEX_JS, encoding='utf-8').read(), INDEX_JS)

ctx = '\n\n'.join(parts) + '\n'
open('/tmp/task37_context.md', 'w', encoding='utf-8').write(ctx)
json.dump(manifest, open('/tmp/task37_manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

Q1 = '''产出 common/recommend.js 完整代码：
①mealSession会话状态机（新建/场景判定/需求收集/候选装载/推荐中/两段输出/确认入库/关闭；新餐=新会话默认独立，仅显式声明才延续并记录）；
②prompt装配器（初始化prompt081+当次卡+ref_tables按需拉取+候选清单含成分摘要与数值负荷+用户输入，按"将查的表"声明拉取）；
③卡选择逻辑（默认079，仅用户输入显式含"快速"才080）；
④无支持项查证的二次独立调用编排（同mode新开消息不携带初稿）；
⑤双保险：候选进装配前先调规则层硬过滤（过敏原/忌口/重选），与agent结果不一致以规则层为准并记录。
禁止硬编码prompt全文，prompt按版本号从DB读。'''

Q2 = '''基于context里 aiGateway/index.js 原文产出修改版，并新增两个脚本：
①aiGateway/index.js的MODEL_MAP新增recommend_fast（deepseek-flash思考low）与recommend_deep（deepseek-flash思考medium，注释注明可上探high），原八位不动；
②DB建表脚本：新集合ref_tables（表号/版本/内容/生效标记）与dish_summary（菜品/成分与效应摘要/数值负荷/生成时间/模型版本），含安全规则（ref_tables全员只读仅云函数写，dish_summary同）；
③速查表导入脚本（从云存储md文件解析入ref_tables，表文件缺失时导入器如实报缺不编造）。
输出修改后完整文件与两个新脚本，标注改动点。'''

qs = [Q1, Q2]
json.dump(qs, open('/tmp/task37_questions.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

cb = ctx.encode('utf-8'); qb = json.dumps(qs, ensure_ascii=False, indent=1).encode('utf-8')
print('context bytes:', len(cb), 'sha:', sha(cb))
print('questions bytes:', len(qb), 'sha:', sha(qb))
for m in manifest: print(f"  {m['path'].split('/')[-1]}  {m['bytes']}B  {m['sha256'][:16]}…")
print('Q1 tail:', repr(Q1[-30:]), 'Q2 tail:', repr(Q2[-30:]))
