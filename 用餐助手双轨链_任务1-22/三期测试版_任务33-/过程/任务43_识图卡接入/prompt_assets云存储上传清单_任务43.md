# 任务43 prompt_assets 云存储上传清单

> 用途：将 4 张执行卡文件上传至云存储，供 `importRefTables` 云函数导入 `prompt_assets` 表。
> 上传后须**重跑 `importRefTables` 云函数**，卡方可在 `recommend.js` 中按版本号被读取。

## 上传清单（4 个文件）

| # | 文件名 | 云存储目标路径 | 对应 promptId |
|---|---|---|---|
| 1 | `识图任务执行卡-AGT-0924-w8n-096.md` | `prompt_assets/识图任务执行卡-AGT-0924-w8n-096.md` | `AGT-0924-w8n-096` |
| 2 | `详细推荐执行卡-AGT-0924-w8n-097.md` | `prompt_assets/详细推荐执行卡-AGT-0924-w8n-097.md` | `AGT-0924-w8n-097` |
| 3 | `快速推荐执行卡-AGT-0924-w8n-098.md` | `prompt_assets/快速推荐执行卡-AGT-0924-w8n-098.md` | `AGT-0924-w8n-098` |
| 4 | `饮食推荐agent初始化prompt-AGT-0924-w8n-099.md` | `prompt_assets/饮食推荐agent初始化prompt-AGT-0924-w8n-099.md` | `AGT-0924-w8n-099` |

## 操作步骤

1. 将上表 4 个 md 文件分别上传至云存储目录 **`prompt_assets`**，路径与文件名须与表格**逐字一致**（含中文与连字符）。
2. 上传完成后，**重跑 `importRefTables` 云函数**（可传 `event.promptDir = 'prompt_assets'` 覆盖默认目录）。
3. 核对云函数返回：`importedPrompts` 应含上述 4 条；`missingPrompts` 应为空。
4. 核对 `prompt_assets` 表：每个 `id` 仅一条 `active=true`，字段 `{ id, version, title, content, sourceFile, active, importedAt }` 齐全。

## 版本与覆盖说明

- `version` 由各 md 的 YAML frontmatter `id` 字段解析得到（如 `AGT-0924-w8n-096`）。
- 同一 `id` 多次导入时历史版本保留、仅最新一条 `active=true`（与 `ref_tables` 同模式）。

## 旧卡移除声明

- 旧卡 **`AGT-0924-w8n-079`（旧详细卡）/ `AGT-0924-w8n-080`（旧快速卡）/ `AGT-0924-w8n-081`（旧初始化prompt）** 已从导入清单移除，**不再导入**。
- 现有链尾为新卡 **096 / 097 / 098 / 099**；`recommend.js` 中旧卡号零残留，`prompt_assets` 中对应的旧卡如需下线，请另行将该 `id` 的全部版本置 `active=false`。

## 铁律

- 文件**取不到即如实报缺**（进 `missingPrompts`），**绝不写占位或编造内容**。
- 上传路径错误 / 文件名不符 → 导入器将判为缺失，请按上表逐字核对后重传。