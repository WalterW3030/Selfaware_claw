// [任务42-第3轮] 我的页接入 i18n：langPack + i18nBehavior；含语言切换入口
// 基座：任务34原生工程版 pages/profile/profile.js

const i18n = require('../../utils/i18n.js')
const i18nBehavior = require('../../utils/i18nBehavior.js')

Page({
  behaviors: [i18nBehavior],

  data: {
    pageTitle: '我的',
    bodyData: {
      height: '',
      weight: '',
      allergens: '',
      goal: ''
    },
    // 语言选择项
    langList: [
      { key: 'zh-Hans', labelKey: 'order.lang.zhHans' },
      { key: 'zh-Hant', labelKey: 'order.lang.yue' },
      { key: 'en', labelKey: 'order.lang.en' }
    ]
  },

  goAuth() {
    wx.showToast({ title: '授权管理', icon: 'none' })
  },

  // 语言切换（写 storage + 全局广播）
  onPickLang(e) {
    const lang = e.currentTarget.dataset.lang
    i18n.setLang(lang)
  }
})
