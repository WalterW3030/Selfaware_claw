# T1_v4 脚本A补丁（kimi出具，v4.2为基座）

日期：2026-09-09 | 适用：T1_v4_执行器.py v4.2 | 共4处编辑，均为整段替换，禁止自由发挥

---

## 编辑1：Union导入归位（修v4.2导入回归）

**删除**这两行（顶部导入区）：
```python
from typing import List, Dict, Optional, Tuple
```
**替换为**：
```python
from typing import List, Dict, Optional, Tuple, Union
```

**整段删除**"类型补全"块（parse_question_list之后那四行）：
```python
# ---------------------------------------------------------------------------
# 类型补全：Python <3.10 无 Union 内建
import typing
if not hasattr(typing, 'Union'):
    pass  # 已用 from typing import ...
from typing import Union
```

## 编辑2：_inject_cli 整段替换

```python
    def _inject_cli(self, question_id: str, question_text: str) -> Dict:
        """CLI注入：注入前记录行数，注入后仅在新行内定位该题user消息取锚"""
        import subprocess

        pre_line_count = 0
        if os.path.exists(self.session_jsonl):
            with open(self.session_jsonl, 'r', encoding='utf-8') as f:
                pre_line_count = sum(1 for _ in f)

        try:
            result = subprocess.run(
                ["openclaw", "sessions", "send", "--message", question_text],
                capture_output=True, text=True, timeout=10
            )
        except Exception as e:
            return {"status": "failed", "method": "openclaw-cli", "error": str(e),
                    "question_id": question_id, "pre_line_count": pre_line_count}

        if result.returncode != 0:
            return {"status": "failed", "method": "openclaw-cli",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "question_id": question_id,
                    "cli_output": result.stdout, "cli_error": result.stderr,
                    "injected_msgId": None, "pre_line_count": pre_line_count}

        injected_msgId = None
        keyword = question_text[:30] if len(question_text) > 30 else question_text
        try:
            with open(self.session_jsonl, 'r', encoding='utf-8') as f:
                for i, line in enumerate(f, start=1):
                    if i <= pre_line_count:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    msg = entry.get('message', {})
                    if msg.get('role') == 'user':
                        content = msg.get('content', '')
                        if isinstance(content, list):
                            text = ''.join(c.get('text', '') for c in content if isinstance(c, dict))
                        else:
                            text = str(content)
                        if keyword in text:
                            injected_msgId = entry.get('id')
                            break
        except Exception:
            pass

        return {"status": "injected", "method": "openclaw-cli",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "question_id": question_id,
                "cli_output": result.stdout, "cli_error": result.stderr,
                "injected_msgId": injected_msgId, "pre_line_count": pre_line_count}
```

## 编辑3：extract 签名与阶段0整段替换

**签名替换为**：
```python
    def extract(self, question_id: str, question_text: str,
                injected_msgId: Optional[str] = None,
                poll_interval: float = POLL_INTERVAL_SECONDS,
                poll_timeout: float = POLL_TIMEOUT_SECONDS,
                search_after_line: int = 0) -> Dict:
```

**阶段0整段替换为**（其后的轮询循环保持v4.2原样不动）：
```python
        # 阶段0：确定起始行
        start_line = None
        if injected_msgId:
            with open(self.session_jsonl, 'r', encoding='utf-8') as f:
                for i, line in enumerate(f, start=1):
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if entry.get('id') == injected_msgId:
                        start_line = i
                        break
            if not start_line:
                return {"error": "ANCHOR_NOT_FOUND",
                        "message": f"注入msgId {injected_msgId} 在session中未找到"}
        else:
            # 退化搜索：仅在 search_after_line 之后的新行内按题干关键词匹配user消息
            keyword = question_text[:30] if len(question_text) > 30 else question_text
            with open(self.session_jsonl, 'r', encoding='utf-8') as f:
                for i, line in enumerate(f, start=1):
                    if i <= search_after_line:
                        continue
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    msg = entry.get('message', {})
                    if msg.get('role') == 'user':
                        content = msg.get('content', '')
                        if isinstance(content, list):
                            text = ''.join(c.get('text', '') for c in content if isinstance(c, dict))
                        else:
                            text = str(content)
                        if keyword in text:
                            start_line = i
                            injected_msgId = entry.get('id')
                            break
            if not start_line:
                return {"error": "TEXT_SEARCH_FAILED",
                        "message": f"search_after_line={search_after_line}之后未找到含关键词'{keyword[:20]}...'的user消息"}
```

注意：阶段0失败路径返回的error字典里不含poll字段，_execute_question的STRUCTURE_ERROR分支按`window["error"]`取键，兼容。

## 编辑4：_execute_question 真实模式调用行替换

**删除**：
```python
        window = self.extractor.extract(qid, qtext, injected_msgId=injected_msgId)
```
**替换为**：
```python
        window = self.extractor.extract(
            qid, qtext,
            injected_msgId=injected_msgId,
            search_after_line=inject_result.get("pre_line_count", 0)
        )
```

---

## 补丁要点（防再犯）
- 退化搜索范围限定为注入后新行（search_after_line之后），不扫历史——排除压缩摘要/历史同文误配（第三轮L169实鉴）
- 锚定失败显式报错（ANCHOR_NOT_FOUND / TEXT_SEARCH_FAILED），任何路径都不允许无锚从第0行扫描
- v4.2其余改进（api实装、direct禁用、节流、mock标注）保留不动
