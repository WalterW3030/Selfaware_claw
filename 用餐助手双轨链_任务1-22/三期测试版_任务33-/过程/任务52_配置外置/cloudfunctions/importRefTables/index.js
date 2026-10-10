// 【新增】速查表 + prompt 资产导入脚本：从云存储 md 文件解析入 ref_tables / prompt_assets
// 依据：推荐系统结构设计v1.0 §U2；初始化prompt099"将查的表"集合；
//       识图卡096 / 详细卡097 / 快速卡098 / 初始化prompt099（prompt_assets 资产）
//
// 任务52配置外置：可配置项已移至 ./assets.config.js（清单部署副本，随本函数目录上传；母本 cloudfunctions/shared/assets.config.js）
//   EXPECTED_TABLES / EXPECTED_PROMPTS 改从清单读；清单加载自检不通过 → 报缺拒绝执行。
//
// 铁律（对齐"表/资产文件缺失时导入器如实报缺不编造"口径）：
//   - 只导入真实取到的云存储文件；取不到 → 进 missing，绝不写占位/编造内容
//   - 每个表号/资产 id 导入后，仅保留一条 active=true（版本管理）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 任务47：manager-node 列目录（云函数内自动读取环境临时凭证，免鉴权）
const CloudBase = require('@cloudbase/manager-node')
const fs = require('fs')
const os = require('os')
const path = require('path')

// ── 清单加载（任务52：可配置项外置）────────────────────────────────
const assetsConfig = require('./assets.config.js')
const EXPECTED_TABLES = assetsConfig.EXPECTED_TABLES
const EXPECTED_PROMPTS = assetsConfig.EXPECTED_PROMPTS
const DEFAULT_DIR = assetsConfig.DEFAULT_DIR
const DEFAULT_PROMPT_DIR = assetsConfig.DEFAULT_PROMPT_DIR

/** envId 解析：优先微信云函数运行时上下文 ENV，兜底 TCB_ENV（任务47第二轮细化指令） */
function resolveEnvId() {
  try {
    const ctx = cloud.getWXContext()
    if (ctx && ctx.ENV) return ctx.ENV
  } catch (e) { /* 非云函数运行时（如本地）无 wx 上下文 */ }
  return process.env.TCB_ENV || undefined
}
const manager = CloudBase.init(resolveEnvId() ? { envId: resolveEnvId() } : {})

// ── 解析 md：YAML frontmatter + 正文 ─────────────────────────────
function parseFrontmatter(md) {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(String(md || ''))
  if (!m) return { meta: {}, body: String(md || '') }
  const meta = {}
  m[1].split('\n').forEach((line) => {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  })
  return { meta, body: m[2] }
}

/** 下载单个云存储文件 → md 文本；失败返回 null（不编造） */
async function downloadMd(fileID) {
  try {
    const res = await cloud.downloadFile({ fileID })
    if (!res || !res.fileContent) return null
    return res.fileContent.toString('utf8')
  } catch (e) {
    return null
  }
}

// ── 任务47：目录列取 + 文件名模糊匹配（取代固定候选 fileID 逐个试）──────────

/** 列 dir 下所有 .md 文件的对象 Key（manager-node listCurrentDirectory，非递归） */
async function listDirMdFiles(dir) {
  const { files } = await manager.storage.listCurrentDirectory(dir)
  return (files || [])
    .map((f) => f && f.Key)
    .filter((k) => typeof k === 'string' && k.toLowerCase().endsWith('.md'))
}

/**
 * 文件名含表号即命中，但按非数字边界精确切分：
 * basename 中每个连续数字段必须完整等于表号（"016" 命中 "016口味负荷速查表.md"，不命中 "0160xx.md"）
 */
function fileMatchesTableNo(key, tableNo) {
  const base = String(key).split('/').pop()
  const digitRuns = base.match(/\d+/g) || []
  return digitRuns.includes(tableNo)
}

