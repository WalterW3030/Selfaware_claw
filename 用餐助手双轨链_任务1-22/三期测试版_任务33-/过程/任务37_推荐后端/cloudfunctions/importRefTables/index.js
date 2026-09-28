// 【新增】速查表导入脚本：从云存储 md 文件解析入 ref_tables
// 依据：推荐系统结构设计v1.0 §U2；初始化prompt081"将查的表"集合
//
// 铁律（对齐"表文件缺失时导入器如实报缺不编造"口径）：
//   - 只导入真实取到的云存储文件；取不到 → 进 missing，绝不写占位/编造内容
//   - 每个表号导入后，同表号仅保留一条 active=true（版本管理）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 081"将查的表"（默认表）+ 支持度/机制表（按需）
const EXPECTED_TABLES = [
  { tableNo: '016', title: '口味负荷速查表' },
  { tableNo: '020', title: '场景速查表' },
  { tableNo: '033', title: '稳定性判定' },
  { tableNo: '051', title: '辣度标注惯例' },
  { tableNo: '062', title: '通用维度底线' },
  { tableNo: '058', title: '支持度标注' },
  { tableNo: '068', title: '支持度标注' },
  { tableNo: '017', title: '机制原理' },
  { tableNo: '026', title: '机制原理' }
]

// 云存储约定目录（可经 event.dir 覆盖）
const DEFAULT_DIR = 'ref_tables'

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

/** 候选 fileID 列表：由调用方传入 / 或按约定目录+表号+扩展名猜测 */
function candidateFileIDs(tableNo, { dir, providedMap } = {}) {
  if (providedMap && providedMap[tableNo]) {
    return Array.isArray(providedMap[tableNo]) ? providedMap[tableNo] : [providedMap[tableNo]]
  }
  const base = `${dir || DEFAULT_DIR}`
  return [`${base}/${tableNo}.md`, `${base}/${tableNo}_*.md`]
}

/** 版本化写入：同表号历史保留、仅最新一条 active=true */
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

exports.main = async (event = {}) => {
  const dir = event.dir || DEFAULT_DIR
  const providedMap = event.files || null   // { '016': 'cloud://.../016.md', ... }

  const imported = []
  const missing = []

  for (const t of EXPECTED_TABLES) {
    const ids = candidateFileIDs(t.tableNo, { dir, providedMap })

    let md = null
    let usedFile = null
    for (const id of ids) {
      if (id.includes('*')) continue        // 通配需文件列表 API，wx-server-sdk 无 → 跳过
      const got = await downloadMd(id)
      if (got) { md = got; usedFile = id; break }
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

  // 返回口径：缺表明确列出，供上层声明缺口（合法停摆）
  return {
    ok: true,
    imported,
    missing,
    note: missing.length
      ? `以下速查表在云存储未找到：${missing.join('、')}。已如实报缺，未编造内容；` +
        `请补传对应 md 后重跑本脚本。`
      : '全部速查表导入完成。'
  }
}
