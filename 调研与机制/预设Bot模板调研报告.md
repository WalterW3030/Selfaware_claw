# 网页预设 Bot 模板调研报告

## 一、主流平台的 Bot 模板是怎么设置的

### 1. Custom GPTs（OpenAI）
- 核心就是一个**预填的系统提示词**（instructions 字段，上限 8000 字符）
- 可选附加：知识文件（knowledge files）、对话开场白（conversation starters）、Actions（API 调用）
- 官方原话："A custom GPT is just a pre-filled set of system instructions"
- **隐藏机制**：Custom GPT 内部秘密使用"隐藏的对话示例"作为上下文 + 优化过的采样参数 + 一致性机制。这就是为什么同一段提示词在 Custom GPT 里人格鲜明，搬到裸 API 就变得平庸——API 只拿到系统提示词，拿不到那些隐藏的 few-shot 对话示例

### 2. Gemini Gems（Google）
- 与 Custom GPT 完全同构：名称 + 固定指令 + 可选参考文件
- 保存后行为即固定，无需每次重贴指令

### 3. Character.ai / Poe / Coze
- Character.ai：人格描述 + **示例对话**（example dialogues）——示例对话是它人格稳定的关键
- Poe bot：一段系统提示词（prompt）+ 可选知识库
- Coze：提示词 + 插件 + 工作流 + 知识库，是这几家里配置最重的

### 4. OpenClaw 的 SOUL.md（对照）
- 单个 markdown 文件定义身份、规则、工具、行为
- 本质也是"系统提示词文件化"，外加工具绑定

## 二、与我们的加载模式 A/B/C 的对应关系

先明确我们的三个模式（基于当前实验文件）：
- **Mode A**：仅系统提示词（V40_SYSTEM_PROMPT），单轮直接判断
- **Mode B**：系统提示词 + 8 轮预设对话历史（MODEB_PRELOAD）
- **Mode C**：1 轮压缩版系统提示词（把 Mode B 多轮内容整合进单条 prompt）

| 平台模板 | 设置方式 | 最接近的模式 |
|---|---|---|
| Poe bot / 简单提示词模板 | 纯系统提示词 | **Mode A / Mode C** |
| Coze（不算工作流插件部分） | 系统提示词为主 | **Mode C** |
| **Custom GPT** | 系统提示词 + 隐藏 few-shot 对话示例 | **表面是 Mode C，实际是 Mode B** |
| **Character.ai** | 人格描述 + 示例对话 | **Mode B**（示例对话 = 预设对话历史） |
| Gemini Gems | 系统提示词 | Mode A / C |

**关键结论**：
- 大多数模板的"可见部分"最接近 **Mode C**（一段整合好的系统提示词）
- 但效果好的模板（Custom GPT、Character.ai）都**偷偷内嵌了示例对话**，功能上等价于 **Mode B**
- 这与我们的实验数据互相印证：Mode B（92%）> Mode A（86%），学术上叫 few-shot 示例优于纯指令描述。OpenAI 社区的实际案例也证实：把 Custom GPT 搬到 API 时人格崩坏，修复手段第一名就是"把 few-shot 对话示例显式加进提示词"
- 也就是说：**业界实战和我们的实验得出同一结论——单轮纯指令（A/C）不如带示例对话上下文（B）**，而 Mode C 的价值在于把 B 的效果压缩进一轮、省 token

## 三、能否直接导入 Claw Group 或其他 MoA 系统

### 直接导入（一键/原生支持）：不行
- Custom GPTs 锁定在 OpenAI 平台内，GPT Builder 还**隐藏实际提示词**，官方不提供导出
- Gemini Gems 锁定在 Gemini 生态
- Poe / Coze 同理，各自锁定
- 目前**没有跨平台 bot 模板导入标准**（有个别第三方做 .skill 包之类的尝试，未成标准）

### 手动迁移：可以，因为可迁移的核心就是那段提示词文本
- 自己建的 GPT：instructions 是你自己的，复制出来即可。官方文章也确认"This actually makes it portable. Want to try it as a Gemini Gem? Copy and paste it over."
- 迁移路径：
  1. 提取模板的 instructions / persona 文本
  2. 转成目标系统接受的格式：OpenClaw → SOUL.md；我们的测试框架 → system prompt（即 Mode A/C 加载）；示例对话部分 → 预设对话历史（即 Mode B 加载）
  3. 工具/插件部分（GPT Actions、Coze 插件）**无法自动迁移**，需要在目标平台重建（OpenClaw 里对应 skills/工具适配器）
- 别人的公开 GPT：提示词可被 prompt injection 套出来，但违反平台 ToS，不建议

### 对我们框架的直接意义
- 可以把任何 bot 模板"降解"为两部分：指令文本（→ Mode A/C 加载）+ 示例对话（→ Mode B 加载）
- 我们现有的 Mode A/B/C 加载机制已经覆盖了所有模板的可迁移内容，无需新增导入功能
- 真正不可迁移的只有平台绑定的工具链（Actions/插件），这部分本来就和我们的 Step 3 工具执行层对应，需要单独适配

## 四、一句话总结

网页预设 bot 模板 = 系统提示词（+ 隐藏的示例对话）。可见部分最接近 Mode C，效果好的模板实质是 Mode B。无法一键导入任何 MoA 系统，但提示词文本可手动迁移，迁移后正好落入我们现有的 A/B/C 加载体系。
