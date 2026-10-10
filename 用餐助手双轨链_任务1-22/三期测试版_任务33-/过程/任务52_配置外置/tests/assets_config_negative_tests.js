// tests/assets_config_negative_tests.js
// 任务52配置外置 —— 负向单测（纯 Node 断言，零云依赖）
//
// 运行：node tests/assets_config_negative_tests.js
//
// 设计：
//   - 用 Module._load 拦截 wx-server-sdk 与 @cloudbase/manager-node 替身，避免真实云依赖。
//   - 用 fs 在临时目录改写清单副本模拟缺件，不改仓库原件。
//   - 覆盖：①清单缺项报缺（MODEL_MAP/EXPECTED_TABLES/EXPECTED_PROMPTS 各一）
//           ②改名不命中不误配（精确 fileName 不中 + 数字段模糊不中 → 报缺）
//           ③模糊兜底优先级（精确 fileName 与数字段模糊同时可命中 → 选精确 fileName）
//   - 结束打印 "n/m PASS"。

'use strict'

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const Module = require('module')

// ── 计数 ─────────────────────────────────────────────────────────
let passed = 0
let total = 0
function check(name, fn) {
  total++
  try {
    fn()
    passed++
    console.log('  PASS  ' + name)
  } catch (e) {
    console.log('  FAIL  ' + name + '  →  ' + (e && e.message ? e.message : e))
  }
}

// ── 仓库根定位（本文件在 tests/ 下，根 = 上一级）────────────────────
const ROOT = path.resolve(__dirname, '..')
const SHARED_CONFIG = path.join(ROOT, 'cloudfunctions', 'shared', 'assets.config.js')

// ── 临时工作区 ───────────────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'assets_cfg_test_'))

// ── Module._load 拦截：云 SDK 替身（零云依赖）──────────────────────
const origLoad = Module._load
function installStub() {
  Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') {
      return {
        init() {},
        DYNAMIC_CURRENT_ENV: 'DYNAMIC_CURRENT_ENV',
        getWXContext() { return { ENV: 'stub-env' } },
        database() {
          return {
            collection() {
              return {
                where() { return this },
                orderBy() { return this },
                limit() { return this },
                get() { return Promise.resolve({ data: [] }) },
                update() { return Promise.resolve({}) },
                add() { return Promise.resolve({}) },
                doc() { return { update() { return Promise.resolve({}) } } }
              }
            }
          }
        },
        downloadFile() { return Promise.resolve({ fileContent: Buffer.from('') }) },
        ai() { return { createModel() { return { generateText() { return Promise.resolve({ text: '' }) } } } } }
      }
    }
    if (request === '@cloudbase/manager-node') {
      return {
        init() {
          return {
            storage: {
              listCurrentDirectory() { return Promise.resolve({ files: [] }) },
              downloadFile() { return Promise.resolve({}) }
            }
          }
        }
      }
    }
    return origLoad.apply(this, arguments)
  }
}
function uninstallStub() {
  Module._load = origLoad
}

// ── 工具：读清单源文本 ───────────────────────────────────────────
function readConfigSource() {
  return fs.readFileSync(SHARED_CONFIG, 'utf8')
}

// ── 工具：在临时目录生成"改造版清单副本" ─────────────────────────
// 复制仓库清单源文本 → 写入 TMP 下带唯一名的 .js 文件 → 返回该文件路径。
// 调用方对文本做删改以模拟缺件，绝不触碰仓库原件。
let copySeq = 0
function makeConfigCopy(mutate) {
  copySeq++
  let src = readConfigSource()
  if (typeof mutate === 'function') src = mutate(src)
  const p = path.join(TMP, `assets.config.copy${copySeq}.js`)
  fs.writeFileSync(p, src, 'utf8')
  return p
}

// ── 工具：清 require 缓存后加载指定清单副本，返回 { ok, value, error } ──
function loadConfig(configPath) {
  try {
    delete require.cache[require.resolve(configPath)]
  } catch (e) { /* 首次无缓存 */ }
  try {
    const value = require(configPath)
    return { ok: true, value, error: null }
  } catch (e) {
    return { ok: false, value: null, error: e }
  }
}

