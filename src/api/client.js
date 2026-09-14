const API_BASE = '/api'

// 可选的共享密钥：只有构建时设了 VITE_APP_KEY 才发送（后端要同时打开 REQUIRE_APP_KEY 才会校验）
const APP_KEY = import.meta.env.VITE_APP_KEY || ''

// 带上状态码的错误：调用方需要区分「被限流了，等会儿再来」和「真的出错了」
export class ApiError extends Error {
  constructor(message, status = 0, retryAfter = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

// 限流(429)或压根没连上 —— 这类失败是暂时的，重试就好，不该当成「数据出错/没有数据」处理
export function isRetryable(e) {
  return e instanceof ApiError && (e.status === 429 || e.status === 0)
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (APP_KEY) headers['X-App-Key'] = APP_KEY

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('网络连接失败，请检查网络后重试', 0, 0)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    // Retry-After 由后端的限流中间件给出
    const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10) || 0
    const message = res.status === 429
      ? `请求过于频繁，请等 ${retryAfter || 60} 秒后再试`
      : (err.error || `请求失败: ${res.status}`)
    throw new ApiError(message, res.status, retryAfter)
  }

  return res.json()
}

export const api = {
  // 用户
  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  // 删除会级联清空该用户的全部学习数据，需要带家长 PIN
  deleteUser: (userId, pin) => request('/users', { method: 'DELETE', body: JSON.stringify({ user_id: userId, pin }) }),
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

  // 词库（全量拉取，本地搜索/筛选/收藏）。传 bank_id 而不是 user_id：
  // 词库内容与用户无关，按 bank 拉取才能命中服务端边缘缓存
  getWords: (bankId) => request(`/words?bank_id=${bankId}`),
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
