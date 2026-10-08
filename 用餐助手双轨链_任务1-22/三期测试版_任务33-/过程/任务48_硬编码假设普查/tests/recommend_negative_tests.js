// [任务48-第二轮] common/recommend.js 负向用例（独立 harness）
// 原则：harness 与生产代码不共享假设。db/gateway 为测试替身，形状按"接口约定"构造
// （prompt_assets: where({id,active}).orderBy('version').limit(1).get() → {data:[{content}]}
//  ref_tables:    where({tableNo,active}).limit(1).get()             → {data:[doc]}
//  替身的 where 不实施过滤，由测试数据集合保证语义——过滤行为属真实DB引擎，非被测逻辑）。
// 运行：node tests/recommend_negative_tests.js（在任务48目录下）
'use strict'

const rec = require('../../任务43_识图卡接入/common/recommend.js')

let pass = 0
let fail = 0
function ok (name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name) }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  | got: ' + JSON.stringify(extra) : '')) }
}

function makeDb ({ prompts = [], tables = [] } = {}) {
  const pick = (name) => name === 'ref_tables' ? tables : prompts
  const chain = (name) => ({
    orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ data: pick(name) }) }) }),
    limit: () => ({ get: () => Promise.resolve({ data: pick(name) }) })
  })
  const adds = []
  return {
    _adds: adds,
    collection (name) {
      return {
        where: () => chain(name),
        add: (x) => { adds.push({ name, data: x }); return Promise.resolve({}) }
      }
    }
  }
}

function makeGateway (fn) {
  const calls = []
  return {
    _calls: calls,
    invoke: (req) => { calls.push(req); return Promise.resolve(fn(req)) }
  }
}

