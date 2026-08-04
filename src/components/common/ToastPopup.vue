<script setup>
import { useToast } from '../../utils/toast'

const { state } = useToast()
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="state.visible"
        class="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-medium text-sm max-w-xs text-center
          transition-all duration-300"
        :class="state.type === 'success' ? 'bg-emerald-500' : state.type === 'error' ? 'bg-red-500' : 'bg-indigo-500'"
      >
        {{ state.message }}
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active { animation: slideIn 0.3s ease-out; }
.toast-leave-active { animation: fadeOut 0.3s ease-in; }
@keyframes slideIn {
  from { opacity: 0; transform: translate(-50%, -20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
</style>
