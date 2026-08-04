<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { useAppStore } from '../stores/appStore'
import { useBankStore } from '../stores/bankStore'
import { api } from '../api/client'
import { useToast } from '../utils/toast'
import AppHeader from '../components/common/AppHeader.vue'
import CardLearn from '../components/learn/CardLearn.vue'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const bankStore = useBankStore()
const { show: toast } = useToast()

const words = ref([])
const currentIndex = ref(0)
const loading = ref(true)
const done = ref(false)
const dailyGoalMet = ref(false) // 今日已达目标（非词库学完）
let batchIds = [] // 待批量提交的新词 id

const currentWord = computed(() => words.value[currentIndex.value] || {})

async function flushLearned() {
  if (!batchIds.length) return
  const ids = [...batchIds]
  try {
    await api.submitLearnBatch({ user_id: store.user.id, word_ids: ids })
    // 成功才移除；失败保留，下个触发点自动重试（后端会跳过已学过的词，重试安全）
    batchIds.splice(0, ids.length)
    bankStore.markLearned(ids)
  } catch {}
}

// Fisher-Yates 洗牌（本地随机挑词用）
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 离开学新词页时先把缓存提交，避免中途退出丢进度
onBeforeRouteLeave(async () => {
  await flushLearned()
})

onMounted(async () => {
  const uid = store.user?.id
  if (!uid) { router.push('/'); return }
  const dailyGoal = store.user?.words_per_day || 20

  // 优先用首页路由带来的 todayNew，避免重复调 /home（达标时即可 0 查询）
  const passedTodayNew = route.state?.todayNew
  let remaining
  if (typeof passedTodayNew === 'number') {
    remaining = Math.max(0, dailyGoal - passedTodayNew)
  } else {
    try {
      const home = await api.getHome(uid)
      remaining = Math.max(0, dailyGoal - (home.stats?.todayNew || 0))
    } catch (e) {
      toast('获取学习进度失败: ' + e.message, 'error')
      loading.value = false
      return
    }
  }

  if (remaining === 0) {
    dailyGoalMet.value = true
    done.value = true
    loading.value = false
    return
  }

  try {
    const count = Math.min(remaining, dailyGoal)
    // 优先用 bankStore 本地词库挑未学词（免一次全表扫描），失败回退后端 getNewWords
    try {
      const bankId = store.user?.bank_id || 2
      const all = await bankStore.load(uid, bankId)
      const fresh = all.filter(w => w.status === 'new')
      if (fresh.length === 0) {
        words.value = []
        done.value = true
      } else {
        words.value = shuffle([...fresh]).slice(0, count)
      }
    } catch {
      const data = await api.getNewWords(uid, count)
      words.value = data.words || []
      if (words.value.length === 0) done.value = true
    }
  } catch (e) {
    toast('获取新词失败: ' + e.message, 'error')
  } finally {
    loading.value = false
  }
})

async function next() {
  const w = words.value[currentIndex.value]
  batchIds.push(w.id)

  if (currentIndex.value < words.value.length - 1) {
    currentIndex.value++
    // 每 10 词提交一次，避免中途退出丢进度
    if (batchIds.length >= 10) await flushLearned()
  } else {
    done.value = true
    await flushLearned()
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto flex flex-col">
    <AppHeader title="📖 学新词" />
    <div v-if="currentIndex > 0 || (done && words.length > 0)" class="text-sm text-gray-400 text-right -mt-3 mb-2">
      {{ Math.min(currentIndex + 1, words.length) }}/{{ words.length }}
    </div>

    <!-- 已完成 -->
    <div v-if="done || loading" class="flex-1 flex items-center justify-center">
      <div v-if="loading" class="text-gray-400">加载中...</div>
      <div v-else class="text-center">
        <div class="text-5xl mb-4">✅</div>
        <div v-if="words.length > 0">
          <div class="text-xl font-bold text-gray-800 mb-2">今日新学完成！</div>
          <p class="text-gray-400 text-sm mb-6">已学 {{ words.length }} 个新词，明天将自动进入复习</p>
          <div class="flex gap-3 justify-center">
            <router-link to="/review/new" class="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition">
              🧠 立即回顾
            </router-link>
            <router-link to="/review" class="px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition">
              🔄 去复习
            </router-link>
            <router-link to="/home" class="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition">
              返回首页
            </router-link>
          </div>
        </div>
        <div v-else-if="dailyGoalMet">
          <div class="text-xl font-bold text-gray-800 mb-2">今日新学已完成 📖</div>
          <p class="text-gray-400 text-sm mb-6">今日目标已达成，明天继续！</p>
          <div class="flex gap-3 justify-center">
            <router-link to="/review" class="px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition">
              🔄 去复习
            </router-link>
            <router-link to="/home" class="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition">
              返回首页
            </router-link>
          </div>
        </div>
        <div v-else>
          <div class="text-xl font-bold text-gray-800 mb-2">🎉 词库已完成！</div>
          <p class="text-gray-400 text-sm mb-6">所有词汇都已学过，进入复习巩固吧</p>
          <router-link to="/home" class="inline-block px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition">
            返回首页
          </router-link>
        </div>
      </div>
    </div>

    <!-- 学习卡片 -->
    <CardLearn
      v-else
      :word="currentWord"
      :index="currentIndex"
      :total="words.length"
      @next="next"
    />
  </div>
</template>
