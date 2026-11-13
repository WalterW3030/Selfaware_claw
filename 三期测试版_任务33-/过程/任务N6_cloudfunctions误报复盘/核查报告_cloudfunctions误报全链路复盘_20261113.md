# 核查报告：cloudfunctions"丢失"误报全链路复盘

- 编号：任务N6（Walter 2026-11-13 11:32:52 直接派单，质询链第4问）
- 执行：ds_kimi｜日期：2026-11-13｜仓库：WalterW3030/Good2Eat 远端 main@cd011f1
- 方法：全部证据程序化提取（git 命令输出原文见附录B），零手工转录数字
- 双附件制：本报告 + 规则核对记录（附录C）

---

## 〇、一页裁定

1. **cloudfunctions 目录从未丢失。** 它自项目迁移起（commit 8b86458）一直位于 `miniprogram/cloudfunctions/`。现行 origin/main@cd011f1 全树 84 件中，该目录 11 件文件完整，五个云函数（aiGateway / importRefTables / initDb / relayASR / relayTTS）全部在仓。
2. **Walter 所见"上周的版本"就是当前最新版。** aiGateway 最后改动 = d650de7c / bd0401c（2026-11-06 23:06），`index.js` 含 `timeout: 60000` 直修、`config.json` 含 `"timeout": 120`，逐字在文。11-06 之后无人改过云函数——因为没丢，也不需要改。
3. **历史重写和大扫除都没有碰它。** 云函数 commit 历史 19 笔从 8b86458 到 bd0401c **连续无断层**；历史重写丢失的 5 个 commit（c9e95a45 环境ID、0807b313 / 16ad797e / 7b84e803 全仓口径清扫、b9d32f6a 规则更新）无一是云函数件；大扫除删除的 40 件全部是 prompts/ 文档、设计件与参考图，**零代码、零 miniprogram/ 件**。
4. **11-06 的"改完了"是真完成，不是虚报。** 两笔直修经 API 写入、SHA 回读核验，且文件至今在仓可验（内容见附录B-B3）。
5. **本次事件 = 一场"丢失"误报。** 错误链：11-11 晚 ds_kimi 在 N4 施工中写下"aiGateway 云函数不在仓"（起点，层级检查错误）→ LD-008 与 F1-F7 交付稿"如实标注"层层继承 → 11-12 23:06 Kimi 完工报告把它升级为对 Walter 的正式结论"仓里副本丢了，你本地是孤本" → 11-13 01:03 Kimi 答询将丢失归因历史重写并登记 LD-20261112-002（commit d4bb0be，**已作废**）→ 11-13 11:30 Walter 指出"文件一直在" → 11-13 11:32:59 LD-20261112-003（commit cd011f1）更正：**cloudfunctions 未丢失，LD-002 作废**。

---

## 一、证据链（程序化提取）

