<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  word: { type: Object, required: true },
})

const emit = defineEmits(['submit', 'skip'])

const typedWord = ref('')
const submitted = ref(false)
const isCorrect = ref(false)

function submit() {
  if (!typedWord.value.trim()) return
  isCorrect.value = typedWord.value.trim().toLowerCase() === props.word.word.toLowerCase()
  submitted.value = true
  emit('submit', isCorrect.value)
}

function next() {
  submitted.value = false
  typedWord.value = ''
  emit('skip')
}
</script>

<template>
  <div class="flex-1 flex flex-col">
    <div class="text-center text-sm text-indigo-400 mb-2">✏️ 强化拼写</div>

    <div class="flex-1 bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center">
      <!-- 答题状态：提示 + 释义 + 输入框（无音标/发音，避免拼写提示） -->
      <template v-if="!submitted">
        <div class="text-lg text-gray-500 mb-2">请根据释义写出单词：</div>
        <div class="text-xl font-medium text-gray-800 mb-6 leading-relaxed" style="white-space: pre-line">{{ word.definition }}</div>
        <input
          v-model="typedWord"
          type="text"
          inputmode="latin"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="输入英文单词"
          class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition text-center text-lg"
          @keyup.enter="submit"
        />
      </template>

      <!-- 结果状态：判定 + 释义 + 例句 + 音标 -->
      <template v-else>
        <div class="w-full text-center">
          <div :class="isCorrect ? 'text-emerald-600' : 'text-red-500'" class="text-lg font-bold mb-3">
            {{ isCorrect ? '✅ 正确！' : '❌ 正确答案是 ' + word.word }}
          </div>
          <div class="text-base text-gray-700 leading-relaxed" style="white-space: pre-line">{{ word.definition }}</div>
          <div v-if="word.example_en" class="mt-4 pt-3 border-t border-gray-50">
            <div class="text-base text-gray-700 font-medium">{{ word.example_en }}</div>
            <div v-if="word.example_cn" class="text-sm text-gray-500 mt-1">{{ word.example_cn }}</div>
          </div>
          <div v-if="word.phonetic" class="text-sm text-gray-400 mt-3">{{ word.phonetic }}</div>
        </div>
      </template>
    </div>

    <button
      v-if="!submitted"
      @click="submit"
      class="w-full mt-4 py-3 bg-gray-100 rounded-xl text-gray-600 font-medium hover:bg-gray-200 transition active:scale-[0.98]"
      :disabled="!typedWord.trim()"
    >提交</button>

    <button
      v-else
      @click="next"
      class="w-full mt-4 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition"
    >继续</button>
  </div>
</template>
