// [任务42-第1轮] i18n 页面混入 Behavior：onLoad 注入 data.langPack + 订阅语言变更自动 setData
// 依据：《多语言与语音方案.md》v1.0 三.1（Behavior 混入）
// 用法：Page({ behaviors: [require('../../utils/i18nBehavior.js')], ... })

const i18n = require('./i18n.js')

module.exports = Behavior({
  data: {
    langPack: {},
    lang: i18n.DEFAULT_LANG
  },

  lifetimes: {
    attached() {
      // 注入当前语言包
      const lang = i18n.getLang()
      this.setData({
        lang,
        langPack: i18n.getLangPack(lang)
      })

      // 订阅语言变更，自动刷新本页 langPack
      this._i18nUnsubscribe = i18n.subscribeLangChange((nextLang, pack) => {
        this.setData({
          lang: nextLang,
          langPack: pack
        })
      })
    },

    detached() {
      if (typeof this._i18nUnsubscribe === 'function') {
        this._i18nUnsubscribe()
        this._i18nUnsubscribe = null
      }
    }
  },

  methods: {
    // 页面内切换语言（可选调用）
    i18nSetLang(lang) {
      i18n.setLang(lang)
    },

    // 取当前语言
    i18nGetLang() {
      return i18n.getLang()
    }
  }
})
