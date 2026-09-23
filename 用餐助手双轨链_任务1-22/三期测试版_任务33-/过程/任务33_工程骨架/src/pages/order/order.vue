<template>
  <view class="page">
    <text class="page-title">{{ pageTitle }}</text>

    <!-- 顶部双模式选择器,默认快速 -->
    <view class="mode-switch">
      <button :class="{ active: mode === 'fast' }" @click="mode = 'fast'">快速</button>
      <button :class="{ active: mode === 'deep' }" @click="mode = 'deep'">深度</button>
    </view>

    <!-- 菜单拍照入口 -->
    <view class="menu-capture">
      <button @click="handleMenuCapture">拍菜单</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const pageTitle = '点餐助手'
const mode = ref('fast')

// 拍菜单 → 上传云存储 → 待接 aiGateway order_fast / order_deep(T2/T8)
const handleMenuCapture = () => {
  uni.chooseImage({
    count: 1,
    sourceType: ['camera', 'album'],
    success: (res) => {
      const filePath = res.tempFilePaths[0]
      wx.cloud.uploadFile({
        cloudPath: `order/${Date.now()}.jpg`,
        filePath,
        success: () => {
          console.log('菜单已上传, 当前模式:', mode.value)
        },
        fail: (err) => {
          console.error('菜单上传失败', err)
        }
      })
    }
  })
}
</script>

<style></style>
