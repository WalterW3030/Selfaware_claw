# 任务书：纯kimi 25题直跑重跑

日期：2026-09-09 | 执行：ds_kimi | 依据：Walter裁定"无论结果如何，重跑纯kimi都选用直跑"

## 方法（第二轮已验证可行的直跑法）
逐题把题干作为真实user消息注入测量会话，主agent（被测k2p6）直接回答；每题答完立即提取窗口落盘，不攒批。

## 硬性规程
1. **新会话**：为本次重跑新建专用测量会话，开始前报告session id与JSONL绝对路径；严禁使用任何历史会话
2. **输入绑定**：开跑前报告 pureKimi_new_questions_v3.md 的SHA-256与解析题数（应为25）
3. **逐题窗口（Plan A）**：start=该题user消息（msgId+行号+timestamp），end=该turn收尾assistant消息（msgId+行号+timestamp；排除toolCall发起与纯thinking）；中间不得有另一条user消息，否则记STRUCTURE_ERROR不重跑
4. **逐题字段**：question_id / start_msgId / start_line / start_timestamp / end_msgId / end_line / end_timestamp / elapsed_seconds（两端时间戳差）/ answer_sha256（答案文本SHA-256）/ answer_preview（前200字符）/ usage（该turn的prompt/completion token原始值，如JSONL中有usage字段原样抄录，无则记null）
5. **失败登记**：任何一题超时/结构错/无回复→记FAILED+原因，保留现场，禁止自动重跑，继续下一题
6. **禁止项**：占位值、估算、子代理、脚本A真实模式（本次不走脚本）、中途改题目文本
7. **跑中沉默**：除阻断错误外中途不汇报；25题完成后一次性交付

## 交付（完成后单消息）
1. results.jsonl（25行，每题一行，字段见规程4）
2. summary：总题数/COMPLETED/FAILED/STRUCTURE_ERROR计数、总墙钟时间、token合计（可得分项）
3. session id + JSONL路径 + 起止行号范围
4. 题目清单SHA-256（与开跑前一致复核）

## 验收（我侧）
逐题机械核对：msgId回查会话、角色与关键词、时间戳重算（容差0.001s）、顺序与无中间user、answer_sha256格式。任何一行FAIL→该题数据作废登记，不重跑。
