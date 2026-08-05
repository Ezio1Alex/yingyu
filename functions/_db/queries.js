const DB = (env) => env.DB
import { todayCN, nowCN, dateOffset } from './time.js'

// ===== 用户 =====
export async function getUsers(env) {
  return DB(env).prepare('SELECT * FROM users ORDER BY created_at').all().then(r => r.results)
}
export async function createUser(env, { id, name, grade }) {
  const bankId = grade === '初中' ? 1 : 2
  await DB(env).prepare('INSERT INTO users (id, name, grade, bank_id) VALUES (?, ?, ?, ?)').bind(id, name, grade, bankId).run()
  return { id, name, grade, bank_id: bankId, words_per_day: 20 }
}
export async function updateUserBank(env, userId, bankId) {
  await DB(env).prepare('UPDATE users SET bank_id = ? WHERE id = ?').bind(bankId, userId).run()
  return { ok: true }
}

// 删除用户并级联清除其全部数据（不留垃圾），一次 batch 原子执行
// spot_check_items 无 user_id，通过该用户的 spot_checks 关联删除
export async function deleteUser(env, userId) {
  await DB(env).batch([
    DB(env).prepare(`DELETE FROM spot_check_items WHERE check_id IN (SELECT id FROM spot_checks WHERE user_id = ?)`).bind(userId),
    DB(env).prepare('DELETE FROM spot_checks WHERE user_id = ?').bind(userId),
    DB(env).prepare('DELETE FROM bookmarks WHERE user_id = ?').bind(userId),
    DB(env).prepare('DELETE FROM review_log WHERE user_id = ?').bind(userId),
    DB(env).prepare('DELETE FROM word_learning WHERE user_id = ?').bind(userId),
    DB(env).prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ])
  return { ok: true }
}

// ===== 今日复习 =====
// 第一轮：未评分的到期词；若没有则回退到今天已复习的词（支持当天二轮）
// 第二轮起：到期词 + 今天已复习过的词（重复复习只记日志不重算 SM2）
export async function getTodayWords(env, userId, round = 1) {
  const today = todayCN()
  const reviewedToday = `EXISTS (SELECT 1 FROM review_log WHERE user_id = ? AND word_id = p.word_id AND type = 'recall' AND date(reviewed_at) = ?)`
  const sql = round === 1 ? `
    SELECT w.*, p.stage, p.gap, p.reps, p.next_review
    FROM words w INNER JOIN word_learning p ON w.id = p.word_id AND p.user_id = ?
    WHERE p.next_review <= ?
      AND NOT EXISTS (SELECT 1 FROM review_log WHERE user_id = ? AND word_id = w.id AND date(reviewed_at) = ? AND type = 'recall')
    ORDER BY RANDOM()` : `
    SELECT w.*, p.stage, p.gap, p.reps, p.next_review
    FROM words w INNER JOIN word_learning p ON w.id = p.word_id AND p.user_id = ?
    WHERE (p.next_review <= ? OR ${reviewedToday})
    ORDER BY RANDOM()`
  const results = await DB(env).prepare(sql).bind(userId, today, userId, today).all().then(r => r.results)
  if (round === 1 && results.length === 0) {
    // 第一轮没有未评分到期词 → 回退到今天已复习过的词
    return DB(env).prepare(`
      SELECT w.*, p.stage, p.gap, p.reps, p.next_review
      FROM words w INNER JOIN word_learning p ON w.id = p.word_id AND p.user_id = ?
      WHERE ${reviewedToday}
      ORDER BY RANDOM()
    `).bind(userId, userId, today).all().then(r => r.results)
  }
  return results
}

// ===== 新学词 =====
export async function getNewWords(env, userId, count) {
  const user = await DB(env).prepare('SELECT bank_id FROM users WHERE id = ?').bind(userId).first()
  const bankId = user?.bank_id || 2
  return DB(env).prepare(`SELECT w.* FROM words w WHERE w.bank_id = ? AND w.id NOT IN (SELECT word_id FROM word_learning WHERE user_id = ?) ORDER BY RANDOM() LIMIT ?`).bind(bankId, userId, count).all().then(r => r.results)
}
export async function getRemainingNewCount(env, userId) {
  const total = await ensureBanks(env, userId)
  const learned = await DB(env).prepare('SELECT COUNT(*) as c FROM word_learning WHERE user_id = ?').bind(userId).first()
  return Math.max(0, total - (learned?.c || 0))
}

