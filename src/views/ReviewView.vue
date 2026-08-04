<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { useAppStore } from '../stores/appStore'
import { api } from '../api/client'
import { useToast } from '../utils/toast'
import { chance } from '../utils/format'
import { DEFAULTS } from '../utils/constants'
import AppHeader from '../components/common/AppHeader.vue'
import CardRecall from '../components/review/CardRecall.vue'
import CardTyping from '../components/review/CardTyping.vue'

const router = useRouter()
const store = useAppStore()
const { show: toast } = useToast()

const words = ref([])
const currentIndex = ref(0)
const loading = ref(true)
const done = ref(false)
const emptyRound = ref(false) // 进入时没有待复习词

const currentWord = computed(() => words.value[currentIndex.value] || {})

const round = ref(1)
const stats = ref({ typingDone: 0, roundsCompleted: 0 })
const roundTotal = ref(0)   // 本轮评分数
const roundCorrect = ref(0) // 本轮答对数
const showTyping = ref(false)
const isRated = ref(false)

// 批量提交缓冲
let pendingRatings = []
let pendingTypings = []

async function flushPending() {
  if (!pendingRatings.length && !pendingTypings.length) return
  const ratings = [...pendingRatings]
  const typings = [...pendingTypings]
  try {
    await api.submitReviewBatch({ user_id: store.user.id, items: ratings, typings })
    // 成功才移除已提交的；失败保留，下一个触发点自动重试
    pendingRatings.splice(0, ratings.length)
    pendingTypings.splice(0, typings.length)
  } catch { /* 后端幂等，重试安全 */ }
}

// 离开复习页时先把缓存的评分提交，避免中途退出丢进度
onBeforeRouteLeave(async () => {
  await flushPending()
})

onMounted(async () => { await loadRound() })

async function loadRound() {
  const uid = store.user?.id
  if (!uid) { router.push('/'); return }
  loading.value = true; done.value = false
  currentIndex.value = 0; showTyping.value = false; isRated.value = false
  roundTotal.value = 0; roundCorrect.value = 0; emptyRound.value = false
  try {
    if (round.value === 1) {
      const data = await api.getToday(uid, 1)
      words.value = data.words || []
    } else {
      // 二轮起：复用首轮列表本地乱序，不再请求后端
      shuffle(words.value)
    }
    if (words.value.length === 0) { emptyRound.value = true; done.value = true }
  } catch (e) { toast('获取复习列表失败: ' + e.message, 'error')
  } finally { loading.value = false }
}

// Fisher-Yates 洗牌
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function handleRate(score) {
  if (isRated.value) return
  isRated.value = true
  roundTotal.value++
  if (score >= 3) roundCorrect.value++
  // 只有首轮评分提交后端；二轮起纯本地练习，不写任何数据
  if (round.value === 1) {
    pendingRatings.push({ word_id: currentWord.value.id, score })
    // 每 20 词提交一次，防中途关闭丢进度
    if (pendingRatings.length >= 20) flushPending()
  }
  if (chance(DEFAULTS.TYPING_CHANCE)) { showTyping.value = true }
  else { nextWord() }
}

function handleTypingSubmit(correct) {
  stats.value.typingDone++
  // 拼写结果同样只在首轮提交
  if (round.value === 1) {
    pendingTypings.push({ word_id: currentWord.value.id, correct })
  }
}

function nextWord() {
  showTyping.value = false; isRated.value = false
  if (currentIndex.value < words.value.length - 1) { currentIndex.value++ }
  else { done.value = true; flushPending() }
}

async function nextRound() {
  await flushPending()
  round.value++; stats.value.roundsCompleted++
  await loadRound()
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto flex flex-col">
    <AppHeader title="🔄 复习" />
    <div v-if="words.length > 0 && !loading" class="text-sm text-gray-400 text-right -mt-3 mb-1">
      第 {{ round }} 轮 · {{ currentIndex + 1 }}/{{ words.length }}
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">加载中...</div>

    <div v-else-if="done" class="flex-1 flex items-center justify-center">
      <!-- 今天没有待复习 -->
      <div v-if="emptyRound" class="text-center max-w-xs">
        <div class="text-5xl mb-4">✨</div>
        <div class="text-xl font-bold text-gray-800 mb-3">今天没有待复习的单词</div>
        <p class="text-gray-400 text-sm mb-6">明天到期的词会自动出现在这里，先去学点新词吧</p>
        <router-link to="/home"
          class="block w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition text-center"
        >🏠 返回首页</router-link>
      </div>

      <!-- 本轮完成 -->
      <div v-else class="text-center max-w-sm w-full">
        <div class="text-5xl mb-4">🎉</div>
        <div class="text-xl font-bold text-gray-800 mb-3">
          {{ stats.roundsCompleted > 0 ? `第 ${stats.roundsCompleted} 轮完成！` : '今日复习完成！' }}
        </div>
        <p class="text-gray-500 mb-1">
          本轮 {{ roundTotal }} 词 · 正确率 {{ roundTotal > 0 ? Math.round(roundCorrect/roundTotal*100) : 0 }}%
        </p>
        <p class="text-gray-400 text-sm mb-5">累计拼写强化 {{ stats.typingDone }} 词</p>

        <div class="space-y-2">
          <button @click="nextRound"
            class="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition active:scale-[0.98]"
          >🔄 再来一轮</button>
          <div class="flex gap-2">
            <router-link to="/review/complete"
              class="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition text-sm whitespace-nowrap"
            >📊 学习报告</router-link>
            <router-link to="/home"
              class="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition text-sm whitespace-nowrap"
            >🏠 首页</router-link>
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <CardRecall v-if="!showTyping" :word="currentWord"
        :key="'r'+round+'w'+currentWord.id" @rate="handleRate" />
      <CardTyping v-else :word="currentWord"
        :key="'t'+round+'w'+currentWord.id"
        @submit="handleTypingSubmit" @skip="nextWord" />
    </template>
  </div>
</template>
