// 未提交缓冲的 localStorage 持久化
// 用途：网络失败时复习评分/学新词缓冲不丢，刷新/退出/杀进程后下次进入自动补交
// 提交成功即删除，平时 localStorage 基本为空，仅异常滞留时作为"断电保险"
const lsKey = (userId, type) => `pending_${type}_${userId}`

export const pendingStore = {
  load(userId, type) {
    try {
      const raw = localStorage.getItem(lsKey(userId, type))
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  },
  save(userId, type, data) {
    try { localStorage.setItem(lsKey(userId, type), JSON.stringify(data)) } catch {}
  },
  clear(userId, type) {
    try { localStorage.removeItem(lsKey(userId, type)) } catch {}
  },
}
