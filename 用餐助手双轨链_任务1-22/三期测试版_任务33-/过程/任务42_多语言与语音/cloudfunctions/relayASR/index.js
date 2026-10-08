// [任务42-2026-10-04变更] relayASR 云函数骨架：腾讯云一句话识别（SentenceRecognition）
// 背景：个人主体小程序不支持微信同声传译插件，语音输入改走本云函数转发腾讯云 ASR
// 未配置环境变量 → 返回 { error: "asr_not_configured" }
// 已配置 → 从云存储下载录音（前端传 fileID），调用 SentenceRecognition 返回识别文本
// 密钥走环境变量：TENCENT_ASR_SECRET_ID / TENCENT_ASR_SECRET_KEY（密钥明文不入代码/文档）

const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// ── 腾讯云 ASR 配置 ──
const ASR_HOST = 'asr.tencentcloudapi.com'
const ASR_SERVICE = 'asr'
const ASR_VERSION = '2019-06-14'
const ASR_REGION = 'ap-guangzhou'
// 识别引擎由前端按界面语言映射：zh-Hans→16k_zh / zh-Hant→16k_yue / en→16k_en

// ── 签名辅助（TC3-HMAC-SHA256）──
function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex')
}
function hmac256(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest()
}

function buildAuthorization(secretId, secretKey, payload, timestamp) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const credentialScope = `${date}/${ASR_SERVICE}/tc3_request`

  // 1) 拼接规范请求串
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${ASR_HOST}\n`
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
  const secretService = hmac256(secretDate, ASR_SERVICE)
  const secretSigning = hmac256(secretService, 'tc3_request')
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex')

  // 4) 拼接 Authorization
  return `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

// ── 调腾讯云一句话识别 ──
function callTencentASR(secretId, secretKey, audioBase64, dataLen, engine, voiceFormat) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000)
    const body = {
      ProjectId: 0,
      SubServiceType: 2,          // 2=一句话识别
      EngSerViceType: engine,     // 16k_zh / 16k_yue / 16k_en
      SourceType: 1,              // 1=直接传音频数据（base64）
      VoiceFormat: voiceFormat,   // mp3 / wav 等，与前端录音格式一致
      Data: audioBase64,
      DataLen: dataLen            // 音频原始字节数
    }
    const payload = JSON.stringify(body)
    const authorization = buildAuthorization(secretId, secretKey, payload, timestamp)

    const options = {
      hostname: ASR_HOST,
      method: 'POST',
      path: '/',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json; charset=utf-8',
        'Host': ASR_HOST,
        'X-TC-Action': 'SentenceRecognition',
        'X-TC-Version': ASR_VERSION,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': ASR_REGION
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.Response && json.Response.Error) {
            reject(new Error(json.Response.Error.Message || 'ASR error'))
            return
          }
          const text = json.Response && json.Response.Result
          if (!text) {
            reject(new Error('no result in response'))
            return
          }
          resolve(text)
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
  const secretId = process.env.TENCENT_ASR_SECRET_ID
  const secretKey = process.env.TENCENT_ASR_SECRET_KEY

  // 未配置 → 明确返回，前端据此 toast"语音输入即将上线"
  if (!secretId || !secretKey) {
    return { error: 'asr_not_configured' }
  }

  const fileID = event && event.fileID
  // [任务48] 引擎/格式白名单校验，缺失或不支持如实报错（原行为：静默缺省 16k_zh/mp3，拼错即替换为假设值）
  const ASR_ENGINES = ['16k_zh', '16k_yue', '16k_en'] // 腾讯云一句话识别引擎（登记于外部假设清单，待实测）
  const ASR_FORMATS = ['wav', 'mp3', 'pcm', 'ogg', 'aac', 'm4a']
  const engine = event && event.engine
  if (!engine) return { error: 'empty_engine', detail: 'engine 必传，支持：' + ASR_ENGINES.join(', ') }
  if (ASR_ENGINES.indexOf(engine) < 0) return { error: 'unknown_engine', detail: 'engine 不支持：' + engine + '；支持：' + ASR_ENGINES.join(', ') }
  const voiceFormat = event && event.format
  if (!voiceFormat) return { error: 'empty_format', detail: 'format 必传，支持：' + ASR_FORMATS.join(', ') }
  if (ASR_FORMATS.indexOf(voiceFormat) < 0) return { error: 'unknown_format', detail: 'format 不支持：' + voiceFormat + '；支持：' + ASR_FORMATS.join(', ') }
  if (!fileID) {
    return { error: 'empty_file' }
  }

  try {
    // 前端录音已上传云存储，这里下载后转 base64 送识别
    const file = await cloud.downloadFile({ fileID: fileID })
    const buf = file.fileContent
    if (!buf || !buf.length) {
      return { error: 'empty_file' }
    }
    const text = await callTencentASR(secretId, secretKey, buf.toString('base64'), buf.length, engine, voiceFormat)
    return { text: text }
  } catch (e) {
    return { error: 'asr_failed', message: String(e && e.message || e) }
  }
}
