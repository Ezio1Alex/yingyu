<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '../stores/appStore'
import { useBankStore } from '../stores/bankStore'
import { api } from '../api/client'
import { useToast } from '../utils/toast'
import AppHeader from '../components/common/AppHeader.vue'
import BottomNav from '../components/common/BottomNav.vue'
import WordDetailModal from '../components/learn/WordDetailModal.vue'

const store = useAppStore()
const bankStore = useBankStore()
const { show: toast } = useToast()

const allWords = ref([])
const searchInput = ref('')
const filter = ref('')
const loading = ref(true)
const visible = ref(100) // 本地增量渲染，避免一次渲染上千个 DOM

const detailWord = ref(null)
const showDetail = ref(false)

// 本地筛选：状态 tab + 搜索词
const filteredWords = computed(() => {
  const q = searchInput.value.trim().toLowerCase()
  return allWords.value.filter(w => {
    if (filter.value === 'new' && w.status !== 'new') return false
    if (filter.value === 'learning' && w.status !== 'learning') return false
    if (filter.value === 'mastered' && w.status !== 'mastered') return false
    if (filter.value === 'bookmarked' && !w.bookmarked) return false
    if (q && !w.word.toLowerCase().includes(q)) return false
    return true
  })
})

const shownWords = computed(() => filteredWords.value.slice(0, visible.value))

function switchFilter(f) {
  filter.value = f
  visible.value = 100
}

function onSearch() {
  visible.value = 100
}

function clearSearch() {
  searchInput.value = ''
  visible.value = 100
}

function loadMore() {
  visible.value += 100
}

async function toggleBookmark(word) {
  try {
    if (word.bookmarked) {
      await api.removeBookmark({ user_id: store.user.id, word_id: word.id })
      bankStore.setBookmarked(word.id, false)
    } else {
      await api.addBookmark({ user_id: store.user.id, word_id: word.id })
      bankStore.setBookmarked(word.id, true)
    }
  } catch (e) { toast('操作失败: ' + e.message, 'error') }
}

function openDetail(word) {
  detailWord.value = word
  showDetail.value = true
}

onMounted(async () => {
  const uid = store.user?.id
  if (!uid) return
  try {
    const bankId = store.user?.bank_id || 2
    allWords.value = await bankStore.load(uid, bankId)
  } catch (e) { toast('加载词库失败: ' + e.message, 'error')
  } finally { loading.value = false }
})

const statusLabels = {
  new: { text: '未学', class: 'bg-gray-100 text-gray-400' },
  learning: { text: '学习中', class: 'bg-amber-50 text-amber-500' },
  mastered: { text: '已掌握', class: 'bg-emerald-50 text-emerald-500' },
}

const emptyTexts = {
  bookmarked: '还没有收藏的单词',
  mastered: '还没有掌握的单词',
  learning: '没有学习中的单词',
  new: '没有未学的单词',
  '': '暂无数据',
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 max-w-lg mx-auto flex flex-col">
    <div class="p-4 pb-0">
      <AppHeader title="📖 词库" :showBack="false" />

      <!-- 搜索框（本地实时筛选） -->
      <div class="relative mb-3">
        <input v-model="searchInput" @input="onSearch" type="text" placeholder="搜索单词..."
          class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition text-sm" />
        <span v-if="searchInput" @click="clearSearch" class="absolute right-3 top-2.5 text-gray-300 cursor-pointer hover:text-gray-500">✕</span>
      </div>

      <!-- 筛选 tab -->
      <div class="flex gap-2 mb-4 overflow-x-auto">
        <button @click="switchFilter('')"
          :class="filter === '' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'"
          class="px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap"
        >全部</button>
        <button @click="switchFilter('new')"
          :class="filter === 'new' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'"
          class="px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap"
        >未学</button>
        <button @click="switchFilter('learning')"
          :class="filter === 'learning' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'"
          class="px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap"
        >学习中</button>
        <button @click="switchFilter('mastered')"
          :class="filter === 'mastered' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'"
          class="px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap"
        >已掌握</button>
        <button @click="switchFilter('bookmarked')"
          :class="filter === 'bookmarked' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'"
          class="px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap"
        >⭐ 收藏</button>
      </div>
    </div>

    <!-- 词库列表 -->
    <div class="flex-1 overflow-y-auto px-4 pb-24">
      <div v-if="loading" class="text-center text-gray-400 py-8">加载中...</div>

      <div v-else-if="allWords.length === 0" class="text-center text-gray-400 py-8">词库为空</div>

      <template v-else>
        <div v-if="filteredWords.length === 0" class="text-center text-gray-400 py-8">
          {{ emptyTexts[filter] || '暂无数据' }}
        </div>

        <div v-else class="space-y-1">
          <div v-for="w in shownWords" :key="w.id"
            class="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition"
            @click="openDetail(w)"
          >
            <button @click.stop="toggleBookmark(w)" class="text-lg flex-shrink-0 transition"
              :class="w.bookmarked ? 'text-amber-400' : 'text-gray-200 hover:text-gray-300'"
            >{{ w.bookmarked ? '⭐' : '☆' }}</button>

            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-800">{{ w.word }}</div>
              <div class="text-xs text-gray-400 truncate">{{ w.phonetic }} · {{ w.definition }}</div>
            </div>

            <div class="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
              :class="statusLabels[w.status]?.class || statusLabels.new.class"
            >{{ statusLabels[w.status]?.text || '未学' }}</div>
          </div>

          <button v-if="shownWords.length < filteredWords.length" @click="loadMore"
            class="w-full py-3 text-sm text-gray-400 hover:text-indigo-500 transition"
          >加载更多 ({{ filteredWords.length - shownWords.length }} 个)</button>
        </div>
      </template>
    </div>

    <BottomNav />

    <!-- 单词详情弹窗（只读） -->
    <WordDetailModal v-if="showDetail" :word="detailWord"
      @close="showDetail = false" @toggle-bookmark="toggleBookmark(detailWord)" />
  </div>
</template>
