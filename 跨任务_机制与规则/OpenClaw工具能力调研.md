# OpenClaw 工具能力调研报告（2026-08-04）

## 核心发现

OpenClaw 2026 内置工具非常丰富，**ds_kimi 作为 Agent 可以直接使用这些工具**，不需要 spawn 子代理。

## 可用工具清单

### 1. Web 工具（Step 3 可用）
| 工具 | 功能 | 需要 API Key |
|------|------|-------------|
| web_search | 网页搜索（Brave Search API） | Brave API Key（可用免费 tier） |
| web_fetch | 下载网页内容 | 不需要 |
| browser | 完整浏览器自动化（Chromium） | 不需要 |

### 2. 代码执行（Step 3 可用）
| 工具 | 功能 | 需要 API Key |
|------|------|-------------|
| exec | 执行 shell 命令（沙箱化） | 不需要 |
| python | Python 代码执行（沙箱化，支持 pip 安装） | 不需要 |
| node | Node.js 执行（沙箱化） | 不需要 |
| calculator | 数学计算 | 不需要 |

### 3. 文件管理（Step 3 可用）
| 工具 | 功能 | 需要 API Key |
|------|------|-------------|
| read | 读取文件 | 不需要 |
| write | 写入文件 | 不需要 |
| edit | 编辑文件 | 不需要 |

### 4. 子代理管理
| 工具 | 功能 |
|------|------|
| sessions_spawn | 生成子代理会话 |
| subagents | 列出/管理/终止子代理 |
| sessions_yield | 等待子代理完成 |

## 关键结论

**ds_kimi 可以直接用 OpenClaw 工具执行 Step 3，不需要 spawn Kimi：**

| 任务类型 | Step 3 执行方式 | 是否需要 spawn |
|----------|----------------|---------------|
| 天气查询 | web_fetch 直接调用 wttr.in | 不需要 |
| 股价查询 | web_search 搜索后 browser 访问 | 不需要 |
| 新闻查询 | web_search 直接搜索 | 不需要 |
| 代码执行 | python 或 exec 沙箱执行 | 不需要 |
| 数学计算 | calculator 或 python | 不需要 |
| 文件处理 | read/write/edit | 不需要 |
| 需要 Kimi 特定能力时 | sessions_spawn 生成子代理 | 需要 |

## 之前的误解

**错误假设**："Step 3 必须 spawn Kimi 子代理"

**实际情况**：
- ds_kimi 作为 OpenClaw Agent，本身就拥有 web_search、browser、exec、python 等工具
- 大多数任务（天气、新闻、搜索、计算、代码执行）可以直接用这些工具完成
- 只有在需要 Kimi 特定能力（如 vision、特定 model）时才需要 spawn

## 对实验的影响

这意味着：
1. **大多数题目的 Step 3 可以直接真实执行**，不需要 simulated
2. 不需要等待 Alpha Vantage API key，web_search + browser 就能获取股价
3. 不需要 spawn Kimi，ds_kimi 自己的工具就能完成 Step 3
4. 真正的 blocker 是 ds_kimi 是否**知道并使用**这些工具

## 立即行动

需要确认 ds_kimi 的当前环境中：
1. 哪些工具在 tools.allow 列表中？
2. 是否配置了 Brave API key（web_search 需要）？
3. 是否能直接调用 web_search / browser / exec / python？

如果这些工具可用，Step 3 的真实执行率可以从 6% 提升到 60-70%。
