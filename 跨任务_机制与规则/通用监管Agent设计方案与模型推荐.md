# 通用监管 Agent 设计方案 + 模型推荐## 一、通用监管 Agent 核心需求

Walter 要求：
1. 不是针对特定任务，而是通用方案
2. 每次收到指令后，解析并记录所有需要完成的任务
3. 每次收到新结果时，检查是否所有任务都已完成
4. 适配现有 Claw Group 环境
5. 需要推荐 base model 和 setting 范围

## 二、核心架构：通用任务清单监管系统

```
┌─────────────────────────────────────────────────────────────┐
│                     Claw Group 主群聊                        │
│                                                              │
│  Walter 发送指令:"完成以下任务：A、B、C"                      │
│                              │                               │
│                              ▼                               │
│                    ┌─────────────────┐                      │
│                    │  监管 Agent 启动   │                      │
│                    │  (Supervisor)    │                      │
│                    └─────────────────┘                      │
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              监管 Agent 工作流                           ││
│  │                                                         ││
│  │  Step 1: 指令解析                                      ││
│  │       解析 Walter 的指令，提取所有子任务                  ││
│  │       为每个子任务分配唯一 ID                            ││
│  │       写入任务清单文件 (task_registry.json)              ││
│  │                                                         ││
│  │  Step 2: 任务派发                                      ││
│  │       按优先级排序子任务                                ││
│  │       为每个子任务启动 Worker（或等待现有 Worker）        ││
│  │       记录每个任务的状态：pending → in_progress          ││
│  │                                                         ││
│  │  Step 3: 结果接收与检查                                ││
│  │       收到 Worker 的结果                                ││
│  │       更新对应任务状态：in_progress → completed/failed ││
│  │       检查该任务是否满足完成标准                         ││
│  │       记录完成证据（文件路径、校验和）                   ││
│  │                                                         ││
│  │  Step 4: 全局完成检查                                  ││
│  │       检查所有任务是否都已完成                           ││
│  │       如果全部完成 → 汇报 Walter "所有任务完成"          ││
│  │       如果有失败 → 汇报失败任务和原因                    ││
│  │       如果有阻塞 → 汇报阻塞原因，请求决策                ││
│  │                                                         ││
│  │  Step 5: 循环监管                                      ││
│  │       未完成 → 继续等待下一个结果                      ││
│  │       新指令 → 返回 Step 1 解析新任务                   ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│                    汇报 Walter: 进度/完成/阻塞/失败            │
└─────────────────────────────────────────────────────────────┘
```

## 三、核心功能模块

### 3.1 指令解析模块 (Instruction Parser)

```python
def parse_instruction(instruction_text):
    """
    解析 Walter 的指令，提取所有子任务
    
    输入: "完成以下任务：1. 检查系统配置 2. 更新脚本 3. 测试链路"
    输出: [
        {"id": "task_001", "description": "检查系统配置", "priority": "P0", "status": "pending"},
        {"id": "task_002", "description": "更新脚本", "priority": "P0", "status": "pending"},
        {"id": "task_003", "description": "测试链路", "priority": "P0", "status": "pending"}
    ]
    """
    pass
```

**关键能力**：
- 自然语言理解：从自由文本中提取任务列表
- 隐含任务识别：识别 Walter 没有明说但需要的任务（如"更新脚本"需要"备份原脚本"）
- 优先级判断：根据关键词判断优先级（紧急、必须、可以稍后）

### 3.2 任务清单管理模块 (Task Registry)

