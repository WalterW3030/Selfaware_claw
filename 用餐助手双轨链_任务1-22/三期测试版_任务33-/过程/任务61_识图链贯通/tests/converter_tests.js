process.env.NODE_PATH = '/tmp/task61test/node_modules'
require('module').Module._initPaths()
const GW = '/root/Selfaware_claw/用餐助手双轨链_任务1-22/三期测试版_任务33-/过程/任务52_配置外置/cloudfunctions/aiGateway/index.js'
const main = require(GW).main
const CLOUD_URL = 'cloud://env123.636c-env123-1300000000/recognize/a.jpg'
const mk = (content) => [{ role: 'user', content }]
const EVENTS = {
  success:     { mode: 'recognize', messages: mk([{ type: 'text', text: '看图' }, { type: 'image_url', image_url: { url: CLOUD_URL } }]) },
  dlfail:      { mode: 'recognize', messages: mk([{ type: 'image_url', image_url: { url: CLOUD_URL } }]) },
  oversize:    { mode: 'recognize', messages: mk([{ type: 'image_url', image_url: { url: CLOUD_URL } }]) },
  passthrough: { mode: 'recognize', messages: mk([{ type: 'image_url', image_url: { url: 'https://example.com/p.jpg' } }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }]) },
  badscheme:   { mode: 'recognize', messages: mk([{ type: 'image_url', image_url: { url: 'ftp://x/y.jpg' } }]) },
  nourl:       { mode: 'recognize', messages: mk([{ type: 'image_url', image_url: {} }]) },
  textonly:    { mode: 'recognize', messages: [{ role: 'user', content: '纯文本串' }] }
}
function setDl(mode) { global.__DL_MODE = mode }
const results = []
;(async () => {
  for (const [c, event] of Object.entries(EVENTS)) {
    delete global.__captured
    if (c === 'oversize') setDl('big'); else if (c === 'dlfail') setDl('fail'); else setDl('ok')
    try {
      const res = await main(JSON.parse(JSON.stringify(event)))
      results.push({ case: c, mainReturned: res, captured: global.__captured || null })
    } catch (e) {
      results.push({ case: c, threw: String((e && e.message) || e) })
    }
  }
  console.log(JSON.stringify(results))
})().catch(e => { console.error('FATAL', (e && e.stack) || e); process.exit(1) })
