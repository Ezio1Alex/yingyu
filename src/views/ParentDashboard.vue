<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/appStore'
import { api } from '../api/client'
import { useToast } from '../utils/toast'
import { pendingStore } from '../utils/pendingStore'
import SpeakButton from '../components/common/SpeakButton.vue'
import AppHeader from '../components/common/AppHeader.vue'
import ProgressCard from '../components/common/ProgressCard.vue'
import DayDetailModal from '../components/parent/DayDetailModal.vue'

const router = useRouter()
const store = useAppStore()
const { show: toast } = useToast()

if (!store.pinVerified) { router.push('/parent') }

const users = ref([])
const selectedUserId = ref('')
const showUserMenu = ref(false) // 自定义用户下拉是否展开（原生 select 展开面板无法改样式，故自绘）
const selectedUserName = computed(() => users.value.find(u => u.id === selectedUserId.value)?.name || '选择孩子')

function selectUser(u) {
  selectedUserId.value = u.id
  showUserMenu.value = false
  loadData()
}
const stats = ref(null)
const weakWords = ref([])
const history = ref([])
const monthData = ref({ year: 0, month: 0, days: [] })

// 日期详情
const dayDetail = ref(null)
const dayDetailData = ref(null)
const dayLoading = ref(false)

// 当前浏览的月份（YYYY-MM）
const currentMonth = ref('')
const monthTitle = computed(() => {
  const m = monthData.value
  return m.year ? `${m.year}年${m.month}月` : ''
})

// 抽查数量设置
const showCountPicker = ref(false)
const spotCount = ref(10)
const spotMode = ref('normal') // normal | today_new
const customCount = ref('')

// 抽查状态
const spotCheckActive = ref(false)
const spotCheckWords = ref([])
const spotCheckIndex = ref(0)
const spotCheckResults = ref([])
const spotCheckDone = ref(false)
const spotCheckResult = ref(null)
const submitting = ref(false) // 抽查提交中，防网络卡顿重复提交
const spotClientId = ref('') // 本次抽查会话唯一标识（后端幂等去重）
const reinforcingIds = ref([]) // 正在标记加强的 word_id 集合

const monthDays = computed(() => {
  const data = monthData.value.days || []
  const weeks = []; let week = []
  for (const d of data) {
    if (d.date === '' && week.length === 0) { week.push(d); continue }
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) weeks.push(week)
  return weeks
})

onMounted(async () => {
  try {
    users.value = await api.getUsers()
    if (users.value.length > 0) {
      selectedUserId.value = users.value[0].id
      await loadData()
      // 补交上次未提交的抽查结果（网络失败/退出后的保险）
      flushSpotCheck()
    }
  } catch {}
})

async function loadData(month) {
  if (!selectedUserId.value) return
  try {
    const data = await api.getParentDashboard(selectedUserId.value, month || currentMonth.value)
    stats.value = data.stats
    weakWords.value = data.weakWords || []
    history.value = data.history || []
    monthData.value = data.monthData || { year: 0, month: 0, days: [] }
    currentMonth.value = `${data.monthData?.year || ''}-${String(data.monthData?.month || '').padStart(2, '0')}`
  } catch {}
}

