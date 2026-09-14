import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  const user = ref(JSON.parse(localStorage.getItem('vocab_user') || 'null'))
  const pinVerified = ref(false)
  // 家长 PIN 只留在内存里，**不落 localStorage**：删除用户等破坏性操作要带着它提交
  const parentPin = ref('')

  const isLoggedIn = computed(() => !!user.value)

  function setUser(u) {
    user.value = u
    localStorage.setItem('vocab_user', JSON.stringify(u))
  }

  function updateUser(partial) {
    const updated = { ...user.value, ...partial }
    user.value = updated
    localStorage.setItem('vocab_user', JSON.stringify(updated))
  }

  function logout() {
    user.value = null
    pinVerified.value = false
    // 注意：这里**不清 parentPin**。PIN 是家长端的凭据，和「当前登录的是哪个孩子」是两回事 ——
    // 家长在面板上删掉的正好是当前登录的那个孩子时会触发 logout()，若把 PIN 一起清了，
    // 家长接着删下一个孩子就会 403。只存内存，刷新即失效。
    localStorage.removeItem('vocab_user')
  }

  function setPinVerified(v, pin = '') {
    pinVerified.value = v
    parentPin.value = v ? pin : ''
  }

  return { user, pinVerified, parentPin, isLoggedIn, setUser, updateUser, logout, setPinVerified }
})
