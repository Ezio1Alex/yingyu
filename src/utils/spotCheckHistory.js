// 抽查历史合并展示
//
// 后端一条记录 = 一次「点了开始抽查」。但家长可能连点好几次（候选池不够时反复重试），
// 或一轮里分几次交卷 —— 于是出现过 20:40 连着四条「1/1」这种碎片记录，把有意义的记录淹了。
//
// 合并规则：同一天内，相邻两条时间间隔 < GAP 视为同一次抽查。
// 不丢信息：合并结果带 n（合并了几条），界面上会标出「共 N 次」；
// 点日期看当天详情时仍是每一条原始记录。
export const HISTORY_MERGE_GAP_MS = 5 * 60 * 1000

// 后端给的是东八区墙上时间 'YYYY-MM-DD HH:MM:SS'，当本地时间解析即可（这里只用来比先后）
function parseCN(s) {
  return Date.parse(String(s || '').replace(' ', 'T')) || 0
}

// 入参 history 需按 checked_at 倒序（后端就是 ORDER BY checked_at DESC）
export function groupSpotCheckHistory(history, gapMs = HISTORY_MERGE_GAP_MS) {
  const groups = []
  for (const h of history || []) {
    const t = parseCN(h.checked_at)
    const day = String(h.checked_at || '').split(' ')[0]
    const g = groups[groups.length - 1]
    // 倒序遍历：g 比 h 新，g.oldestT 是当前这组里最早的一条
    if (g && g.day === day && g.oldestT - t < gapMs) {
      g.oldestT = t
      g.oldest = h.checked_at
      g.total += h.total_words
      g.correct += h.correct
      g.n++
    } else {
      groups.push({
        id: h.id,
        day,
        newest: h.checked_at,
        oldest: h.checked_at,
        oldestT: t,
        total: h.total_words,
        correct: h.correct,
        n: 1,
      })
    }
  }
  return groups
}

// 展示用的时间区间文本：多条显示 "HH:MM–HH:MM"，单条只显示 "HH:MM"
export function groupTimeLabel(g) {
  const hm = (s) => String(s || '').split(' ')[1]?.slice(0, 5) || ''
  return g.n > 1 ? `${hm(g.oldest)}–${hm(g.newest)}` : hm(g.newest)
}