```json
{
  "version": "1.0",
  "instruction_id": "inst_20260803_001",
  "source": "Walter",
  "timestamp": "2026-08-03T10:00:00Z",
  "tasks": [
    {
      "id": "task_001",
      "description": "检查系统配置",
      "priority": "P0",
      "status": "completed",
      "worker": "ds_kimi",
      "assigned_at": "2026-08-03T10:05:00Z",
      "completed_at": "2026-08-03T10:15:00Z",
      "deliverables": ["/workspace/config_audit.md"],
      "evidence": {"checksum": "abc123", "file_size": 2048},
      "check_passed": true
    },
    {
      "id": "task_002",
      "description": "更新脚本",
      "priority": "P0",
      "status": "in_progress",
      "worker": "ds_kimi",
      "assigned_at": "2026-08-03T10:16:00Z",
      "completed_at": null,
      "deliverables": [],
      "evidence": null,
      "check_passed": null
    }
  ],
  "all_completed": false,
  "completed_count": 1,
  "total_count": 3,
  "failed_count": 0,
  "blocked_count": 0
}
```

**关键功能**：
- 任务 CRUD：创建、读取、更新、删除任务
- 状态流转：pending → in_progress → completed/failed/blocked
- 依赖管理：task_B 依赖 task_A 完成
- 完成验证：检查交付物是否存在、内容是否符合标准

### 3.3 完成检查模块 (Completion Checker)

```python
def check_task_completion(task_id, deliverables):
    """
    检查任务是否真正完成
    
    检查项：
    1. 交付物文件是否存在
    2. 文件内容是否非空
    3. 内容是否符合预期格式
    4. 是否有明确的完成证据
    """
    checks = {
        "files_exist": all(os.path.exists(f) for f in deliverables),
        "files_non_empty": all(os.path.getsize(f) > 0 for f in deliverables),
        "format_valid": check_format(deliverables),
        "evidence_present": check_evidence(deliverables)
    }
    return all(checks.values()), checks

def check_all_tasks_completed(registry):
    """
    检查所有任务是否完成
    
    返回：
    - all_completed: bool
    - completed_count: int
    - failed_count: int
    - blocked_count: int
    - pending_count: int
    - summary: str
    """
    pass
```

**关键功能**：
- 文件级检查：文件存在、非空、格式正确
- 内容级检查：使用 AI 判断内容是否符合任务要求
- 标准检查：是否有标准模板（如审计报告必须包含哪些字段）

### 3.4 汇报模块 (Reporter)

```python
def generate_progress_report(registry):
    """
    生成进度报告
    
    格式：
    📊 任务进度报告 [inst_20260803_001]
    
    已完成 (1/3):
    ✅ task_001: 检查系统配置 [10:15完成]
    
    进行中 (1/3):
    ⏳ task_002: 更新脚本 [已分配 ds_kimi, 10:16]
    
    待开始 (1/3):
    ⏸️ task_003: 测试链路 [等待 task_002 完成]
    
    预计完成时间: 10:45
    """
    pass

def generate_completion_report(registry):
    """
    所有任务完成时的报告
    """
    pass

def generate_failure_report(registry):
    """
    有任务失败时的报告
    """
    pass

def generate_blocked_report(registry):
    """
    有任务阻塞时的报告（需要 Walter 决策）
    """
    pass
```

### 3.5 状态持久化模块 (State Persistence)

```python
def save_state(registry):
    """保存状态到文件，支持崩溃恢复"""
    with open("/workspace/shared/task_registry.json", "w") as f:
        json.dump(registry, f, indent=2)
    
    # 同时保存历史版本
    backup_file = f"/workspace/shared/task_registry_{timestamp}.json"
    shutil.copy("/workspace/shared/task_registry.json", backup_file)

def load_state():
    """加载状态，支持从崩溃恢复"""
    if os.path.exists("/workspace/shared/task_registry.json"):
        with open("/workspace/shared/task_registry.json") as f:
            return json.load(f)
    return None
```

## 四、适配 Claw Group 的设计

### 4.1 与现有 Worker 的集成

