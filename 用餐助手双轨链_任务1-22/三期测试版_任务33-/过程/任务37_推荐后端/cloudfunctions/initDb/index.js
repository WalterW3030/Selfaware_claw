// 【新增】DB 建表脚本：ref_tables + dish_summary
// 依据：推荐系统结构设计v1.0 §L1/L3；文档2/3 支持度标注规则；文档4 初始化prompt081
//
// 职责：
//   1) 创建集合 ref_tables、dish_summary（已存在则幂等跳过）
//   2) 输出集合索引定义（供控制台建索引；wx-server-sdk 无建索引 API）
//   3) 输出安全规则 JSON（全员只读 / 仅云函数写）
//
// 安全规则边界（如实声明）：
//   wx-server-sdk 只能 createCollection，无法直接写入"安全规则/索引"。
//   安全规则与索引需经【云开发控制台】或 @cloudbase/manager-node 应用。
//   本脚本已把规则与索引以常量+返回值形式导出，供上方两种途径落地。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ── 集合定义 ──────────────────────────────────────────────────────
const COLLECTIONS = [
  {
    name: 'ref_tables',
    desc: '速查表存储（表号→内容）。装配器按"将查的表"按需拉取。',
    fields: {
      tableNo:    'string  — 表号，如 "016"（口味负荷）/ "020"（场景）/ "033"/"051"/"062"',
      version:    'string  — 版本号（frontmatter version 或文件名后缀）',
      title:      'string  — 表标题',
      content:    'string  — 表正文（md 原文）',
      active:     'boolean — 生效标记（同表号仅一条 active=true）',
      sourceFile: 'string  — 来源文件（云存储 fileID）',
      importedAt: 'number  — 导入时间戳'
    },
    indexes: [
      { name: 'idx_tableNo_active', keys: [['tableNo', 1], ['active', 1]] },
      { name: 'idx_tableNo_version', keys: [['tableNo', 1], ['version', -1]] }
    ]
  },
  {
    name: 'dish_summary',
    desc: '菜品成分与效应摘要 + 数值负荷（推荐候选数据源；模型不得自产数字）。',
    fields: {
      dishId:            'string  — 菜品唯一 ID',
      name:              'string  — 菜品名',
      ingredientSummary: 'string  — 成分与已知效应摘要（味型层/成分层双陈述）',
      numericLoad:       'object  — 数值负荷（辣度/糖度/盐度等；菜单内相对量，不绝对化）',
      generatedAt:       'number  — 生成时间戳',
      modelVersion:      'string  — 生成该摘要的模型版本'
    },
    indexes: [
      { name: 'idx_dishId', keys: [['dishId', 1]], unique: true },
      { name: 'idx_name',   keys: [['name', 1]] }
    ]
  }
]

// ── 安全规则：全员只读、仅云函数写（管理端/admin 不受客户端规则约束）──
// 客户端读 = true，客户端写 = false → 写操作只能经云函数（admin）完成。
const SECURITY_RULES = {
  ref_tables:   { read: true, write: false },
  dish_summary: { read: true, write: false }
}

/** 幂等创建集合 */
async function ensureCollection(name) {
  try {
    await db.createCollection(name)
    return { name, created: true }
  } catch (e) {
    const msg = String((e && e.message) || e)
    if (/already exist|exist/i.test(msg)) return { name, created: false, note: '已存在，跳过' }
    throw e
  }
}

exports.main = async () => {
  const results = { collections: [], indexes: COLLECTIONS.flatMap(c => c.indexes), securityRules: SECURITY_RULES }

  for (const c of COLLECTIONS) {
    results.collections.push(await ensureCollection(c.name))
  }

  // 索引与安全规则：wx-server-sdk 无对应 API，需经控制台/manager-node 应用。
  // 下面把待办材料打印到日志，便于运维照单操作。
  console.log('[initDb] 待应用索引：', JSON.stringify(results.indexes, null, 2))
  console.log('[initDb] 待应用安全规则：', JSON.stringify(SECURITY_RULES, null, 2))
  console.log('[initDb] 应用途径：①云开发控制台→数据库→集合→权限设置/索引管理；' +
              '②@cloudbase/manager-node（设 PROVISION=1 时由下方可选块自动应用）')

  // ── 可选：若部署环境装了 @cloudbase/manager-node 且提供 secretId/secretKey，
  //         可自动应用安全规则（缺依赖则静默跳过，不阻塞集合创建）────────
  if (process.env.PROVISION === '1') {
    try {
      const CloudBase = require('@cloudbase/manager-node')
      const manager = CloudBase.init({
        secretId:  process.env.TCB_SECRET_ID,
        secretKey: process.env.TCB_SECRET_KEY,
        // [任务48] envId 改走 getWXContext().ENV（TCB_ENV 兜底），与任务47 importRefTables 同法；
        // 原 cloud.DYNAMIC_CURRENT_ENV 是 wx-server-sdk 魔数占位串，manager-node 不解释，必失败
        envId:     (cloud.getWXContext && (cloud.getWXContext() || {}).ENV) || process.env.TCB_ENV
      })
      for (const [name, rule] of Object.entries(SECURITY_RULES)) {
        await manager.database.updateCollectionSecurity(name, rule)
      }
      results.securityRulesApplied = true
    } catch (e) {
      results.securityRulesApplied = false
      results.securityRulesError = String((e && e.message) || e)
    }
  }

  return results
}
