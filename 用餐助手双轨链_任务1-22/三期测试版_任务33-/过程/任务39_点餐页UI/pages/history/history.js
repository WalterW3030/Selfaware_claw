// [任务39-第2轮] 历史记录页：保留历次记录只读展示
// 基座：任务34原生工程版；只读，不含编辑操作。

Page({
  data: {
    pageTitle: '历史记录',
    records: [],
    loading: false
  },

  onLoad() {
    this.loadRecords()
  },

  // 读历次记录（dish_profile），只读展示
  loadRecords() {
    this.setData({ loading: true })
    const db = wx.cloud.database()
    db.collection('dish_profile')
      .orderBy('closedAt', 'desc')
      .limit(50)
      .get()
      .then((res) => {
        this.setData({ records: res.data || [], loading: false })
      })
      .catch((err) => {
        console.warn('读取历史记录失败', err)
        this.setData({ records: [], loading: false })
      })
  }
})
