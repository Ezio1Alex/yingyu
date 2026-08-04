<script setup>
import { computed } from 'vue'
import SpeakButton from '../common/SpeakButton.vue'

const props = defineProps({
  word: { type: Object, required: true },
  index: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
})

const emit = defineEmits(['next'])

const w = computed(() => props.word)
</script>

<template>
  <div class="flex-1 flex flex-col">
    <div class="flex-1 bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center">
      <div class="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
        {{ w.word }}
      </div>
      <div class="flex items-center justify-center gap-1.5 mb-6">
        <SpeakButton :word="w.word" size="sm" />
        <span class="text-gray-400 text-base">{{ w.phonetic || '' }}</span>
      </div>

      <div class="w-full border-t border-gray-100 pt-6 space-y-4">
        <div>
          <span class="text-xs text-gray-400 mr-2">释义</span>
          <div class="text-lg text-gray-700 leading-relaxed" style="white-space: pre-line">{{ w.definition }}</div>
        </div>
        <div v-if="w.example_en" class="mt-4 pt-2 border-t border-gray-50">
          <span class="text-xs text-gray-400 mr-2">例句</span>
          <div class="text-base text-gray-700 font-medium mt-1">{{ w.example_en }}</div>
          <div v-if="w.example_cn" class="text-sm text-gray-500 mt-1">{{ w.example_cn }}</div>
        </div>
      </div>
    </div>

    <button
      @click="emit('next')"
      class="w-full mt-4 py-4 bg-indigo-500 text-white rounded-xl font-medium text-lg hover:bg-indigo-600 transition active:scale-[0.98]"
    >✅ 记住了，下一个</button>
    <p class="text-xs text-gray-400 text-center mt-2">新词不评分，明天自动进入复习</p>
  </div>
</template>
