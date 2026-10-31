// [任务42-第3轮] 首页接入 i18n：langPack + i18nBehavior；显示文字走语言包
// 基座：任务39-第2轮 pages/index/index.js；其余逻辑不动。

const gateway = require('../../common/gateway.js')
const rec = require('../../common/recommend.js')
const i18n = require('../../utils/i18n.js')
const i18nBehavior = require('../../utils/i18nBehavior.js')

Page({
  behaviors: [i18nBehavior],

  data: {
    pageTitle: '食知',
    recentMeals: []
  },

  onLoad() {
    this.loadRecentMeals()
  },

  onShow() {
    this.loadRecentMeals()
  },

  // ── 新的一餐 ──
  startNewMeal() {
    const mealId = `meal_${Date.now()}`
    try {
      const session = rec.createMealSession({ mealId })
      wx.setStorageSync('pending_meal_session', session)
    } catch (e) {
      console.warn('新建mealSession异常', e)
    }
    wx.navigateTo({ url: '/pages/order/order?newMeal=1' })
  },

  // ── 最近餐次列表 ──
  loadRecentMeals() {
    const db = wx.cloud.database()
    db.collection('dish_profile')
      .orderBy('closedAt', 'desc')
      .limit(10)
      .get()
      .then((res) => {
        this.setData({ recentMeals: res.data || [] })
      })
      .catch((err) => {
        console.warn('读取最近餐次失败', err)
        this.setData({ recentMeals: [] })
      })
  },

  goMealDetail(e) {
    const mealId = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/history/history?mealId=${mealId}` })
  },

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
