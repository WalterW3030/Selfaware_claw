App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      // ENV_ID：Walter 填写（微信开发者工具 → 云开发 → 环境ID）
      env: '',
      traceUser: true
    })
  }
})