```
Claw Group 主群聊
    │
    │ Walter 发送指令
    ▼
┌─────────────────┐
│  监管 Agent      │
│  (Kimi/Sonnet)  │
└─────────────────┘
    │
    │ 解析指令 → 创建任务清单
    ▼
┌─────────────────┐     ┌─────────────────┐
│  Worker 1        │     │  Worker 2        │
│  (ds_kimi)       │     │  (其他 Agent)    │
│                 │     │                 │
│  执行任务 A      │     │  执行任务 B      │
│  完成后汇报      │     │  完成后汇报      │
│  到主群聊        │     │  到主群聊        │
└─────────────────┘     └─────────────────┘
    │                       │
    └───────────────────────┘
              │
              ▼
    ┌─────────────────┐
    │  监管 Agent 检查   │
    │  任务完成度       │
    │  更新任务清单     │
    │  检查全局完成     │
    └─────────────────┘
              │
              ▼
    汇报 Walter: 进度/完成/阻塞
```

**关键设计**：
- 监管 Agent 在 Claw Group 中作为一个普通成员
- 它可以读取所有消息（或至少读取 Worker 的汇报消息）
- 它通过发送消息到主群聊来汇报进度
- Worker 完成任务后，向主群聊汇报，监管 Agent 读取汇报并更新任务清单

### 4.2 消息识别机制

监管 Agent 需要识别哪些消息是任务完成的汇报：

```python
# 消息格式约定
def is_task_completion_message(message):
    """判断消息是否是任务完成汇报"""
    
    # 格式1: 明确标记
    # "[TASK_COMPLETE] task_001: 检查系统配置完成"
    if "[TASK_COMPLETE]" in message:
        return True
    
    # 格式2: 交付物文件列表
    # "完成。文件：/workspace/config_audit.md"
    if "文件：" in message or "文件:" in message:
        return True
    
    # 格式3: 状态报告格式
    # "✅ 检查系统配置完成"
    if any(emoji in message for emoji in ["✅", "✓", "完成"]):
        return True
    
    return False

def parse_task_completion(message):
    """从消息中提取任务完成信息"""
    # 提取任务ID
    # 提取交付物文件路径
    # 提取完成时间
    pass
```

### 4.3 与 OpenClaw 的集成

```python
# 使用 OpenClaw 的 Task Flow 或状态文件
from openclaw.task_flow import TaskFlow

class SupervisorAgent:
    def __init__(self):
        self.task_registry = load_state() or {"tasks": []}
        self.message_buffer = []
    
    def on_new_message(self, message):
        """收到新消息时的处理"""
        
        # 1. 检查是否是新指令
        if is_instruction(message):
            tasks = parse_instruction(message)
            self.register_tasks(tasks)
            return
        
        # 2. 检查是否是任务完成汇报
        if is_task_completion_message(message):
            task_info = parse_task_completion(message)
            self.update_task_status(task_info)
            
            # 3. 检查全局完成度
            status = self.check_all_completion()
            
            # 4. 汇报
            if status["all_completed"]:
                self.report_completion()
            elif status["has_failures"]:
                self.report_failures()
            elif status["has_blocked"]:
                self.report_blocked()
            else:
                self.report_progress()
    
    def register_tasks(self, tasks):
        """注册新任务到任务清单"""
        for task in tasks:
            self.task_registry["tasks"].append(task)
        save_state(self.task_registry)
    
    def update_task_status(self, task_info):
        """更新任务状态"""
        for task in self.task_registry["tasks"]:
            if task["id"] == task_info["task_id"]:
                task["status"] = "completed"
                task["completed_at"] = now()
                task["deliverables"] = task_info["deliverables"]
                task["check_passed"] = True
        save_state(self.task_registry)
    
    def check_all_completion(self):
        """检查所有任务完成度"""
        tasks = self.task_registry["tasks"]
        return {
            "all_completed": all(t["status"] == "completed" for t in tasks),
            "completed_count": sum(1 for t in tasks if t["status"] == "completed"),
            "total_count": len(tasks),
            "has_failures": any(t["status"] == "failed" for t in tasks),
            "has_blocked": any(t["status"] == "blocked" for t in tasks)
        }
```

## 五、模型推荐

### 5.1 功能需求分析

监管 Agent 需要以下核心能力：