/** 按对象 Key 下载 md 文本（downloadFile → /tmp 临时文件）；取不到返回 null（绝不编造） */
async function downloadMdByKey(key) {
  const tmp = path.join(os.tmpdir(), `importRef_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.md`)
  try {
    await manager.storage.downloadFile({ cloudPath: key, localPath: tmp })
    if (!fs.existsSync(tmp)) return null
    const content = fs.readFileSync(tmp, 'utf8')
    return content || null
  } catch (e) {
    return null
  } finally {
    try { fs.unlinkSync(tmp) } catch (e) { /* 清理失败忽略 */ }
  }
}

/**
 * 任务47第二轮：prompt 资产文件名精确匹配（basename === EXPECTED_PROMPTS.fileName）
 * 旧 candidatePromptFileIDs 固定路径构造已退役（相对路径不是合法 fileID，下载必然失败）
 */
function promptFileMatches(key, fileName) {
  return String(key).split('/').pop() === fileName
}

/** 版本化写入（速查表）：同表号历史保留、仅最新一条 active=true */
async function upsertTable(rec) {
  // 先全部置非生效
  await db.collection('ref_tables').where({ tableNo: rec.tableNo }).update({
    data: { active: false }
  })
  // 再按 tableNo+version upsert
  const exist = await db.collection('ref_tables')
    .where({ tableNo: rec.tableNo, version: rec.version }).limit(1).get()
  if (exist.data && exist.data.length) {
    await db.collection('ref_tables').doc(exist.data[0]._id).update({ data: { ...rec, active: true } })
  } else {
    await db.collection('ref_tables').add({ data: { ...rec, active: true } })
  }
}

/**
 * 版本化写入（prompt 资产）：同 id 历史保留、仅最新一条 active=true
 * 表结构：{ id, version, title, content, sourceFile, active, importedAt }
 * 与 ref_tables 同一版本化模式（先全置非生效，再按 id+version upsert）。
 */
async function upsertPrompt(rec) {
  // 先全部置非生效
  await db.collection('prompt_assets').where({ id: rec.id }).update({
    data: { active: false }
  })
  // 再按 id+version upsert
  const exist = await db.collection('prompt_assets')
    .where({ id: rec.id, version: rec.version }).limit(1).get()
  if (exist.data && exist.data.length) {
    await db.collection('prompt_assets').doc(exist.data[0]._id).update({ data: { ...rec, active: true } })
  } else {
    await db.collection('prompt_assets').add({ data: { ...rec, active: true } })
  }
}

