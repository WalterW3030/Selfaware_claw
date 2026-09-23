// [任务36] 新增：复用统一入口，新增 translate / order_phrase 两个 mode
const { callAI } = require('../../common/gateway.js')

// [任务36] 语言标签
const LANG_LABEL = { zh_CN: '普通话', en_US: '英语', yue: '粤语' }

// [任务36] WechatSI 插件（声明见 app.json），仅用于 TTS 播报
// 注：requirePlugin 需在 app.json 声明 plugins.WechatSI(0.3.5) 后可用
let WechatSI = null
try {
  WechatSI = requirePlugin('WechatSI')
} catch (e) {
  WechatSI = null // 插件未就绪时兜底，播报走降级
}

Page({
  data: {
    pageTitle: '点餐助手',
    mode: 'fast',

    // ── [任务36] 菜单翻译 ──
    menuConfirmed: false,     // 识别确认门禁是否通过（通过后才允许翻译）
    candidates: [],           // 已确认候选清单（由门禁回填）
    translateLang: 'zh_CN',   // 三语选择：zh_CN | yue | en_US
    translating: false,
    translateResult: null,    // { list:[{name, translation, flag}], fallback:bool }

    // ── [任务36] 语音点单 ──
    phraseText: '',           // 生成的播报话术
    phraseConfirmed: false,   // 用户是否确认话术（确认后才可播报）
    speaking: false,
    ttsFallbackText: '',      // TTS 失败降级：展示文本让用户自己念
    yueTtsReady: false        // 粤语 TTS 通道是否就绪（未就绪则播报置灰）
  },

  onLoad() {
    // [任务36] 粤语播报通道就绪态（测试版默认 false → 置灰“即将支持”）
    // 实际可改为调用云函数 ttsProxy 探测环境变量是否配置后回填
    this.setData({ yueTtsReady: false })
  },

  setFast() {
    this.setData({ mode: 'fast' })
  },

  setDeep() {
    this.setData({ mode: 'deep' })
  },

  // 拍菜单 → 上传云存储 → 待接 aiGateway order_fast / order_deep(T2/T8)
  handleMenuCapture() {
    wx.chooseImage({
      count: 1,
      sourceType: ['camera', 'album'],
      success: (res) => {
        const filePath = res.tempFilePaths[0]
        wx.cloud.uploadFile({
          cloudPath: `order/${Date.now()}.jpg`,
          filePath,
          success: () => {
            console.log('菜单已上传, 当前模式:', this.data.mode)
            // [任务36] 此处上传后进入识别+确认门禁；门禁通过后由 onMenuConfirmed 回填 candidates
          },
          fail: (err) => {
            console.error('菜单上传失败', err)
          }
        })
      }
    })
  },

  // ── [任务36 新增] 门禁通过回调：设定已确认清单，解锁翻译/话术 ──
  onMenuConfirmed(confirmedList) {
    this.setData({
      menuConfirmed: true,
      candidates: Array.isArray(confirmedList) ? confirmedList : []
    })
  },

  // ── [任务36 新增] 三语选择器 ──
  // 说明：三语均可选用于“翻译”；粤语因播报通道未就绪在播报环节置灰（见 handleSpeak）
  onPickLang(e) {
    const lang = e.currentTarget.dataset.lang
    if (!LANG_LABEL[lang]) return
    this.setData({ translateLang: lang, phraseConfirmed: false })
  },

  // ── [任务36 新增] 菜单翻译：门禁通过后可选 ──
  handleTranslate() {
    if (!this.data.menuConfirmed) {
      wx.showToast({ title: '请先确认菜单', icon: 'none' })
      return
    }
    this.setData({ translating: true })

    const fast = this.data.mode === 'fast'
    const messages = [
      { role: 'system', content: buildTranslateSystem(this.data.translateLang, fast) },
      { role: 'user', content: JSON.stringify(this.data.candidates) }
    ]

    callAI('translate', messages)
      .then((res) => {
        const text = extractText(res)
        this.setData({
          translating: false,
          translateResult: { list: parseTranslate(text, this.data.candidates), fallback: false }
        })
      })
      .catch(() => {
        // [任务36] 失败降级：展示原文，不阻断主流程
        this.setData({ translating: false, translateResult: { list: [], fallback: true } })
        wx.showToast({ title: '翻译失败，已展示原文', icon: 'none' })
      })
  },

  // ── [任务36 新增] 生成点餐话术（order_phrase，菜名白名单约束）──
  handleGenPhrase() {
    if (!this.data.candidates.length) {
      wx.showToast({ title: '请先确认候选', icon: 'none' })
      return
    }
    const messages = [
      { role: 'system', content: buildPhraseSystem(this.data.translateLang) },
      { role: 'user', content: JSON.stringify(this.data.candidates) }
    ]

    callAI('order_phrase', messages)
      .then((res) => {
        const text = extractText(res)
        // [任务36] 红线：话术菜名只许来自已确认候选，越权则回退模板
        const safe = phraseHonorsWhitelist(text, this.data.candidates)
        this.setData({
          phraseText: safe ? text : buildTemplatePhrase(this.data.candidates),
          phraseConfirmed: false,
          ttsFallbackText: ''
        })
      })
      .catch(() => {
        // [任务36] 生成失败 → 模板话术兜底
        this.setData({
          phraseText: buildTemplatePhrase(this.data.candidates),
          phraseConfirmed: false,
          ttsFallbackText: ''
        })
      })
  },

  // ── [任务36 新增] 用户确认话术（播报前置门禁，不可跳过）──
  confirmPhrase() {
    if (!this.data.phraseText || !this.data.phraseText.trim()) {
      wx.showToast({ title: '话术为空', icon: 'none' })
      return
    }
    this.setData({ phraseConfirmed: true })
  },

  // [任务36 新增] 允许用户编辑话术
  onPhraseEdit(e) {
    this.setData({ phraseText: e.detail.value, phraseConfirmed: false })
  },

  // ── [任务36 新增] 播报 ──
  handleSpeak() {
    if (!this.data.phraseConfirmed) {
      wx.showToast({ title: '请先确认话术', icon: 'none' })
      return
    }
    const lang = this.data.translateLang

    // 粤语：走腾讯云 TTS 云函数（备选通道），未就绪则置灰提示
    if (lang === 'yue') {
      if (!this.data.yueTtsReady) {
        wx.showToast({ title: '粤语播报即将支持', icon: 'none' })
        return
      }
      this.speakViaTencentTTS(this.data.phraseText)
      return
    }

    // 普通话 / 英语：WechatSI 插件 textToSpeech
    if (!WechatSI) {
      this.fallbackToText()
      return
    }
    this.setData({ speaking: true, ttsFallbackText: '' })
    WechatSI.textToSpeech({
      lang: lang === 'en_US' ? 'en_US' : 'zh_CN',
      tts: true,
      content: this.data.phraseText,
      success: (res) => {
        this.setData({ speaking: false })
        const audio = wx.createInnerAudioContext()
        audio.src = res.filename
        audio.play()
        this._audio = audio
      },
      fail: () => {
        // [任务36] 失败降级：展示话术文本让用户自己念
        this.fallbackToText()
      }
    })
  },

  // [任务36 新增] 粤语播报：云函数 ttsProxy 转发腾讯云 TTS（密钥走环境变量）
  speakViaTencentTTS(text) {
    this.setData({ speaking: true, ttsFallbackText: '' })
    wx.cloud.callFunction({
      name: 'ttsProxy',
      data: { text, lang: 'yue' },
      success: (res) => {
        const r = res.result || {}
        if (r.error || !r.audioUrl) {
          this.fallbackToText()
          return
        }
        this.setData({ speaking: false })
        const audio = wx.createInnerAudioContext()
        audio.src = r.audioUrl
        audio.play()
        this._audio = audio
      },
      fail: () => this.fallbackToText()
    })
  },

  // [任务36 新增] TTS 失败降级：展示话术文本供用户自己念
  fallbackToText() {
    this.setData({ speaking: false, ttsFallbackText: this.data.phraseText })
    wx.showToast({ title: '播报失败，请照文本念', icon: 'none' })
  }
})

