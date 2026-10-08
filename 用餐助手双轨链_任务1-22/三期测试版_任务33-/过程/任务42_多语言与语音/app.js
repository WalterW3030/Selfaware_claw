// [任务42-第3轮] app.js 接入 i18n 初始化：onLaunch 读取 storage 语言并设为当前语言
// 基座：任务34原生工程版 app.js

const i18n = require('./utils/i18n.js')

App({
  onLaunch() {
    // [任务42] i18n 初始化：读取 storage 语言并设为当前语言
    try {
      const lang = i18n.getLang()
      i18n.setLang(lang)
    } catch (e) {
      console.warn('i18n 初始化异常', e)
    }

    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      // [任务48] 默认取当前环境（SDK 自适应，消除 env:'' 空槽的部署假设）；
      // 如需固定环境：env: '你的环境ID'（微信开发者工具 → 云开发 → 环境ID）
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true
    })
  }
})
