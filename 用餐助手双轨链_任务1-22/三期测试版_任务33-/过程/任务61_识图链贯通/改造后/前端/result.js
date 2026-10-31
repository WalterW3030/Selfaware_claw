// 任务56：健康免责声明——声明文本从清单 HEALTH_NOTICE 读（禁硬编码），
// 仅 options.health_notice === 'true' 时显示独立声明行；不拼进模型输出文本。
// [任务61] 识图链贯通（2026-11-01）：result 页新增识别发起——onLoad 读 fileID，
//   userInput.images=[fileID] 走 recommend.js recognizeImages 识图前置链，
//   aiGateway 云端把 cloud:// 转 base64 DataURL 后注入 recognize 请求。
const assetsConfig = require('../../common/assets.config.js')

const confirmUtil = require('../../common/confirm.js')
const rec = require('../../common/recommend.js')
const { callAI } = require('../../common/gateway.js')

Page({
  data: {
    pageTitle: '识别结果',
    mode: '',
    healthNotice: false,
    healthNoticeText: '',
    recognizing: false,
    recognizeText: '',
    recognizeFailed: false
  },

  onLoad(options) {
    // 声明文本唯一来源 = 清单（R1 禁硬编码）；清单缺 HEALTH_NOTICE 时静默不显示（前端不阻断主链路）
    const hnText = (assetsConfig.HEALTH_NOTICE && typeof assetsConfig.HEALTH_NOTICE.text === 'string')
      ? assetsConfig.HEALTH_NOTICE.text
      : ''
    const fileID = (options && typeof options.fileID === 'string') ? options.fileID : ''
    this.setData({
      mode: options.mode || 'recognize',
      healthNotice: options.health_notice === 'true',
      healthNoticeText: hnText
    })
    // [任务61] mode=recognize 且带 fileID → 发起识图链；缺 fileID 显式提示，不静默（R5）
    if (this.data.mode === 'recognize') {
      if (fileID) {
        this.runRecognize(fileID)
      } else {
        this.setData({ recognizeFailed: true, recognizeText: '未收到图片 fileID，无法发起识别' })
      }
    }
  },

  // [任务61] 识别发起：结构与 order.js 推荐发起同模（gateway 内联 invoke + db 先探测后消费 + 缺即显式报缺）
  async runRecognize(fileID) {
    this.setData({ recognizing: true, recognizeFailed: false })
    const gateway = {
      invoke: ({ mode, messages }) => callAI(mode, messages)
    }
    let db = null
    try {
      db = wx.cloud.database()
    } catch (e) {
      console.error('云数据库未初始化，无法发起识别', e)
    }
    if (!db) {
      this.setData({ recognizing: false, recognizeFailed: true, recognizeText: '云服务未就绪，无法发起识别' })
      return
    }
    const session = { mealId: `recognize_${Date.now()}`, recognition: null }
    try {
      // recognizeImages 内层已全捕获（识图卡缺失/调用失败/结构无法解析均返回 failed 记录），
      // 此处兜底外抛路径，保证异常不吞（R8），错误信息含定位要素（R9）。
      const record = await rec.recognizeImages({ session, userInput: { text: '', images: [fileID] }, gateway, db })
      this.setData({ recognizing: false, recognizeText: record.text, recognizeFailed: !!record.failed })
    } catch (e) {
      this.setData({ recognizing: false, recognizeFailed: true, recognizeText: '识图异常：' + (e && e.message ? e.message : String(e)) })
    }
  },

  goConfirm() {
    wx.navigateTo({ url: '/pages/history/history' })
  }
})