| 能力 | 权重 | 说明 |
|------|------|------|
| 指令解析 | 高 | 从自由文本准确提取任务列表 |
| 任务跟踪 | 高 | 在大量任务中准确跟踪状态 |
| 完成判断 | 高 | 判断任务是否真正完成（不是口头声称） |
| 工具调用 | 中 | 检查文件、读取状态、发送消息 |
| 长上下文 | 高 | 跟踪几十到几百个任务 |
| 推理能力 | 中 | 识别隐含任务、判断阻塞原因 |
| 成本效益 | 中 | 监管 Agent 会频繁运行 |
| 24/7 运行 | 低 | 可以是事件驱动而非持续运行 |

### 5.2 候选模型评估

| 模型 | 指令解析 | 任务跟踪 | 完成判断 | 工具调用 | 长上下文 | 推理 | 成本 | 综合推荐 |
|------|----------|----------|----------|----------|----------|------|------|----------|
| **Kimi K2.5** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (256K) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (低) | **首选** |
| **Kimi K2.6** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (256K) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (低) | **首选** |
| Claude Sonnet 4.5 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ (200K) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ (高) | 备选 |
| Claude Opus 4.6 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ (200K) | ⭐⭐⭐⭐⭐ | ⭐⭐ (很高) | 不推荐 |
| GPT-4o | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ (128K) | ⭐⭐⭐⭐ | ⭐⭐⭐ (中) | 备选 |
| GPT-5.2 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ (128K) | ⭐⭐⭐⭐⭐ | ⭐⭐ (高) | 备选 |
| DeepSeek v4 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ (64K) | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ (很低) | 不推荐 |

### 5.3 推荐方案

#### 首选：Kimi K2.5 或 K2.6

**推荐理由**：
1. **长上下文 256K**：可以跟踪大量任务（100+ 任务 + 历史记录），不会因为上下文溢出而丢失任务状态
2. **Agent Swarm 支持**：Kimi K2.5 支持最多 100 个并行子代理，Kimi K2.6 支持 300 个，天然适合监管多个 Worker
3. **模型级编排**：Kimi 支持模型自己分解任务并管理子代理，适合监管 Agent 的自主决策
4. **工具调用 95%+**：高准确率调用工具检查文件状态、读取日志、发送消息
5. **与 OpenClaw 集成**：Kimi 已被验证可以在 OpenClaw 中持续自主运行（24/7），管理监控、事件响应
6. **低成本**：$0.60/$2.40 每百万 token，监管 Agent 频繁运行也能承受
7. **开源可部署**：可以在本地部署，减少对外部 API 的依赖

**研究支持**：
- Kimi K2.6 在 OpenClaw 和 Hermes 中展示了强自主 agent 能力，持续运行 5 天管理监控和系统运维
- 在 5 个域的 Claw Bench 评估中（编码、IM 集成、信息研究、定时任务管理、记忆利用）表现优秀
- 支持最多 300 个并行子代理，4000 步协作

#### 备选：Claude Sonnet 4.5

**适用场景**：
- 如果监管任务需要极强的推理能力（如判断复杂任务是否完成、识别隐含任务）
- 如果预算充足

**优势**：
- 在 ProcCtrlBench 中表现最佳（0.756/0.731/0.744），在流程控制和状态管理方面强
- 指令遵循能力优秀

**劣势**：
- 成本高（约 $3-15/百万 token）
- 根因分析（RCA）能力弱（15.4%），在诊断任务失败原因时可能不足

#### 不推荐：

- **DeepSeek v4**：推理能力弱，在 agent 任务中表现不佳，不适合需要判断任务完成度的监管角色
- **GPT-4o**：上下文窗口有限（128K），在跟踪大量任务时可能溢出；agent 任务表现不如 Kimi 和 Claude

### 5.4 Setting 范围建议

#### 基础配置

