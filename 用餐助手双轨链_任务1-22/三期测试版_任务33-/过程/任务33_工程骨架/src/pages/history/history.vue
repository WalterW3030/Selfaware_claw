<template>
  <view class="page">
    <text class="page-title">{{ pageTitle }}</text>

    <view v-if="records.length === 0" class="empty">
      <text>暂无记录</text>
    </view>
    <view v-else class="list">
      <view v-for="item in records" :key="item.id">{{ item.dish }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const pageTitle = '历史记录'
const records = ref([])
</script>

<style></style>
