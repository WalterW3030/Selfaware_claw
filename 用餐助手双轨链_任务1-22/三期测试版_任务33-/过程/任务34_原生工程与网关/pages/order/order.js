Page({
  data: {
    pageTitle: '点餐助手',
    mode: 'fast'
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
          },
          fail: (err) => {
            console.error('菜单上传失败', err)
          }
        })
      }
    })
  }
})
