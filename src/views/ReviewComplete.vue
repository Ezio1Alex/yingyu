<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/appStore'
import { api } from '../api/client'

const router = useRouter()
const store = useAppStore()

const stats = ref({ mastered: 0, today: 0, todayNew: 0, streak: 0 })
const todayReviewed = computed(() => Math.max(0, (stats.value.today || 0) - (stats.value.todayNew || 0)))

onMounted(async () => {
  try {
    const s = await api.getStats(store.user?.id)
    stats.value = s
  } catch {}
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto flex items-center justify-center">
    <div class="text-center">
      <div class="text-5xl mb-4">🎉</div>
      <div class="text-xl font-bold text-gray-800 mb-2">今日学习完成！</div>
      <div class="text-gray-500 space-y-1 mb-6">
        <p>今日总计学习 <strong class="text-gray-800">{{ stats.today }}</strong> 词</p>
        <p>今日新学 <strong class="text-indigo-600">{{ stats.todayNew || 0 }}</strong> 词 · 今日复习 <strong class="text-emerald-600">{{ todayReviewed }}</strong> 词</p>
        <p>已学词汇 <strong class="text-gray-800">{{ (stats.mastered || 0) + (stats.learning || 0) }}</strong> 词</p>
        <p>已掌握 <strong class="text-emerald-600">{{ stats.mastered }}</strong> 词（连续答对 4 次以上）</p>
        <p>连续打卡 <strong class="text-amber-500">🔥 {{ stats.streak }}</strong> 天</p>
      </div>
      <div class="flex gap-3 justify-center">
        <router-link to="/stats" class="px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition">
          📊 查看统计
        </router-link>
        <router-link to="/home" class="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition">
          🏠 返回首页
        </router-link>
      </div>
    </div>
  </div>
</template>
