<script setup>
import SpeakButton from '../common/SpeakButton.vue'

const props = defineProps({
  word: { type: Object, required: true },
})
const emit = defineEmits(['close', 'toggle-bookmark'])
</script>

<template>
  <div class="fixed inset-0 z-40 bg-black/40 flex items-end justify-center" @click.self="emit('close')">
    <div class="bg-white w-full max-w-lg rounded-t-2xl p-6 pb-8">
      <!-- 头部 -->
      <div class="flex items-center gap-3 mb-5">
        <span class="text-2xl font-bold text-gray-800">{{ word.word }}</span>
        <SpeakButton :word="word.word" size="sm" />
        <span v-if="word.phonetic" class="text-gray-400 text-sm">{{ word.phonetic }}</span>
        <button @click="emit('toggle-bookmark')" class="ml-auto text-xl transition"
          :class="word.bookmarked ? 'text-amber-400' : 'text-gray-300 hover:text-gray-400'"
          title="收藏"
        >{{ word.bookmarked ? '⭐' : '☆' }}</button>
      </div>

      <!-- 词性 + 释义 -->
      <div class="border-t border-gray-100 pt-4">
        <div class="text-base text-gray-700 leading-relaxed" style="white-space: pre-line">
          <span v-if="word.pos" class="inline-block mr-1 text-indigo-500 font-medium">{{ word.pos }}</span>
          {{ word.definition }}
        </div>

        <!-- 例句 -->
        <div v-if="word.example_en" class="mt-4 pt-3 border-t border-gray-50">
          <div class="text-base text-gray-700 font-medium">{{ word.example_en }}</div>
          <div v-if="word.example_cn" class="text-sm text-gray-500 mt-1">{{ word.example_cn }}</div>
        </div>
      </div>

      <!-- 状态 -->
      <div class="mt-4 text-xs text-gray-400">
        <span v-if="word.status === 'mastered'" class="text-emerald-500">✅ 已掌握</span>
        <span v-else-if="word.status === 'learning'" class="text-amber-500">📖 学习中</span>
        <span v-else class="text-gray-400">未学习</span>
      </div>

      <div class="flex gap-2 mt-6">
        <button @click="emit('close')"
          class="w-full py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition"
        >关闭</button>
      </div>
    </div>
  </div>
</template>
