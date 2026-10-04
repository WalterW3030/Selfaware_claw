# 语音云函数部署说明（relayTTS / relayASR）

> 用途：为点餐页提供语音能力——播报走 relayTTS（腾讯云 TTS），语音输入走 relayASR（腾讯云一句话识别）。
> 背景（2026-10-04变更）：个人主体小程序不支持「微信同声传译」插件（2024-08 官方社区确认），插件路线废弃，语音输入输出全部走腾讯云转发。
> 未配置密钥时：relayTTS 返回 `{ error: "tts_not_configured" }`，前端按界面语言提示「普通话/粤语/英语播报即将上线」；relayASR 返回 `{ error: "asr_not_configured" }`，前端提示「语音输入即将上线」。其余功能不受影响。
> **安全红线：密钥明文一律不入本文档、不入代码、不入群聊。**

## 一、腾讯云开通

1. 腾讯云控制台开通「语音识别（ASR）」与「语音合成（TTS）」服务。
2. 访问管理 → API密钥管理 → 新建密钥（SecretId / SecretKey）。ASR 与 TTS 可用同一密钥，也可分开。

## 二、云函数部署

1. 微信开发者工具 → 云开发 → 云函数 → 新建云函数 `relayTTS`，粘贴 `cloudfunctions/relayTTS/index.js`。
2. 同法新建云函数 `relayASR`，粘贴 `cloudfunctions/relayASR/index.js`。
3. 两个函数各部署上传。

## 三、环境变量配置

| 云函数 | 环境变量 |
|--------|----------|
| relayTTS | `TENCENT_TTS_SECRET_ID`、`TENCENT_TTS_SECRET_KEY` |
| relayASR | `TENCENT_ASR_SECRET_ID`、`TENCENT_ASR_SECRET_KEY` |

云开发 → 云函数 → 函数配置 → 环境变量，逐项填入。密钥只填这里，不落代码、不落文档。

## 四、接口约定

- relayTTS 入参 `{ text, lang }`，lang ∈ `zh-Hans`（普通话）/ `zh-Hant`（粤语）/ `en`（英语）；返回 `{ audioBase64, format:"mp3" }` 或 `{ error }`。音色映射在函数内 VOICE_MAP（实际以腾讯云控制台开通为准）。
- relayASR 入参 `{ fileID, engine, format }`：fileID=前端录音上传云存储后的文件 ID；engine 按界面语言映射 `zh-Hans→16k_zh` / `zh-Hant→16k_yue` / `en→16k_en`；format 默认 `mp3`。返回 `{ text }` 或 `{ error }`。

## 五、未配密钥前的行为

密钥未配置时两个函数都返回 not_configured，前端 toast「即将上线」类提示，不报错、不影响点餐主流程。配好密钥后无需改代码，直接可用。
