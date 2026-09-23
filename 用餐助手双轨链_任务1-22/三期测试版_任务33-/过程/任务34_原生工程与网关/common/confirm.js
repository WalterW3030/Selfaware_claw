// 置信度分档 + 确认门禁状态机骨架
// 真实阈值属 T4 业务逻辑,TODO 处待任务25+31修订版模板确定后填入

// TODO(T4): 三档阈值待定,示例区间,需按识别模板实测校准
const THRESHOLD_HIGH = 0.85   // TODO: 高置信下限
const THRESHOLD_MEDIUM = 0.6  // TODO: 中置信下限(低于此为低)

// 分档判定:返回 'high' | 'medium' | 'low'
function classifyConfidence(score) {
  if (typeof score !== 'number') return 'low'
  if (score >= THRESHOLD_HIGH) return 'high'
  if (score >= THRESHOLD_MEDIUM) return 'medium'
  return 'low'
}

// 确认门禁状态机
// 状态流转: idle → pending → confirmed
//                     ↘ (low 档) manual_input → confirmed
function createConfirmGate() {
  const state = {
    status: 'idle',      // idle | pending | manual_input | confirmed
    candidates: [],       // 识别候选列表(含 name/score/is_food)
    chosen: null          // 用户确认结果
  }

  // 载入识别候选
  function loadCandidates(candidates) {
    state.candidates = candidates || []
    state.status = 'pending'
    return state.status
  }

  // 按分档决定下一步:高直接展示/中请用户纠正/低转手动输入
  function actionFor(score) {
    const tier = classifyConfidence(score)
    if (tier === 'high') return 'show_directly'
    if (tier === 'medium') return 'ask_correct'
    return 'manual_input'
  }

  // 用户确认后置为 confirmed(确认前禁止写入饮食记录,AGENTS 业务红线)
  function confirm(item) {
    state.chosen = item
    state.status = 'confirmed'
    return state.chosen
  }

  // 非食物硬答拦截(is_food=false 走重拍路径)
  function isFood(item) {
    return item && item.is_food !== false
  }

  return {
    state,
    loadCandidates,
    actionFor,
    confirm,
    isFood
  }
}

module.exports = { classifyConfidence, createConfirmGate }
