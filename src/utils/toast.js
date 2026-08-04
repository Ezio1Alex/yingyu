// 全局 Toast 通知系统
import { reactive } from 'vue'

const state = reactive({
  visible: false,
  message: '',
  type: 'success', // success | error | info
  timer: null,
})

let toastId = 0

export function useToast() {
  function show(msg, type = 'success', duration = 2500) {
    clearTimeout(state.timer)
    state.message = msg
    state.type = type
    state.visible = true
    toastId++
    const id = toastId
    state.timer = setTimeout(() => {
      if (toastId === id) state.visible = false
    }, duration)
  }

  return { state, show }
}
