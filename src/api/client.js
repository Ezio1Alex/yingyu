const API_BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `请求失败: ${res.status}`)
  }
  return res.json()
}

export const api = {
  // 用户
  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (userId) => request('/users', { method: 'DELETE', body: JSON.stringify({ user_id: userId }) }),
  updateUserBank: (data) => request('/users/bank', { method: 'PUT', body: JSON.stringify(data) }),

  // 今日复习
  getToday: (userId, round) => request(`/today?user_id=${userId}&round=${round || 1}`),
  // 今日新学回顾（只读拉取，练习不落库）
  getTodayNew: (userId) => request(`/review/new?user_id=${userId}`),

  // 聚合端点（每页 1 请求）
  getHome: (userId) => request(`/home?user_id=${userId}`),
  getStatsSummary: (userId) => request(`/stats/summary?user_id=${userId}`),
  getParentDashboard: (userId, month) => request(`/parent/dashboard?user_id=${userId}${month ? '&month=' + month : ''}`),
  getParentDay: (userId, date) => request(`/parent/day?user_id=${userId}&date=${date}`),

  // 批量提交（取代逐词提交）
  submitLearnBatch: (data) => request('/learn/batch', { method: 'POST', body: JSON.stringify(data) }),
  submitReviewBatch: (data) => request('/review/batch', { method: 'POST', body: JSON.stringify(data) }),

  // 新学词（拉取未学词）
  getNewWords: (userId, count) => request(`/words/new?user_id=${userId}&count=${count}`),

  // 统计（学习报告页用）
  getStats: (userId) => request(`/stats?user_id=${userId}`),

  // 词库（全量拉取，本地搜索/筛选/收藏）
  getWords: (userId) => request(`/words?user_id=${userId}`),
  // 学习状态小接口（已学/收藏列表，前端合并本地词条缓存）
  getWordState: (userId) => request(`/words/state?user_id=${userId}`),

  // 设置
  updateSettings: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // 收藏
  getBookmarks: (userId) => request(`/bookmarks?user_id=${userId}`),
  addBookmark: (data) => request('/bookmarks', { method: 'POST', body: JSON.stringify(data) }),
  removeBookmark: (data) => request('/bookmarks', { method: 'DELETE', body: JSON.stringify(data) }),

  // 家长端
  verifyParentPin: (pin) => request('/parent/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) }),
  startSpotCheck: (userId, total = 10, mode = 'normal') => request('/parent/spot-check', { method: 'POST', body: JSON.stringify({ user_id: userId, total, mode }) }),
  submitSpotCheck: (data) => request('/parent/spot-check/submit', { method: 'POST', body: JSON.stringify(data) }),
  reinforce: (data) => request('/parent/reinforce', { method: 'POST', body: JSON.stringify(data) }),
}
