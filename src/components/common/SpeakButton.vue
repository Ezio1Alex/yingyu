<script setup>
const props = defineProps({
  word: { type: String, required: true },
  accent: { type: String, default: 'us' }, // 'us' 美式 | 'uk' 英式
  size: { type: String, default: 'sm' },
})

function speak() {
  if (!props.word) return
  const type = props.accent === 'uk' ? 1 : 2
  const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(props.word)}&type=${type}`
  const audio = new Audio(audioUrl)
  audio.play().catch(() => {
    // 音频失败时尝试浏览器 TTS
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(props.word)
      u.lang = props.accent === 'uk' ? 'en-GB' : 'en-US'
      window.speechSynthesis.speak(u)
    }
  })
}
</script>

<template>
  <button
    @click="speak"
    class="inline-flex items-center justify-center transition hover:scale-110 active:scale-95"
    :class="size === 'sm' ? 'text-base' : 'text-xl'"
    title="点击发音"
  >
    🔊
  </button>
</template>
