# 任务61测试复现说明

converter_tests.js = 网关 cloud://→base64 转换器单测（7 用例）。

## 运行方式

本目录下建立桩目录（模拟 wx-server-sdk）：

```
tests/
  converter_tests.js          # 主测（require 任务52树 aiGateway/index.js）
  wx-server-sdk_stub.js       # SDK 桩（downloadFile/generateText 行为可控）
```

将桩放到 NODE_PATH 可见位置后运行：

```bash
mkdir -p /tmp/task61test/node_modules/wx-server-sdk
cp tests/wx-server-sdk_stub.js /tmp/task61test/node_modules/wx-server-sdk/index.js
node tests/converter_tests.js
```

（converter_tests.js 内已硬编码 NODE_PATH=/tmp/task61test/node_modules）

## 用例与断言口径

| 用例 | 输入 | 期望 |
|---|---|---|
| success | cloud:// 图址 + 文本块 | generateText 收到 data:image/jpeg;base64, 前缀 URL，文本块不动 |
| dlfail | 下载抛错（桩） | error=upstream_error，detail 含 fileID 与 errMsg |
| oversize | 桩返回 5MB+1 字节 | error=upstream_error，detail 含实际/上限字节 |
| passthrough | https 直链 + data: URL | 两 URL 原样注入，零改动 |
| badscheme | ftp:// | error=upstream_error，detail 含不受理形态 |
| nourl | image_url 无 url | error=upstream_error，R5 显式报缺 |
| textonly | 纯文本串 content | 字符串 content 不动（回归） |

## 诚实声明

downloadFile/generateText 均为**本地桩**，非真实云端调用。
云端实测步骤见 运行证据_任务61.md §实测交接（须 Walter 在云端执行）。
