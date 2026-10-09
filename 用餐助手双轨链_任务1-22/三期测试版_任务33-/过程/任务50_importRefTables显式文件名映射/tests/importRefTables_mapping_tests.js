// [任务50] importRefTables 显式 fileName 映射单测（独立 harness）
// 原则：harness 与生产代码不共享假设。
//   - wx-server-sdk / @cloudbase/manager-node 经 Module._load 拦截替换为测试替身，
//     替身形状按"接口约定"构造（listCurrentDirectory → {files:[{Key}]};
//     downloadFile({cloudPath,localPath}) → 将内容写入 localPath），与被测代码内部实现独立。
//   - 云存储文件清单与文件内容均为测试自建数据，非来自生产代码的同一假设。
// 运行：node tests/importRefTables_mapping_tests.js（在任务50目录下）
'use strict'

const fs = require('fs')
const path = require('path')
const Module = require('module')

// ── 测试替身 ──────────────────────────────────────────────────────
const store = {
  // key → md 内容；由每个用例自行填充
  files: new Map()
}

const dbStub = {
  collection () {
    return {
      where: () => ({
        update: () => Promise.resolve({}),
        limit: () => ({ get: () => Promise.resolve({ data: [] }) })
      }),
      add: () => Promise.resolve({})
    }
  }
}

const wxStub = {
  init: () => {},
  database: () => dbStub,
  getWXContext: () => ({}),
  downloadFile: () => Promise.resolve({ fileContent: null })
}

const managerStub = {
  storage: {
    listCurrentDirectory: (dir) => {
      const keys = [...store.files.keys()].filter((k) => k.startsWith(dir + '/'))
      return Promise.resolve({ files: keys.map((k) => ({ Key: k })) })
    },
    downloadFile: ({ cloudPath, localPath }) => {
      const content = store.files.get(cloudPath)
      if (content === undefined) return Promise.reject(new Error('not found: ' + cloudPath))
      fs.writeFileSync(localPath, content)
      return Promise.resolve({})
    }
  }
}

const origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return wxStub
  if (request === '@cloudbase/manager-node') return { init: () => managerStub }
  return origLoad.apply(this, arguments)
}

const importer = require('../../任务43_识图卡接入/cloudfunctions/importRefTables/index.js')

// ── 断言工具 ──────────────────────────────────────────────────────
let pass = 0
let fail = 0
function ok (name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name) }
  else { fail++; console.log('FAIL  ' + name + (extra !== undefined ? '  | got: ' + JSON.stringify(extra) : '')) }
}

function md (title, version) {
  return `---\ntitle: ${title}\nversion: ${version}\n---\n\n${title}正文内容`
}

// 9 张速查表的真实云存储形态（Walter 侧）：5 张文件名含表号 + 4 张 R 系列
const NINE_KEYS = [
  ['ref_tables/016口味负荷速查表.md', md('口味负荷速查表', 'v1')],
  ['ref_tables/020场景速查表.md', md('场景速查表', 'v1')],
  ['ref_tables/033稳定性判定.md', md('稳定性判定', 'v1')],
  ['ref_tables/017机制原理.md', md('机制原理', 'v1')],
  ['ref_tables/026机制原理v2.md', md('机制原理', 'v2')],
  ['ref_tables/辣度标注惯例_R8.md', md('辣度标注惯例', 'v1')],
  ['ref_tables/通用维度底线表_R9.md', md('通用维度底线表', 'v1')],
  ['ref_tables/口味搭配方法_R3.md', md('口味搭配方法', 'v1')],
  ['ref_tables/情景速查表_R7.md', md('情景速查表', 'v1')]
]

async function run (keys) {
  store.files = new Map(keys)
  return importer.main({})
}

