<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/appStore'
import { api } from '../api/client'

const router = useRouter()
const store = useAppStore()

const pin = ref('')
const error = ref(false)
const verifying = ref(false)

// PIN 由后端校验（env.PARENT_PIN），前端不持有真实 PIN
async function verify() {
  error.value = false
  if (!pin.value || verifying.value) return
  verifying.value = true
  try {
    const res = await api.verifyParentPin(pin.value)
    if (res.ok) {
      store.setPinVerified(true)
      router.push('/parent/dashboard')
    } else {
      error.value = true
    }
  } catch {
    error.value = true
  } finally {
    verifying.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
    <div class="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
      <div class="text-center mb-6">
        <div class="text-5xl mb-3">🔒</div>
        <h1 class="text-xl font-bold text-gray-800">家长督导</h1>
        <p class="text-sm text-gray-400 mt-1">请输入 PIN 码查看孩子学习情况</p>
      </div>

      <input
        v-model="pin"
        type="password"
        placeholder="输入 PIN 码"
        class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition text-center text-lg tracking-widest"
        @keyup.enter="verify"
      />

      <p v-if="error" class="text-red-400 text-sm mt-2 text-center">PIN 码错误，请重试</p>

      <button
        @click="verify"
        class="w-full mt-4 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition disabled:opacity-50"
        :disabled="!pin || verifying"
      >{{ verifying ? '验证中...' : '确认' }}</button>

      <router-link to="/home" class="block mt-4 text-center text-sm text-gray-400 hover:text-gray-600 transition">
        ‹ 返回
      </router-link>
    </div>
  </div>
</template>
