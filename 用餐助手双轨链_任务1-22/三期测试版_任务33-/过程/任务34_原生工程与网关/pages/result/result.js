const confirmUtil = require('../../common/confirm.js')

Page({
  data: {
    pageTitle: '识别结果',
    mode: ''
  },

  onLoad(options) {
    this.setData({ mode: options.mode || 'recognize' })
  },

  goConfirm() {
    wx.navigateTo({ url: '/pages/history/history' })
  }
})