async function main () {
  // ── B1 负向：096 识图卡缺失 → 如实报缺，不调网关（原行为：空 prompt 硬跑）──
  {
    const session = rec.createMealSession({ mealId: 'm_neg_b1' })
    const db = makeDb({ prompts: [] })
    const gw = makeGateway(() => ({ text: '不该被调用' }))
    const record = await rec.recognizeImages({ session, userInput: { text: '看图', images: ['img1'] }, gateway: gw, db })
    ok('B1 卡缺失→failed', record.failed === true, record)
    ok('B1 报缺文案含"识图卡缺失"', typeof record.text === 'string' && record.text.indexOf('识图卡缺失') >= 0, record.text)
    ok('B1 网关零调用', gw._calls.length === 0, gw._calls.length)
    ok('B1 记录入会话', session.recognition === record)
  }

  // ── 正向：卡齐备 + 标准返回结构 → 成功 ──
  {
    const session = rec.createMealSession({ mealId: 'm_pos' })
    const db = makeDb({ prompts: [{ id: 'AGT-0924-w8n-096', active: true, version: 1, content: '卡096全文' }] })
    const gw = makeGateway(() => ({ choices: [{ message: { content: '【识图记录】\n图1主题：茶水\n清单：茶' } }] }))
    const record = await rec.recognizeImages({ session, userInput: { text: '看图', images: ['img1'] }, gateway: gw, db })
    ok('POS 标准结构→成功', record.failed === false, record)
    ok('POS 记录含返回文本', record.text.indexOf('茶水') >= 0, record.text)
    ok('POS 条目计数>0', record.entries > 0, record.entries)
    ok('POS system含卡096正文', gw._calls.length === 1 && gw._calls[0].messages[0].content.indexOf('卡096全文') >= 0)
  }

  // ── B2 负向：返回结构无法解析（{foo:1}）→ null 分支如实报缺，与"合法空文本"区分 ──
  {
    const session = rec.createMealSession({ mealId: 'm_neg_shape' })
    const db = makeDb({ prompts: [{ id: 'AGT-0924-w8n-096', active: true, version: 1, content: '卡096' }] })
    const gw = makeGateway(() => ({ foo: 1 }))
    const record = await rec.recognizeImages({ session, userInput: { images: ['i'] }, gateway: gw, db })
    ok('SHAPE 未知结构→failed', record.failed === true, record)
    ok('SHAPE 文案含"结构无法解析"', record.text.indexOf('结构无法解析') >= 0, record.text)
  }

  // ── 负向：合法空文本（结构对、content=''）→ "返回为空"，文案与未知结构不同 ──
  {
    const session = rec.createMealSession({ mealId: 'm_neg_empty' })
    const db = makeDb({ prompts: [{ id: 'AGT-0924-w8n-096', active: true, version: 1, content: '卡096' }] })
    const gw = makeGateway(() => ({ choices: [{ message: { content: '' } }] }))
    const record = await rec.recognizeImages({ session, userInput: { images: ['i'] }, gateway: gw, db })
    ok('EMPTY 合法空→failed且文案为"返回为空"', record.failed === true && record.text.indexOf('返回为空') >= 0, record.text)
  }

  // ── B3 负向：未知卡 id → throw（原行为：静默回退 recommend_deep）──
  {
    let threw = null
    try { rec.cardToMode({ id: '999' }) } catch (e) { threw = e }
    ok('B3 未知卡id→throw', threw && threw.message.indexOf('999') >= 0, threw && threw.message)
    let threwNull = null
    try { rec.cardToMode(null) } catch (e) { threwNull = e }
    ok('B3 空卡→throw', threwNull !== null)
    ok('B3 正向映射不变', rec.cardToMode(rec.CARD_DEEP) === 'recommend_deep' && rec.cardToMode(rec.CARD_FAST) === 'recommend_fast')
  }

  // ── 负向：prompt 资产缺失禁止回退硬编码（recommend 级，缺099）──
  {
    const session = rec.createMealSession({ mealId: 'm_neg_099' })
    rec.judgeScene(session, '堂食')
    rec.collectRequirements(session, { userRequirements: ['清淡'] })
    rec.loadCandidates(session, [])
    const db = makeDb({ prompts: [] })
    const gw = makeGateway(() => ({ text: 'x' }))
    let threw = null
    try {
      await rec.recommend({ session, userInput: '想吃清淡的', gateway: gw, db })
    } catch (e) { threw = e }
    ok('099缺失→reject且报"prompt 资产缺失"', threw && threw.message.indexOf('prompt 资产缺失') >= 0, threw && threw.message)
  }

  // ── 正向 e2e：全量资产 → recommend 出第一段 ──
  {
    const session = rec.createMealSession({ mealId: 'm_e2e' })
    rec.judgeScene(session, '堂食')
    rec.collectRequirements(session, { userRequirements: ['清淡'] })
    rec.loadCandidates(session, [{ dishId: 'd1', name: '清蒸鱼', allergens: [], tags: [], support: '✓' }])
    const prompts = ['099', '097', '096'].map((id) => ({ id: 'AGT-0924-w8n-' + id, active: true, version: 1, content: '卡' + id }))
    const tables = ['016', '020', '033', '051', '062', '058', '068'].map((no) => ({ tableNo: no, active: true, version: 1, content: '表' + no + '内容' }))
    const db = makeDb({ prompts, tables })
    const gw = makeGateway(() => ({ text: '1. 清蒸鱼 理由：清淡' }))
    const res = await rec.recommend({ session, userInput: '想吃清淡的', gateway: gw, db })
    ok('E2E mode=recommend_deep', res.mode === 'recommend_deep', res.mode)
    ok('E2E 无缺表', res.tableGaps.length === 0, res.tableGaps)
    ok('E2E 状态=two_stage_output', session.stage === 'two_stage_output', session.stage)
    ok('E2E 装配含099+表016', gw._calls[0].messages[0].content.indexOf('卡099') >= 0 && gw._calls[0].messages[0].content.indexOf('表016内容') >= 0)
  }

  console.log('\n结果: ' + pass + '/' + (pass + fail))
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2) })