// 批量学新词：1 次读 + 1 次 batch 写
export async function addNewWords(env, userId, wordIds) {
  const today = todayCN()
  const nextReview = dateOffset(today, 1)
  const now = nowCN()
  const ids = [...new Set(wordIds)]
  if (!ids.length) return { learned: 0 }

  // 过滤已学过的词，避免重复记 'learning'
  const existing = await DB(env).prepare(`SELECT word_id FROM word_learning WHERE user_id = ? AND word_id IN (${ids.map(() => '?').join(',')})`).bind(userId, ...ids).all().then(r => new Set(r.results.map(x => x.word_id)))
  const fresh = ids.filter(id => !existing.has(id))

  const stmts = []
  for (const wid of fresh) {
    stmts.push(DB(env).prepare(`INSERT INTO word_learning (user_id, word_id, stage, next_review, started_at) VALUES (?, ?, 'learning', ?, ?)`).bind(userId, wid, nextReview, now))
    stmts.push(DB(env).prepare(`INSERT INTO review_log (user_id, word_id, stage, type, score, correct, reviewed_at) VALUES (?, ?, 'learning', 'learning', 0, 0, ?)`).bind(userId, wid, now))
  }
  if (stmts.length) await DB(env).batch(stmts)
  return { learned: fresh.length }
}

// ===== 复习批量提交 =====
// items: [{ word_id, score }]，typings: [{ word_id, correct }]
// 2 次读 + 1 次 batch 写
export async function submitReviews(env, userId, items = [], typings = []) {
  const today = todayCN()
  const now = nowCN()
  const allIds = [...new Set([...items.map(i => i.word_id), ...typings.map(t => t.word_id)])]
  if (!allIds.length) return []

  // 读当前学习状态
  const stateRes = await DB(env).prepare(`SELECT * FROM word_learning WHERE user_id = ? AND word_id IN (${allIds.map(() => '?').join(',')})`).bind(userId, ...allIds).all()
  const stateMap = new Map(stateRes.results.map(s => [s.word_id, s]))

  // 读今天已评过 recall 的词（round 2 只记录不更新 SM2）
  const doneRes = await DB(env).prepare(`SELECT DISTINCT word_id FROM review_log WHERE user_id = ? AND date(reviewed_at) = ? AND type = 'recall'`).bind(userId, today).all()
  const reviewedToday = new Set(doneRes.results.map(x => x.word_id))

  const stmts = []
  const results = []
  const { sm2, calcNextReview } = await import('../_srs/sm2.js')

  for (const item of items) {
    const wid = item.word_id
    const score = item.score
    const st = stateMap.get(wid)
    const stage = st?.stage || 'learning'
    const correct = score >= 3 ? 1 : 0

    if (reviewedToday.has(wid)) {
      // 今天已评分过（网络重试/重复提交）：直接跳过，不更新 SM2 也不重复记日志
      // （否则 review_log 会因重试膨胀，薄弱词汇错误计数被重复累加）
      results.push({ word_id: wid, skipped: true })
      continue
    }

    const r = sm2(score, st?.ease ?? 2.5, st?.gap ?? 0, st?.reps ?? 0)
    const nextReview = calcNextReview(today, r.gap)
    stmts.push(DB(env).prepare(`UPDATE word_learning SET stage = ?, ease = ?, gap = ?, reps = ?, next_review = ?, reviewed_at = ? WHERE user_id = ? AND word_id = ?`).bind(r.stage, r.ease, r.gap, r.reps, nextReview, now, userId, wid))
    stmts.push(DB(env).prepare(`INSERT INTO review_log (user_id, word_id, stage, type, score, correct, reviewed_at) VALUES (?, ?, ?, 'recall', ?, ?, ?)`).bind(userId, wid, stage, score, correct, now))
    results.push({ word_id: wid, stage: r.stage, ease: r.ease, gap: r.gap, reps: r.reps, nextReview, mastered: r.stage === 'known' })
  }

  // 拼写强化，只记录不改 SM2
  for (const t of typings) {
    const st = stateMap.get(t.word_id)
    const stage = st?.stage || 'learning'
    stmts.push(DB(env).prepare(`INSERT INTO review_log (user_id, word_id, stage, type, score, correct, reviewed_at) VALUES (?, ?, ?, 'spelling', ?, ?, ?)`).bind(userId, t.word_id, stage, t.correct ? 3 : 0, t.correct ? 1 : 0, now))
  }

  if (stmts.length) await DB(env).batch(stmts)
  return results
}

