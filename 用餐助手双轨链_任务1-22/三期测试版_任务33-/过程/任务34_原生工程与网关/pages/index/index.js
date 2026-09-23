const gateway = require('../../common/gateway.js')

Page({
  data: {
    pageTitle: '食知'
  },

  // 拍照 → 上传云存储 → 待接 aiGateway recognize 模式(T2)
  handleCapture() {
    wx.chooseImage({
      count: 1,
      sourceType: ['camera', 'album'],
      success: (res) => {
        const filePath = res.tempFilePaths[0]
        wx.cloud.uploadFile({
          cloudPath: `recognize/${Date.now()}.jpg`,
          filePath,
          success: () => {
            wx.navigateTo({ url: '/pages/result/result?mode=recognize' })
          },
          fail: (err) => {
            console.error('上传云存储失败', err)
          }
        })
      }
    })
  },

  goResult(e) {
    const mode = e.currentTarget.dataset.mode
    wx.navigateTo({ url: `/pages/result/result?mode=${mode}` })
  }
})
