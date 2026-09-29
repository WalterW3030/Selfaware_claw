// [任务39-第2轮] 首页加"新的一餐"按钮（新建mealSession→跳点餐页新会话）+ 最近餐次入口列表
// 基座：任务34原生工程版；其余页面不动。

const gateway = require('../../common/gateway.js')
const rec = require('../../common/recommend.js')

Page({
  data: {
    pageTitle: '食知',
    recentMeals: []          // 最近餐次列表（读history数据）
  },

  onLoad() {
    this.loadRecentMeals()
  },

  onShow() {
    // 返回首页时刷新最近餐次
    this.loadRecentMeals()
  },

  // ── 新的一餐：新建mealSession → 跳转点餐页新会话 ──
  startNewMeal() {
    const mealId = `meal_${Date.now()}`
    try {
      // 新建独立会话（默认不携带上一餐）
      const session = rec.createMealSession({ mealId })
      // 暂存本次会话ID，供点餐页确认新会话
      wx.setStorageSync('pending_meal_session', session)
    } catch (e) {
      console.warn('新建mealSession异常', e)
    }
    wx.navigateTo({ url: '/pages/order/order?newMeal=1' })
  },

  // ── 最近餐次列表：读history数据（dish_profile）──
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

  // 点最近餐次 → 跳历史页查看
  goMealDetail(e) {
    const mealId = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/history/history?mealId=${mealId}` })
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