async function main () {
  // ── A. 全量正路：Walter 真实 9 文件场景 → 9 进 0 缺，from 记录命中 Key ──
  {
    const r = await run(NINE_KEYS)
    ok('A1 imported 9 张', r.imported.length === 9 && r.missing.length === 0, r)
    const byNo = Object.fromEntries(r.imported.map((i) => [i.tableNo, i.from]))
    ok('A2 051→辣度标注惯例_R8.md（显式映射命中）', byNo['051'] === 'ref_tables/辣度标注惯例_R8.md', byNo['051'])
    ok('A3 062→通用维度底线表_R9.md（显式映射命中）', byNo['062'] === 'ref_tables/通用维度底线表_R9.md', byNo['062'])
    ok('A4 058→口味搭配方法_R3.md（显式映射命中）', byNo['058'] === 'ref_tables/口味搭配方法_R3.md', byNo['058'])
    ok('A5 068→情景速查表_R7.md（显式映射命中）', byNo['068'] === 'ref_tables/情景速查表_R7.md', byNo['068'])
    ok('A6 016 仍走数字段兜底', byNo['016'] === 'ref_tables/016口味负荷速查表.md', byNo['016'])
    ok('A7 026 多数字段取完整段匹配', byNo['026'] === 'ref_tables/026机制原理v2.md', byNo['026'])
  }

  // ── B. 优先级：显式 fileName 与数字段同时可命中时，fileName 优先 ──
  {
    // 显式映射文件与数字段干扰文件同时存在 → fileName 必须优先
    const keys = [...NINE_KEYS, ['ref_tables/051其他辣度表.md', md('其他辣度表', 'v9')]]
    const r = await run(keys)
    const hit051 = r.imported.find((i) => i.tableNo === '051')
    ok('B1 051 优先显式 fileName', hit051 && hit051.from === 'ref_tables/辣度标注惯例_R8.md', hit051)
  }

  // ── C. 负向：4 张 R 系列全缺 → 如实报缺进 missing，绝不编造 ──
  {
    const keys = NINE_KEYS.filter(([k]) => !/_R\d+\.md$/.test(k))
    const r = await run(keys)
    ok('C1 缺 4 张', r.missing.length === 4, r.missing)
    ok('C2 缺的是 051/062/058/068', ['051', '062', '058', '068'].every((n) => r.missing.includes(n)), r.missing)
    ok('C3 imported 5 张', r.imported.length === 5, r.imported.length)
    ok('C4 note 如实列缺口', typeof r.note === 'string' && r.note.indexOf('051') >= 0, r.note)
  }

  // ── D. 负向：显式 fileName 缺席/不符时的回退与报缺行为 ──
  {
    // D1: 显式映射的文件缺席，但存在数字段可兜底的文件 → 走数字段兜底（不因映射缺席而停摆）
    const keys1 = NINE_KEYS.filter(([k]) => k !== 'ref_tables/辣度标注惯例_R8.md')
    keys1.push(['ref_tables/051辣度速查.md', md('辣度速查', 'v1')])
    const r1 = await run(keys1)
    const hit1 = r1.imported.find((i) => i.tableNo === '051')
    ok('D1 显式fileName缺席→数字段兜底', hit1 && hit1.from === 'ref_tables/051辣度速查.md', hit1)

    // D2: fileName 逐字不符（大小写差异），其余文件数字段也不匹配 051（"r8" 的数字段是 8 不是 051）
    //      → 如实报缺，不静默命中、不编造
    const keys2 = NINE_KEYS.filter(([k]) => k !== 'ref_tables/辣度标注惯例_R8.md')
    keys2.push(['ref_tables/辣度标注惯例_r8.md', md('小写r8', 'v1')])
    const r2 = await run(keys2)
    ok('D2 fileName不符且数字段无命中→051报缺', r2.missing.includes('051'), r2.missing)
    ok('D2 051 未进 imported', !r2.imported.some((i) => i.tableNo === '051'), r2.imported)
  }

  // ── E. from 语义不变：数字段兜底命中时 from 照常记命中 Key ──
  {
    const r = await run(NINE_KEYS)
    const hit020 = r.imported.find((i) => i.tableNo === '020')
    ok('E1 兜底命中 from=命中Key', hit020 && hit020.from === 'ref_tables/020场景速查表.md', hit020)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2) })
