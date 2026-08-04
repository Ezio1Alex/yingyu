/**
 * 东八区 (Asia/Shanghai, UTC+8) 日期工具
 * 所有日期操作统一走这里，避免 toISOString() 的 UTC 偏移问题
 */

/** 获取今天的东八区日期字符串 YYYY-MM-DD */
export function todayCN() {
  const d = new Date()
  // 手动加 8 小时到 UTC，再取日期
  const utc8 = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().split('T')[0]
}

/** 获取当前东八区的完整时间字符串 YYYY-MM-DD HH:mm:ss */
export function nowCN() {
  const d = new Date()
  const utc8 = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().replace('T', ' ').split('.')[0]
}

/** 日期加减 N 天，返回东八区日期字符串 */
export function dateOffset(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  d.setDate(d.getDate() + days)
  const utc8 = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().split('T')[0]
}