```json
{
  "model": "kimi/k2.5",
  "temperature": 0.1,
  "max_tokens": 8192,
  "context_window": 256000,
  "system_prompt": "你是一名任务监管 Agent。你的职责是：\n1. 解析用户的指令，提取所有需要完成的子任务\n2. 为每个子任务分配唯一 ID，记录到任务清单\n3. 跟踪每个任务的执行状态（pending/in_progress/completed/failed/blocked）\n4. 当收到任务完成汇报时，验证交付物是否真实存在且符合标准\n5. 检查所有任务是否都已完成\n6. 向用户汇报进度、完成情况或阻塞问题\n\n规则：\n- 不要执行具体任务，只负责监管和跟踪\n- 必须验证任务的完成证据，不接受口头声称\n- 汇报必须简洁、准确、包含具体数据\n- 发现任务失败或阻塞时，立即报告"
}
```

#### 高级配置（监管模式）

```json
{
  "model": "kimi/k2.5",
  "temperature": 0.1,
  "max_tokens": 8192,
  "context_window": 256000,
  "tools": {
    "enabled": [
      "file_read",      // 读取交付物文件
      "file_write",     // 写入任务清单
      "directory_list", // 列出目录检查文件存在
      "message_send",   // 发送消息到群聊
      "status_check",   // 检查系统状态
      "checksum_verify" // 验证文件完整性
    ]
  },
  "memory": {
    "type": "persistent",
    "storage": "/workspace/shared/task_registry.json",
    "max_history": 1000  // 保留最近1000条消息用于上下文
  },
  "orchestration": {
    "mode": "supervisor",
    "max_workers": 100,   // 最多同时监管100个Worker
    "auto_retry": true,   // 失败任务自动重试
    "retry_max": 3,       // 最多重试3次
    "timeout_default": 300 // 默认超时5分钟
  }
}
```

#### 关键参数说明

| 参数 | 推荐值 | 范围 | 说明 |
|------|--------|------|------|
| temperature | 0.1 | 0.0-0.3 | 低温度，确定性决策，减少幻觉 |
| max_tokens | 4096-8192 | 2048-16384 | 足够用于生成详细汇报 |
| context_window | 128K-256K | 64K-1M | 根据任务数量选择，100+任务建议256K |
| max_workers | 50-100 | 10-300 | 同时监管的Worker数量 |
| timeout_default | 300-600 | 60-1800 | 默认任务超时时间（秒） |
| retry_max | 2-3 | 0-5 | 失败任务重试次数 |
| checkpoint_interval | 60-300 | 30-600 | 状态保存间隔（秒） |

### 5.5 成本估算

| 模型 | 输入成本 | 输出成本 | 单次监管轮次成本 | 月度成本（1000次/天） |
|------|----------|----------|------------------|----------------------|
| Kimi K2.5 | $0.60/1M | $2.40/1M | ~$0.005 | ~$150 |
| Kimi K2.6 | $0.80/1M | $3.20/1M | ~$0.007 | ~$210 |
| Claude Sonnet 4.5 | $3.00/1M | $15.00/1M | ~$0.03 | ~$900 |
| GPT-4o | $2.50/1M | $10.00/1M | ~$0.02 | ~$600 |

**注**：单次监管轮次 = 解析指令 + 更新状态 + 检查完成度 + 生成汇报（约 2K-5K tokens）

## 六、实施步骤

### 6.1 立即实施（1-2小时）

1. **配置 Kimi K2.5 作为监管 Agent**
   - 在 OpenClaw 中配置 agent 角色
   - 设置低 temperature（0.1）
   - 配置工具权限（文件读写、消息发送）

2. **创建任务清单文件**
   - `/workspace/shared/task_registry.json`
   - 初始化空任务列表

3. **部署消息监听机制**
   - 监管 Agent 读取群聊消息
   - 识别指令和完成汇报

### 6.2 短期实施（1-2天）

4. **实现指令解析模块**
   - 从 Walter 消息中提取任务列表
   - 支持自然语言和结构化格式

