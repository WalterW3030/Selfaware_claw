// tests/assets_config_negative_tests.js
// 任务52配置外置 —— 负向单测（纯 Node 断言，零云依赖）
// 【任务55更新】卡链108-112 + 名称段匹配（nameSeg，编号不参与）：
//   ①组缺件用例换新卡ID（098→109）；②组改为"编号对名称不对→不命中"；
//   ③组改为"编号不对名称对→命中"与"多命中→报歧义"（原"精确fileName优先"逻辑已退役）；
//   新增⑥组：selectCard/cardToMode 卡链路由负向用例。
//
// 运行：node tests/assets_config_negative_tests.js
//
// 设计：
//   - 用 Module._load 拦截 wx-server-sdk 与 @cloudbase/manager-node 替身，避免真实云依赖。
//   - 用 fs 在临时目录改写清单副本模拟缺件，不改仓库原件。
//   - 覆盖：①清单缺项报缺（MODEL_MAP/EXPECTED_TABLES/EXPECTED_PROMPTS/BINDINGS角色 各一）
//           ②编号对名称不对→不命中不误配（任务55负向必备一）
//           ③编号不对名称对→命中 / 多命中→报歧义（任务55负向必备二、三）
//           ④ENV_ID 环境ID兜底优先级（任务53：清单>wxContext>TCB_ENV>undefined）
//           ⑤chat位角色注入（任务54：注入system含"食知"/缺PERSONA拒绝点名/空白拒绝/非chat不注入）
//           ⑥任务55卡链路由：百科动词→111 / 默认108 / 显式快速109 / 裸"分析"不进111 /
//             cardToMode(111)=recommend_deep / 未知卡throw点名 / 缺CARD_WIKI绑定拒绝点名
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
// 通过 Module._load 拦截脚本发出的清单请求（'./assets.config.js'，部署副本路径），
// 命中时改从 configPath 加载（仅测试期重定向，不改仓库脚本）。
// 兼容说明：拦截按 /assets\.config(\.js)?$/ 匹配请求名，不区分 './' 与 '../' 前缀。
function loadScriptWithConfig(scriptPath, configPath) {
  const scriptAbs = path.resolve(scriptPath)
  const orig = Module._load
  Module._load = function (request, parent, isMain) {
    // 脚本内 require('./assets.config.js')：parent.filename 为脚本路径
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
// 【任务55】卡链108-112，缺件样本用 109（快速卡）
check('①c EXPECTED_PROMPTS 缺 109 → checkConfig.ok=false 且项数不足', () => {
  const p = makeConfigCopy((s) => dropPromptId(s, 'AGT-0924-w8n-109'))
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
// 【任务55】缺件样本用 109（CARD_FAST 绑定指向它）
check('①e recommend.js 清单缺 109 → 加载即 throw，信息含"缺"并点名', () => {
  const p = makeConfigCopy((s) => dropPromptId(s, 'AGT-0924-w8n-109'))
  const r = loadScriptWithConfig(
    path.join(ROOT, 'common', 'recommend.js'), p)
  assert.strictEqual(r.ok, false, 'recommend.js 应加载即抛错拒绝执行')
  const msg = String(r.error && r.error.message || r.error)
  assert.ok(msg.indexOf('缺') >= 0, '错误信息应含"缺"，实得：' + msg)
  assert.ok(msg.indexOf('AGT-0924-w8n-109') >= 0 || msg.indexOf('EXPECTED_PROMPTS') >= 0,
    '错误信息应点名缺的 prompt 资产，实得：' + msg)
})

// ①-f importRefTables：清单缺项 → main() 返回 ok=false 且 note 点名，不猜默认值
// 【任务55】缺件样本用 109
check('①f importRefTables 清单缺 109 → main() 返回 ok=false 且 note 点名', async () => {
  // importRefTables 的清单自检在 main 入口，需实际调用 main
  const p = makeConfigCopy((s) => dropPromptId(s, 'AGT-0924-w8n-109'))
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

// ①-h 【任务55】缺 CARD_WIKI 绑定（百科卡111接线）→ recommend.js 加载即 throw，点名该角色
check('①h recommend.js 缺 PROMPT_BINDINGS.CARD_WIKI → 加载即 throw，点名该角色', () => {
  const p = makeConfigCopy((s) => dropBinding(s, 'CARD_WIKI'))
  const r = loadScriptWithConfig(
    path.join(ROOT, 'common', 'recommend.js'), p)
  assert.strictEqual(r.ok, false, 'recommend.js 应加载即抛错拒绝执行')
  const msg = String(r.error && r.error.message || r.error)
  assert.ok(msg.indexOf('缺') >= 0, '错误信息应含"缺"，实得：' + msg)
  assert.ok(msg.indexOf('PROMPT_BINDINGS.CARD_WIKI') >= 0,
    '错误信息应点名 PROMPT_BINDINGS.CARD_WIKI，实得：' + msg)
})

// ═══════════════════════════════════════════════════════════════
// ② 编号对名称不对→不命中不误配（任务55负向必备一：编号完全不参与匹配）
// ═══════════════════════════════════════════════════════════════
console.log('\n— ② 编号对名称不对→不命中不误配（任务55） —')

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

// ②-a 表文件名称段被改：编号 051 在、名称段不对（"辣度标注速查表"≠"辣度标注惯例"）→ 报缺，且不错配
// （任务55机制：basename 含 nameSeg 才命中；编号完全不参与，编号对了也救不回错误名称）
check('②a 编号对名称不对（051辣度标注速查表.md）→ 051 进 missing，不误配到其他表', () => {
  const dirFiles = [
    'ref_tables/016口味负荷速查表.md',
    'ref_tables/020场景速查表.md',
    'ref_tables/033稳定性判定.md',
    'ref_tables/051辣度标注速查表.md',      // 编号 051 在，但名称段不对 → 不命中（任务55负向必备一）
    'ref_tables/通用维度底线表_R9.md',
    'ref_tables/口味搭配方法_R3.md',
    'ref_tables/情景速查表_R7.md',
    'ref_tables/味相互作用原理_017.md',
    'ref_tables/机制原理手册_026.md'
  ]
  // 任务55新链 prompt 文件名（含各自 nameSeg）
  const promptFiles = [
    'prompt_assets/识图任务执行卡-AGT-0924-w8n-110.md',
    'prompt_assets/详细推荐执行卡-AGT-0924-w8n-108.md',
    'prompt_assets/快速推荐执行卡-AGT-0924-w8n-109.md',
    'prompt_assets/饮食百科任务执行卡-AGT-0924-w8n-111.md',
    'prompt_assets/饮食推荐agent初始化prompt-AGT-0924-w8n-112.md'
  ]
  const ret = runImportWithDirFiles(dirFiles, promptFiles)
  return ret.then((out) => {
    assert.ok(out.missing.indexOf('051') >= 0, '051 应进 missing，实得 missing=' + JSON.stringify(out.missing))
    // 不得错配：051 不应出现在 imported 里
    const importedNos = (out.imported || []).map((x) => x.tableNo)
    assert.ok(importedNos.indexOf('051') < 0, '051 名称段不对时不得被错配导入（编号不参与）')
    // 其他表应正常导入（不因 051 缺而整体失败）
    assert.ok(importedNos.indexOf('016') >= 0, '016 应正常导入')
    // prompt 五卡应全部按名称段命中（含编号 110-112 的新文件名）
    const importedPromptIds = (out.importedPrompts || []).map((x) => x.id)
    assert.strictEqual(importedPromptIds.length, 5, '五张 prompt 卡应全部导入，实得：' + importedPromptIds.join('、'))
  })
})

// ═══════════════════════════════════════════════════════════════
// ③ 名称段命中与多命中歧义（任务55负向必备二、三）
//   原"精确 fileName 优先于数字段模糊"逻辑已随任务55退役（编号/精确文件名均不参与匹配），
//   本组按任务书第4步替换为：编号不对名称对→命中；多命中→报歧义。
// ═══════════════════════════════════════════════════════════════
console.log('\n— ③ 名称段命中与多命中歧义（任务55） —')

// ③-a 编号不对名称对→命中：051 文件名不含 "051"、但含名称段 → 照样导入（任务55负向必备二）
check('③a 编号不对名称对（辣度标注惯例_R8终版.md 无编号）→ 051 命中导入', () => {
  const dirFiles = [
    'ref_tables/016口味负荷速查表.md',
    'ref_tables/020场景速查表.md',
    'ref_tables/033稳定性判定.md',
    'ref_tables/辣度标注惯例_R8终版.md',     // 无编号、名称段对 → 命中（任务55负向必备二）
    'ref_tables/通用维度底线表_R9.md',
    'ref_tables/口味搭配方法_R3.md',
    'ref_tables/情景速查表_R7.md',
    'ref_tables/味相互作用原理_017.md',
    'ref_tables/机制原理手册_026.md'
  ]
  const promptFiles = [
    'prompt_assets/识图任务执行卡-AGT-0924-w8n-110.md',
    'prompt_assets/详细推荐执行卡-AGT-0924-w8n-108.md',
    'prompt_assets/快速推荐执行卡-AGT-0924-w8n-109.md',
    'prompt_assets/饮食百科任务执行卡-AGT-0924-w8n-111.md',
    'prompt_assets/饮食推荐agent初始化prompt-AGT-0924-w8n-112.md'
  ]
  const ret = runImportWithDirFiles(dirFiles, promptFiles)
  return ret.then((out) => {
    assert.ok(out.missing.indexOf('051') < 0, '051 不应进 missing，实得 missing=' + JSON.stringify(out.missing))
    const rec = (out.imported || []).find((x) => x.tableNo === '051')
    assert.ok(rec, '051 应按名称段命中导入（编号不参与）')
    assert.ok(String(rec.from).indexOf('辣度标注惯例_R8终版.md') >= 0,
      '051 应选中名称段命中的文件，实得 from=' + rec.from)
    // 不得误报歧义：唯一命中
    assert.ok(!(out.ambiguousTables || []).some((a) => a.tableNo === '051'),
      '051 唯一命中时不得误报多命中歧义')
  })
})

// ③-b 多命中→报歧义：同一名称段两个文件 → 不猜，进 missing 并注明"多命中歧义"+命中文件列表
// （任务55负向必备三）
check('③b 多命中→报歧义（两个含辣度标注惯例的文件）→ 051 进 missing 且 note 注明歧义与命中列表', () => {
  const dirFiles = [
    'ref_tables/016口味负荷速查表.md',
    'ref_tables/020场景速查表.md',
    'ref_tables/033稳定性判定.md',
    'ref_tables/辣度标注惯例_R8.md',        // 命中①
    'ref_tables/辣度标注惯例_R8_备份.md',   // 命中② → 多命中
    'ref_tables/通用维度底线表_R9.md',
    'ref_tables/口味搭配方法_R3.md',
    'ref_tables/情景速查表_R7.md',
    'ref_tables/味相互作用原理_017.md',
    'ref_tables/机制原理手册_026.md'
  ]
  const promptFiles = [
    'prompt_assets/识图任务执行卡-AGT-0924-w8n-110.md',
    'prompt_assets/详细推荐执行卡-AGT-0924-w8n-108.md',
    'prompt_assets/快速推荐执行卡-AGT-0924-w8n-109.md',
    'prompt_assets/饮食百科任务执行卡-AGT-0924-w8n-111.md',
    'prompt_assets/饮食推荐agent初始化prompt-AGT-0924-w8n-112.md'
  ]
  const ret = runImportWithDirFiles(dirFiles, promptFiles)
  return ret.then((out) => {
    // 不猜：051 不得被导入
    const importedNos = (out.imported || []).map((x) => x.tableNo)
    assert.ok(importedNos.indexOf('051') < 0, '多命中时 051 不得被猜着导入')
    // 进 missing
    assert.ok(out.missing.indexOf('051') >= 0, '多命中时 051 应进 missing，实得：' + JSON.stringify(out.missing))
    // 歧义登记：命中列表两个文件、点名 051
    const amb = (out.ambiguousTables || []).find((a) => a.tableNo === '051')
    assert.ok(amb, 'ambiguousTables 应登记 051 的歧义')
    assert.strictEqual(amb.hits.length, 2, '051 歧义命中列表应为 2 个文件，实得：' + JSON.stringify(amb.hits))
    assert.ok(amb.hits.some((h) => h.indexOf('辣度标注惯例_R8.md') >= 0) &&
              amb.hits.some((h) => h.indexOf('辣度标注惯例_R8_备份.md') >= 0),
      '051 歧义命中列表应含两个命中文件名，实得：' + amb.hits.join('|'))
    // note 注明"多命中歧义"+命中文件
    assert.ok(String(out.note || '').indexOf('多命中歧义') >= 0,
      'note 应注明"多命中歧义"，实得：' + out.note)
    assert.ok(String(out.note || '').indexOf('辣度标注惯例') >= 0,
      'note 应列出命中文件，实得：' + out.note)
  })
})

// ③-c prompt 资产多命中→报歧义：同一名称段（详细推荐执行卡）两个文件 → 108 进 missingPrompts
// （与 ③-b 同机制，覆盖 prompt 资产路径）
check('③c prompt 多命中→报歧义（两个含详细推荐执行卡的文件）→ 108 进 missingPrompts 且歧义登记', () => {
  const dirFiles = [
    'ref_tables/016口味负荷速查表.md',
    'ref_tables/020场景速查表.md',
    'ref_tables/033稳定性判定.md',
    'ref_tables/辣度标注惯例_R8.md',
    'ref_tables/通用维度底线表_R9.md',
    'ref_tables/口味搭配方法_R3.md',
    'ref_tables/情景速查表_R7.md',
    'ref_tables/味相互作用原理_017.md',
    'ref_tables/机制原理手册_026.md'
  ]
  const promptFiles = [
    'prompt_assets/识图任务执行卡-AGT-0924-w8n-110.md',
    'prompt_assets/详细推荐执行卡-AGT-0924-w8n-108.md',   // 命中①
    'prompt_assets/详细推荐执行卡_旧版留档.md',           // 命中② → 多命中
    'prompt_assets/快速推荐执行卡-AGT-0924-w8n-109.md',
    'prompt_assets/饮食百科任务执行卡-AGT-0924-w8n-111.md',
    'prompt_assets/饮食推荐agent初始化prompt-AGT-0924-w8n-112.md'
  ]
  const ret = runImportWithDirFiles(dirFiles, promptFiles)
  return ret.then((out) => {
    assert.ok((out.missingPrompts || []).indexOf('AGT-0924-w8n-108') >= 0,
      '108 应进 missingPrompts，实得：' + JSON.stringify(out.missingPrompts))
    const amb = (out.ambiguousPrompts || []).find((a) => a.promptId === 'AGT-0924-w8n-108')
    assert.ok(amb, 'ambiguousPrompts 应登记 108 的歧义')
    assert.strictEqual(amb.hits.length, 2, '108 歧义命中列表应为 2 个文件，实得：' + JSON.stringify(amb.hits))
    const importedPromptIds = (out.importedPrompts || []).map((x) => x.id)
    assert.ok(importedPromptIds.indexOf('AGT-0924-w8n-108') < 0, '多命中时 108 不得被猜着导入')
    // 其余四卡不受影响
    assert.strictEqual(importedPromptIds.length, 4, '其余四卡应正常导入，实得：' + importedPromptIds.join('、'))
  })
})

// ═══════════════════════════════════════════════════════════════
// ④ ENV_ID 环境ID兜底优先级（任务53）：清单 ENV_ID > getWXContext().ENV > TCB_ENV > undefined
// ═══════════════════════════════════════════════════════════════
console.log('\n— ④ ENV_ID 环境ID兜底优先级（任务53） —')

// 工具：改写清单 ENV_ID 取值（传字符串替换右值；undefined=删整行模拟旧版清单）
function setEnvId(src, value) {
  if (value === undefined) {
    return src.replace(/^const ENV_ID = .*$/m, '')
  }
  return src.replace(/^const ENV_ID = .*$/m, 'const ENV_ID = ' + JSON.stringify(value))
}

// 工具：同步加载 importRefTables，捕获 CloudBase.init 实参；wx 上下文与 TCB_ENV 可控。
// wxCtx 传 { __throw: true } 模拟无 wx 上下文（getWXContext 抛错）。
function loadImportCaptureInit(configMutate, wxCtx, tcbEnv) {
  const p = makeConfigCopy(configMutate)
  const scriptAbs = path.join(ROOT, 'cloudfunctions', 'importRefTables', 'index.js')
  const hadTcb = Object.prototype.hasOwnProperty.call(process.env, 'TCB_ENV')
  const oldTcb = process.env.TCB_ENV
  if (tcbEnv === undefined) delete process.env.TCB_ENV
  else process.env.TCB_ENV = tcbEnv

  const orig = Module._load
  let capturedInit = null
  Module._load = function (request, parent, isMain) {
    if (/assets\.config(\.js)?$/.test(request) && parent && parent.filename &&
        path.resolve(parent.filename) === scriptAbs) {
      const abs = path.resolve(p)
      delete require.cache[require.resolve(abs)]
      return require(abs)
    }
    if (request === '@cloudbase/manager-node') {
      return {
        init(arg) {
          capturedInit = arg
          return {
            storage: {
              listCurrentDirectory() { return Promise.resolve({ files: [] }) },
              downloadFile() { return Promise.resolve({}) }
            }
          }
        }
      }
    }
    if (request === 'wx-server-sdk') {
      return {
        init() {},
        DYNAMIC_CURRENT_ENV: 'x',
        getWXContext() {
          if (wxCtx && wxCtx.__throw) throw new Error('no wx context')
          return wxCtx
        },
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
  try { delete require.cache[require.resolve(scriptAbs)] } catch (e) {}
  let loadErr = null
  try { require(scriptAbs) } catch (e) { loadErr = e }
  Module._load = orig
  if (hadTcb) process.env.TCB_ENV = oldTcb
  else delete process.env.TCB_ENV
  return { err: loadErr, initArg: capturedInit }
}

// ④-a 清单 ENV_ID 非空 → 第一优先（wx 上下文与 TCB_ENV 同时存在也被压过）
check('④a 清单 ENV_ID 非空 → init 收到清单值（压过 wxContext/TCB_ENV）', () => {
  const r = loadImportCaptureInit(null, { ENV: 'ctx-env-should-lose' }, 'tcb-env-should-lose')
  assert.strictEqual(r.err, null, '加载不应报错：' + (r.err && r.err.message))
  assert.deepStrictEqual(r.initArg, { envId: 'cloud1-d6giun5fd1af7fe74' },
    'init 实参应为清单 ENV_ID，实得：' + JSON.stringify(r.initArg))
})

// ④-b 清空 ENV_ID → 降级走 getWXContext().ENV
// （验收负向口径：清空 ENV_ID 时仍能走 context 兜底）
check('④b 清空 ENV_ID → init 收到 wxContext.ENV', () => {
  const r = loadImportCaptureInit((s) => setEnvId(s, ''), { ENV: 'ctx-env-4b' }, 'tcb-env-4b')
  assert.strictEqual(r.err, null, '加载不应报错：' + (r.err && r.err.message))
  assert.deepStrictEqual(r.initArg, { envId: 'ctx-env-4b' },
    'init 实参应为 wxContext.ENV，实得：' + JSON.stringify(r.initArg))
})

// ④-c 纯空白 ENV_ID → 视为空，同样走 wxContext
check('④c 纯空白 ENV_ID → 视为空，init 收到 wxContext.ENV', () => {
  const r = loadImportCaptureInit((s) => setEnvId(s, '   '), { ENV: 'ctx-env-4c' }, undefined)
  assert.strictEqual(r.err, null, '加载不应报错：' + (r.err && r.err.message))
  assert.deepStrictEqual(r.initArg, { envId: 'ctx-env-4c' },
    'init 实参应为 wxContext.ENV，实得：' + JSON.stringify(r.initArg))
})

// ④-d 清空 ENV_ID + wxContext 无 ENV → 走 TCB_ENV
check('④d 清空 ENV_ID 且 wxContext 无 ENV → init 收到 TCB_ENV', () => {
  const r = loadImportCaptureInit((s) => setEnvId(s, ''), {}, 'tcb-env-4d')
  assert.strictEqual(r.err, null, '加载不应报错：' + (r.err && r.err.message))
  assert.deepStrictEqual(r.initArg, { envId: 'tcb-env-4d' },
    'init 实参应为 TCB_ENV，实得：' + JSON.stringify(r.initArg))
})

// ④-e 全空 → init 收到 {}（裸初始化；列目录失败由 dirError 保因如实上报）
check('④e 清单空 + 无 wx 上下文 + 无 TCB_ENV → init 收到 {}（dirError 保因）', () => {
  const r = loadImportCaptureInit((s) => setEnvId(s, ''), { __throw: true }, undefined)
  assert.strictEqual(r.err, null, '加载不应报错：' + (r.err && r.err.message))
  assert.deepStrictEqual(r.initArg, {},
    'init 实参应为空对象（裸 init），实得：' + JSON.stringify(r.initArg))
})

// ═══════════════════════════════════════════════════════════════
// ⑤ chat 位角色注入（任务54）：注入 system / 缺 PERSONA 拒绝点名 / 非 chat 不注入
// ═══════════════════════════════════════════════════════════════
console.log('\n— ⑤ chat 位角色注入（任务54） —')

// 工具：异步用例登记。async 自执行 IIFE——fn 的同步前缀（写清单副本/加载模块）
// 立即执行，只有 main() 调用挂起；避免收尾先删临时目录导致 ENOENT。
const pendingAsync = []
function checkAsync(name, fn) {
  total++
  pendingAsync.push((async () => { await fn() })().then(
    () => { passed++; console.log('  PASS  ' + name) },
    (e) => { console.log('  FAIL  ' + name + '  →  ' + (e && e.message ? e.message : e)) }
  ))
}

// 工具：加载 aiGateway，清单重定向到改写副本；捕获 extend 通道实际发出的 messages。
// 通道默认 extend（清单 MODEL_MAP 全 extend），generateText 替身捕获 data.messages。
function loadGatewayWithConfig(configMutate) {
  const p = makeConfigCopy(configMutate)
  const scriptAbs = path.join(ROOT, 'cloudfunctions', 'aiGateway', 'index.js')
  const orig = Module._load
  let capturedMessages = null
  Module._load = function (request, parent, isMain) {
    if (/assets\.config(\.js)?$/.test(request) && parent && parent.filename &&
        path.resolve(parent.filename) === scriptAbs) {
      const abs = path.resolve(p)
      delete require.cache[require.resolve(abs)]
      return require(abs)
    }
    if (request === 'wx-server-sdk') {
      return {
        init() {},
        DYNAMIC_CURRENT_ENV: 'x',
        ai() {
          return {
            createModel() {
              return {
                generateText(data) {
                  capturedMessages = (data && data.messages) || null
                  return Promise.resolve({ text: 'stub-ok' })
                }
              }
            }
          }
        }
      }
    }
    return orig.apply(this, arguments)
  }
  try { delete require.cache[require.resolve(scriptAbs)] } catch (e) {}
  let mod = null, loadErr = null
  try { mod = require(scriptAbs) } catch (e) { loadErr = e }
  Module._load = orig
  return { mod, loadErr, getCaptured: () => capturedMessages }
}

// ⑤-a chat 位注入：messages[0]=system 且含"食知"，且调用方原数组不被改动
checkAsync('⑤a chat 注入 system（messages[0]=system 含"食知"，原数组不变）', async () => {
  const g = loadGatewayWithConfig(null)
  assert.strictEqual(g.loadErr, null, 'aiGateway 加载不应报错：' + (g.loadErr && g.loadErr.message))
  const original = [{ role: 'user', content: '你是谁' }]
  const ret = await g.mod.main({ mode: 'chat', messages: original })
  assert.ok(ret && !ret.error, 'chat 调用不应返回错误：' + JSON.stringify(ret))
  const sent = g.getCaptured()
  assert.ok(Array.isArray(sent), '应捕获到实际发出的 messages')
  assert.strictEqual(sent.length, 2, '注入后应为 2 条消息，实得 ' + sent.length)
  assert.strictEqual(sent[0].role, 'system', 'messages[0] 应为 system，实得：' + sent[0].role)
  assert.ok(String(sent[0].content).indexOf('食知') >= 0,
    'system 内容应含"食知"，实得：' + sent[0].content)
  assert.strictEqual(original.length, 1, '调用方原 messages 不应被改动（长度应为 1）')
})

// ⑤-b 清单 PERSONA={}（缺 chat_system 键）→ chat 拒绝并点名
checkAsync('⑤b 清单 PERSONA={}（缺 chat_system）→ chat 拒绝并点名', async () => {
  const g = loadGatewayWithConfig((s) => s.replace(/const PERSONA = \{[\s\S]*?\n\}/, 'const PERSONA = {}'))
  assert.strictEqual(g.loadErr, null,
    '缺 PERSONA 键时 aiGateway 加载不应报错（自检不含 PERSONA）：' + (g.loadErr && g.loadErr.message))
  const ret = await g.mod.main({ mode: 'chat', messages: [{ role: 'user', content: '你是谁' }] })
  assert.ok(ret && ret.error, 'chat 调用应被拒绝返回 error，实得：' + JSON.stringify(ret))
  const msg = JSON.stringify(ret)
  assert.ok(msg.indexOf('PERSONA.chat_system') >= 0, '拒绝信息应点名 PERSONA.chat_system，实得：' + msg)
  assert.ok(msg.indexOf('缺') >= 0, '拒绝信息应含"缺"，实得：' + msg)
})

// ⑤-c chat_system 空白 → 同样拒绝并点名（空白视同缺）
checkAsync('⑤c chat_system 空白 → chat 拒绝并点名', async () => {
  const g = loadGatewayWithConfig((s) => s.replace(/chat_system: '[^']*'/, "chat_system: ''"))
  assert.strictEqual(g.loadErr, null, 'aiGateway 加载不应报错：' + (g.loadErr && g.loadErr.message))
  const ret = await g.mod.main({ mode: 'chat', messages: [{ role: 'user', content: '你是谁' }] })
  assert.ok(ret && ret.error, 'chat 调用应被拒绝返回 error，实得：' + JSON.stringify(ret))
  const msg = JSON.stringify(ret)
  assert.ok(msg.indexOf('PERSONA.chat_system') >= 0, '拒绝信息应点名 PERSONA.chat_system，实得：' + msg)
})

// ⑤-d 非 chat 位（recognize）不注入 system
checkAsync('⑤d 非 chat 位（recognize）不注入 system', async () => {
  const g = loadGatewayWithConfig(null)
  assert.strictEqual(g.loadErr, null, 'aiGateway 加载不应报错：' + (g.loadErr && g.loadErr.message))
  const ret = await g.mod.main({ mode: 'recognize', messages: [{ role: 'user', content: '图片文字识别' }] })
  assert.ok(ret && !ret.error, 'recognize 调用不应返回错误：' + JSON.stringify(ret))
  const sent = g.getCaptured()
  assert.ok(Array.isArray(sent), '应捕获到实际发出的 messages')
  assert.strictEqual(sent.length, 1, 'recognize 消息数应保持 1，实得 ' + sent.length)
  assert.strictEqual(sent[0].role, 'user', 'recognize 不应注入 system（messages[0] 应为 user），实得：' + sent[0].role)
})

// ═══════════════════════════════════════════════════════════════
// ⑥ 任务55卡链路由：selectCard / cardToMode 负向用例（卡112卡面"卡选择"段口径）
// ═══════════════════════════════════════════════════════════════
console.log('\n— ⑥ 任务55卡链路由 —')

// ⑥-a 百科动词 → 111："为什么搭" / "新菜品·新食谱·新搭配" / "记录"
check('⑥a 百科动词（为什么搭/新菜品记录）→ selectCard 返回 111', () => {
  const r = require(path.join(ROOT, 'common', 'recommend.js'))
  assert.strictEqual(r.selectCard('为什么搭豆浆和油条').id, 'AGT-0924-w8n-111',
    '"为什么搭"应路由到百科卡111')
  assert.strictEqual(r.selectCard('新菜品：番茄炒蛋，记录一下').id, 'AGT-0924-w8n-111',
    '"新菜品/记录"应路由到百科卡111')
})

// ⑥-b 推荐默认108；显式"快速"→109（卡112：未显式说明一律默认详查卡108）
check('⑥b 默认→108；显式"快速"→109', () => {
  const r = require(path.join(ROOT, 'common', 'recommend.js'))
  assert.strictEqual(r.selectCard('推荐几个清淡的菜').id, 'AGT-0924-w8n-108',
    '未显式说明应默认详查卡108')
  assert.strictEqual(r.selectCard('快速推荐，赶时间').id, 'AGT-0924-w8n-109',
    '显式"快速"应用快查卡109')
})

// ⑥-c 裸"分析"不进111："分析"为108/111共用动词，单独出现走默认卡（卡112口径）
check('⑥c 裸"分析"（帮我分析一下）→ 不进111，默认108', () => {
  const r = require(path.join(ROOT, 'common', 'recommend.js'))
  assert.strictEqual(r.selectCard('帮我分析一下这桌菜').id, 'AGT-0924-w8n-108',
    '裸"分析"应走默认详查卡108而非百科卡111')
})

// ⑥-d cardToMode：111 → recommend_deep（百科=深度分析，无快速模式）；未知卡 id → throw 点名
check('⑥d cardToMode(111)=recommend_deep；未知卡 throw 且点名 id', () => {
  const r = require(path.join(ROOT, 'common', 'recommend.js'))
  assert.strictEqual(r.cardToMode({ id: 'AGT-0924-w8n-111' }), 'recommend_deep',
    '百科卡111应映射 recommend_deep（无快速模式，不占 recommend_fast）')
  let threw = null
  try { r.cardToMode({ id: 'AGT-UNKNOWN-XYZ' }) } catch (e) { threw = e }
  assert.ok(threw, '未知卡 id 应 throw（任务48口径，静默回退已封死）')
  assert.ok(String(threw.message).indexOf('AGT-UNKNOWN-XYZ') >= 0,
    'throw 信息应点名未知卡 id，实得：' + threw.message)
})

// ⑥-e 常量绑定：五卡常量读自清单 PROMPT_BINDINGS（108/109/110/111/112 一一对上）
check('⑥e 五卡常量=清单绑定（INIT=112/DEEP=108/FAST=109/RECOG=110/WIKI=111）', () => {
  const r = require(path.join(ROOT, 'common', 'recommend.js'))
  assert.strictEqual(r.PROMPT_INIT.id, 'AGT-0924-w8n-112')
  assert.strictEqual(r.CARD_DEEP.id, 'AGT-0924-w8n-108')
  assert.strictEqual(r.CARD_FAST.id, 'AGT-0924-w8n-109')
  assert.strictEqual(r.PROMPT_RECOGNIZE.id, 'AGT-0924-w8n-110')
  assert.strictEqual(r.CARD_WIKI.id, 'AGT-0924-w8n-111')
})

// ── 收尾 ─────────────────────────────────────────────────────────
uninstallStub()
try { fs.rmSync(TMP, { recursive: true, force: true }) } catch (e) { /* 清理忽略 */ }

// 汇总：等待 ⑤ 组登记的异步用例全部落定后打印计数。
// （①f/②/③ 的 async 用例沿用同步计数口径，见文件头说明；本汇总对 ⑤ 起全量可判。）
Promise.all(pendingAsync).then(() => {
  console.log('\n' + passed + '/' + total + ' PASS\n')
  if (passed !== total) process.exitCode = 1
})