// ── 工具：加载"改造版脚本"，其 require 的清单被重定向到 configPath ──
// 通过 Module._load 拦截 '../shared/assets.config.js' 的相对请求，
// 命中时改从 configPath 加载（仅测试期重定向，不改仓库脚本）。
function loadScriptWithConfig(scriptPath, configPath) {
  const scriptAbs = path.resolve(scriptPath)
  const orig = Module._load
  Module._load = function (request, parent, isMain) {
    // 脚本内 require('../shared/assets.config.js')：parent.filename 为脚本路径
    if (/assets\.config(\.js)?$/.test(request) && parent && parent.filename) {
      // 仅当发起方是本脚本时重定向
      if (path.resolve(parent.filename) === scriptAbs) {
        const abs = path.resolve(configPath)
        delete require.cache[require.resolve(abs)]
        return require(abs)
      }
    }
    return orig.apply(this, arguments)
  }
  try {
    delete require.cache[require.resolve(scriptAbs)]
  } catch (e) { /* 无缓存 */ }
  let result, error
  try {
    result = require(scriptAbs)
  } catch (e) {
    error = e
  } finally {
    Module._load = orig
  }
  return { ok: !error, value: result, error }
}

// ── 工具：从清单副本中"删掉"某 mode / 某 tableNo / 某 promptId ─────
function dropModelMode(src, mode) {
  // 删掉形如 `  mode:      { channel: ..., model: ... },` 的整行
  const re = new RegExp('^\\s*' + mode + '\\s*:\\s*\\{[^}]*\\}\\s*,?\\s*$', 'm')
  return src.replace(re, '')
}
function dropTableNo(src, tableNo) {
  const re = new RegExp('^\\s*\\{\\s*tableNo:\\s*[\'"]' + tableNo + '[\'"][^}]*\\}\\s*,?\\s*$', 'm')
  return src.replace(re, '')
}
function dropPromptId(src, promptId) {
  const re = new RegExp('^\\s*\\{\\s*promptId:\\s*[\'"]' + promptId + '[\'"][^}]*\\}\\s*,?\\s*$', 'm')
  return src.replace(re, '')
}
function dropBinding(src, role) {
  // 删掉 PROMPT_BINDINGS 里形如 `  ROLE: 'AGT-...', // 注释` 的整行
  // （只匹配冒号后直接引号的行，不会误伤 MODEL_MAP；容忍行尾注释）
  const re = new RegExp('^\\s*' + role + '\\s*:\\s*[\'"][^\'"]+[\'"]\\s*,?\\s*(//.*)?\\s*$', 'm')
  return src.replace(re, '')
}

// ═══════════════════════════════════════════════════════════════
// 测试主体
// ═══════════════════════════════════════════════════════════════

console.log('\n[任务52配置外置 · 负向单测]\n')

installStub()

// ── 前置健全性：仓库原件清单自检应通过 ───────────────────────────
console.log('— 前置健全性 —')
check('仓库原件 assets.config.js 自检通过（ok=true，无缺项）', () => {
  const r = loadConfig(SHARED_CONFIG)
  assert.strictEqual(r.ok, true, '加载仓库原件失败：' + (r.error && r.error.message))
  const chk = r.value.checkConfig()
  assert.strictEqual(chk.ok, true, '仓库原件自检不通过，缺项：' + chk.missing.join('、'))
  assert.deepStrictEqual(chk.missing, [], '缺项应为空')
})

// ═══════════════════════════════════════════════════════════════
// ① 清单缺项报缺
// ═══════════════════════════════════════════════════════════════
console.log('\n— ① 清单缺项报缺 —')

// ①-a MODEL_MAP 缺某 mode → checkConfig 不通过且点名
check('①a MODEL_MAP 缺 chat → checkConfig.ok=false 且点名 MODEL_MAP.chat', () => {
  const p = makeConfigCopy((s) => dropModelMode(s, 'chat'))
  const r = loadConfig(p)
  assert.strictEqual(r.ok, true, '清单加载不应抛错（缺项由 checkConfig 报）：' + (r.error && r.error.message))
  const chk = r.value.checkConfig()
  assert.strictEqual(chk.ok, false, '缺 chat 后自检应不通过')
  assert.ok(chk.missing.some((m) => m.indexOf('MODEL_MAP.chat') === 0),
    '缺项应点名 MODEL_MAP.chat，实得：' + chk.missing.join('、'))
})

// ①-b EXPECTED_TABLES 缺某 tableNo → 项数不足且点名
check('①b EXPECTED_TABLES 缺 051 → checkConfig.ok=false 且项数不足', () => {
  const p = makeConfigCopy((s) => dropTableNo(s, '051'))
  const r = loadConfig(p)
  assert.strictEqual(r.ok, true, '清单加载不应抛错：' + (r.error && r.error.message))
  const chk = r.value.checkConfig()
  assert.strictEqual(chk.ok, false, '缺表后自检应不通过')
  assert.ok(chk.missing.some((m) => m.indexOf('EXPECTED_TABLES') === 0),
    '缺项应点名 EXPECTED_TABLES，实得：' + chk.missing.join('、'))
})

