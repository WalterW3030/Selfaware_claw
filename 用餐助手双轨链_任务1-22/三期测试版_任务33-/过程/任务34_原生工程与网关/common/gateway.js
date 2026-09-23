// 食知 AI 调用统一入口
// 规则:所有页面只允许通过 callAI() 调 AI,禁止前端直连任何模型 API(AGENTS.md 技术约束)
// 实际模型路由在云函数 aiGateway 的 MODEL_MAP 集中配置(T2)

// mode: 'recognize'|'copy'|'nutrition'|'order_fast'|'order_deep'|'chat'
function callAI(mode, messages) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'aiGateway',
      data: { mode, messages },
      success: (res) => {
        const result = res.result || {}
        // 网关侧红线拦截反馈(nutrition 模式数字泄漏等)
        if (result.error) {
          reject(result)
          return
        }
        resolve(result)
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

// 便捷封装:识图模式(图片走云存储 fileID 或 base64,禁入代码包)
function callRecognize(messages, allowNumbers = false) {
  return callAI('recognize', messages)
}

// 便捷封装:营养模式(默认拦截模型自产数字,见 T2 红线)
function callNutrition(messages, allowNumbers = false) {
  return callAI('nutrition', messages)
}

module.exports = { callAI, callRecognize, callNutrition }