// 上/下月翻页（下月不超过当月，上不早于用户创建月，简单起见限当年）
function prevMonth() {
  const [y, m] = currentMonth.value.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  loadData(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
}
function nextMonth() {
  const [y, m] = currentMonth.value.split('-').map(Number)
  const d = new Date(y, m, 1)
  loadData(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
}
const isCurrentMonth = computed(() => {
  const now = new Date()
  return currentMonth.value === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
})

async function openDay(d) {
  if (!d.date || !selectedUserId.value) return
  dayDetail.value = d.date
  dayDetailData.value = null
  dayLoading.value = true
  try {
    dayDetailData.value = await api.getParentDay(selectedUserId.value, d.date)
  } catch (e) { toast('获取详情失败: ' + e.message, 'error') }
  finally { dayLoading.value = false }
}

async function startSpotCheck() {
  try {
    const total = spotMode.value === 'today_new' ? 999 : spotCount.value
    const data = await api.startSpotCheck(selectedUserId.value, total, spotMode.value)
    spotCheckWords.value = (data.words || []).map(w => ({ ...w, showDef: false }))
    spotCheckIndex.value = 0; spotCheckResults.value = []
    spotCheckDone.value = false; spotCheckResult.value = null
    spotClientId.value = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
    spotCheckActive.value = true
  } catch (e) { toast('发起抽查失败: ' + e.message, 'error') }
}

function rateSpot(correct) {
  // 提交中或已完成：忽略重复点击（网络卡顿双击/重按会重复提交）
  if (submitting.value || spotCheckDone.value) return
  const wid = spotCheckWords.value[spotCheckIndex.value].id
  // 该词已评过分（如提交失败后重试），不再重复 push，直接进入提交
  const already = spotCheckResults.value.some(r => r.word_id === wid)
  if (!already) {
    spotCheckResults.value.push({
      word_id: wid,
      result: correct ? 1 : 0,
      category: spotCheckWords.value[spotCheckIndex.value].category || '',
    })
  }
  if (spotCheckIndex.value < spotCheckWords.value.length - 1) { spotCheckIndex.value++ }
  else { finishSpotCheck() }
}

// 返回上一步：撤销最后一次评分，回上一题
function backStep() {
  if (spotCheckResults.value.length === 0) return
  spotCheckResults.value.pop()
  if (spotCheckIndex.value > 0) spotCheckIndex.value--
}

async function finishSpotCheck() {
  if (submitting.value || spotCheckDone.value) return
  submitting.value = true
  const results = [...spotCheckResults.value]
  // 本地立即算出结果展示，不等待网络；结果落 localStorage，后台静默提交
  spotCheckResult.value = { correct: results.filter(r => r.result === 1).length, total: results.length }
  spotCheckDone.value = true
  pendingStore.save(selectedUserId.value, 'spotcheck', { client_id: spotClientId.value, items: results })
  submitting.value = false
  flushSpotCheck()
}

// 后台静默提交未完成的抽查结果（成功才删缓冲；失败保留下个触发点重试，
// 后端按 client_id 幂等，重试/补交不会重复插入）
async function flushSpotCheck() {
  const uid = selectedUserId.value
  if (!uid) return
  const saved = pendingStore.load(uid, 'spotcheck')
  if (!saved || !saved.items?.length) return
  if (submitting.value) return
  submitting.value = true
  try {
    await api.submitSpotCheck({ user_id: uid, items: saved.items, client_id: saved.client_id })
    pendingStore.clear(uid, 'spotcheck')
  } catch {} // 失败保留，下个触发点自动重试
  finally { submitting.value = false }
}

async function doReinforce(wordId) {
  if (reinforcingIds.value.includes(wordId)) return
  reinforcingIds.value.push(wordId)
  try {
    await api.reinforce({ user_id: selectedUserId.value, word_ids: [wordId] })
    toast('已标记加强')
  } catch (e) { toast('操作失败', 'error') }
}

// 删除当前选中的孩子及其全部数据（级联清除，不可恢复）
const deleting = ref(false)

function deleteSelected() {
  const u = users.value.find(x => x.id === selectedUserId.value)
  if (!u) return
  if (!window.confirm(`确定删除孩子「${u.name}」吗？\n将同时清除其全部学习数据（进度、复习记录、收藏、抽查历史），此操作不可恢复。`)) return
  doDeleteUser(u)
}

async function doDeleteUser(u) {
  deleting.value = true
  try {
    await api.deleteUser(u.id)
    users.value = await api.getUsers()
    // 若删除的是当前选中，切到剩余第一个
    if (selectedUserId.value === u.id) {
      selectedUserId.value = users.value[0]?.id || ''
      if (selectedUserId.value) { await loadData() }
      else {
        stats.value = null
        weakWords.value = []
        history.value = []
        monthData.value = { year: 0, month: 0, days: [] }
      }
    }
    // 若删除的是当前登录用户，本地会话同步登出
    if (store.user?.id === u.id) store.logout()
    toast('已删除孩子')
  } catch (e) { toast('删除失败: ' + e.message, 'error')
  } finally { deleting.value = false }
}

function closeSpotCheck() {
  spotCheckActive.value = false; spotCheckDone.value = false
  spotCheckResult.value = null; loadData()
}

function toggleDef(index) {
  if (spotCheckWords.value[index]) spotCheckWords.value[index].showDef = !spotCheckWords.value[index].showDef
}

function getResult(wordId) {
  return spotCheckResults.value.find(r => r.word_id === wordId)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
    <AppHeader title="🔒 家长督导" :backAction="spotCheckActive ? closeSpotCheck : null" />

    <!-- 选择孩子 -->
    <div class="bg-white rounded-xl p-4 shadow-sm mb-4">
      <div class="flex gap-2 items-center">
        <div class="relative flex-1">
          <button @click="showUserMenu = !showUserMenu" type="button"
            class="w-full flex items-center justify-between p-2.5 pr-3 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          >
            <span class="truncate">{{ selectedUserName }}</span>
            <span class="text-gray-400 text-xs transition-transform duration-200 shrink-0" :class="showUserMenu ? 'rotate-180' : ''">▾</span>
          </button>
          <div v-if="showUserMenu"
            class="absolute z-20 left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 py-1 max-h-56 overflow-y-auto"
          >
            <button v-for="u in users" :key="u.id" type="button" @click="selectUser(u)"
              class="w-full px-3 py-2.5 text-left text-sm transition"
              :class="u.id === selectedUserId ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-700 hover:bg-gray-50'"
            >{{ u.name }} · {{ u.grade }}</button>
          </div>
        </div>
        <button @click="deleteSelected" :disabled="!selectedUserId || deleting"
          class="px-3 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 transition disabled:opacity-40 whitespace-nowrap"
          title="删除当前选中的孩子及其全部数据（不可恢复）"
        >🗑 删除</button>
      </div>
    </div>

    <!-- 非抽查状态：看板 -->
    <template v-if="!spotCheckActive">
      <div v-if="stats" class="grid grid-cols-3 gap-3 mb-4">
        <ProgressCard :value="stats.mastered" label="已掌握" variant="primary" />
        <ProgressCard :value="stats.learning + stats.mastered" label="总进度" variant="success" />
        <ProgressCard :value="`🔥 ${stats.streak}天`" label="连续打卡" variant="warning" size="sm" />
      </div>

      <!-- 学习日历 -->
      <div class="bg-white rounded-xl p-5 shadow-sm mb-4">
        <div class="flex items-center justify-between mb-3">
          <button @click="prevMonth" class="px-3 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition text-sm">‹ 上月</button>
          <div class="text-sm font-medium text-gray-700">📅 {{ monthTitle }}</div>
          <button v-if="!isCurrentMonth" @click="nextMonth"
            class="px-3 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition text-sm"
          >下月 ›</button>
          <span v-else class="w-14"></span>
        </div>
        <table class="w-full text-center text-xs">
          <thead><tr class="text-gray-400">
            <th class="py-1 w-8">日</th><th class="py-1 w-8">一</th><th class="py-1 w-8">二</th>
            <th class="py-1 w-8">三</th><th class="py-1 w-8">四</th><th class="py-1 w-8">五</th><th class="py-1 w-8">六</th>
          </tr></thead>
          <tbody>
            <tr v-for="(week, wi) in monthDays" :key="wi">
              <td v-for="(d, di) in week" :key="di" class="py-0.5">
                <div v-if="d.date"
                  @click="openDay(d)"
                  :class="[
                    d.isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : '',
                    d.count > 0 ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200' : 'bg-gray-100 text-gray-400 cursor-pointer hover:bg-gray-200',
                    'w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-medium transition'
                  ]"
                >{{ d.date.slice(-2) }}</div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="flex justify-center gap-4 mt-3 text-xs text-gray-500">
          <span>🔥 连续 {{ stats?.streak || 0 }} 天</span>
          <span>📖 今日 {{ stats?.today || 0 }} 词</span>
          <span>👆 点击日期查看详情</span>
        </div>
      </div>

      <!-- 薄弱词汇（当月） -->
      <div class="bg-white rounded-xl p-5 shadow-sm mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-medium text-gray-800">⚠️ 薄弱词汇 <span class="text-xs text-gray-400 font-normal">{{ monthTitle }} </span></h2>
          <span class="text-xs text-gray-400">{{ weakWords.length }} 个</span>
        </div>
        <div v-if="weakWords.length === 0" class="text-sm text-gray-400 py-2">当月暂无</div>
        <div v-else class="space-y-2">
          <div v-for="w in weakWords" :key="w.word"
            class="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0"
          >
            <span class="text-gray-700 font-medium">{{ w.word }}</span>
            <span class="text-red-400 text-xs">已错 {{ w.errors }} 次</span>
          </div>
        </div>
      </div>

      <!-- 抽查历史（当月） -->
      <div class="bg-white rounded-xl p-5 shadow-sm mb-4">
        <h2 class="font-medium text-gray-800 mb-3">📋 抽查历史 <span class="text-xs text-gray-400 font-normal">{{ monthTitle }}</span></h2>
        <div v-if="history.length === 0" class="text-sm text-gray-400 py-2">当月暂无记录</div>
        <div v-else class="space-y-2">
          <div v-for="h in history" :key="h.id"
            class="flex justify-between items-center text-sm py-1.5 border-b border-gray-50 last:border-0"
          >
            <div class="text-gray-500 text-xs">
              <div>{{ h.checked_at?.split(' ')[0] }}</div>
              <div class="text-gray-300">{{ h.checked_at?.split(' ')[1]?.slice(0,5) }}</div>
            </div>
            <div class="text-right">
              <div class="text-gray-700 font-medium">{{ h.correct }}/{{ h.total_words }} 正确</div>
              <div class="text-xs" :class="h.correct >= h.total_words * 0.7 ? 'text-emerald-500' : 'text-red-400'">
                {{ h.total_words > 0 ? Math.round(h.correct/h.total_words*100) : 0 }}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 开始抽查 + 设置 -->
      <div class="flex gap-2">
        <button @click="startSpotCheck"
          class="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition"
        >🎯 开始抽查</button>
        <button @click="showCountPicker = !showCountPicker"
          class="w-12 py-3 bg-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-300 transition text-lg"
          title="设置抽查数量"
        >⚙️</button>
      </div>
      <div v-if="showCountPicker" class="bg-white rounded-xl p-4 shadow-sm mt-2">
        <div class="text-sm text-gray-600 mb-3">抽查范围</div>
        <div class="flex gap-2 mb-3">
          <button v-for="n in [10,20]" :key="n"
            @click="spotMode='normal'; spotCount=n; showCountPicker=false"
            class="flex-1 py-2 rounded-lg text-sm font-medium transition"
            :class="spotMode==='normal' && spotCount===n ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'"
          >{{ n }} 词</button>
          <button @click="spotMode='today_new'; showCountPicker=false"
            class="flex-1 py-2 rounded-lg text-sm font-medium transition"
            :class="spotMode==='today_new' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'"
          >📖 当日新学</button>
        </div>
        <div class="border-t border-gray-100 pt-3">
          <div class="text-xs text-gray-400 mb-2">自定义数量</div>
          <div class="flex gap-2">
            <input v-model.number="customCount" type="number" min="1" max="100" placeholder="输入词数"
              class="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-center" />
            <button @click="spotMode='normal'; spotCount=customCount||10; showCountPicker=false"
              class="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium"
            >确定</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 抽查进行中 -->
    <template v-else-if="!spotCheckDone">
      <div class="bg-white rounded-xl p-6 shadow-sm text-center">
        <div class="text-sm text-gray-400 mb-4">
          第 {{ spotCheckIndex + 1 }}/{{ spotCheckWords.length }} 题 ·
          <span class="text-indigo-400 font-medium">{{ {recent:'近期',weak:'薄弱',mastered:'已掌握'}[spotCheckWords[spotCheckIndex]?.category] || spotCheckWords[spotCheckIndex]?.category }}</span>
        </div>
        <div class="text-3xl font-bold text-gray-800 mb-2">{{ spotCheckWords[spotCheckIndex]?.word }}</div>
        <div class="flex items-center justify-center gap-1.5 mb-4">
          <SpeakButton :word="spotCheckWords[spotCheckIndex]?.word || ''" size="sm" />
          <span class="text-gray-400 text-base">{{ spotCheckWords[spotCheckIndex]?.phonetic || '' }}</span>
        </div>
        <template v-if="spotCheckWords[spotCheckIndex]?.showDef">
          <div class="border-t border-gray-100 pt-4 space-y-3">
            <div class="text-lg text-gray-700 font-medium leading-relaxed" style="white-space: pre-line">{{ spotCheckWords[spotCheckIndex]?.definition }}</div>
            <div v-if="spotCheckWords[spotCheckIndex]?.example_en" class="mt-4 pt-3 border-t border-gray-50">
              <div class="text-base text-gray-700 font-medium">{{ spotCheckWords[spotCheckIndex]?.example_en }}</div>
              <div v-if="spotCheckWords[spotCheckIndex]?.example_cn" class="text-sm text-gray-500 mt-1">{{ spotCheckWords[spotCheckIndex]?.example_cn }}</div>
            </div>
          </div>
          <div class="flex gap-2 mt-6">
            <button @click="backStep" :disabled="spotCheckResults.length === 0"
              class="px-5 py-3 rounded-xl bg-gray-100 text-gray-500 font-medium hover:bg-gray-200 transition disabled:opacity-40"
            >⬅ 返回上一步</button>
            <button @click="rateSpot(false)" class="flex-1 py-3 rounded-xl bg-red-50 text-red-500 font-bold hover:bg-red-100 transition">❌ 不对</button>
            <button @click="rateSpot(true)" class="flex-1 py-3 rounded-xl bg-emerald-50 text-emerald-600 font-bold hover:bg-emerald-100 transition">✅ 对了</button>
          </div>
        </template>
        <button v-else @click="toggleDef(spotCheckIndex)"
          class="mt-4 px-8 py-3 bg-indigo-50 text-indigo-500 rounded-xl font-medium hover:bg-indigo-100 transition"
        >👆 查看答案</button>
      </div>
    </template>

    <!-- 抽查结果（逐词展示） -->
    <template v-else>
      <div class="bg-white rounded-xl p-5 shadow-sm mb-4">
        <div class="text-center mb-4">
          <div class="text-xl font-bold text-gray-800">🎯 抽查完成</div>
          <div class="text-sm text-gray-500 mt-1" v-if="spotCheckResult">
            正确 {{ spotCheckResult.correct }}/{{ spotCheckResult.total }}
            （{{ spotCheckResult.total > 0 ? Math.round(spotCheckResult.correct/spotCheckResult.total*100) : 0 }}%）
          </div>
        </div>

        <!-- 逐词结果 -->
        <div class="space-y-2">
          <div v-for="(w, i) in spotCheckWords" :key="w.id"
            class="flex items-center gap-3 py-2 px-3 rounded-lg"
            :class="getResult(w.id)?.result === 1 ? 'bg-emerald-50' : 'bg-red-50'"
          >
            <span class="text-lg">{{ getResult(w.id)?.result === 1 ? '✅' : '❌' }}</span>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-800">{{ w.word }}</div>
              <div class="text-xs text-gray-400 truncate">{{ w.definition }}</div>
            </div>
            <!-- 逐个标记加强（只有答错的才显示） -->
            <button v-if="getResult(w.id)?.result === 0"
              @click="doReinforce(w.id)" :disabled="reinforcingIds.includes(w.id)"
              class="px-3 py-1.5 text-xs rounded-lg font-medium transition"
              :class="reinforcingIds.includes(w.id) ? 'bg-amber-100 text-amber-400' : 'bg-amber-500 text-white hover:bg-amber-600'"
            >{{ reinforcingIds.includes(w.id) ? '✅ 已加强' : '📋 加强' }}</button>
          </div>
        </div>

        <button @click="closeSpotCheck"
          class="w-full mt-4 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition"
        >返回看板</button>
      </div>
    </template>

    <!-- 日期详情弹窗 -->
    <DayDetailModal v-if="dayDetail" :date="dayDetail" :data="dayDetailData" :loading="dayLoading"
      @close="dayDetail = null" />
  </div>
</template>
