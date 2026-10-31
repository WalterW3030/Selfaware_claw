# 黑板体系 · 最终部署清单（2026-11-01，v17 路由版）

## 一、部署必需（按角色）

### agent 执行层（仓库）
| 文件 | 用哪一版 | 说明 |
|---|---|---|
| protocol.md | protocol_v12_research / commercial / universal 选一（v12.0 协议砍半，1.9 索引化） | 部署时改名 protocol.md，按场景选版 |
| router.md | 当前版（v15 判别与指向） | 已原地更新；生效副本在项目指令 |
| /cards/task_card_A_v4.md | 当前版 | |
| /cards/task_card_B_v4.md | 当前版 | |
| /cards/task_card_C_v4.md | 当前版 | |
| /cards/task_card_D_v4.md | 当前版 | |
| /cards/task_card_E_v3.md | 当前版 | |
| /cards/task_card_W_v3.md | 当前版 | |
| /cards/task_card_G_v3.md | 当前版 | |
| /cards/task_card_A_research_v4.md | 当前版 | |
| /cards/task_card_A_commercial_v4.md | 当前版 | |
| /cards/task_card_B_research_v4.md | 当前版 | |
| /cards/task_card_B_commercial_v4.md | 当前版 | |
| /cards/task_card_D_research_v4.md | 当前版 | |
| /cards/task_card_D_commercial_v4.md | 当前版 | |
| /cards/task_card_vision_animal_plant_v2.md | 当前版（v2 研究优化版） | |
| /cards/task_card_vision_landmark_scenery_v2.md | 当前版 | |
| /cards/task_card_vision_artifact_architecture_v2.md | 当前版 | |
| /cards/task_card_commentary_scenery.md | 当前版（v2） | |
| brief.md | brief_universal / brief_commercial / brief_v3 选一 | 按场景；brief_task_commercialization 为特定任务书，按需 |
| digest_card_template.md | 放 digest/ 目录 | 卡片行模板 |
| agents.md | 仓库自建（表头行） | |

### 自动注入层
| 文件 | 用哪一版 |
|---|---|
| Kimi Project 项目指令 | project_instruction.md 全文复制（含路由头 v14 生效副本） |

### 人读文档（不进 /cards/）
| 文件 | 用途 |
|---|---|
| blackboard_introduction.md | 功能介绍 |
| operations_guide_v3.md | 操作指南 |
| system_design_notes.md | 设计原理与排障 |
| modification_rules.md | 修改规则（元流程） |
| skill_method_review.md | 方法审查记录 |
| conversation_first_aid.md | 对话急救话术 |
| claw_prompts.md | 两条开工 prompt |
| protocol_single_window.md + agent_method_v2.md + philosophy_note.md | 单窗口场景（可选保留） |

## 二、删除清单（重复/废弃，实测共 158 个文件）

### protocol 旧版（全部中间版本，174 个）
protocol_v3_1 / v3_2_commercial / v4_1 / v4_universal /
v5 / v5_1~v5_4（含 solo）/ v6 / v6_2 / v6_3 /
v7 / v7_1~v7_9 / v8 / v8_1 / v8_2 /
v9 / v9_1~v9_10 / v10 / v10_1~v10_6 / v11 / v11_1
——共 128 个，只保留 v11_2 三版，其余全部删除。

### 任务卡旧版（20 个）
- task_card_A_v2 / B_v2 / C_v2 / D_v2（v2 四张）
- task_card_A_collection / B_analysis / C_design / D_advice（卡 0 时代四张）
- task_card_A_research / A_commercial / B_research / B_commercial / D_research / D_commercial（旧特化六张，无 v3 后缀）
- task_card_V_BIO / V_GEO / V_ART（识图旧版三张）
- task_card_0_router.md（卡 0 已消解）
- task_card_tour_narration.md（讲解卡旧版）
- task_cards_index.md（选择矩阵信息已被各卡首行"使用范围"覆盖；如需保留须先更新 E/W/G 与 v3 文件名）

### 指南/模板旧版（10 个）
- operations_guide.md / operations_guide_v2.md（留 v3）
- agent_card_research / commercial / universal（v6.1 执行卡，被任务卡 v3 取代）
- agent_method.md（v1 单窗口方法）
- blackboard_scheme_overview.md（被 introduction+notes 取代）
- blackboard_simple.md（被 introduction 取代）
- prompt_template_v2.md（被 router v14+项目指令取代）

## 三、不改即用的文件
router.md、project_instruction.md、全部 _v3 卡、三张识图卡、
讲解卡、brief_universal/commercial/v3、全部人读文档——均为
当前最新版，无需修改。


## 四、版本变更记录（10-29 检索侧修复轮）
- 13 张卡 v3→v4：A/B/C/D + 特化 6（内建检索计划表/迷你表、
  去举例、特化管线自包含）
- 识图 3 卡加 v2：迷你表内建、槽位映射改引 protocol
- E/W/G 维持 v3（无搜索义务，未改）
- 讲解卡维持原版（未改）
- 项目指令改名 project_instruction.md（内容=路由头 v14）
- protocol 维持 v11.2（本轮未改 protocol）


## 五、v12.0 变更（11-01 合规危机修复）
- protocol 三版 -18%（16594→13673 字）：1.9 的 a-o 十五子条款
  压缩为单条索引（内容并入 1.18 检索计划表对应列，不单独
  留痕）；追问门槛 1.9i 保留独立效力
- router/卡/项目指令维持 v14/v4 现版（全文源在执行层，
  protocol 转纯索引角色）
- 用户验收压缩为三票制：①temp/ 有计划表且含"概念分解"行
  ②产出文件在板上可开 ③结论无未举证全称词


## 六、v15 路由变更（11-01 只读所需）
- router 从"判别+全文规则"瘦身为"判别+指向"（约 1500→900
  字）：检索计划表全文移出 router，唯一全文源在所选任务卡
  （A/B 完整版、C/D/识图迷你版）
- 新增第一规则：开工只读三样（本路由头+所选卡一张+
  compact_context），卡内未写的规则不额外加载，protocol
  按需不通读
- 判别块字段精简（去开工动作回执三子项，回执职责由卡内
  表格承担）
- protocol 维持 v12；卡维持 v4/v2——本轮只动 router 与指令


## 七、v16 变更（11-01 卡内铁律去重）
- 17 张卡的"铁律段"全部删除（与 router 规则区重复，违反
  全文唯一源原则）；铁律唯一源=router 规则区
- router 补第 9 条"索引绑定"（原铁律第 4 条），升 v16，
  项目指令同步
- protocol 维持 v12；卡其余内容不动


## 八、v17 变更（11-01 读取模式优化）
- 17 张卡节标题加【必读】标记 32 处、【条件：<触发>】4 处
  （修复分支/变更提示）——条件块获"此刻可不读"的显式许可，
  注意力按标记分配，文字内容零删减
- router 第 6 条"每产出重读全文 900 字"改为"三行自检"
  （目标复述/凭证核对/漂移自查，0 读取）；全文重读仅保留
  会话恢复与变更场景——按会话产出 5 份计，重复读取从
  4500 字降为 0
- router 升 v17，项目指令同步
