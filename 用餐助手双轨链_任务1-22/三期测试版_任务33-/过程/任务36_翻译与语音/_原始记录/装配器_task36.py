#!/usr/bin/env python3
"""任务36输入装配：任务32增补 + 调研替代声明段 + 任务34三文件原文 + manifest + 题面。"""
import json, hashlib, os

REPO = '/root/Selfaware_claw'
T34 = f'{REPO}/用餐助手双轨链_任务1-22/三期测试版_任务33-/过程/任务34_原生工程与网关'
DOC1 = f'{REPO}/用餐助手双轨链_任务1-22/二期设计_任务23-29/点餐助手双模式增补_任务32.md'
FILES = ['cloudfunctions/aiGateway/index.js', 'pages/order/order.js', 'common/gateway.js']

KIMI_INTENT = '''[Buffered IM message, Time: [2026-09-23 Wed 17:04:02 GMT+8]] <@Kimi|kimi> 加入两个功能 菜单翻译和语音点单 即将最终候选转为一段点餐要求，并由ai speech说出，需要支持普通话，粤语和英文翻译，根据任务功能要求和复杂度，选择合适的模型，并将其作为选项加入，完善对应的设计方案和代码部分'''

def sha(b): return hashlib.sha256(b).hexdigest()

parts, manifest = [], []
def add(title, text, src):
    b = text.encode('utf-8')
    parts.append(f'=====【{title}】=====\n{text}')
    manifest.append({'path': src, 'bytes': len(b), 'sha256': sha(b)})

d1 = open(DOC1, encoding='utf-8').read()
add('文档1: 点餐助手双模式增补_任务32（二期设计_任务23-29/）', d1, DOC1)

substitute = ('【装配声明】任务36派发（2026-09-23T17:06:37+08:00）指定的《菜单翻译与语音点单调研_任务36输入.md》'
              '在仓库、工作区、下载目录均不存在（已全盘搜索）。执行器不编造该文件，以下以 Coordinator Kimi 于 17:04:02 的功能意图消息原文作为本文档替代输入；'
              '两轮题面本身含完整规格，任务可执行。若该调研文件后续入库，本替代段特此声明其非原文。\n\n' + KIMI_INTENT)
add('文档2: 任务36输入（调研文件缺失，以Kimi 17:04意图消息原文替代——装配声明）', substitute, '<substitute:Kimi 17:04 intent>')

for rel in FILES:
    t = open(f'{T34}/{rel}', encoding='utf-8').read()
    add(f'骨架源文件: {rel}（任务34产出，任务36第2轮改造对象）', t, f'{T34}/{rel}')

ctx = '\n\n'.join(parts) + '\n'
open('/tmp/task36_context.md', 'w', encoding='utf-8').write(ctx)
json.dump(manifest, open('/tmp/task36_manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

Q1 = '''为点餐助手新增菜单翻译与语音点单双功能，产出设计文档。要求：
①菜单翻译——触发时机（菜单识别确认门禁通过后可选）、三语选项（普通话/粤语/英语）、翻译走aiGateway新增mode=translate用hy3、结果与原文对照展示；
②语音点单——流程为"最终候选确认→AI生成点餐话术（新增mode=order_phrase用hy3，prompt约束菜名只许来自已确认候选不得增删）→用户确认话术→TTS播报"；
③播报通道=WechatSI插件（普通话/英语）+腾讯云TTS粤语备选通道（云函数转发，密钥环境变量，测试版可置灰标注即将支持）；
④与快速/深度双模式的关系（两模式都可翻译可播报，翻译在快速模式下默认只译菜名清单）；
⑤失败降级（TTS失败→展示话术文本让用户自己念）。
输出《点餐助手翻译与语音增补_任务36.md》。'''

Q2 = '''基于context里的三个文件原文（cloudfunctions/aiGateway/index.js、pages/order/order.js、common/gateway.js）产出修改版：
①aiGateway/index.js的MODEL_MAP新增translate与order_phrase两个mode（都hy3，extend通道），其余不动；
②pages/order/order.js+order.wxml：菜单确认后加"翻译"按钮+三语选择器（粤语播报选项置灰标注即将支持）、候选确认后加"生成点餐话术"按钮→话术展示+确认→"播报"按钮（WechatSI插件调用textToSpeech，lang按选择，tts=true，InnerAudioContext播放，失败降级展示文本），插件声明（app.json加plugins.WechatSI版本0.3.5）也给出；
③common/gateway.js不变只确认新mode可复用callAI。
输出修改后完整文件，标注改动点。'''

qs = [Q1, Q2]
json.dump(qs, open('/tmp/task36_questions.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

cb = ctx.encode('utf-8'); qb = json.dumps(qs, ensure_ascii=False, indent=1).encode('utf-8')
print('context bytes:', len(cb), 'sha:', sha(cb))
print('questions bytes:', len(qb), 'sha:', sha(qb))
for m in manifest: print(f"  {m['path'].split('/')[-1]}  {m['bytes']}B  {m['sha256'][:16]}…")
# 题面尾断言基线
print('Q1 tail:', repr(Q1[-30:]), 'Q2 tail:', repr(Q2[-30:]))
