<script setup>
import { ref, computed } from 'vue'
import SpeakButton from '../common/SpeakButton.vue'

const props = defineProps({
  date: { type: String, required: true },
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const label = computed(() => {
  const d = new Date(props.date + 'T00:00:00')
  const week = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
  return `${props.date} ${week}`
})
</script>

<template>
  <div class="fixed inset-0 z-40 bg-black/40 flex items-end justify-center" @click.self="emit('close')">
    <div class="bg-white w-full max-w-lg rounded-t-2xl p-6 pb-8 max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-gray-800">📅 {{ label }}</h2>
        <button @click="emit('close')" class="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
      </div>

      <div v-if="loading" class="text-center text-gray-400 py-6">加载中...</div>

      <template v-else-if="data">
        <!-- 学习统计 -->
        <div class="grid grid-cols-3 gap-2 mb-4">
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <div class="text-xl font-bold text-indigo-600">{{ data.newCount }}</div>
            <div class="text-xs text-gray-400 mt-0.5">新学</div>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <div class="text-xl font-bold text-emerald-600">{{ data.correct }}/{{ data.reviewed }}</div>
            <div class="text-xs text-gray-400 mt-0.5">复习答对</div>
          </div>
          <div class="bg-gray-50 rounded-xl p-3 text-center">
            <div class="text-xl font-bold text-gray-600">{{ data.spotChecks?.length || 0 }}</div>
            <div class="text-xs text-gray-400 mt-0.5">抽查</div>
          </div>
        </div>

        <!-- 当日抽查明细 -->
        <div v-if="data.spotChecks?.length" class="mb-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">🎯 当日抽查</h3>
          <div class="space-y-1.5">
            <div v-for="c in data.spotChecks" :key="c.id"
              class="flex justify-between items-center text-sm py-1.5 px-3 rounded-lg bg-gray-50"
            >
              <span class="text-gray-400 text-xs">{{ c.checked_at?.split(' ')[1]?.slice(0,5) }}</span>
              <span class="text-gray-700 font-medium">{{ c.correct }}/{{ c.total_words }} 正确</span>
              <span class="text-xs" :class="c.correct >= c.total_words * 0.7 ? 'text-emerald-500' : 'text-red-400'">
                {{ c.total_words > 0 ? Math.round(c.correct/c.total_words*100) : 0 }}%
              </span>
            </div>
          </div>
        </div>

        <!-- 当日答错的词 -->
        <div v-if="data.missedWords?.length">
          <h3 class="text-sm font-medium text-gray-700 mb-2">⚠️ 当日薄弱词</h3>
          <div class="space-y-1.5">
            <div v-for="w in data.missedWords" :key="w.word"
              class="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-red-50"
            >
              <span class="flex items-center gap-1.5 text-gray-700 font-medium">
                {{ w.word }}
                <SpeakButton :word="w.word" size="sm" />
              </span>
              <span class="text-red-400 text-xs">已错 {{ w.errors }} 次</span>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!data.missedWords?.length && !data.spotChecks?.length && data.newCount === 0 && data.reviewed === 0"
          class="text-center text-gray-400 py-6">当天无学习记录</div>
      </template>

      <button @click="emit('close')"
        class="w-full mt-5 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition"
      >关闭</button>
    </div>
  </div>
</template>