// 今日新学回顾：拉今天学过的词（只读，练习不落库、不影响算法）
export async function getTodayNewWords(env, userId) {
  const today = todayCN()
  return DB(env).prepare(`SELECT DISTINCT w.* FROM review_log r JOIN words w ON w.id = r.word_id WHERE r.user_id = ? AND r.type = 'learning' AND date(r.reviewed_at) = ? ORDER BY RANDOM()`).bind(userId, today).all().then(r => r.results)
}

// ===== 统计 =====
// 词库总词数：惰性写入 banks 表（部署后首次调用自动从 words 统计一次，之后不再扫 words 全表）
async function getBankId(env, userId) {
  const u = await DB(env).prepare('SELECT bank_id FROM users WHERE id = ?').bind(userId).first()
  return u?.bank_id || 2
}
async function ensureBankTotal(env, bankId) {
  const row = await DB(env).prepare('SELECT total_words FROM banks WHERE id = ?').bind(bankId).first()
  if (row) return row.total_words
  const cnt = await DB(env).prepare('SELECT COUNT(*) as c FROM words WHERE bank_id = ?').bind(bankId).first()
  const total = cnt?.c || 0
  await DB(env).prepare('INSERT OR IGNORE INTO banks (id, name, total_words) VALUES (?, ?, ?)').bind(bankId, bankId === 1 ? '中考' : '高考', total).run()
  return total
}
// 聚合类端点入口统一调用：确保 banks 已初始化，统计 total/remainingNew 时不再扫 words
async function ensureBanks(env, userId) {
  return ensureBankTotal(env, await getBankId(env, userId))
}

// 聚合查询：把原来 6 条查询压成 1 条（total 读 banks 静态表，不再 COUNT words 全表）
function aggStmt(env, userId) {
  const today = todayCN()
  return DB(env).prepare(`
    SELECT
      (SELECT COUNT(*) FROM word_learning WHERE user_id = ? AND stage = 'known') AS known,
      (SELECT COUNT(*) FROM word_learning WHERE user_id = ? AND stage <> 'known') AS learning,
      (SELECT total_words FROM banks WHERE id = (SELECT bank_id FROM users WHERE id = ?)) AS total,
      (SELECT COUNT(DISTINCT word_id) FROM review_log WHERE user_id = ? AND date(reviewed_at) = ?) AS today_words,
      (SELECT COUNT(DISTINCT word_id) FROM review_log WHERE user_id = ? AND type = 'learning' AND date(reviewed_at) = ?) AS today_new
  `).bind(userId, userId, userId, userId, today, userId, today)
}
function streakStmt(env, userId) {
  return DB(env).prepare('SELECT DISTINCT date(reviewed_at) as d FROM review_log WHERE user_id = ? ORDER BY d DESC LIMIT 60').bind(userId)
}
function calcStreak(dates) {
  if (!dates.length) return 0
  let count = 0
  const today = todayCN()
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] === dateOffset(today, -i)) count++
    else break
  }
  return count
}

export async function getStats(env, userId) {
  await ensureBanks(env, userId)
  const agg = await aggStmt(env, userId).first()
  const rows = await streakStmt(env, userId).all()
  const streak = calcStreak(rows.results.map(r => r.d))
  return formatStats(agg, streak)
}
function formatStats(agg, streak) {
  return {
    mastered: agg.known,
    learning: agg.learning,
    notStarted: agg.total - agg.known - agg.learning,
    streak,
    today: agg.today_words,
    todayNew: agg.today_new,
  }
}

// 首页聚合端点：1 次 batch 返回 stats + 待复习数 + 剩余新词数
export async function getHomeData(env, userId) {
  const today = todayCN()
  await ensureBanks(env, userId)
  const [aggR, streakR, dueR, remainR] = await DB(env).batch([
    aggStmt(env, userId),
    streakStmt(env, userId),
    DB(env).prepare('SELECT COUNT(*) as c FROM word_learning WHERE user_id = ? AND next_review <= ?').bind(userId, today),
    // 剩余新词 = 词库总数 - 已学数（banks 静态表 + word_learning 索引计数，不扫 words）
    DB(env).prepare(`SELECT total_words - (SELECT COUNT(*) FROM word_learning WHERE user_id = ?) as c FROM banks WHERE id = (SELECT bank_id FROM users WHERE id = ?)`).bind(userId, userId),
  ])
  const streak = calcStreak(streakR.results.map(r => r.d))
  return {
    stats: formatStats(aggR.results[0], streak),
    dueToday: dueR.results[0]?.c || 0,
    remainingNew: remainR.results[0]?.c || 0,
  }
}

