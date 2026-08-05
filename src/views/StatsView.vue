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

const stats = ref({ mastered: 0, learning: 0, notStarted: 0, streak: 0, today: 0 })
// 一次拉取三周（本周/上周/上上周），切换纯本地，零额外请求
const weeks = ref([])
const currentIdx = ref(0)
const weekLabels = ['本周', '上周', '上上周']

const currentWeek = computed(() => weeks.value[currentIdx.value] || { weekData: [], weakWords: [] })
const weekData = computed(() => currentWeek.value.weekData)
const weakWords = computed(() => currentWeek.value.weakWords)

const maxCount = computed(() => Math.max(...weekData.value.map(x => x.count), 1))
const totalWeek = computed(() => weekData.value.reduce((s, d) => s + d.count, 0))
// 本周有学习的天数（打卡）
const weekActiveDays = computed(() => weekData.value.filter(d => d.count > 0).length)

// 统计页数据 localStorage 缓存（当天有效）：刷新/切回都立即渲染（柱状图不闪跳），后台静默刷新
const SUMMARY_CACHE_KEY = 'summary_cache_'
function todayStr() {
  const d = new Date()
  const utc8 = new Date(d.getTime() + 8 * 3600 * 1000)
  return utc8.toISOString().slice(0, 10)
}
function readSummaryCache(uid) {
  try {
    const raw = localStorage.getItem(SUMMARY_CACHE_KEY + uid)
    if (!raw) return null
    const c = JSON.parse(raw)
    return c.date === todayStr() ? c : null
  } catch { return null }
}
function writeSummaryCache(uid, data) {
  try { localStorage.setItem(SUMMARY_CACHE_KEY + uid, JSON.stringify({ date: todayStr(), ...data })) } catch {}
}

async function load() {
  const uid = store.user?.id
  if (!uid) { router.push('/'); return }
  // 先读本地缓存立即渲染，避免"等数据 → 柱状图闪现"
  const cached = readSummaryCache(uid)
  if (cached) {
    stats.value = cached.stats
    weeks.value = cached.weeks
  }
  try {
    const data = await api.getStatsSummary(uid)
    const val = { stats: data.stats || {}, weeks: data.weeks || [] }
    writeSummaryCache(uid, val)
    stats.value = val.stats
    weeks.value = val.weeks
  } catch {}
}

onMounted(() => { load() })
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
    <AppHeader title="📊 学习统计" :showBack="false" />

    <!-- 三栏概览 -->
    <div class="grid grid-cols-3 gap-3 mb-6">
      <ProgressCard :value="stats.mastered" label="已掌握" variant="success" />
      <ProgressCard :value="stats.learning" label="学习中" variant="warning" />
      <ProgressCard :value="stats.notStarted" label="未开始" variant="muted" />
    </div>

    <!-- 打卡 + 周趋势 -->
    <div class="bg-white rounded-xl p-5 shadow-sm mb-6">
      <!-- 周切换：纯前端切换，不请求 -->
      <div class="flex gap-2 mb-4">
        <button v-for="(label, i) in weekLabels" :key="label"
          @click="currentIdx = i"
          class="flex-1 py-1.5 rounded-lg text-sm font-medium transition active:scale-[0.98]"
          :class="currentIdx === i ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
        >{{ label }}</button>
      </div>

      <div class="flex justify-between items-center mb-1">
        <span class="font-medium text-gray-800">🔥 {{ weekLabels[currentIdx] }}打卡 <span class="text-amber-500">{{ weekActiveDays }}</span> 天</span>
        <span class="text-sm text-gray-400">今日 {{ stats.today }} 词</span>
      </div>
      <div class="text-xs text-gray-400 mb-4">本周共学 {{ totalWeek }} 词</div>

      <!-- 周趋势柱状图（容器常驻，数据未到显示骨架灰条，避免空→图突然出现） -->
      <div class="pt-4 border-t border-gray-100">
        <div class="text-sm text-gray-500 mb-4">📈 {{ weekLabels[currentIdx] }}趋势</div>
        <div class="flex items-end gap-2 h-28">
          <template v-if="weekData.length > 0">
            <div v-for="d in weekData" :key="d.date" class="flex-1 flex flex-col items-center gap-1">
              <!-- 数字标记 -->
              <div class="text-xs font-medium" :class="d.count > 0 ? 'text-indigo-600' : 'text-gray-300'">{{ d.count }}</div>
              <!-- 柱（今天加高亮圈） -->
              <div class="w-full rounded-t-md transition-all duration-200 flex items-end justify-center"
                :class="[d.count > 0 ? 'bg-indigo-500' : 'bg-indigo-100', d.isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : '']"
                :style="{ height: Math.max(4, (d.count / maxCount) * 80) + 'px' }"
              ></div>
              <div class="text-xs" :class="d.isToday ? 'text-indigo-600 font-medium' : 'text-gray-400'">{{ d.label }}</div>
            </div>
          </template>
          <template v-else>
            <div v-for="i in 7" :key="i" class="flex-1 h-10 bg-gray-100 rounded-t-md animate-pulse"></div>
          </template>
        </div>
      </div>
    </div>

    <!-- 当周薄弱词汇 -->
    <div class="bg-white rounded-xl p-5 shadow-sm mb-6">
      <h2 class="font-medium text-gray-800 mb-3">⚠️ {{ weekLabels[currentIdx] }}薄弱词汇</h2>
      <div v-if="weakWords.length === 0" class="text-sm text-gray-400 py-2">暂无薄弱词汇，继续保持！</div>
      <div v-else class="space-y-2">
        <div v-for="w in weakWords" :key="w.word"
          class="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0"
        >
          <span class="text-gray-700 font-medium">{{ w.word }}</span>
          <span class="text-red-400 text-xs">已错 {{ w.errors }} 次</span>
        </div>
      </div>
    </div>

    <BottomNav />
    <div class="h-16"></div>
  </div>
</template>