// ── [任务36] 模块内辅助函数 ────────────────────────────────────────

function extractText(res) {
  if (!res) return ''
  if (typeof res === 'string') return res
  if (typeof res.text === 'string') return res.text
  if (Array.isArray(res.choices) && res.choices[0] && res.choices[0].message) {
    const c = res.choices[0].message.content
    if (typeof c === 'string') return c
    if (Array.isArray(c)) return c.map((p) => p.text || '').join('')
  }
  if (typeof res.content === 'string') return res.content
  return ''
}

function buildTranslateSystem(lang, fast) {
  return [
    'role: 菜单翻译',
    `目标语: ${LANG_LABEL[lang]}`,
    '硬约束:',
    '  - 只翻译给定清单内的菜名与标记，不得新增/删除/合并条目',
    '  - 过敏原/禁忌成分必须逐条对应译出，不得省略',
    '输出:',
    fast
      ? '  - 快速模式：仅返回 [{ "name": 原名, "translation": 译文 }]，不译长描述/营养'
      : '  - 深度模式：返回 [{ "name": 原名, "translation": 译文, "flag": 成分标记译文, "note": 备注 }]'
  ].join('\n')
}

function buildPhraseSystem(lang) {
  return [
    'role: 点餐话术生成',
    `目标语: ${LANG_LABEL[lang]}`,
    '硬约束:',
    '  - 生成的菜名只许来自已确认候选清单，不得增删、不得改写菜名、不得杜撰菜品',
    '  - 数量、口味备注以清单为准，不得臆造',
    '  - 不输出价格、不输出营养数值',
    '输出: 一段可直接对服务员说的口语化点餐要求'
  ].join('\n')
}

// 解析翻译返回：容错 JSON / 纯文本
function parseTranslate(text, candidates) {
  try {
    const arr = JSON.parse(text)
    if (Array.isArray(arr)) return arr
  } catch (e) { /* 落到纯文本 */ }
  // 纯文本降级：按行对照
  return String(text || '').split('\n').filter(Boolean).map((line, i) => ({
    name: (candidates[i] && candidates[i].name) || '',
    translation: line
  }))
}

// [任务36] 红线：话术菜名白名单校验（越权则回退模板）
function phraseHonorsWhitelist(text, candidates) {
  if (!text) return false
  // 简单策略：解析话术中出现的候选菜名，若出现明显不在清单的菜名片段则判失败。
  // 联调阶段可替换为词典/分词匹配，此处以“至少命中一个已确认菜名”为最低通过条件。
  const names = (candidates || []).map((c) => c.name).filter(Boolean)
  if (!names.length) return false
  return names.some((n) => text.indexOf(n) >= 0)
}

// [任务36] 模板话术兜底
function buildTemplatePhrase(candidates) {
  const names = (candidates || []).map((c) =>
    c.count ? `${c.name}x${c.count}` : c.name
  ).filter(Boolean)
  return `麻烦点：${names.join('、')}。谢谢！`
}