// 统计页聚合端点：1 次 batch 返回 stats + 三周数据（本周/上周/上上周），前端本地切周，零额外请求
export async function getStatsSummary(env, userId) {
  const today = todayCN()
  await ensureBanks(env, userId)
  const todayDate = new Date(today + 'T00:00:00+08:00')
  const mondayOffset = (todayDate.getDay() + 6) % 7
  const thisMonday = dateOffset(today, -mondayOffset)
  const start = dateOffset(thisMonday, -14) // 上上周一
  const end = dateOffset(thisMonday, 6)     // 本周日

  const [aggR, streakR, weakR, weekR] = await DB(env).batch([
    aggStmt(env, userId),
    streakStmt(env, userId),
    // 三周内答错的 recall（带日期，JS 里按周切分）
    DB(env).prepare(`SELECT date(r.reviewed_at) as d, w.word, w.definition, COUNT(*) as errors FROM review_log r JOIN words w ON w.id = r.word_id WHERE r.user_id = ? AND r.correct = 0 AND r.type = 'recall' AND date(r.reviewed_at) >= ? AND date(r.reviewed_at) <= ? GROUP BY r.word_id, date(r.reviewed_at)`).bind(userId, start, end),
    // 三周每日学习数
    DB(env).prepare(`SELECT date(reviewed_at) as d, COUNT(DISTINCT word_id) as cnt FROM review_log WHERE user_id = ? AND date(reviewed_at) >= ? AND date(reviewed_at) <= ? GROUP BY date(reviewed_at)`).bind(userId, start, end),
  ])
  const streak = calcStreak(streakR.results.map(r => r.d))

  const dayMap = new Map(weekR.results.map(r => [r.d, r.cnt]))
  // 弱词按周聚合：weakByWeek[w] = Map<word, {word, definition, errors}>
  const weakByWeek = [new Map(), new Map(), new Map()]
  const dayMs = 86400000
  for (const row of weakR.results) {
    const dayIdx = Math.round((Date.parse(row.d + 'T00:00:00+08:00') - Date.parse(start + 'T00:00:00+08:00')) / dayMs)
    const weekIdx = Math.floor(dayIdx / 7)
    if (weekIdx < 0 || weekIdx > 2) continue
    const m = weakByWeek[weekIdx]
    const e = m.get(row.word) || { word: row.word, definition: row.definition, errors: 0 }
    e.errors += row.errors
    m.set(row.word, e)
  }

  const weeks = []
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  for (let w = 0; w < 3; w++) {
    const wkStart = dateOffset(thisMonday, -w * 7) // w=0 本周，1 上周，2 上上周
    const weekData = []
    for (let i = 0; i < 7; i++) {
      const dateStr = dateOffset(wkStart, i)
      weekData.push({ date: dateStr, label: labels[i], count: dayMap.get(dateStr) || 0, isToday: dateStr === today })
    }
    weeks.push({
      offset: w, // 0=本周，1=上周，2=上上周
      weekData,
      weakWords: [...weakByWeek[2 - w].values()].sort((a, b) => b.errors - a.errors).slice(0, 5),
    })
  }

  return {
    stats: formatStats(aggR.results[0], streak),
    weeks,
  }
}

