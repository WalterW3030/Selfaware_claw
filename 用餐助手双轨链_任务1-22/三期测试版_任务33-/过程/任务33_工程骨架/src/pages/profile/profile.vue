<template>
  <view class="page">
    <text class="page-title">{{ pageTitle }}</text>

    <view class="section body-data">
      <text class="section-title">身体数据</text>
      <input placeholder="身高 (cm)" />
      <input placeholder="体重 (kg)" />
      <input placeholder="过敏原" />
      <input placeholder="饮食目标" />
    </view>

    <view class="section auth">
      <text class="section-title">授权管理</text>
      <button @click="goAuth">隐私与授权</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const pageTitle = '我的'
const bodyData = ref({
  height: '',
  weight: '',
  allergens: '',
  goal: ''
})

const goAuth = () => {
  // 逐项分层授权入口(见 v3 四章),具体措辞待 H6 确认
  uni.showToast({ title: '授权管理', icon: 'none' })
}
</script>

<style></style>