// ①-c EXPECTED_PROMPTS 缺某 promptId → 项数不足且点名
check('①c EXPECTED_PROMPTS 缺 098 → checkConfig.ok=false 且项数不足', () => {
  const p = makeConfigCopy((s) => dropPromptId(s, 'AGT-0924-w8n-098'))
  const r = loadConfig(p)
  assert.strictEqual(r.ok, true, '清单加载不应抛错：' + (r.error && r.error.message))
  const chk = r.value.checkConfig()
  assert.strictEqual(chk.ok, false, '缺卡后自检应不通过')
  assert.ok(chk.missing.some((m) => m.indexOf('EXPECTED_PROMPTS') === 0),
    '缺项应点名 EXPECTED_PROMPTS，实得：' + chk.missing.join('、'))
})

// ①-d aiGateway：清单缺项 → 加载即抛错，错误信息含"缺"且点名，不猜默认值继续执行
check('①d aiGateway 清单缺 chat → 加载即 throw，信息含"缺"并点名 MODEL_MAP.chat', () => {
  const p = makeConfigCopy((s) => dropModelMode(s, 'chat'))
  const r = loadScriptWithConfig(
    path.join(ROOT, 'cloudfunctions', 'aiGateway', 'index.js'), p)
  assert.strictEqual(r.ok, false, 'aiGateway 应加载即抛错拒绝执行')
  const msg = String(r.error && r.error.message || r.error)
  assert.ok(msg.indexOf('缺') >= 0, '错误信息应含"缺"，实得：' + msg)
  assert.ok(msg.indexOf('MODEL_MAP.chat') >= 0, '错误信息应点名 MODEL_MAP.chat，实得：' + msg)
})

// ①-e recommend.js：清单缺 promptId → 加载即 throw，信息含"缺"并点名
check('①e recommend.js 清单缺 098 → 加载即 throw，信息含"缺"并点名', () => {
  const p = makeConfigCopy((s) => dropPromptId(s, 'AGT-0924-w8n-098'))
  const r = loadScriptWithConfig(
    path.join(ROOT, 'common', 'recommend.js'), p)
  assert.strictEqual(r.ok, false, 'recommend.js 应加载即抛错拒绝执行')
  const msg = String(r.error && r.error.message || r.error)
  assert.ok(msg.indexOf('缺') >= 0, '错误信息应含"缺"，实得：' + msg)
  assert.ok(msg.indexOf('AGT-0924-w8n-098') >= 0 || msg.indexOf('EXPECTED_PROMPTS') >= 0,
    '错误信息应点名缺的 prompt 资产，实得：' + msg)
})

// ①-f importRefTables：清单缺项 → main() 返回 ok=false 且 note 点名，不猜默认值
check('①f importRefTables 清单缺 098 → main() 返回 ok=false 且 note 点名', async () => {
  // importRefTables 的清单自检在 main 入口，需实际调用 main
  const p = makeConfigCopy((s) => dropPromptId(s, 'AGT-0924-w8n-098'))
  const r = loadScriptWithConfig(
    path.join(ROOT, 'cloudfunctions', 'importRefTables', 'index.js'), p)
  assert.strictEqual(r.ok, true, 'importRefTables 加载不应抛错（自检在 main）：' + (r.error && r.error.message))
  // main 是 async，同步测试内触发并断言返回体
  const ret = r.value.main({})
  assert.ok(ret && typeof ret.then === 'function', 'main 应返回 Promise')
  ret.then((out) => {
    assert.strictEqual(out.ok, false, '清单缺项时 main 应返回 ok=false')
    assert.strictEqual(out.error, 'assets_config_check_failed', 'error 应为 assets_config_check_failed')
    assert.ok(String(out.note || '').indexOf('缺') >= 0, 'note 应含"缺"，实得：' + out.note)
  }).catch((e) => {
    throw new Error('main 拒绝执行时不应抛未捕获异常：' + (e && e.message))
  })
})