// 家长端聚合端点：1 次 batch 返回 stats + 当月薄弱词 + 当月抽查历史 + 月日历
// monthStr: 'YYYY-MM'，缺省为当前月
export async function getParentDashboard(env, userId, monthStr) {
  const today = todayCN()
  await ensureBanks(env, userId)
  let year, month // month 0-indexed
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    year = parseInt(monthStr.slice(0, 4))
    month = parseInt(monthStr.slice(5, 7)) - 1
  } else {
    year = parseInt(today.slice(0, 4))
    month = parseInt(today.slice(5, 7)) - 1
  }
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const pad = (n) => String(n).padStart(2, '0')
  const startDateStr = `${year}-${pad(month + 1)}-01`
  const endDateStr = `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`

  const [aggR, streakR, weakR, histR, monthR] = await DB(env).batch([
    aggStmt(env, userId),
    streakStmt(env, userId),
    // 当月薄弱词：只统计当月答错的 recall
    DB(env).prepare(`SELECT w.word, w.definition, COUNT(*) as errors FROM review_log r JOIN words w ON w.id = r.word_id WHERE r.user_id = ? AND r.correct = 0 AND r.type = 'recall' AND date(r.reviewed_at) >= ? AND date(r.reviewed_at) <= ? GROUP BY r.word_id ORDER BY errors DESC LIMIT 10`).bind(userId, startDateStr, endDateStr),
    // 当月抽查历史（checked_at 是 UTC，转东八区再按日比较）
    DB(env).prepare(`SELECT id, user_id, total_words, correct, note, datetime(checked_at, '+8 hours') as checked_at FROM spot_checks WHERE user_id = ? AND date(checked_at, '+8 hours') >= ? AND date(checked_at, '+8 hours') <= ? ORDER BY checked_at DESC LIMIT 50`).bind(userId, startDateStr, endDateStr),
    DB(env).prepare(`SELECT date(reviewed_at) as d, COUNT(DISTINCT word_id) as cnt FROM review_log WHERE user_id = ? AND date(reviewed_at) >= ? AND date(reviewed_at) <= ? GROUP BY date(reviewed_at)`).bind(userId, startDateStr, endDateStr),
  ])
  const streak = calcStreak(streakR.results.map(r => r.d))

  const monthMap = new Map(monthR.results.map(r => [r.d, r.cnt]))
  const days = []
  for (let i = 0; i < firstDay.getDay(); i++) days.push({ date: '', count: -1 })
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`
    days.push({ date: dateStr, count: monthMap.get(dateStr) || 0, isToday: dateStr === today })
  }

  return {
    stats: formatStats(aggR.results[0], streak),
    weakWords: weakR.results,
    history: histR.results,
    monthData: { year, month: month + 1, days },
  }
}

// 某天的学习详情：新学/复习/答对 + 当日抽查
export async function getDayDetail(env, userId, dateStr) {
  const [newR, recallR, missR, checkR] = await DB(env).batch([
    DB(env).prepare(`SELECT COUNT(DISTINCT word_id) as c FROM review_log WHERE user_id = ? AND type = 'learning' AND date(reviewed_at) = ?`).bind(userId, dateStr),
    DB(env).prepare(`SELECT COUNT(DISTINCT word_id) as total, COUNT(DISTINCT CASE WHEN correct = 1 THEN word_id END) as correct FROM review_log WHERE user_id = ? AND type = 'recall' AND date(reviewed_at) = ?`).bind(userId, dateStr),
    DB(env).prepare(`SELECT w.word, w.definition, COUNT(*) as errors FROM review_log r JOIN words w ON w.id = r.word_id WHERE r.user_id = ? AND r.correct = 0 AND r.type = 'recall' AND date(r.reviewed_at) = ? GROUP BY r.word_id ORDER BY errors DESC LIMIT 5`).bind(userId, dateStr),
    DB(env).prepare(`SELECT id, total_words, correct, datetime(checked_at, '+8 hours') as checked_at FROM spot_checks WHERE user_id = ? AND date(checked_at, '+8 hours') = ? ORDER BY checked_at DESC`).bind(userId, dateStr),
  ])
  return {
    date: dateStr,
    newCount: newR.results[0]?.c || 0,
    reviewed: recallR.results[0]?.total || 0,
    correct: recallR.results[0]?.correct || 0,
    missedWords: missR.results,
    spotChecks: checkR.results,
  }
}

// ===== 收藏 =====
export async function getBookmarks(env, userId) {
  return DB(env).prepare(`SELECT w.*, b.created_at as bookmarked_at FROM bookmarks b JOIN words w ON w.id = b.word_id WHERE b.user_id = ? ORDER BY b.created_at DESC`).bind(userId).all().then(r => r.results)
}
export async function addBookmark(env, userId, wordId) {
  await DB(env).prepare('INSERT OR IGNORE INTO bookmarks (user_id, word_id) VALUES (?, ?)').bind(userId, wordId).run()
  return { ok: true }
}
export async function removeBookmark(env, userId, wordId) {
  await DB(env).prepare('DELETE FROM bookmarks WHERE user_id = ? AND word_id = ?').bind(userId, wordId).run()
  return { ok: true }
}

// ===== 词库 =====
// 学习状态小接口：只返回用户已学/收藏（几百行），不含词条全文
// 前端用它 + 本地词条缓存合并出 status/bookmarked，避免每次重拉全量词库
export async function getWordState(env, userId) {
  const bankId = await getBankId(env, userId)
  const [learnedR, bmR] = await DB(env).batch([
    DB(env).prepare('SELECT word_id, stage FROM word_learning WHERE user_id = ?').bind(userId),
    DB(env).prepare('SELECT word_id FROM bookmarks WHERE user_id = ?').bind(userId),
  ])
  return {
    bank_id: bankId,
    learned: learnedR.results,
    bookmarked: bmR.results.map(r => r.word_id),
  }
}

// 一次全量拉取用户词库（含学习状态 + 收藏状态），前端本地筛选
export async function getBankWords(env, userId) {
  return DB(env).prepare(`
    SELECT w.*,
      CASE WHEN p.stage = 'known' THEN 'mastered'
           WHEN p.word_id IS NOT NULL THEN 'learning'
           ELSE 'new' END as status,
      CASE WHEN p.stage = 'known' THEN 1 ELSE 0 END as mastered,
      CASE WHEN b.word_id IS NOT NULL THEN 1 ELSE 0 END as bookmarked
    FROM words w
    LEFT JOIN word_learning p ON w.id = p.word_id AND p.user_id = ?
    LEFT JOIN bookmarks b ON w.id = b.word_id AND b.user_id = ?
    WHERE w.bank_id = (SELECT bank_id FROM users WHERE id = ?)
    ORDER BY w.id
  `).bind(userId, userId, userId).all().then(r => r.results)
}

// ===== 家长端 =====
export async function startSpotCheck(env, userId, total, mode) {
  const today = todayCN()
  if (mode === 'today_new') {
    return await DB(env).prepare(`SELECT DISTINCT w.*, '今日新学' as category FROM review_log r JOIN words w ON w.id = r.word_id WHERE r.user_id = ? AND r.type = 'learning' AND date(r.reviewed_at) = ? ORDER BY RANDOM()`).bind(userId, today).all().then(r => r.results)
  }
  // 待复习池：next_review <= today
  let words = await DB(env).prepare(`SELECT DISTINCT w.*, '待复习' as category FROM words w INNER JOIN word_learning p ON w.id = p.word_id AND p.user_id = ? WHERE p.next_review <= ? ORDER BY RANDOM()`).bind(userId, today).all().then(r => r.results)
  // 当天待复习词都复习完了 → 回退到今天已复习过的词（家长仍可抽查）
  if (words.length === 0) {
    words = await DB(env).prepare(`SELECT DISTINCT w.*, '今日已复习' as category FROM review_log r JOIN words w ON w.id = r.word_id WHERE r.user_id = ? AND r.type = 'recall' AND date(r.reviewed_at) = ? ORDER BY RANDOM()`).bind(userId, today).all().then(r => r.results)
  }
  return words.slice(0, total)
}
export async function submitSpotCheckResult(env, userId, items, clientId) {
  const correct = items.filter(i => i.result === 1).length
  // 幂等：同一抽查会话重复提交（网络重试/本地缓冲补交）只记录一次
  if (clientId) {
    const exist = await DB(env).prepare('SELECT correct, total_words FROM spot_checks WHERE client_id = ?').bind(clientId).first()
    if (exist) return { correct: exist.correct, total: exist.total_words, already: true }
  }
  const result = await DB(env).prepare('INSERT INTO spot_checks (user_id, total_words, correct, client_id) VALUES (?, ?, ?, ?)').bind(userId, items.length, correct, clientId || null).run()
  const checkId = result.meta?.last_row_id
  const stmts = items.map(item => DB(env).prepare('INSERT INTO spot_check_items (check_id, word_id, category, result) VALUES (?, ?, ?, ?)').bind(checkId, item.word_id, item.category || '', item.result))
  if (stmts.length) await DB(env).batch(stmts)
  return { correct, total: items.length }
}
export async function reinforceWords(env, userId, wordIds) {
  const today = todayCN()
  const now = nowCN()
  const stmts = wordIds.map(wid => DB(env).prepare(`UPDATE word_learning SET stage = 'learning', gap = 1, reps = 0, next_review = ?, reviewed_at = ? WHERE user_id = ? AND word_id = ?`).bind(today, now, userId, wid))
  if (stmts.length) await DB(env).batch(stmts)
  return { updated: wordIds.length }
}
