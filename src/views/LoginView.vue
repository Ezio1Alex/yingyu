<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/appStore'
import { api } from '../api/client'
import { useToast } from '../utils/toast'

const router = useRouter()
const store = useAppStore()
const { show: toast } = useToast()

const name = ref('')
const grade = ref('高中')
const pin = ref('') // 家长 PIN（创建用户需家长确认）
const users = ref([])
const showCreate = ref(false)
const loading = ref(true)
const creating = ref(false) // 防双击/网络重试重复创建用户

onMounted(async () => {
  try {
    users.value = await api.getUsers()
    if (users.value.length === 0) showCreate.value = true
  } catch {
    showCreate.value = true
  } finally {
    loading.value = false
  }
})

function selectUser(u) {
  store.setUser(u)
  router.push('/home')
}

async function createUser() {
  if (!name.value.trim() || !pin.value.trim() || creating.value) return
  creating.value = true
  try {
    const u = await api.createUser({ name: name.value.trim(), grade: grade.value, pin: pin.value })
    store.setUser(u)
    router.push('/home')
  } catch (e) {
    toast('创建失败: ' + e.message, 'error')
    creating.value = false // 失败允许重试
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100 p-4">
    <div class="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">📚</div>
        <h1 class="text-2xl font-bold text-gray-800">英语背单词</h1>
        <p class="text-gray-500 mt-1 text-sm">智能间隔重复 · 科学记忆</p>
      </div>

      <div v-if="loading" class="text-center text-gray-400 py-8">加载中...</div>

      <!-- 已有用户列表 -->
      <div v-else-if="users.length > 0 && !showCreate" class="space-y-3">
        <p class="text-sm text-gray-500 mb-3">选择学习者：</p>
        <button
          v-for="u in users"
          :key="u.id"
          @click="selectUser(u)"
          class="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition flex items-center gap-3"
        >
          <span class="text-2xl">👤</span>
          <div>
            <div class="font-medium text-gray-800">{{ u.name }}</div>
            <div class="text-xs text-gray-400">{{ u.grade }} · {{ u.bank_id === 1 ? '中考' : '高考' }}词库</div>
          </div>
        </button>
        <button
          @click="showCreate = true"
          class="w-full mt-2 p-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition text-sm"
        >
          ＋ 添加学习者
        </button>

        <div class="mt-6 pt-4 border-t border-gray-100">
          <router-link to="/parent" class="block text-center text-xs text-gray-400 hover:text-gray-600 transition">
            🔒 家长督导
          </router-link>
        </div>
      </div>

      <!-- 创建新用户 -->
      <div v-else class="space-y-4">
        <p class="text-xs text-gray-400">创建新学习者需家长 PIN 确认</p>
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">家长 PIN</label>
          <input
            v-model="pin"
            type="password"
            placeholder="请输入家长 PIN 码"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition tracking-widest"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">你的名字</label>
          <input
            v-model="name"
            type="text"
            placeholder="输入昵称"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-600 mb-2">你的年级</label>
          <div class="flex gap-3">
            <button
              @click="grade = '初中'"
              :class="grade === '初中' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'"
              class="flex-1 py-3 rounded-xl font-medium transition"
            >初中 (中考)</button>
            <button
              @click="grade = '高中'"
              :class="grade === '高中' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'"
              class="flex-1 py-3 rounded-xl font-medium transition"
            >高中 (高考)</button>
          </div>
        </div>
        <button
          @click="createUser"
          class="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition disabled:opacity-50"
          :disabled="!name.trim() || !pin.trim()"
        >✅ 开始学习</button>
      </div>
    </div>
  </div>
</template>
