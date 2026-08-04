<script setup>
defineProps({
  title: { type: String, default: '' },
  showBack: { type: Boolean, default: true },
  backAction: { type: Function, default: null }, // 自定义返回动作（默认 router.back()）
  rightText: { type: String, default: '' },
  rightLink: { type: String, default: '' },
})
</script>

<template>
  <div class="flex items-center gap-3 mb-4">
    <button v-if="showBack" @click="backAction ? backAction() : $router.back()" class="text-gray-400 hover:text-gray-600 transition text-xl leading-none">
      ‹
    </button>
    <h1 class="text-lg font-bold text-gray-800">{{ title }}</h1>
    <router-link v-if="rightLink" :to="rightLink" class="ml-auto text-gray-400 hover:text-gray-600 transition text-xl">
      {{ rightText }}
    </router-link>
  </div>
</template>
