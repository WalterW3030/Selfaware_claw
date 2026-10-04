// [任务42-第3轮] 历史页接入 i18n：langPack + i18nBehavior；只读逻辑不动
// 基座：任务39-第2轮 pages/history/history.js

const i18n = require('../../utils/i18n.js')
const i18nBehavior = require('../../utils/i18nBehavior.js')

Page({
  behaviors: [i18nBehavior],

  data: {
    pageTitle: '历史记录',
    records: [],
    loading: false
  },

  onLoad() {
    this.loadRecords()
  },

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
