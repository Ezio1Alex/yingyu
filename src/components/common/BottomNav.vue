<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { path: '/home', icon: '🏠', label: '首页' },
  { path: '/stats', icon: '📊', label: '统计' },
  { path: '/words', icon: '📖', label: '词库' },
]
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-3 max-w-lg mx-auto z-10">
    <div class="flex justify-around">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        :class="route.path === tab.path ? 'text-indigo-500' : 'text-gray-400 hover:text-gray-600'"
        class="flex flex-col items-center transition"
      >
        <span class="text-xl">{{ tab.icon }}</span>
        <span class="text-xs mt-0.5">{{ tab.label }}</span>
      </router-link>
    </div>
  </div>
</template>
