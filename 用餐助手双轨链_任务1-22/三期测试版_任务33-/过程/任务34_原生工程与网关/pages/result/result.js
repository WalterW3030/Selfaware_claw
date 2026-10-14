// 任务56：健康免责声明——声明文本从清单 HEALTH_NOTICE 读（禁硬编码），
// 仅 options.health_notice === 'true' 时显示独立声明行；不拼进模型输出文本。
const assetsConfig = require('../../common/assets.config.js')

const confirmUtil = require('../../common/confirm.js')

Page({
  data: {
    pageTitle: '识别结果',
    mode: '',
    healthNotice: false,
    healthNoticeText: ''
  },

  onLoad(options) {
    // 声明文本唯一来源 = 清单（R1 禁硬编码）；清单缺 HEALTH_NOTICE 时静默不显示（前端不阻断主链路）
    const hnText = (assetsConfig.HEALTH_NOTICE && typeof assetsConfig.HEALTH_NOTICE.text === 'string')
      ? assetsConfig.HEALTH_NOTICE.text
      : ''
    this.setData({
      mode: options.mode || 'recognize',
      healthNotice: options.health_notice === 'true',
      healthNoticeText: hnText
    })
  },

  goConfirm() {
    wx.navigateTo({ url: '/pages/history/history' })
  }
})
