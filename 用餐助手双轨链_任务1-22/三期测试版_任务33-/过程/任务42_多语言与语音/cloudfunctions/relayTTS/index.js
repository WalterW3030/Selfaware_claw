// [任务42-第3轮] relayTTS 云函数骨架：腾讯云 TTS（普通话/英语/粤语三语，语速1.0）
// [任务42-2026-10-04变更] 个人主体小程序不支持微信同声传译插件，播报三语统一走本函数
// 未配置环境变量 → 返回 { error: "tts_not_configured" }
// 已配置 → 调腾讯云 TTS 合成并返回 base64 音频数据
// 密钥走环境变量：TENCENT_TTS_SECRET_ID / TENCENT_TTS_SECRET_KEY（密钥明文不入代码/文档）

const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ── 腾讯云 TTS 配置 ──
const TTS_HOST = 'tts.tencentcloudapi.com'
const TTS_SERVICE = 'tts'
const TTS_VERSION = '2019-08-23'
const TTS_REGION = 'ap-guangzhou'

// ── 界面语言 → 音色（实际音色以腾讯云控制台开通为准）──
// 101001=普通话女声（智瑜） 301000=英语女声 101019=粤语女声精品
const VOICE_MAP = {
  'zh-Hans': { voiceType: 101001, primaryLanguage: 1 },
  'zh-Hant': { voiceType: 101019, primaryLanguage: 1 },
  'en':      { voiceType: 301000, primaryLanguage: 2 }
}

// ── 签名辅助（TC3-HMAC-SHA256）──
function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex')
}
function hmac256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest()
}

function buildAuthorization(secretId, secretKey, payload, timestamp) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const credentialScope = `${date}/${TTS_SERVICE}/tc3_request`

  // 1) 拼接规范请求串
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${TTS_HOST}\n`
  const signedHeaders = 'content-type;host'
  const hashedRequestPayload = sha256Hex(payload)
  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload
  ].join('\n')

  // 2) 拼接待签名字符串
  const algorithm = 'TC3-HMAC-SHA256'
  const hashedCanonicalRequest = sha256Hex(canonicalRequest)
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    hashedCanonicalRequest
  ].join('\n')

  // 3) 计算签名
  const secretDate = hmac256('TC3' + secretKey, date)
  const secretService = hmac256(secretDate, TTS_SERVICE)
  const secretSigning = hmac256(secretService, 'tc3_request')
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex')

  // 4) 拼接 Authorization
  return `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

// ── 调腾讯云 TTS ──
function callTencentTTS(secretId, secretKey, text, voice) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000)
    const body = {
      Text: text,
      SessionId: `relay_${Date.now()}`,
      ModelType: 1,                  // 1=基础模型；精品音色用 ModelType 1 + VoiceType 指定
      VoiceType: voice.voiceType,
      Codec: 'mp3',
      SampleRate: 16000,
      Speed: 1.0,
      Volume: 0,
      PrimaryLanguage: voice.primaryLanguage   // 1=中文 2=英文
    }
    const payload = JSON.stringify(body)
    const authorization = buildAuthorization(secretId, secretKey, payload, timestamp)

    const options = {
      hostname: TTS_HOST,
      method: 'POST',
      path: '/',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json; charset=utf-8',
        'Host': TTS_HOST,
        'X-TC-Action': 'TextToVoice',
        'X-TC-Version': TTS_VERSION,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': TTS_REGION
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.Response && json.Response.Error) {
            reject(new Error(json.Response.Error.Message || 'TTS error'))
            return
          }
          const audioBase64 = json.Response && json.Response.Audio
          if (!audioBase64) {
            reject(new Error('no audio in response'))
            return
          }
          resolve(audioBase64)
        } catch (e) {
          reject(e)
        }
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// ── 入口 ──
exports.main = async (event) => {
  const secretId = process.env.TENCENT_TTS_SECRET_ID
  const secretKey = process.env.TENCENT_TTS_SECRET_KEY

  // 未配置 → 明确返回，前端据此 toast"粤语播报即将上线"
  if (!secretId || !secretKey) {
    return { error: 'tts_not_configured' }
  }

  const text = (event && event.text) || ''
  const lang = (event && event.lang) || 'zh-Hans'
  if (!text) {
    return { error: 'empty_text' }
  }

  const voice = VOICE_MAP[lang] || VOICE_MAP['zh-Hans']
  try {
    const audioBase64 = await callTencentTTS(secretId, secretKey, text, voice)
    // 返回 base64 音频数据（前端可写入临时文件或用 data URL 播放）
    return { audioBase64, format: 'mp3' }
  } catch (e) {
    return { error: 'tts_failed', message: String(e && e.message || e) }
  }
}
