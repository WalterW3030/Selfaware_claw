#!/usr/bin/env python3
"""任务42装配器：context十二份拼接（设计依据+规格+任务39三页七件+任务38 app.json+任务34 profile/app.js），SHA绑定；questions三轮。机制与任务39装配器一致。"""
import json, hashlib, os

BASE = "/root/Selfaware_claw/用餐助手双轨链_任务1-22/三期测试版_任务33-"
OUT_CTX = "/tmp/task42_context.md"
OUT_Q = "/tmp/task42_questions.json"

DOCS = [
    ("多语言与语音方案.md（v1.0，2026-09-30，commit 4a09b28，设计依据，以它为准）", f"{BASE}/结论/多语言与语音方案.md"),
    ("点餐页UI规格汇总_任务39输入.md（v1.3定稿）", f"{BASE}/结论/点餐页UI规格汇总_任务39输入.md"),
    ("pages/order/order.js 原文（任务39版，第2轮改造基座）", f"{BASE}/过程/任务39_点餐页UI/pages/order/order.js"),
    ("pages/order/order.wxml 原文（任务39版，第2轮改造基座）", f"{BASE}/过程/任务39_点餐页UI/pages/order/order.wxml"),
    ("pages/order/order.wxss 原文（任务39版，第2轮改造基座）", f"{BASE}/过程/任务39_点餐页UI/pages/order/order.wxss"),
    ("pages/index/index.js 原文（任务39版，第3轮改造基座）", f"{BASE}/过程/任务39_点餐页UI/pages/index/index.js"),
    ("pages/index/index.wxml 原文（任务39版，第3轮改造基座）", f"{BASE}/过程/任务39_点餐页UI/pages/index/index.wxml"),
    ("pages/history/history.js 原文（任务39版，第3轮改造基座）", f"{BASE}/过程/任务39_点餐页UI/pages/history/history.js"),
    ("pages/history/history.wxml 原文（任务39版，第3轮改造基座）", f"{BASE}/过程/任务39_点餐页UI/pages/history/history.wxml"),
    ("app.json 原文（任务38语音剥离版，第3轮重声明插件块基座）", f"{BASE}/过程/任务38_语音剥离/app.json"),
    ("pages/profile/profile.js 原文（任务34原生工程版，第3轮改造基座）", f"{BASE}/过程/任务34_原生工程与网关/pages/profile/profile.js"),
    ("app.js 原文（任务34原生工程版，第3轮改造基座）", f"{BASE}/过程/任务34_原生工程与网关/app.js"),
]

parts = ["=====【装配声明（十二份输入SHA绑定完成，非替代输入）】=====\n"
         "【装配声明】任务42派发（2026-10-03T19:45:15+08:00）要求的十二份输入本文档已全部就位并完成SHA绑定。"
         "《多语言与语音方案.md》（v1.0，commit 4a09b28）为设计依据，以它为准。"
         "《点餐页UI规格汇总_任务39输入.md》（v1.3定稿）为UI规格权威。"
         "基座说明：pages/order三件套以任务39版为最新基座；pages/index、pages/history以任务39版为基座；app.json以任务38语音剥离版为基座；pages/profile与app.js以任务34原生工程版为基座。"
         "本声明不构成输入替代，十二份均为原文。\n"]
shas = []
for title, path in DOCS:
    raw = open(path, "rb").read()
    sha = hashlib.sha256(raw).hexdigest()
    shas.append((title.split(" ")[0][:30], sha[:12], len(raw)))
    text = raw.decode("utf-8")
    parts.append(f"=====【文档: {title}】=====\n{text}")
ctx = "\n".join(parts)
with open(OUT_CTX, "w", encoding="utf-8") as f:
    f.write(ctx)
ctx_sha = hashlib.sha256(open(OUT_CTX, "rb").read()).hexdigest()

FMT = ('\n\n【输出格式要求】给出每个文件的完整内容，每个文件一个独立代码块；代码块第一行必须是文件路径标注（JS用 // FILE: 路径，'
       'WXML用 <!-- FILE: 路径 -->，WXSS用 /* FILE: 路径 */，JSON用 // FILE: 路径 注释行）；代码块之外只给极简改动点列表，不要额外解释。')

