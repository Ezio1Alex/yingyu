import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'

// 词库词条数据版本：以后更新词库内容（改释义/加词）时 +1，所有客户端会自动重拉缓存
const VERSION = 1
const lsKey = (bankId) => `vocab_words_${bankId}`

// 合并词条 + 云端状态：status 按最新已学集合重算，保证缓存里的旧状态被覆盖
function merge(base, st) {
  const learnedMap = new Map(st.learned.map(l => [l.word_id, l.stage]))
  const bmSet = new Set(st.bookmarked)
  return base.map(w => {
    const stage = learnedMap.get(w.id)
    return {
      ...w,
      status: stage === 'known' ? 'mastered' : (stage ? 'learning' : 'new'),
      mastered: stage === 'known' ? 1 : 0,
      bookmarked: bmSet.has(w.id) ? 1 : 0,
    }
  })
}

export const useBankStore = defineStore('bank', () => {
  const words = ref([]) // 合并后的词条列表（含 status / bookmarked）
  const bankId = ref(0)
  const loaded = ref(false)
  const state = ref({ bank_id: 0, learned: [], bookmarked: [] })

  // 加载指定词库：
  //   1. 内存已加载同词库 → 直接用
  //   2. 本地 localStorage 词条缓存（带版本） + 云端状态接口合并
  //   3. 无缓存 → 全量拉取兜底并落 localStorage
  async function load(userId, targetBankId) {
    if (loaded.value && bankId.value === targetBankId) return words.value
    const freshState = await api.getWordState(userId)
    state.value = freshState

    let base = null
    try {
      const raw = localStorage.getItem(lsKey(targetBankId))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.version === VERSION) base = parsed.words
      }
    } catch {}
    if (!base || !base.length) {
      const data = await api.getWords(userId)
      base = data.words || []
      try {
        localStorage.setItem(lsKey(targetBankId), JSON.stringify({ version: VERSION, words: base }))
      } catch {}
    }

    words.value = merge(base, freshState)
    bankId.value = targetBankId
    loaded.value = true
    return words.value
  }

  // 收藏切换：云端已由调用方提交，本地同步内存（含 state 集合 + words 对象）
  function setBookmarked(wordId, val) {
    const s = new Set(state.value.bookmarked)
    if (val) s.add(wordId); else s.delete(wordId)
    state.value.bookmarked = [...s]
    const w = words.value.find(x => x.id === wordId)
    if (w) w.bookmarked = val ? 1 : 0
  }

  // 学新词提交成功后调用：把新学词标记为已学，避免重复推荐
  function markLearned(ids) {
    const map = new Map(state.value.learned.map(l => [l.word_id, l.stage]))
    for (const id of ids) if (!map.has(id)) map.set(id, 'learning')
    state.value.learned = [...map.entries()].map(([word_id, stage]) => ({ word_id, stage }))
    for (const w of words.value) {
      if (ids.includes(w.id)) { w.status = 'learning'; w.mastered = 0 }
    }
  }

  function reset() {
    words.value = []
    bankId.value = 0
    loaded.value = false
    state.value = { bank_id: 0, learned: [], bookmarked: [] }
  }

  return { words, bankId, loaded, state, load, setBookmarked, markLearned, reset }
})