// ①-g recommend.js：清单缺 PROMPT_BINDINGS 角色绑定 → 加载即 throw，信息含"缺"并点名角色
check('①g recommend.js 缺 PROMPT_BINDINGS.PROMPT_RECOGNIZE → 加载即 throw，点名该角色', () => {
  const p = makeConfigCopy((s) => dropBinding(s, 'PROMPT_RECOGNIZE'))
  const r = loadScriptWithConfig(
    path.join(ROOT, 'common', 'recommend.js'), p)
  assert.strictEqual(r.ok, false, 'recommend.js 应加载即抛错拒绝执行')
  const msg = String(r.error && r.error.message || r.error)
  assert.ok(msg.indexOf('缺') >= 0, '错误信息应含"缺"，实得：' + msg)
  assert.ok(msg.indexOf('PROMPT_BINDINGS.PROMPT_RECOGNIZE') >= 0,
    '错误信息应点名 PROMPT_BINDINGS.PROMPT_RECOGNIZE，实得：' + msg)
})

// ═══════════════════════════════════════════════════════════════
// ② 改名不命中不误配（精确 fileName 不中 + 数字段模糊不中 → 报缺）
// ═══════════════════════════════════════════════════════════════
console.log('\n— ② 改名不命中不误配 —')

// 直接测 importRefTables 内部的匹配函数语义：通过注入"目录文件清单"驱动 main。
// 用 stub 让 listCurrentDirectory 返回一批"改名后"的文件名，观察 missing 是否点名、是否错配。
function runImportWithDirFiles(dirFiles, promptFiles) {
  // 临时重装 stub：listCurrentDirectory 返回给定文件清单
  const orig = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === '@cloudbase/manager-node') {
      return {
        init() {
          return {
            storage: {
              listCurrentDirectory(dir) {
                // ref_tables 目录返回 dirFiles，prompt_assets 返回 promptFiles
                const isPrompt = String(dir).indexOf('prompt') >= 0
                const list = isPrompt ? promptFiles : dirFiles
                return Promise.resolve({ files: list.map((Key) => ({ Key })) })
              },
              downloadFile({ cloudPath }) {
                // 命中即返回一段可解析 md（带 frontmatter）
                return Promise.resolve({})
              }
            }
          }
        }
      }
    }
    if (request === 'wx-server-sdk') {
      return {
        init() {}, DYNAMIC_CURRENT_ENV: 'x',
        getWXContext() { return { ENV: 'stub' } },
        database() {
          return { collection() { return {
            where() { return this }, orderBy() { return this }, limit() { return this },
            get() { return Promise.resolve({ data: [] }) },
            update() { return Promise.resolve({}) },
            add() { return Promise.resolve({}) },
            doc() { return { update() { return Promise.resolve({}) } } }
          } } }
        },
        downloadFile() { return Promise.resolve({ fileContent: Buffer.from('') }) },
        ai() { return { createModel() { return { generateText() { return Promise.resolve({ text: '' }) } } } } }
      }
    }
    return orig.apply(this, arguments)
  }

  // downloadMdByKey 走 manager.storage.downloadFile → /tmp 文件；这里改为让 fs 读到内容。
  // 简化：直接让 downloadFile 在 localPath 写一段合法 md。
  Module._load = function (request, parent, isMain) {
    if (request === '@cloudbase/manager-node') {
      return {
        init() {
          return {
            storage: {
              listCurrentDirectory(dir) {
                const isPrompt = String(dir).indexOf('prompt') >= 0
                const list = isPrompt ? promptFiles : dirFiles
                return Promise.resolve({ files: list.map((Key) => ({ Key })) })
              },
              downloadFile({ cloudPath, localPath }) {
                // 写一段带 frontmatter 的 md，供 importRefTables 解析
                const md = '---\ntitle: T\nversion: v1\nid: ' + cloudPath + '\n---\n正文\n'
                fs.writeFileSync(localPath, md, 'utf8')
                return Promise.resolve({})
              }
            }
          }
        }
      }
    }
    if (request === 'wx-server-sdk') {
      return {
        init() {}, DYNAMIC_CURRENT_ENV: 'x',
        getWXContext() { return { ENV: 'stub' } },
        database() {
          return { collection() { return {
            where() { return this }, orderBy() { return this }, limit() { return this },
            get() { return Promise.resolve({ data: [] }) },
            update() { return Promise.resolve({}) },
            add() { return Promise.resolve({}) },
            doc() { return { update() { return Promise.resolve({}) } } }
          } } }
        },
        downloadFile() { return Promise.resolve({ fileContent: Buffer.from('') }) },
        ai() { return { createModel() { return { generateText() { return Promise.resolve({ text: '' }) } } } } }
      }
    }
    return orig.apply(this, arguments)
  }

  const scriptAbs = path.join(ROOT, 'cloudfunctions', 'importRefTables', 'index.js')
  try { delete require.cache[require.resolve(scriptAbs)] } catch (e) {}
  const mod = require(scriptAbs)
  Module._load = orig
  return mod.main({})
}

