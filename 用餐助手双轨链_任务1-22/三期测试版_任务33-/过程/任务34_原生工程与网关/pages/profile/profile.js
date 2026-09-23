Page({
  data: {
    pageTitle: '我的',
    bodyData: {
      height: '',
      weight: '',
      allergens: '',
      goal: ''
    }
  },

  goAuth() {
    // 逐项分层授权入口(见 v3 四章),具体措辞待 H6 确认
    wx.showToast({ title: '授权管理', icon: 'none' })
  }
})