exports.main = async (event = {}) => {
  // 任务52：清单加载自检不通过 → 报缺拒绝执行，列出全部缺项，绝不猜默认值
  const _cfgCheck = assetsConfig.checkConfig()
  if (!_cfgCheck.ok) {
    return {
      ok: false,
      error: 'assets_config_check_failed',
      note: 'assets.config.js 清单自检不通过，拒绝执行；缺项：' + _cfgCheck.missing.join('、')
    }
  }

  const dir = event.dir || DEFAULT_DIR
  const promptDir = event.promptDir || DEFAULT_PROMPT_DIR
  const providedMap = event.files || null              // { '016': 'cloud://.../016.md', ... }
  const providedPromptMap = event.promptFiles || null  // { 'AGT-0924-w8n-096': 'cloud://.../xxx.md', ... }

  // ══════════════ 速查表导入（任务47：先列目录再按文件名匹配）══════════════
  const imported = []
  const missing = []

  // 任务47：一次性列出 ref_tables / prompt_assets 下所有 .md；列目录失败保因、不回落旧固定候选路径
  let dirError = null
  let dirMdKeys = []
  try {
    dirMdKeys = await listDirMdFiles(dir)
  } catch (e) {
    dirError = (e && e.message) ? e.message : String(e)
  }
  let promptDirError = null
  let promptMdKeys = []
  try {
    promptMdKeys = await listDirMdFiles(promptDir)
  } catch (e) {
    promptDirError = (e && e.message) ? e.message : String(e)
  }

  for (const t of EXPECTED_TABLES) {
    let md = null
    let usedFile = null

    if (providedMap && providedMap[t.tableNo]) {
      // 调用方显式传入 fileID：直接按 fileID 下载（兼容路径，不变）
      const ids = Array.isArray(providedMap[t.tableNo]) ? providedMap[t.tableNo] : [providedMap[t.tableNo]]
      for (const id of ids) {
        if (typeof id !== 'string' || id.includes('*')) continue
        const got = await downloadMd(id)
        if (got) { md = got; usedFile = id; break }
      }
    } else if (!dirError) {
      // 任务50：显式 fileName 精确匹配优先（R系列文件名不含表号，数字段模糊匹配认不出）；
      // fileName 无命中 → 数字段模糊匹配兜底（任务47逻辑不变）
      let hit = null
      if (t.fileName) {
        hit = dirMdKeys
          .filter((k) => String(k).split('/').pop() === t.fileName)
          .sort()[0]
      }
      if (!hit) {
        hit = dirMdKeys
          .filter((k) => fileMatchesTableNo(k, t.tableNo))
          .sort()[0]
      }
      if (hit) {
        const got = await downloadMdByKey(hit)
        if (got) { md = got; usedFile = hit }
      }
    }

    // —— 铁律：取不到 → 如实报缺，绝不写占位 ——
    if (!md) { missing.push(t.tableNo); continue }

    const { meta, body } = parseFrontmatter(md)
    const version = meta.version || meta.版本 || 'v1'

    await upsertTable({
      tableNo:    t.tableNo,
      version,
      title:      meta.title || meta.表名 || t.title,
      content:    body.trim(),
      sourceFile: usedFile,
      importedAt: Date.now()
    })
    imported.push({ tableNo: t.tableNo, version, from: usedFile })
  }

  // ══════════════ prompt 资产导入（任务47第二轮：列目录 + fileName 精确匹配）══════════════
  const importedPrompts = []
  const missingPrompts = []

  for (const p of EXPECTED_PROMPTS) {
    let md = null
    let usedFile = null

    if (providedPromptMap && providedPromptMap[p.promptId]) {
      // 调用方显式传入 fileID：直接按 fileID 下载（覆盖通道，保留）
      const ids = Array.isArray(providedPromptMap[p.promptId]) ? providedPromptMap[p.promptId] : [providedPromptMap[p.promptId]]
      for (const id of ids) {
        if (typeof id !== 'string' || id.includes('*')) continue
        const got = await downloadMd(id)
        if (got) { md = got; usedFile = id; break }
      }
    } else if (!promptDirError) {
      // 任务47第二轮：basename === fileName 精确匹配，多张命中取字典序第一张
      const hit = promptMdKeys
        .filter((k) => promptFileMatches(k, p.fileName))
        .sort()[0]
      if (hit) {
        const got = await downloadMdByKey(hit)
        if (got) { md = got; usedFile = hit }
      }
    }

    // —— 铁律：取不到 → 进 missing，绝不写占位/编造 ——
    if (!md) { missingPrompts.push(p.promptId); continue }

    const { meta, body } = parseFrontmatter(md)
    // 依规格：version 从 md 的 YAML frontmatter 的 id 字段提取（如 AGT-0924-w8n-096）
    const version = meta.id || p.promptId

    await upsertPrompt({
      id:         p.promptId,                // id = promptId
      version,                               // version = frontmatter.id
      title:      meta.title || p.title,
      content:    body.trim(),
      sourceFile: usedFile,
      importedAt: Date.now()
    })
    importedPrompts.push({ id: p.promptId, version, from: usedFile })
  }

  // 返回口径：缺表/缺资产明确列出，供上层声明缺口（合法停摆）
  const gapNotes = []
  if (missing.length) gapNotes.push(`速查表：${missing.join('、')}`)
  if (missingPrompts.length) gapNotes.push(`prompt 资产：${missingPrompts.join('、')}`)
  if (dirError) gapNotes.push(`列 ref_tables 目录失败：${dirError}`)
  if (promptDirError) gapNotes.push(`列 prompt_assets 目录失败：${promptDirError}`)

  return {
    ok: true,
    dirError,
    promptDirError,
    imported,
    missing,
    importedPrompts,
    missingPrompts,
    note: gapNotes.length
      ? `以下文件在云存储未找到 → ${gapNotes.join('；')}。已如实报缺，未编造内容；` +
        `请补传对应 md 后重跑本脚本。`
      : '全部速查表与 prompt 资产导入完成。'
  }
}
