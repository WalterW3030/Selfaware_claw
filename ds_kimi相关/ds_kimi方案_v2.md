# ds_kimi 方案 v2（实验线）

2026-08-17｜核心与《通用方案_v2.md》完全一致，本文件为自包含版：核心全文+本线适配+替换执行要求。

## 一、核心（与通用方案一致，不可删改）
工件：self_flight.py（--install/--check/--verify/--lint/--audit）、self_flight_rules.md、self_flight_log.jsonl（append-only）、instruction_log.jsonl（append-only，收指令当场追加：发令者+时间+原文+任务标签）。
--check 九项硬闸门：A1 授权核验（引用原文与 instruction_log 该标签最新条目字符串比对）、A2 标签映射、A3 时效确认、A4 绕过申报、A5 口径声明、A6 先核对后判断、B7 声明佐证、B8 状态一致、B9 直答。
--lint 发送前扫描（无佐证声明词、缺复述/直答），如实标注真拦截/留痕档；--audit 本地机械复算清单类产出。
--verify 会话首检。对外仅三条：INSTALL_OK+哈希、异常告警、被要求时导出日志。完成标注分两档。

## 二、ds_kimi 实验线适配
1. --check 触发点：任何实验运行/分析启动前（对应在案事故：B(V43) 误跑、C100 未授权重复跑）
2. A2 映射实例：配置名→test_helpers 函数→system prompt 常量→预载文件（如 C_M1M4→mode C 现有配置）
3. A5 口径钉死：du 判定唯一口径（各 run 自身 dim1=pass 为分母、data_usage.used 判定、fail 与 n/a 互不计分歧、禁用 dim3_new）
4. --audit 实例：清单类产出从 res_*.json 本地复算（33 题清单口径已被指挥独立复算验证可行）
5. B7 强化：历史模式为"已上传/已修正"无附件或零改动（在案 5 次），声明必须附文件且 diff 非零改动
6. 不可修项明示：服务端缓存、引擎 idle timeout 不在方案内，维持记录制

## 三、与既有 EEOP 的边界
EEOP 检测层保留不动（检测能力已验证有效）。本方案不改动 EEOP 任何文件。

## 四、替换执行要求（本次任务）
1. 盘点工作区：列出 eeop_pre_flight 各版本、spec 各版本、任何协议补丁文件、任何 P-A~D 衍生文件（给 v3 脚本加三问、给 spec 加四条的版本）
2. 删除错误旧方案部分：P-A~D 衍生物全部删除或回滚到官方版本；报告删除清单
3. 安装本方案：--install → 报告 INSTALL_OK 原文行 + 脚本哈希 + 日志首行
4. 回传：盘点前后文件列表、删除清单、INSTALL_OK 行、self_flight_log.jsonl 与 instruction_log.jsonl 导出
5. 全程禁止任何未经授权的实验运行

## 五、修改总结（v1→v2，本线视角）
P-A~D 补丁计划（声明闸门式）已撤销未安装 → 由本方案整体取代；A1/A5/B7/B9 修复同通用方案六项。

## 六、载入方式
直接安装（错误旧方案未实际装入，无并存风险）；若盘点发现 P-A~D 残留痕迹，先回滚再装。
