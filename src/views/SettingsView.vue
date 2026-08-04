<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/appStore'
import { api } from '../api/client'
import { useToast } from '../utils/toast'
import AppHeader from '../components/common/AppHeader.vue'

const router = useRouter()
const store = useAppStore()
const { show: toast } = useToast()

const wordsPerDay = ref(store.user?.words_per_day || 20)
const selectedBank = ref(store.user?.bank_id || 2)
const saving = ref(false)
const bankSaving = ref(false)

async function save() {
  saving.value = true
  try {
    await api.updateSettings({ user_id: store.user.id, words_per_day: wordsPerDay.value })
    store.updateUser({ words_per_day: wordsPerDay.value })
    toast('已保存')
  } catch (e) {
    toast('保存失败: ' + e.message, 'error')
  } finally { saving.value = false }
}

async function switchBank(bankId) {
  bankSaving.value = true
  try {
    await api.updateUserBank({ user_id: store.user.id, bank_id: bankId })
    selectedBank.value = bankId
    store.updateUser({ bank_id: bankId })
    toast(`已切换到${bankId === 1 ? '中考' : '高考'}词库`)
  } catch (e) {
    toast('切换失败: ' + e.message, 'error')
  } finally { bankSaving.value = false }
}

function doLogout() { store.logout(); router.push('/') }
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
    <AppHeader title="⚙️ 设置" />

    <!-- 每日目标 -->
    <div class="bg-white rounded-xl p-5 shadow-sm mb-4">
      <h2 class="font-medium text-gray-800 mb-4">每日新学目标</h2>
      <div class="flex gap-2">
        <input v-model.number="wordsPerDay" type="number" min="5" max="50"
          class="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-center text-lg" />
        <button @click="save" :disabled="saving"
          class="px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition disabled:opacity-50"
        >{{ saving ? '保存中...' : '保存' }}</button>
      </div>
      <p class="text-xs text-gray-400 mt-2">复习数量由 SRS 自动计算</p>
    </div>

    <!-- 词库切换 -->
    <div class="bg-white rounded-xl p-5 shadow-sm mb-4">
      <h2 class="font-medium text-gray-800 mb-3">📚 词库选择</h2>
      <p class="text-xs text-gray-400 mb-3">切换词库不影响已有学习进度</p>
      <div class="flex gap-3">
        <button @click="switchBank(1)" :disabled="bankSaving || selectedBank === 1"
          :class="selectedBank === 1 ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          class="flex-1 py-3 rounded-xl font-medium transition disabled:opacity-50"
        >中考词库 (~1545词)</button>
        <button @click="switchBank(2)" :disabled="bankSaving || selectedBank === 2"
          :class="selectedBank === 2 ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          class="flex-1 py-3 rounded-xl font-medium transition disabled:opacity-50"
        >高考词库 (~3710词)</button>
      </div>
    </div>

    <!-- 账号 -->
    <div class="bg-white rounded-xl p-5 shadow-sm mb-4">
      <h2 class="font-medium text-gray-800 mb-2">账号</h2>
      <p class="text-sm text-gray-500 mb-3">{{ store.user?.name }} · {{ store.user?.grade }}</p>
      <button @click="doLogout" class="text-sm text-red-400 hover:text-red-600 transition">退出登录</button>
    </div>

    <!-- 家长入口 -->
    <div class="mt-6 pt-4 border-t border-gray-100">
      <router-link to="/parent" class="block text-center text-sm text-gray-400 hover:text-gray-600 transition">
        🔒 家长督导
      </router-link>
    </div>
  </div>
</template>
