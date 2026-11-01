// 任务63 诊断版 recommend.js 本地行为验证（wx-server-sdk 本地桩，独立于被测对象假设）
// 场景A：prompt_assets+ref_tables 全命中 → recommend 完成且 tableGaps 空（对照基座行为一致）
// 场景B：ref_tables 全0条 → tableGaps=7 表（缺表停摆判定输入，行为与基座一致）
// 场景C：ref_tables 查询抛错 → recommend 必须 reject（rethrow 语义保持，不得被日志 catch 吞掉）
// 场景D：探针抛错/0条不影响主流程（探针只读，控制流零改动）
// 读数：场景结论逐案打印，退出码=失败用例数
'use strict'
const rec = require('./recommend.js')

const TABLES = ['016', '020', '033', '051', '062', '058', '068']

function makeDb ({ tableDocs, promptDocs, tableThrow, probeThrow, probeEmpty }) {
  return {
    collection (name) {
      const chain = { where (cond) { chain.cond = cond; return chain }, orderBy () { return chain }, limit () { return chain } }
      chain.get = async () => {
        if (name === 'ref_tables') {
          if (probeThrow) { probeThrow = false; throw new Error('probe denied') } // 仅探针那次抛
          if (tableThrow) throw new Error('table query permission denied')
          const docs = tableDocs.filter((d) => {
            const c = chain.cond || {}
            return (c.tableNo === undefined || d.tableNo === c.tableNo) &&
                   (c.active === undefined || d.active === c.active)
          })
          return { data: docs.slice(0, 1) }
        }
        if (name === 'prompt_assets') {
          const docs = promptDocs.filter((d) => {
            const c = chain.cond || {}
            return (c.id === undefined || d.id === c.id) && (c.active === undefined || d.active === c.active)
          })
          return { data: docs.slice(0, 1) }
        }
        return { data: [] }
      }
      return chain
    }
  }
}

const prompts = [
  { id: rec.PROMPT_INIT.id, version: 2, active: true, content: 'INIT_PROMPT_BODY' },
  { id: rec.CARD_DEEP.id, version: 1, active: true, content: 'CARD_108_BODY' },
  { id: rec.PROMPT_RECOGNIZE.id, version: 1, active: true, content: 'CARD_110_BODY' }
]
const tablesAll = TABLES.map((no, i) => ({ tableNo: no, version: 1, active: true, content: 'TABLE_' + no + '_BODY' }))

const gateway = { invoke: async ({ mode }) => ({ text: 'GW_OK mode=' + mode }) }

let fail = 0
const results = []

async function scenario (name, dbOpts, expect) {
  const session = rec.createMealSession({ mealId: 'm63' })
  rec.judgeScene(session, '午餐')
  rec.collectRequirements(session, { userRequirements: ['吃辣'], degreeWords: [], hardFilters: { allergens: [], diet: [], excluded: [] } })
  rec.loadCandidates(session, [])
  try {
    const res = await rec.recommend({ session, userInput: '吃辣', gateway, db: makeDb(dbOpts) })
    const gaps = (res.tableGaps || []).join('、')
    const ok = expect.type === 'resolve' &&
      ((expect.gaps === null && res.tableGaps.length === 0) || (expect.gaps !== null && gaps === expect.gaps))
    results.push([name, ok ? 'PASS' : 'FAIL', 'resolved tableGaps=[' + gaps + '] mode=' + res.mode])
    if (!ok) fail++
  } catch (e) {
    const ok = expect.type === 'reject'
    results.push([name, ok ? 'PASS' : 'FAIL', 'rejected: ' + e.message])
    if (!ok) fail++
  }
}

;(async () => {
  await scenario('A 全命中', { tableDocs: tablesAll, promptDocs: prompts }, { type: 'resolve', gaps: null })
  await scenario('B 全缺0条', { tableDocs: [], promptDocs: prompts }, { type: 'resolve', gaps: TABLES.join('、') })
  await scenario('C 查询抛错', { tableDocs: tablesAll, promptDocs: prompts, tableThrow: true }, { type: 'reject' })
  await scenario('D 探针抛错', { tableDocs: tablesAll, promptDocs: prompts, probeThrow: true }, { type: 'resolve', gaps: null })
  results.forEach((r) => console.log(r[0] + ' → ' + r[1] + '（' + r[2] + '）'))
  console.log('SUMMARY ' + (results.length - fail) + '/' + results.length + ' PASS')
  process.exit(fail ? 1 : 0)
})()
