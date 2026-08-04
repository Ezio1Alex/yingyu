<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { DEFAULTS } from '../../utils/constants'
import SpeakButton from '../common/SpeakButton.vue'

const props = defineProps({
  word: { type: Object, required: true },
  autoStart: { type: Boolean, default: true },
})

const emit = defineEmits(['rate'])

const showAnswer = ref(false)
const timer = ref(0)
const canEasy = ref(true)
let timerInterval = null

const timerDisplay = computed(() => Math.max(0, DEFAULTS.REVIEW_TIMER - timer.value))

watch(() => props.word?.id, () => {
  if (props.autoStart) startTimer()
})

onMounted(() => {
  if (props.autoStart) startTimer()
})

onUnmounted(() => clearInterval(timerInterval))

function startTimer() {
  timer.value = 0
  canEasy.value = true
  showAnswer.value = false
  clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    timer.value++
    if (timer.value >= DEFAULTS.REVIEW_TIMER) {
      canEasy.value = false
      clearInterval(timerInterval)
    }
  }, 1000)
}

function reveal() {
  showAnswer.value = true
  clearInterval(timerInterval)
}

function rate(score) {
  emit('rate', score)
}
</script>

<template>
  <div class="flex-1 flex flex-col">
    <!-- 卡片主体 -->
    <div class="flex-1 bg-white rounded-2xl shadow-sm px-4 py-6 flex flex-col items-center justify-center min-h-[200px]">
      <!-- 倒计时：常驻占位避免布局跳动，进入即从 10s 显示 -->
      <div class="text-sm text-gray-300 mb-2 h-5 leading-5">
        <span v-if="!showAnswer && timer < DEFAULTS.REVIEW_TIMER">⏱ {{ timerDisplay }}s</span>
      </div>

      <!-- 英文单词 -->
      <div class="text-4xl font-bold text-gray-800 mb-2 text-center">{{ word.word }}</div>

      <!-- 音标 + 发音按钮（始终显示） -->
      <div class="flex items-center justify-center gap-1.5 mb-6 text-center">
        <SpeakButton :word="word.word" size="sm" />
        <span class="text-gray-400 text-base">{{ word.phonetic || '' }}</span>
      </div>

      <!-- 未显示答案：显示答案按钮 -->
      <button
        v-if="!showAnswer"
        @click="reveal"
        class="px-8 py-3 bg-indigo-50 text-indigo-500 rounded-xl font-medium hover:bg-indigo-100 transition active:scale-[0.97]"
      >👆 显示答案</button>

      <!-- 已显示答案 -->
      <div v-else class="w-full space-y-3 text-center">
        <div class="border-t border-gray-100 pt-4">
          <div class="text-xl text-gray-700 font-medium leading-relaxed" style="white-space: pre-line">{{ word.definition }}</div>
          <div v-if="word.example_en" class="mt-5 pt-3 border-t border-gray-50">
            <div class="text-base text-gray-700 font-medium">{{ word.example_en }}</div>
            <div v-if="word.example_cn" class="text-sm text-gray-500 mt-1">{{ word.example_cn }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 评分按钮：一直渲染但根据 showAnswer 切换可见 -->
    <div v-if="!showAnswer" class="mt-4 px-2">
      <button
        @click="reveal"
        class="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-medium hover:bg-gray-200 transition"
      >👆 先显示答案再评分</button>
    </div>

    <div v-else class="mt-4 flex gap-2 px-1">
      <button @click="rate(0)" class="flex-1 py-3 rounded-xl bg-red-50 text-red-500 font-bold hover:bg-red-100 transition active:scale-[0.97] text-sm">
        ❌ 忘了
      </button>
      <button @click="rate(3)" class="flex-1 py-3 rounded-xl bg-amber-50 text-amber-600 font-bold hover:bg-amber-100 transition active:scale-[0.97] text-sm">
        🤔 一般
      </button>
      <button @click="rate(5)" :disabled="!canEasy"
        :class="canEasy ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'"
        class="flex-1 py-3 rounded-xl font-bold transition active:scale-[0.97] text-sm">
        ⚡ 秒答
      </button>
    </div>
  </div>
</template>
