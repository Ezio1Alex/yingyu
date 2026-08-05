<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/appStore'
import { api } from '../api/client'
import AppHeader from '../components/common/AppHeader.vue'
import BottomNav from '../components/common/BottomNav.vue'
import ProgressCard from '../components/common/ProgressCard.vue'

const router = useRouter()
const store = useAppStore()

const stats = ref({ mastered: 0, today: 0, streak: 0, todayNew: 0 })
const reviewCount = ref(0)
const bankHasMore = ref(true) // 词库是否还有未学的词

// 今日学习 = 新学 + 复习 的明细
const todayDetail = computed(() => {
  const reviewed = Math.max(0, stats.value.today - stats.value.todayNew)
  return `新学 ${stats.value.todayNew} · 复习 ${reviewed}`
})

const dailyGoal = computed(() => store.user?.words_per_day || 20)
const remainingNew = computed(() => {
  const n = dailyGoal.value - stats.value.todayNew
  return Math.max(0, n)
})
const newWordsDone = computed(() => remainingNew.value === 0 || !bankHasMore.value)

// 首页当天缓存：SPA 内切回秒开（先用缓存渲染，后台静默刷新），避免"今日新学回顾"等框闪跳
let homeCache = { uid: null, date: '', stats: null, reviewCount: 0, bankHasMore: true }
function todayStr() {
  const d = new Date()
  const utc8 = new Date(d.getTime() + 8 * 3600 * 1000)
  return utc8.toISOString().slice(0, 10)
}

async function loadHome(useCache) {
  const uid = store.user?.id
  if (!uid) { router.push('/'); return }
  const today = todayStr()
  const hit = useCache && homeCache.uid === uid && homeCache.date === today && homeCache.stats
  if (hit) {
    // 先用缓存渲染（含今日新学回顾框），再后台静默刷新
    stats.value = homeCache.stats
    reviewCount.value = homeCache.reviewCount
    bankHasMore.value = homeCache.bankHasMore
  }
  try {
    const data = await api.getHome(uid)
    homeCache = { uid, date: today, stats: data.stats || {}, reviewCount: data.dueToday || 0, bankHasMore: (data.remainingNew ?? 0) > 0 }
    stats.value = homeCache.stats
    reviewCount.value = homeCache.reviewCount
    bankHasMore.value = homeCache.bankHasMore
  } catch {}
}

onMounted(() => { loadHome(true) })
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-xl font-bold text-gray-800">📚 今日学习</h1>
        <p class="text-sm text-gray-400">{{ store.user?.name }} · {{ store.user?.grade }}</p>
      </div>
      <router-link to="/settings" class="text-2xl text-gray-400 hover:text-gray-600 transition">⚙️</router-link>
    </div>

    <!-- 概览卡片 -->
    <div class="grid grid-cols-3 gap-3 mb-6">
      <ProgressCard :value="stats.mastered" label="总掌握" variant="primary" />
      <ProgressCard :value="stats.today" label="今日学习" :detail="todayDetail" variant="success" />
      <ProgressCard :value="`🔥 ${stats.streak}`" label="连续打卡" variant="warning" size="sm" />
    </div>

    <!-- 学新词 -->
    <router-link
      :to="{ path: '/learn', state: { todayNew: stats.todayNew } }"
      class="block bg-white rounded-xl p-5 shadow-sm mb-4 hover:shadow-md transition border border-gray-100"
    >
      <div class="flex items-center gap-4">
        <span class="text-3xl">📖</span>
        <div class="flex-1">
          <div class="font-medium text-gray-800">学新词</div>
          <div class="text-sm" :class="newWordsDone ? 'text-gray-300' : 'text-gray-400'">
            <template v-if="!bankHasMore">词库已完成 ✅</template>
            <template v-else-if="remainingNew > 0">今日可学 {{ remainingNew }} 个新词（目标 {{ dailyGoal }}）</template>
            <template v-else>今日新学已完成 ✅</template>
          </div>
        </div>
        <span class="text-gray-300 text-xl">›</span>
      </div>
    </router-link>

    <!-- 今日新学回顾（今天学了词才显示，纯本地练习不影响算法） -->
    <router-link
      v-if="stats.todayNew > 0"
      to="/review/new"
      class="block bg-white rounded-xl p-5 shadow-sm mb-4 hover:shadow-md transition border border-gray-100"
    >
      <div class="flex items-center gap-4">
        <span class="text-3xl">🧠</span>
        <div class="flex-1">
          <div class="font-medium text-gray-800">今日新学回顾</div>
          <div class="text-sm text-gray-400">今天学了 {{ stats.todayNew }} 个新词 · 点此回顾巩固</div>
        </div>
        <span class="text-gray-300 text-xl">›</span>
      </div>
    </router-link>

    <!-- 复习 -->
    <router-link
      to="/review"
      class="block bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition border border-gray-100"
    >
      <div class="flex items-center gap-4">
        <span class="text-3xl">🔄</span>
        <div class="flex-1">
          <div class="font-medium text-gray-800">复习</div>
          <div class="text-sm text-gray-400">
            {{ reviewCount > 0 ? `今日 ${reviewCount} 词待复习` : '暂无待复习词汇 ✨' }}
          </div>
        </div>
        <span class="text-gray-300 text-xl">›</span>
      </div>
    </router-link>

    <BottomNav />
    <div class="h-16"></div>
  </div>
</template>
