<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
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
const showTyping = ref(false)
const isRated = ref(false)
const stats = ref({ total: 0, correct: 0, typingDone: 0 })

const currentWord = computed(() => words.value[currentIndex.value] || {})

onMounted(async () => {
  const uid = store.user?.id
  if (!uid) { router.push('/'); return }
  try {
    const data = await api.getTodayNew(uid)
    words.value = data.words || []
    if (words.value.length === 0) done.value = true
  } catch (e) { toast('获取今日新学失败: ' + e.message, 'error')
  } finally { loading.value = false }
})

// 纯本地练习：评分/拼写都不提交，不影响算法
function handleRate(score) {
  if (isRated.value) return
  isRated.value = true; stats.value.total++
  if (score >= 3) stats.value.correct++
  if (chance(DEFAULTS.TYPING_CHANCE)) { showTyping.value = true }
  else { nextWord() }
}

function handleTypingSubmit() {
  stats.value.typingDone++
}

function nextWord() {
  showTyping.value = false; isRated.value = false
  if (currentIndex.value < words.value.length - 1) { currentIndex.value++ }
  else { done.value = true }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto flex flex-col">
    <AppHeader title="📖 今日新学回顾" />
    <div v-if="words.length > 0 && !loading" class="text-sm text-gray-400 text-right -mt-3 mb-1">
      {{ currentIndex + 1 }}/{{ words.length }}
    </div>
    <p class="text-xs text-gray-400 -mt-2 mb-2">练习不评分、不影响记忆算法</p>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">加载中...</div>

    <div v-else-if="done" class="flex-1 flex items-center justify-center">
      <div class="text-center max-w-xs">
        <div class="text-5xl mb-4">🎉</div>
        <div class="text-xl font-bold text-gray-800 mb-3">
          {{ words.length > 0 ? '今日新学回顾完成！' : '今天还没有学新词' }}
        </div>
        <p v-if="words.length > 0" class="text-gray-500 mb-1">
          共回顾 {{ words.length }} 词 · 正确率 {{ stats.total > 0 ? Math.round(stats.correct/stats.total*100) : 0 }}%
        </p>
        <p class="text-gray-400 text-sm mb-5">拼写强化 {{ stats.typingDone }} 词 · 明天这些词将进入正式复习</p>

        <div class="space-y-2">
          <router-link to="/learn"
            class="block w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition text-center"
          >📖 再学几个新词</router-link>
          <div class="flex gap-2">
            <router-link to="/review"
              class="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition text-sm text-center"
            >🔄 正式复习</router-link>
            <router-link to="/home"
              class="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition text-sm text-center"
            >🏠 首页</router-link>
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <CardRecall v-if="!showTyping" :word="currentWord"
        :key="'n'+currentWord.id" @rate="handleRate" />
      <CardTyping v-else :word="currentWord"
        :key="'nt'+currentWord.id"
        @submit="handleTypingSubmit" @skip="nextWord" />
    </template>
  </div>
</template>