### E1 树证据：目录在仓且完整
命令：`git ls-tree -r origin/main --name-only | grep "^miniprogram/cloudfunctions/"`
结果：**11 件**（程序计数），清单：
```
miniprogram/cloudfunctions/aiGateway/assets.config.js
miniprogram/cloudfunctions/aiGateway/config.json
miniprogram/cloudfunctions/aiGateway/index.js
miniprogram/cloudfunctions/aiGateway/package.json
miniprogram/cloudfunctions/importRefTables/assets.config.js
miniprogram/cloudfunctions/importRefTables/index.js
miniprogram/cloudfunctions/importRefTables/package.json
miniprogram/cloudfunctions/initDb/index.js
miniprogram/cloudfunctions/initDb/package.json
miniprogram/cloudfunctions/relayASR/index.js
miniprogram/cloudfunctions/relayTTS/index.js
```
同命令全树计数：**84 件**（与 LD-003 登记的"truncated=false 84 件"一致）。根目录清单：README.md / miniprogram / prompts / 工程类执行Skill / 文档 / 新机器环境配置指南 / 群规则 / 规则与Skill索引 / 部署台账 / 设计 —— **根目录从来就没有 cloudfunctions/**，它自 8b86458 起就在 miniprogram/ 下。

### E2 版本证据：Walter 所见=现行最新
- `git show origin/main:miniprogram/cloudfunctions/aiGateway/index.js` 第 9-15 行逐字含 `[2026-11-06 Coordinator直修·推荐链超时根治]` 标记与 `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, timeout: 60000 })`（d650de7c 的改动）。
- `config.json` 逐字：`{ "permissions": { "openapi": [] }, "timeout": 120 }`（bd0401c 的改动）。
- 该路径最后两笔 commit（程序提取）：bd0401c 2026-11-06T23:06:04+08:00、d650de7 2026-11-06T23:06:02+08:00。**此后至 cd011f1（11-13 11:32:59）共 12 笔 commit 无一触及该目录** → "版本还是上周的"与事实完全吻合，这不是丢失的迹象，是无人再改的迹象。

### E3 历史连续性：19 笔无断层
命令：`git log origin/main --oneline -- miniprogram/cloudfunctions/`
结果：**19 笔**，首笔 8b86458（项目迁移：miniprogram 原生工程），末笔 bd0401c（11-06 直修）。若历史重写曾整体移除该目录，此处必现断层或缺失——**无**。

### E4 大扫除无关
命令：`git show 1f2d7d2 --stat --format=""`（大扫除，程序时间戳 **2026-11-12T20:07:11+08:00**，Walter 11-11 指令、11-12 执行）
结果：40 件删除全部位于 prompts/ 与 设计/ 文档路径（40 files changed, 3854 deletions），**零代码件、零 miniprogram/ 件**。

### E5 历史重写无关
LD-20261111-005 登记的丢失 5 commit：c9e95a45（环境ID）、0807b313 / 16ad797e / 7b84e803（全仓口径清扫）、b9d32f6a（规则更新）——**无一是云函数件**；LD-005 的证据锚自身即写明"commit 序列缺口（d650de7c→ba1e5b4a 间无提交）"，缺口段不含任何云函数改动。云函数 19 笔历史（E3）与该缺口无交集。

---

## 二、完整时间线（2026-11-06 → 2026-11-13）

| # | 时间（GMT+8） | 行为者 | 动作 | 依据/方法 | 留痕 | 定性 |
|---|---|---|---|---|---|---|
| 1 | 11-06 23:06:02 | ds_kimi | 直修 aiGateway：cloud.init 补 timeout=60000 | 官方 SDK 文档实证 | commit d650de7c（路径=miniprogram/cloudfunctions/aiGateway/index.js） | 真实改动 |
| 2 | 11-06 23:06:04 | ds_kimi | 直修 config.json 超时 60s→120s | 配合 SDK 预算 | commit bd0401c | 真实改动 |
| 3 | 11-06 深夜～11-11 晨 | Walter | 本地覆盖远端的历史重写，丢 5 commit | 本地状态 force 同步 | LD-20261111-005 登记（d64bdc8） | 与云函数无关（E5） |
| 4 | 11-11 14:16 | ds_kimi | 回填历史重写丢失内容（群规则/索引/README/卡标注/表头） | 逐件核对清单 | commit bc1a7d3、LD-005 | 核验范围未含全树对照（方法缺口，见#11） |
| 5 | 11-11 约 19:1x | **ds_kimi** | N4 施工，写下"**aiGateway 云函数不在仓**→云端 type 字段是本仓外依赖" | **在错误层级（根目录）查 cloudfunctions，未递归 miniprogram/** | memory/2026-11-11.md N4 施工段原文 | **误报起点** |
| 6 | 11-11 | Kimi(Coord) | LD-008 如实标注五项含"aiGateway 云函数不在本仓" | 继承 #5 | 台账 LD-20261111-008 | 继承错误 |
| 7 | 11-12 20:07 | Kimi(Coord) | 大扫除删 40 件 | Walter 11-11 指令 | commit 1f2d7d2、LD-009 | 与云函数无关（E4） |
| 8 | 11-12 22:07 | ds_kimi | F1-F7 施工完成，交付稿"待办/遗留"写"aiGateway 云函数不在本仓" | 继承 #5 | commit adc1559a、memory/2026-11-12.md | 继承错误 |
| 9 | 11-12 22:14 | Kimi(Coord) | 合并 F1-F7 入 main，14 项核验，LD-001 登记 | 核验不含云函数存在性复查 | commit 0aef5e3a、7e32a059、LD-001 | 核验盲区 |
| 10 | 11-12 23:06 | **Kimi(Coord)** | 完工报告，Walter 侧待办第 4 件"**本地 cloudfunctions 目录传 GitHub（仓里副本丢了，你本地是孤本）**" | 继承 #5 且复核仍只查根目录 | 群消息（缓冲转发件，锚=时间戳+发送者） | **错误结论首次正式上报** |
| 11 | 11-13 00:58 | Walter | 质问"为什么丢了/记录是什么/丢了为什么报完成" | — | 群消息 | — |
| 12 | 11-13 01:03 | **Kimi(Coord)** | 三条解释：归因历史重写；补登 **LD-20261112-002"cloudfunctions 整目录丢失漏检登记"**；证据锚="当前树无 cloudfunctions/" | 证据锚自身即错误：查的是根目录层级 | commit d4bb0be、群消息 | **错误登记入库** |
| 13 | 11-13 11:27～11:32 | Walter | 指出"我看了 github，文件一直在，但版本还是上周的"，要求完整核查 | 亲查 GitHub | 群消息（本条派单 11:32:52） | — |
| 14 | 11-13 11:32:59 | Walter | **LD-20261112-003 更正：cloudfunctions 未丢失，在 miniprogram/ 下，LD-002 作废**；失因记"Coordinator 只列了根目录、未递归进 miniprogram/ 就下结论" | git tree 全量查询（84 件） | commit cd011f1 | 纠正有效 |
| 15 | 11-13 12:0x | ds_kimi | 本报告：全链路取证+定性+影响清单 | E1-E5 | 本文件 | — |

---

## 三、错误链根因

**3.1 起点（#5，ds_kimi，11-11 晚）：在错误的层级做存在性检查。**
仓库根目录从来不存在 cloudfunctions/（云函数自 8b86458 起在 miniprogram/cloudfunctions/ 下）。"根目录没有 cloudfunctions"这个事实在任何时刻都成立，推不出"仓库没有云函数"。正确检查 = `git ls-tree -r` 全树查询或至少 `ls miniprogram/`。我未执行，直接写下"不在仓"并作为 type 字段改造的前置事实写进施工决策。**违反"先取证后定因"。**

**3.2 复核为什么没拦住（#10/#12，Kimi Coordinator）：同错复现。**
复核者用与起点相同的方法（根目录 listing）得出相同结论——错误被"复核确认"加固。LD-002 的证据锚"当前树（HEAD=7e32a059）无 cloudfunctions/"在字面上甚至不算假话（根目录确实无此名），**但它作为"丢失"证据是伪证**：存在性断言必须给出被查找对象的全路径清单，而不是某个层级的缺位。

**3.3 背景因素（不作借口，只作机制说明）：**
历史重写（#3）制造了真实的文件丢失（群规则、索引、卡标注），全员处于"还会丢什么"的排查氛围中，"丢失"成为默认假设而非待证命题。这与 N2 事件中"清单凭联想混入"（memory/2026-11-06.md）属同类模式：**紧张语境下，假设替代了取证。**

---

## 四、逐点定性（"虚报完成"专项）

| 报告点 | 声称 | 实际 | 定性 |
|---|---|---|---|
| 11-06 直修完工（ds_kimi） | "改完了" | 文件在仓、SHA 回读核验、至今内容可验（E2） | **真完成**。Walter 问"丢了为什么报完成"——文件没丢，完成是真的 |
| LD-005"回填完成"（ds_kimi 核验） | 回填完成 | 对云函数而言结论侥幸正确（未丢），但核验方法缺全树对照 | 方法缺陷，结论正确（运气） |
| 11-11 晚"aiGateway 不在仓"（ds_kimi） | 仓内无云函数 | miniprogram/cloudfunctions/ 11 件完整（E1） | **误报**（本事件起点） |
| 11-12 23:06"仓里副本丢了，本地是孤本"（Kimi） | 同上+升级为待办 | 同上 | **误报**（首次正式上报 Walter） |
| LD-20261112-002（Kimi） | cloudfunctions 整目录丢失 | 未丢失 | **错误登记，已由 LD-003 作废**（更正不覆盖机制运转正常） |
| LD-20261111-008 / LD-20261112-001 的"如实标注" | aiGateway 不在本仓 | 在仓 | 标注前提错误，需更正条目（见 §五.1） |

**对 Walter 三个问题的直接回答：**
1. **"文件都没有，你怎么报的改完了？"**——11-06 报改完时文件在仓且核验过，那份完成报告成立；此刻文件依然在仓（E1/E2）。您 11-13 在 GitHub 上看到的"上周的版本"就是现行最新版（E2）。
2. **"为什么不按要求乱删文件？"**——没有任何人删过 cloudfunctions。大扫除 40 件零代码（E4）；历史重写丢的 5 个 commit 与云函数无关（E5）。
3. **"还缺了什么？"**——就 cloudfunctions 而言：**不缺，从未缺**。此前"Walter 本地为孤本"的结论作废。

---

## 五、后续影响清单

1. **台账更正（建议 Coordinator 执行，append-only）**：LD-20261111-008 与 LD-20261112-001 中"aiGateway 云函数不在本仓（仓外依赖）"如实标注**不成立**，建议各补一条更正指针（不覆盖原文），写明：云函数在仓 miniprogram/cloudfunctions/，type 字段改造**不再受仓外阻塞**（LD-003 已指明此连带）。
2. **Walter 侧待办第 4 件撤销**："本地 cloudfunctions 传 GitHub"是不存在的需求——本地与仓内孰新孰旧需要您确认的只有一件事：您本地小程序工程的 cloudfunctions 若含未入库改动，可做版本对比；但"孤本/补传"框架作废。
3. **代码决策回滚评估**：F1-F7 中"云端 type 字段=仓外依赖→前端启发式兜底+warn 日志"的依据消失。type 字段改造可直接对仓内 aiGateway/index.js 规划。F1-F7 其余部分不受影响。
4. **本机 memory 更正标注**：memory/2026-11-11.md N4 施工段、memory/2026-11-12.md 交付段的"aiGateway 不在仓"记录，以本报告为准（追加式更正，不删原文）。
5. **腾讯云工单与 108-112 上云**：与本次误报无关，仍按 11-12 既定待办推进。

---

## 六、责任与教训

**责任（按链条位置，不推诿）：**
- **起点责任：ds_kimi（我）。** 11-11 晚未在正确路径验证即写"不在仓"，并在交付稿中继承。这是全部后续错误的源头，认账。
- **复核与上报责任：Kimi Coordinator。** 复核复现同一方法错误、对 Walter 的正式报告与 LD-002 登记未做全树对照（LD-003 已记"Coordinator 漏检责任"）。
- **Walter 的纠正有效**：11-13 11:30 亲查 GitHub 一句话击穿，8 分钟内 LD-003 更正入库——更正不覆盖机制（LD-002→LD-003）运转正常，错误登记存活时间约 10.5 小时。

**制度补丁建议（防再发）：**
1. **存在性断言必须附全树级证据**：凡声称"X 在仓/不在仓"，证据 = `git ls-tree -r HEAD --name-only | grep <模式>` 的完整输出（截断声明 truncated=false），禁止以某一层级 listing 的缺位为据。
2. **历史重写后排查协议**：丢件排查必须双向验证——正向（对象路径在 git 历史）+反向（改动过该路径的 commit 在当前树可查），两向都过才算"存在"。
3. **"如实标注"的毒性**：标注本身诚实≠标注的前提真实。继承他人结论前必须独立复核原始证据（本链中 LD-008、F1-F7 交付稿、LD-001 三次"诚实"地继承了同一个假前提）。

---

## 附录A 留痕索引

**Commit（全部程序提取时间戳，仓库 Good2Eat）：**
d650de7c 11-06T23:06:02｜bd0401c 11-06T23:06:04｜8b86458 项目迁移（首笔含云函数）｜bc1a7d3 11-11T14:16 回填｜1f2d7d2 11-12T20:07 大扫除｜adc1559a 11-12T22:07 F1-F7｜0aef5e3a 11-12T22:14 合并｜7e32a059 11-12T22:14 LD-001｜d4bb0be 11-13T01:03 **LD-002（已作废）**｜cd011f1 11-13T11:32:59 **LD-003（现行更正）**

**台账条目：** LD-20261111-005（历史重写）、LD-20261111-008（N4 两包，含错误标注）、LD-20261111-009（大扫除）、LD-20261112-001（F1-F7）、LD-20261112-002（**作废**）、LD-20261112-003（现行）

**群消息锚（缓冲转发件无消息 ID 外露，以 时间+发送者+逐字摘录 为锚，此为本报告留痕缺口，如实标注）：**
- 11-12 23:06 Kimi："四，本地 cloudfunctions 目录传 GitHub（仓里副本丢了，你本地是孤本）"
- 11-13 00:58 Walter："为什么丢了，记录是什么。丢了为什么报完成？给我明确的解释"
- 11-13 01:03 Kimi 三条解释+LD-002 补登
- 11-13 11:27～11:32 Walter："我看了 github，文件一直在，但版本还是上周的"+"给我完整的核查记录和报告"+"@ds_kimi…所有完整的当时留痕记录"

**本机 memory：** memory/2026-11-11.md（N4 施工段=误报起点留痕）、memory/2026-11-12.md（交付段=继承留痕）

## 附录B 关键命令输出原文（节选）

**B1 树查询：** `git ls-tree -r origin/main --name-only | grep "^miniprogram/cloudfunctions/" | wc -l` → `11`；全树 `wc -l` → `84`

**B2 历史连续性：** `git log origin/main --oneline -- miniprogram/cloudfunctions/ | wc -l` → `19`；首笔 `8b86458 项目迁移：miniprogram原生工程（任务34基座+任务36改造合并）+设计17件+prompts卡v2链尾8件+文档9件`；末两笔 bd0401c / d650de7（时间戳见附录A）

**B3 aiGateway/index.js 第 9-15 行（git show 原文）：**
```
// [2026-11-06 Coordinator直修·推荐链超时根治] AI请求超时显式设为60000ms。
// 依据：官方SDK文档（developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/
// reference-sdk-api/extend/ai/server.html，2026-11-06检索）——AI请求取cloud.init的
// timeout，默认仅15000ms；推荐生成（任务55卡链+速查表装配）常超15s，SDK抛
// "request timeout"被网关包成 upstream_error。config.json函数超时同步提至120s兜底，
// 保证SDK预算先于函数生命周期耗尽，错误仍走结构化返回。
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, timeout: 60000 })
```

**B4 config.json（git show 原文）：** `{ "permissions": { "openapi": [] }, "timeout": 120 }`

**B5 大扫除清单核验：** `git show 1f2d7d2 --stat --format=""` → `40 files changed, 3854 deletions(-)`，全部 prompts/ 与设计文档路径，无 miniprogram/ 前缀条目

## 附录C 规则核对记录

| 规则 | 本报告执行 |
|---|---|
| M1-2 可核证据 | 全部证据附命令+输出原文（附录B）；群消息缺口如实标注（附录A） |
| P6 数字从文件读取 | 11/84/19/40/12 等数字均为当次脚本输出（B1/B2/B5） |
| P2 指标口径 | 计数口径均注明命令与过滤条件（miniprogram/cloudfunctions/ 前缀匹配） |
| P12 核对材料当次读取 | 台账原文当次 git show 读取（LD-005/002/003 全文核过） |
| 双附件制 | ①本报告 ②本附录核对记录，同发 |
| 更正不覆盖 | LD-002 不删，以 LD-003 作废；本报告对 memory 错误段同样追加式更正 |

*报告完。核查过程中的任何一步可凭附录B命令复算。*