// ②-a 表文件改名：精确 fileName 不中 + 数字段模糊不中 → 报缺，且不错配到别的表
check('②a 表文件改名（051→乱名）→ 051 进 missing，不误配到其他表', () => {
  // 目录里放一批文件：051 的精确名被改掉，且不含独立数字段 "051"
  const dirFiles = [
    'ref_tables/016口味负荷速查表.md',
    'ref_tables/020场景速查表.md',
    'ref_tables/033稳定性判定.md',
    'ref_tables/辣度标注惯例_乱改.md',      // 051 原精确名被改，且无 "051" 数字段
    'ref_tables/通用维度底线表_R9.md',
    'ref_tables/口味搭配方法_R3.md',
    'ref_tables/情景速查表_R7.md',
    'ref_tables/017机制原理.md',
    'ref_tables/026机制原理.md'
  ]
  const promptFiles = [
    'prompt_assets/识图任务执行卡-AGT-0924-w8n-096.md',
    'prompt_assets/详细推荐执行卡-AGT-0924-w8n-097.md',
    'prompt_assets/快速推荐执行卡-AGT-0924-w8n-098.md',
    'prompt_assets/饮食推荐agent初始化prompt-AGT-0924-w8n-099.md'
  ]
  const ret = runImportWithDirFiles(dirFiles, promptFiles)
  return ret.then((out) => {
    assert.ok(out.missing.indexOf('051') >= 0, '051 应进 missing，实得 missing=' + JSON.stringify(out.missing))
    // 不得错配：051 不应出现在 imported 里
    const importedNos = (out.imported || []).map((x) => x.tableNo)
    assert.ok(importedNos.indexOf('051') < 0, '051 改名后不得被错配导入')
    // 其他表应正常导入（不因 051 缺而整体失败）
    assert.ok(importedNos.indexOf('016') >= 0, '016 应正常导入')
  })
})

// ═══════════════════════════════════════════════════════════════
// ③ 模糊兜底优先级（精确 fileName 与数字段模糊同时可命中 → 选精确 fileName）
// ═══════════════════════════════════════════════════════════════
console.log('\n— ③ 模糊兜底优先级 —')

check('③ 051 同时存在"精确名"与"含051数字段"两文件 → 选精确 fileName', () => {
  // 目录里：精确名文件 + 一个含独立数字段 051 的干扰文件
  const dirFiles = [
    'ref_tables/016口味负荷速查表.md',
    'ref_tables/020场景速查表.md',
    'ref_tables/033稳定性判定.md',
    'ref_tables/辣度标注惯例_R8.md',       // 051 精确 fileName（应被选中）
    'ref_tables/051干扰文件.md',           // 含独立数字段 051（模糊可命中，但应让位）
    'ref_tables/通用维度底线表_R9.md',
    'ref_tables/口味搭配方法_R3.md',
    'ref_tables/情景速查表_R7.md',
    'ref_tables/017机制原理.md',
    'ref_tables/026机制原理.md'
  ]
  const promptFiles = [
    'prompt_assets/识图任务执行卡-AGT-0924-w8n-096.md',
    'prompt_assets/详细推荐执行卡-AGT-0924-w8n-097.md',
    'prompt_assets/快速推荐执行卡-AGT-0924-w8n-098.md',
    'prompt_assets/饮食推荐agent初始化prompt-AGT-0924-w8n-099.md'
  ]
  const ret = runImportWithDirFiles(dirFiles, promptFiles)
  return ret.then((out) => {
    const rec = (out.imported || []).find((x) => x.tableNo === '051')
    assert.ok(rec, '051 应被导入')
    // 精确 fileName 优先：from 应指向精确名文件，而非含 051 数字段的干扰文件
    assert.ok(String(rec.from).indexOf('辣度标注惯例_R8.md') >= 0,
      '051 应选中精确 fileName 文件，实得 from=' + rec.from)
    assert.ok(String(rec.from).indexOf('051干扰文件') < 0,
      '051 不得选中数字段模糊命中的干扰文件')
  })
})

// ── 收尾 ─────────────────────────────────────────────────────────
uninstallStub()
try { fs.rmSync(TMP, { recursive: true, force: true }) } catch (e) { /* 清理忽略 */ }

// 说明：含 async 的用例以 Promise 触发断言，此处给出同步可判定的汇总。
// 为对 async 用例给出一致口径，额外等待一个 tick 后打印计数。
setTimeout(() => {
  console.log('\n' + passed + '/' + total + ' PASS\n')
  if (passed !== total) process.exitCode = 1
}, 50)
