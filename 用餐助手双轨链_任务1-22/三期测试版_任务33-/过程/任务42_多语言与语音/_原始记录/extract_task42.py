#!/usr/bin/env python3
"""任务42抽取器v2：行锚定切分（模型未用代码块围栏，直出FILE标注行）；尾部'- '改动点列表剥离。"""
import re, os, json, hashlib

REPLY = "/tmp/k2p6_task42_reply.txt"
OUT = "/root/Selfaware_claw/用餐助手双轨链_任务1-22/三期测试版_任务33-/过程/任务42_多语言与语音"

raw = open(REPLY, encoding="utf-8").read()
lines = raw.split("\n")

file_re = re.compile(r"^(?:// FILE: |<!-- FILE: |/\* FILE: )(\S+?)(?:\s*-->\s*|\s*\*/\s*)?$")
cycle_re = re.compile(r"^===== Cycle (\d+) \| outcome=(\w+) handoff=(\w+) =====$")

# 定位FILE行
markers = []
for i, ln in enumerate(lines):
    m = file_re.match(ln.strip())
    if m:
        markers.append((i, m.group(1)))

os.makedirs(OUT, exist_ok=True)
written = []
for k, (li, path) in enumerate(markers):
    end = markers[k + 1][0] if k + 1 < len(markers) else len(lines)
    seg = lines[li + 1:end]
    # 周期边界截断
    cut = len(seg)
    for j, s in enumerate(seg):
        if cycle_re.match(s):
            cut = j
            break
    seg = seg[:cut]
    # 尾部'- '改动点列表剥离：从末尾往前，剥离空行与'- '开头的行
    while seg and (not seg[-1].strip() or seg[-1].lstrip().startswith("- ")):
        seg.pop()
    content = "\n".join(seg).rstrip("\n") + "\n"
    dest = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        f.write(content)
    sha = hashlib.sha256(content.encode("utf-8")).hexdigest()
    written.append({"path": path, "bytes": len(content.encode("utf-8")), "sha": sha})
    print(f"[EXTRACT] {path} bytes={len(content.encode('utf-8'))} sha={sha[:12]} lines={len(seg)}")

with open("/tmp/task42_files.json", "w", encoding="utf-8") as f:
    json.dump(written, f, ensure_ascii=False, indent=1)
print(f"[DONE] {len(written)} files -> {OUT}")