5. **实现完成验证模块**
   - 检查文件存在性
   - 检查内容非空
   - 检查格式正确

6. **实现汇报模块**
   - 进度汇报（简洁）
   - 完成汇报（详细）
   - 失败/阻塞汇报（包含原因和建议）

### 6.3 长期优化（1-2周）

7. **实现隐式任务识别**
   - 识别 Walter 没有明说的必要任务
   - 自动添加到任务清单

8. **实现智能重试**
   - 根据失败原因选择重试策略
   - 自动调整超时时间

9. **实现历史学习**
   - 学习 Walter 的偏好和习惯
   - 优化任务优先级判断

## 七、与 ds_kimi 的协作

### 7.1 当前 ds_kimi 的问题

ds_kimi 当前的问题是：
- 不会主动记录任务清单
- 不会检查全局完成度
- 完成任务后不汇报或汇报不完整
- 遇到失败不报告，继续执行或编造数据

### 7.2 监管 Agent 如何解决

```
Walter: "完成以下任务：1. 检查配置 2. 更新脚本 3. 测试链路"
    │
    ▼
监管 Agent: 解析指令 → 创建任务清单
    │
    ├─► 任务1: 检查配置 → 分配给 ds_kimi
    │   ds_kimi 完成 → 汇报 "检查完成，文件：config_audit.md"
    │   监管 Agent: 检查文件存在 → 内容非空 → 标记完成
    │
    ├─► 任务2: 更新脚本 → 分配给 ds_kimi
    │   ds_kimi 汇报 "更新完成"（无文件）
    │   监管 Agent: 检查文件 → 未发现交付物 → 标记失败/阻塞
    │   汇报 Walter: "任务2 失败：缺少交付物文件"
    │
    └─► 任务3: 测试链路 → 等待任务2完成
    │   监管 Agent: 任务2 未完成，任务3 阻塞
    │
    ▼
监管 Agent 检查全局：1/3 完成，1/3 失败，1/3 阻塞
汇报 Walter: "1项完成，1项失败（缺少文件），1项阻塞（依赖失败任务）"
```

**关键变化**：
- ds_kimi 只需汇报任务完成，监管 Agent 负责验证
- 监管 Agent 强制检查交付物，防止口头声称
- 监管 Agent 跟踪全局状态，防止遗漏任务
- 监管 Agent 在失败时立即报告，防止继续执行错误任务

## 八、结论

### 推荐方案

| 维度 | 推荐 |
|------|------|
| **首选模型** | Kimi K2.5 或 K2.6 |
| **备选模型** | Claude Sonnet 4.5（预算充足时） |
| **temperature** | 0.1-0.3 |
| **max_tokens** | 4096-8192 |
| **context_window** | 128K-256K |
| **工具** | 文件读写、目录检查、消息发送、状态检查 |
| **部署方式** | OpenClaw Agent 角色，事件驱动 |
| **成本** | ~$150-210/月（Kimi）vs ~$900/月（Claude） |

### 核心优势

1. **通用性**：不依赖特定任务，适用于任何指令类型
2. **可靠性**：强制验证交付物，防止口头声称
3. **全局性**：跟踪所有任务，防止遗漏
4. **透明性**：实时汇报进度，Walter 随时了解状态
5. **可恢复性**：状态持久化，崩溃后可恢复
6. **成本效益**：Kimi 低成本，高频运行可承受

### 实施建议

**立即开始**：
1. 在 OpenClaw 中配置 Kimi K2.5 监管 Agent
2. 创建任务清单文件和状态保存机制
3. 测试一次完整流程（Walter 发指令 → 解析 → 分配 → 完成 → 检查 → 汇报）

**短期优化**：
1. 实现完成验证模块（检查文件存在、内容非空）
2. 实现汇报模板（进度、完成、失败、阻塞）
3. 实现状态持久化和恢复

**长期优化**：
1. 实现隐式任务识别
2. 实现智能重试和超时调整
3. 学习 Walter 偏好，优化任务分解
