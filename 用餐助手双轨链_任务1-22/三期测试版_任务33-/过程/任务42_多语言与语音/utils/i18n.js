// [任务42-第1轮] i18n 基建：语言包注册 / 当前语言读取 / 切换持久化 / 语言变更事件广播
// 依据：《多语言与语音方案.md》v1.0 三.1；不引入新AI模型，纯前端 i18n。
// 语言键：zh-Hans（简体）/ zh-Hant（繁体）/ en（英文）
// 说明：本文件只做基建，不改任何页面文件。

const LOCALES = {
  'zh-Hans': require('../locale/zh-Hans.js'),
  'zh-Hant': require('../locale/zh-Hant.js'),
  'en': require('../locale/en.js')
}

const LANG_LIST = ['zh-Hans', 'zh-Hant', 'en']
const DEFAULT_LANG = 'zh-Hans'
const LS_LANG_KEY = 'app_lang'

// 语言变更事件名（全局广播）
const EVT_LANG_CHANGED = 'app_lang_changed'

// 订阅者集合：页面 onLoad 订阅、onUnload 退订
let _subscribers = []

// 当前语言（内存缓存，初值从 storage 读）
let _currentLang = null

function _readStorageLang() {
  try {
    const v = wx.getStorageSync(LS_LANG_KEY)
    if (v && LANG_LIST.indexOf(v) >= 0) return v
  } catch (e) { /* 忽略 */ }
  return null
}

function _writeStorageLang(lang) {
  try {
    wx.setStorageSync(LS_LANG_KEY, lang)
  } catch (e) { /* 忽略 */ }
}

// 归一化：接受 'zh_CN' / 'zh-Hans' / 'zh-Hant' / 'en' / 'en_US' / 'yue' 等写法
function normalizeLang(lang) {
  if (!lang) return DEFAULT_LANG
  const s = String(lang)
  if (s === 'zh-Hans' || s === 'zh_CN' || s === 'zh-CN' || s === 'zhHans') return 'zh-Hans'
  if (s === 'zh-Hant' || s === 'zh_HK' || s === 'zh-TW' || s === 'zhHant' || s === 'yue') return 'zh-Hant'
  if (s === 'en' || s === 'en_US' || s === 'en-US') return 'en'
  return DEFAULT_LANG
}

// 取当前语言
function getLang() {
  if (!_currentLang) {
    _currentLang = _readStorageLang() || DEFAULT_LANG
  }
  return _currentLang
}

// 取当前语言包（对象，key → 文案）
function getLangPack(lang) {
  const l = normalizeLang(lang || getLang())
  return LOCALES[l] || LOCALES[DEFAULT_LANG]
}

// 取某个 key 的文案（带兜底：缺失时回退简体包，再缺失回退 key 本身）
function t(key, lang) {
  const pack = getLangPack(lang)
  if (pack && Object.prototype.hasOwnProperty.call(pack, key)) return pack[key]
  const fallback = LOCALES[DEFAULT_LANG]
  if (fallback && Object.prototype.hasOwnProperty.call(fallback, key)) return fallback[key]
  return key
}

// 切换语言：写 storage + 广播（所有订阅页面自动刷新）
function setLang(lang) {
  const next = normalizeLang(lang)
  if (next === getLang()) return next
  _currentLang = next
  _writeStorageLang(next)
  _broadcast(next)
  return next
}

// 订阅语言变更（返回退订函数）
function subscribeLangChange(fn) {
  if (typeof fn !== 'function') return function () {}
  _subscribers.push(fn)
  return function unsubscribe() {
    _subscribers = _subscribers.filter((f) => f !== fn)
  }
}

// 广播语言变更
function _broadcast(lang) {
  const pack = getLangPack(lang)
  _subscribers.slice().forEach((fn) => {
    try {
      fn(lang, pack)
    } catch (e) {
      console.warn('i18n 订阅回调异常', e)
    }
  })
}

// 语言显示名（用于"我的"页/选单栏语言项）
const LANG_DISPLAY = {
  'zh-Hans': '简体',
  'zh-Hant': '繁體',
  'en': 'English'
}

module.exports = {
  LANG_LIST,
  DEFAULT_LANG,
  LS_LANG_KEY,
  EVT_LANG_CHANGED,
  LANG_DISPLAY,
  normalizeLang,
  getLang,
  getLangPack,
  t,
  setLang,
  subscribeLangChange
}