Q1 = ('【第1轮】i18n三语基建。按context中《多语言与语音方案.md》（v1.0，设计依据，以它为准）与《点餐页UI规格汇总_任务39输入.md》，'
      '从任务39 pages/order、pages/index、pages/history 三页全部现有界面文案抽取成key，实现三语切换基础设施，产出7个文件完整内容：'
      '1) utils/i18n.js：语言包注册/当前语言读取/切换写storage持久化/语言变更事件广播（提供全局事件，页面可订阅）；'
      '2) utils/i18nBehavior.js：页面混入Behavior，onLoad把当前语言包注入data.langPack、订阅语言变更事件自动setData刷新；'
      '3) locale/zh-Hans.js、locale/zh-Hant.js、locale/en.js：三个语言包模块各自导出同一套key的对象，key从任务39三页全部显示文字抽取（含选单栏/标签面板13项标签名/分量/预算/忌口15项/输入栏/屏2卡片含角标✓/?/⚠固定三句说明/屏3/停摆兜底文案"这类情况我还没学会了，先用简单推荐"等，一个不漏），三语key完全对齐；繁体包按简体逐条转写、英文包逐条翻译；'
      '4) utils/opencc.js：OpenCC的s2t简转繁实现，用精简映射表做常用字与常见词级转换，文件控制在可维护规模，注释注明可后换opencc-js完整版。'
      '本轮不改任何页面文件。输出7个文件完整内容：utils/i18n.js、utils/i18nBehavior.js、locale/zh-Hans.js、locale/zh-Hant.js、locale/en.js、utils/opencc.js。' + FMT)

Q2 = ('【第2轮】order页接入i18n与语音。基于上一轮你已产出的i18n基建与locale三语包，改造context中任务39版 pages/order 三件套：'
      '1) 全部显示文字改走langPack（wxml用{{langPack.xxx}}绑定，js内文案同步取语言包）；'
      '2) 选单栏语言项改为语言按钮[简▾]，点击循环切换 简体→繁体→English，切换写storage并全局广播即时生效；'
      '3) 模型输出语言：组装推荐prompt末尾按当前界面语言追加输出指令——简体不加、繁体加"以繁體中文輸出全部內容"、英文加"Respond entirely in English"；展示层对模型返回文本再过opencc做繁体兜底；'
      '4) 语音输入：输入栏左侧麦克风按钮，按住说话（touchstart开始、touchend结束）→微信同声传译插件speechToText（语种跟随界面语言：简体=zh_CN/繁体=zh_HK/英文=en_US）→识别文字进入输入栏可编辑后再发送；'
      '5) 播报按钮启用（替换任务38置灰态）：普通话/英语走插件textToSpeech；粤语走云函数relayTTS（wx.cloud.callFunction，name=relayTTS，返回含error=tts_not_configured时toast"粤语播报即将上线"）；播报文本=当前界面语言版本的显示文本；'
      '6) 音色选择窗=占位弹层，仅"默认音色"一项、不可修改。'
      '三屏状态机、推荐链路接线、硬约束逻辑逐字不动，只改显示层与新增语音交互。'
      '输出3个文件完整内容：pages/order/order.js、pages/order/order.wxml、pages/order/order.wxss。' + FMT)

Q3 = ('【第3轮】其余页面接入+粤语TTS云函数+部署说明。'
      '1) pages/index/index.js+pages/index/index.wxml、pages/history/history.js+pages/history/history.wxml、pages/profile/profile.js 全部接入langPack与i18nBehavior（显示文字走语言包）；'
      'app.js接入i18n初始化（onLaunch读取storage语言并设为当前语言）；'
      '2) app.json（基座=context中任务38语音剥离版）重新声明微信同声传译插件块：plugins.WechatSI，provider=wx069ba97219f66d99，version=0.3.5（照任务36）；'
      '3) 新建cloudfunctions/relayTTS/index.js骨架：读环境变量TENCENT_TTS_SECRET_ID与TENCENT_TTS_SECRET_KEY，未配置返回{error:"tts_not_configured"}；已配置则调腾讯云TTS（精品音色、粤语、语速1.0）合成并返回base64音频数据；'
      '4) 网关部署说明文档relayTTS部署说明.md：腾讯云TTS开通与密钥创建步骤、云函数部署方法、环境变量配置方法，密钥明文不入文档。'
      '输出8个文件完整内容：pages/index/index.js、pages/index/index.wxml、pages/history/history.js、pages/history/history.wxml、pages/profile/profile.js、app.js、app.json、cloudfunctions/relayTTS/index.js、relayTTS部署说明.md（说明文档用Markdown标题正文即可，代码块第一行标注用<!-- FILE: 路径 -->）。' + FMT)

qs = [Q1, Q2, Q3]
json.dump(qs, open(OUT_Q, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("context_sha:", ctx_sha, "bytes:", len(ctx.encode("utf-8")))
for t, s, n in shas:
    print(f"  doc {t}… sha={s} bytes={n}")
qb = json.dumps(qs, ensure_ascii=False, indent=1).encode("utf-8")
print("questions_sha:", hashlib.sha256(qb).hexdigest(), "bytes:", len(qb), "rounds:", len(qs))
for i, q in enumerate(qs, 1):
    print(f"  Q{i} len={len(q)} head={q[:30]!r} tail={q[-16:]!r}")
