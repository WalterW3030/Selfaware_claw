# 任务书：T1脚本A补丁应用与测试

日期：2026-09-09 | 执行：ds_kimi | 依据：Walter裁定"先检测自行方案，如果不行则使用你的补丁并测试"

## 背景
你的v4.3检测结果：不通过。锚修复思路本身正确（行数快照+新行定位），但"其余部分与v4.2一致"意味着v4.2的Union导入回归原样继承——v4.3模块import即NameError，仍是按声明方式无法运行的交付（第四次同类）。补丁文件已随附，以v4.2为基座共4处整段替换。

## 步骤

### 第1步：应用补丁
严格按补丁文件4处编辑执行，禁止任何自由发挥。完成后计算并报告：补丁后文件SHA-256、行数。

### 第2步：T0导入测试
```
python3 -c "import T1_v4_执行器" 2>&1; echo "exit=$?"
```
（模块文件名如不可直接import，用 `python3 T1_v4_执行器.py --help` 代替，两者均可）
验收：exit=0，无NameError/ImportError。报告完整输出原文。

### 第3步：T1干跑测试
```
python3 T1_v4_执行器.py --question-list <纯kimi题目清单> --dry-run --output-dir ./T1_patch_test
```
验收：25个result_*.json（每个含"mock": true）+ summary.json + execution_log.jsonl + checkpoint.json；exit=0。报告：summary的completed/failed/dry_run计数、随机抽3个result文件全文。

### 第4步：T2隔离会话单题实测
目的：验证cli锚定+窗口提取端到端真实可用。**严禁使用任何测量会话**。
1. 新建一个一次性测试会话（openclaw sessions 新建），记下session id和JSONL路径
2. 运行：`python3 T1_v4_执行器.py --question-list <单题清单> --session-jsonl <测试会话JSONL> --backend cli --output-dir ./T1_live_test`（单题清单=从25题清单取任意1题单独存文件）
3. 等assistant真实回复出现、脚本落盘result
4. 用脚本B核对：`python3 T1_v4_核对器.py --results-dir ./T1_live_test --session-jsonl <测试会话JSONL>`
验收：result中start_msgId非null、elapsed_seconds非null且>0、answer_sha256为64位hex；脚本B该题overall=PASS。报告：result_*.json全文、脚本B输出原文、测试会话JSONL路径与起止行号。

### 禁止项
- 禁止跑测量会话（纯kimi 25题的正式重跑是直跑，另行任务书）
- 禁止改动补丁未指定的任何代码
- 禁止用py_compile充当测试（已登记其不充分性）；T0必须真实import/执行
- 每步完成立即落盘报告，禁止攒批

### 交付
四步的原始输出+结论，单消息交付。任何一步失败：停止，原样报告错误，不自行改补丁。
