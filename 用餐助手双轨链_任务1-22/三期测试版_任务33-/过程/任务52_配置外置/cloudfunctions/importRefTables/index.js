// 【新增】速查表 + prompt 资产导入脚本：从云存储 md 文件解析入 ref_tables / prompt_assets
// 依据：推荐系统结构设计v1.0 §U2；任务55卡链108-112（识图110/详细108/快速109/百科111/初始化112）；
//       卡链108-112"将查的表"集合（016/020/033/051/058-062/068 中已导入九项）
//
// 任务52配置外置：可配置项已移至 ./assets.config.js（清单部署副本，随本函数目录上传；母本 cloudfunctions/shared/assets.config.js）
//   EXPECTED_TABLES / EXPECTED_PROMPTS 改从清单读；清单加载自检不通过 → 报缺拒绝执行。
//
// 任务55匹配机制：按固定名称段（nameSeg）匹配文件，编号完全不参与；
//   同一名称段多文件命中 → 不猜，进 missing 并注明"多命中歧义"+命中文件列表。
//   （取代任务47数字段模糊匹配与任务50精确文件名优先两级逻辑。）
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
const ENV_ID = assetsConfig.ENV_ID

/**
 * envId 解析（任务53优先级裁决）：
 *   ① 清单 ENV_ID 非空 → 第一优先（云端实测存在 getWXContext().ENV 与 TCB_ENV
 *      均拿不到的环境，裸 manager.init({}) 报 [DescribeEnvInfo] EnvId is required）
 *   ② 微信云函数运行时上下文 getWXContext().ENV（任务47第二轮细化指令）
 *   ③ TCB_ENV 环境变量兜底
 *   ④ 全空 → undefined（CloudBase.init({}) 裸初始化；列目录失败时 dirError 如实保因）
 */
function resolveEnvId() {
  if (typeof ENV_ID === 'string' && ENV_ID.trim() !== '') return ENV_ID
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
 * 任务55：固定名称段匹配（编号完全不参与），取代任务47数字段模糊匹配与任务50精确文件名优先。
 * basename（去目录）包含 nameSeg 即候选命中；nameSeg 非空由清单自检保证
 * （checkConfig 已拦 nameSeg 缺失/空白，到不了这里）。
 */
function fileMatchesNameSeg(key, nameSeg) {
  const base = String(key).split('/').pop()
  return typeof nameSeg === 'string' && nameSeg.length > 0 && base.includes(nameSeg)
}

/**
 * 任务55：在 keys 中取 nameSeg 唯一命中。
 * 0 命中 → { hit: null, hits: [] }；1 命中 → { hit, hits }；
 * ≥2 命中 → { hit: null, hits, ambiguous: true }（不猜，由调用方报"多命中歧义"）。
 */
function resolveUniqueNameSegHit(keys, nameSeg) {
  const hits = keys.filter((k) => fileMatchesNameSeg(k, nameSeg)).sort()
  if (hits.length === 1) return { hit: hits[0], hits }
  return { hit: null, hits, ambiguous: hits.length > 1 }
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

// 【任务55退役说明】prompt 资产 basename === fileName 精确匹配已退役（编号/精确文件名均不再参与匹配），
// 旧 candidatePromptFileIDs 固定路径构造更早退役（相对路径不是合法 fileID，下载必然失败）。
// 现役匹配见 fileMatchesNameSeg。

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
  const providedPromptMap = event.promptFiles || null  // { 'AGT-0924-w8n-108': 'cloud://.../xxx.md', ... }（示例形状，编号不参与匹配）

  // ══════════════ 速查表导入（任务55：basename 含 nameSeg 命中，编号不参与）══════════════
  const imported = []
  const missing = []
  const ambiguousTables = []   // 任务55：多命中歧义登记（表）

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
      // 任务55：basename 含 nameSeg 判定命中（编号完全不参与）；
      // 唯一命中→下载；多命中→不猜，进 missing 并登记"多命中歧义"+命中文件列表
      const r = resolveUniqueNameSegHit(dirMdKeys, t.nameSeg)
      if (r.ambiguous) {
        ambiguousTables.push({ tableNo: t.tableNo, nameSeg: t.nameSeg, hits: r.hits })
        missing.push(t.tableNo)
        continue
      }
      if (r.hit) {
        const got = await downloadMdByKey(r.hit)
        if (got) { md = got; usedFile = r.hit }
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

  // ══════════════ prompt 资产导入（任务55：basename 含 nameSeg 命中，编号不参与）══════════════
  const importedPrompts = []
  const missingPrompts = []
  const ambiguousPrompts = []   // 任务55：多命中歧义登记（prompt 资产）

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
      // 任务55：basename 含 nameSeg 判定命中（编号完全不参与）；
      // 唯一命中→下载；多命中→不猜，进 missingPrompts 并登记"多命中歧义"+命中文件列表
      const r = resolveUniqueNameSegHit(promptMdKeys, p.nameSeg)
      if (r.ambiguous) {
        ambiguousPrompts.push({ promptId: p.promptId, nameSeg: p.nameSeg, hits: r.hits })
        missingPrompts.push(p.promptId)
        continue
      }
      if (r.hit) {
        const got = await downloadMdByKey(r.hit)
        if (got) { md = got; usedFile = r.hit }
      }
    }

    // —— 铁律：取不到 → 进 missing，绝不写占位/编造 ——
    if (!md) { missingPrompts.push(p.promptId); continue }

    const { meta, body } = parseFrontmatter(md)
    // 依规格：version 从 md 的 YAML frontmatter 的 id 字段提取（如 AGT-0924-w8n-108）
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

  // 返回口径：缺表/缺资产明确列出，供上层声明缺口（合法停摆）；多命中歧义单列，供人工消歧后重跑
  const gapNotes = []
  if (missing.length) gapNotes.push(`速查表：${missing.join('、')}`)
  if (missingPrompts.length) gapNotes.push(`prompt 资产：${missingPrompts.join('、')}`)
  if (ambiguousTables.length) {
    gapNotes.push('多命中歧义（表）：' + ambiguousTables.map((a) => `${a.tableNo}〈${a.nameSeg}〉→${a.hits.join('|')}`).join('；'))
  }
  if (ambiguousPrompts.length) {
    gapNotes.push('多命中歧义（prompt）：' + ambiguousPrompts.map((a) => `${a.promptId}〈${a.nameSeg}〉→${a.hits.join('|')}`).join('；'))
  }
  if (dirError) gapNotes.push(`列 ref_tables 目录失败：${dirError}`)
  if (promptDirError) gapNotes.push(`列 prompt_assets 目录失败：${promptDirError}`)

  return {
    ok: true,
    dirError,
    promptDirError,
    imported,
    missing,
    ambiguousTables,
    importedPrompts,
    missingPrompts,
    ambiguousPrompts,
    note: gapNotes.length
      ? `以下文件在云存储未找到 → ${gapNotes.join('；')}。已如实报缺，未编造内容；` +
        `请补传对应 md（多命中歧义请先清理同名段文件）后重跑本脚本。`
      : '全部速查表与 prompt 资产导入完成。'
  }
}
