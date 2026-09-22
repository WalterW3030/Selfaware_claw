<template>
  <view class="page">
    <text class="page-title">{{ pageTitle }}</text>

    <!-- 视觉重点:拍照入口 -->
    <view class="primary-action">
      <button @click="handleCapture">拍照识别</button>
    </view>

    <!-- 三预设模板入口 -->
    <view class="templates">
      <button @click="goResult('recognize')">识图</button>
      <button @click="goResult('copy')">文案</button>
      <button @click="goResult('nutrition')">营养分析</button>
    </view>

    <!-- 自由提问入口,退居二线 -->
    <view class="chat-entry">
      <text @click="goResult('chat')">自由提问</text>
    </view>
  </view>
</template>

<script setup>
const pageTitle = '食知'

// 拍照 → 上传云存储 → 待接 aiGateway recognize 模式(T2)
const handleCapture = () => {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera', 'album'],
    success: (res) => {
      const filePath = res.tempFilePaths[0]
      wx.cloud.uploadFile({
        cloudPath: `recognize/${Date.now()}.jpg`,
        filePath,
        success: () => {
          uni.navigateTo({ url: '/pages/result/result?mode=recognize' })
        },
        fail: (err) => {
          console.error('上传云存储失败', err)
        }
      })
    }
  })
}

const goResult = (mode) => {
  uni.navigateTo({ url: `/pages/result/result?mode=${mode}` })
}
</script>

<style></style>
