<script setup>
defineProps({
  value: { type: [Number, String], default: 0 },
  label: { type: String, default: '' },
  detail: { type: String, default: '' }, // 可选：数字下方的小字明细
  variant: { type: String, default: 'primary' }, // primary | success | warning | muted
  size: { type: String, default: 'md' }, // md | sm（sm 用于含 emoji 的较长文案，避免窄卡片溢出）
})
</script>

<template>
  <div class="bg-white rounded-xl p-4 text-center shadow-sm">
    <div
      class="font-bold whitespace-nowrap"
      :class="[
        size === 'sm' ? 'text-lg' : 'text-2xl',
        variant === 'primary' ? 'text-indigo-600'
          : variant === 'success' ? 'text-emerald-600'
          : variant === 'warning' ? 'text-amber-500' : 'text-gray-400',
      ]"
    >{{ value }}</div>
    <div class="text-xs text-gray-400 mt-1">{{ label }}</div>
    <div v-if="detail" class="text-[10px] text-gray-400 mt-0.5">{{ detail }}</div>
  </div>
</template>
