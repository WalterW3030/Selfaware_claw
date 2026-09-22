<script>
export default {
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      // ENV_ID：Walter 填写（微信开发者工具 → 云开发 → 环境ID）
      env: '',
      traceUser: true
    })
  }
}
</script>

<style>
/* 全局样式：字号五档 + 适老化对比（对照 AGENTS.md 设计规范） */
page {
  --font-xl: 22pt;
  --font-lg: 17pt;
  --font-md: 15pt;
  --font-sm: 14pt;
  --font-xs: 12pt;
  --color-text: #1A1A1A;
  --color-bg: #F7F7F7;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-md);
}
</style>
