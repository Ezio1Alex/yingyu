import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  const user = ref(JSON.parse(localStorage.getItem('vocab_user') || 'null'))
  const pinVerified = ref(false)

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
    localStorage.removeItem('vocab_user')
  }

  function setPinVerified(v) {
    pinVerified.value = v
  }

  return { user, pinVerified, isLoggedIn, setUser, updateUser, logout, setPinVerified }
})
