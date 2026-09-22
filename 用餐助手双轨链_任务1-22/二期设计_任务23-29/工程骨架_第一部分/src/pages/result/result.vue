<template>
  <view class="page">
    <text class="page-title">{{ pageTitle }}</text>

    <!-- 结构化结果:识别候选 + 置信度角标 -->
    <view class="candidate">
      <text class="dish-name">识别候选</text>
      <text class="confidence-tag">置信度角标</text>
    </view>

    <!-- 确认门禁:未经确认不入库(v3 2.1 / AGENTS 业务红线) -->
    <view class="actions">
      <button @click="goConfirm">确认</button>
      <button>纠正</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const pageTitle = '识别结果'
const mode = ref('')

onLoad((options) => {
  mode.value = options.mode || 'recognize'
})

const goConfirm = () => {
  uni.navigateTo({ url: '/pages/history/history' })
}
</script>

<style></style>
