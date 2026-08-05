// 临时测试脚本：用 node:sqlite 适配 D1 API，真实跑 queries.js 全流程
// 用法: node scripts/test-flow.mjs
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// ---------- 临时库 ----------
const dir = mkdtempSync(join(tmpdir(), 'vocab-test-'))
const dbFile = join(dir, 'test.sqlite')
const db = new DatabaseSync(dbFile)
const schema = readFileSync(new URL('../functions/_db/schema.sql', import.meta.url), 'utf8')
db.exec(schema)

// ---------- D1 适配器 ----------
class D1Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = [] }
  bind(...args) { this.params = args; return this }
  all() { return Promise.resolve({ results: this.db.prepare(this.sql).all(...this.params) }) }
  first() { return Promise.resolve(this.db.prepare(this.sql).get(...this.params) ?? null) }
  run() { const info = this.db.prepare(this.sql).run(...this.params); return Promise.resolve({ meta: { changes: info.changes, last_row_id: info.lastInsertRowid } }) }
}
const env = {
  DB: {
    prepare(sql) { return new D1Stmt(db, sql) },
    batch(stmts) {
      db.exec('BEGIN')
      try {
        const out = stmts.map(s => {
          const stmt = db.prepare(s.sql)
          if (/^\s*SELECT/i.test(s.sql)) return { results: stmt.all(...s.params) }
          const info = stmt.run(...s.params)
          return { meta: { changes: info.changes, last_row_id: info.lastInsertRowid } }
        })
        db.exec('COMMIT')
        return Promise.resolve(out)
      } catch (e) { db.exec('ROLLBACK'); throw e }
    },
  },
}

const Q = await import(pathToFileURL(join(process.cwd(), 'functions/_db/queries.js')))
const sm2mod = await import(pathToFileURL(join(process.cwd(), 'functions/_srs/sm2.js')))

let pass = 0, fail = 0
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.log(`  ❌ ${msg}`) }
}

// ---------- 种子数据 ----------
db.exec(`INSERT INTO words (word, definition, bank_id) VALUES
  ('apple','n. 苹果',1),('book','n. 书',1),('cat','n. 猫',1),('dog','n. 狗',1),('egg','n. 蛋',1),
  ('fish','n. 鱼',1),('girl','n. 女孩',1),('house','n. 房子',1),('ice','n. 冰',1),('jump','v. 跳',1)`)
db.exec(`INSERT INTO users (id, name, grade, bank_id, words_per_day) VALUES ('u1', '小明', '初中', 1, 5)`)

console.log('\n--- sm2 阶段转换 ---')
{
  let r = sm2mod.sm2(5, 2.5, 1, 0); ok(r.reps === 1 && r.stage === 'reviewing' && r.gap === 1, `首次答对 → reviewing, reps=${r.reps}, gap=${r.gap}`)
  r = sm2mod.sm2(5, r.ease, r.gap, r.reps); ok(r.stage === 'reviewing' && r.gap === 6, `第二次答对 → reviewing, gap=${r.gap}`)
  r = sm2mod.sm2(5, r.ease, r.gap, r.reps); ok(r.stage === 'reviewing', `第三次答对 → reviewing`)
  r = sm2mod.sm2(5, r.ease, r.gap, r.reps); ok(r.stage === 'known' && r.reps === 4, `第四次答对 → known, reps=${r.reps}`)
  r = sm2mod.sm2(0, r.ease, r.gap, r.reps); ok(r.stage === 'learning' && r.reps === 0 && r.gap === 1, `答错重置 → learning`)
}

console.log('\n--- 首页聚合 getHomeData ---')
{
  const h = await Q.getHomeData(env, 'u1')
  ok(h.stats.mastered === 0 && h.stats.learning === 0 && h.stats.notStarted === 10, `初始统计 0/0/10, 实际 ${h.stats.mastered}/${h.stats.learning}/${h.stats.notStarted}`)
  ok(h.dueToday === 0, `dueToday=0, 实际 ${h.dueToday}`)
  ok(h.remainingNew === 10, `remainingNew=10, 实际 ${h.remainingNew}`)
}

console.log('\n--- 批量学新词 addNewWords ---')
{
  const words = await Q.getNewWords(env, 'u1', 5)
  ok(words.length === 5, `getNewWords 返回 5 词, 实际 ${words.length}`)
  const ids = words.map(w => w.id)
  const r = await Q.addNewWords(env, 'u1', ids)
  ok(r.learned === 5, `learned=5, 实际 ${r.learned}`)
  // 重复学同一批应跳过
  const r2 = await Q.addNewWords(env, 'u1', ids)
  ok(r2.learned === 0, `重复提交 learned=0, 实际 ${r2.learned}`)
  // 学完后首页状态
  const h = await Q.getHomeData(env, 'u1')
  ok(h.stats.learning === 5 && h.remainingNew === 5, `学 5 词后 learning=5 remainingNew=5, 实际 ${h.stats.learning}/${h.remainingNew}`)
  ok(h.stats.today === 5 && h.stats.todayNew === 5, `today=5 todayNew=5, 实际 ${h.stats.today}/${h.stats.todayNew}`)
  // 新词当天不进入复习池
  const t = await Q.getTodayWords(env, 'u1', 1)
  ok(t.length === 0, `新词当天不复习, 实际 ${t.length}`)
  // 今日新学回顾：能拉到刚学的词（只读练习）
  const todayNew = await Q.getTodayNewWords(env, 'u1')
  ok(todayNew.length === 5, `今日新学回顾拉到 ${todayNew.length} 词`)
}

console.log('\n--- 批量复习 submitReviews ---')
{
  // 模拟过了一天：把两个词的 next_review 改到今天
  const learned = db.prepare('SELECT word_id FROM word_learning WHERE user_id = ? LIMIT 2').all('u1')
  const [w1, w2] = learned.map(x => x.word_id)
  db.prepare('UPDATE word_learning SET next_review = date(\'now\', \'+8 hours\') WHERE user_id = ? AND word_id = ?').run('u1', w1)
  db.prepare('UPDATE word_learning SET next_review = date(\'now\', \'+8 hours\') WHERE user_id = ? AND word_id = ?').run('u1', w2)

  const today = await Q.getTodayWords(env, 'u1', 1)
  ok(today.length >= 2, `今日待复习 >= 2, 实际 ${today.length}`)

  // 答对 w1(5分) 答错 w2(0分)，w1 顺带拼写强化
  const results = await Q.submitReviews(env, 'u1',
    [{ word_id: w1, score: 5 }, { word_id: w2, score: 0 }],
    [{ word_id: w1, correct: true }])

  const w1row = db.prepare('SELECT * FROM word_learning WHERE user_id=? AND word_id=?').get('u1', w1)
  const w2row = db.prepare('SELECT * FROM word_learning WHERE user_id=? AND word_id=?').get('u1', w2)
  ok(w1row.stage === 'reviewing' && w1row.reps === 1 && w1row.gap === 1, `w1 答对 → reviewing/reps=1/gap=1, 实际 ${w1row.stage}/${w1row.reps}/${w1row.gap}`)
  ok(w2row.stage === 'learning' && w2row.reps === 0 && w2row.gap === 1, `w2 答错 → learning/reps=0/gap=1, 实际 ${w2row.stage}/${w2row.reps}/${w2row.gap}`)

  const logs = db.prepare(`SELECT type, COUNT(*) c FROM review_log WHERE user_id='u1' GROUP BY type`).all()
  const m = Object.fromEntries(logs.map(x => [x.type, x.c]))
  ok(m.recall === 2 && m.spelling === 1 && m.learning === 5, `日志 recall=2 spelling=1 learning=5, 实际 ${JSON.stringify(m)}`)

  // round2 重复提交 w1：只记日志不更新 SM2
  const r1 = w1row
  const skip = await Q.submitReviews(env, 'u1', [{ word_id: w1, score: 5 }])
  ok(skip[0].skipped === true, `round2 重复 → skipped=true`)
  const w1b = db.prepare('SELECT * FROM word_learning WHERE user_id=? AND word_id=?').get('u1', w1)
  ok(w1b.reps === r1.reps && w1b.gap === r1.gap && w1b.stage === r1.stage, `SM2 状态未变`)
  // 修复：重复提交不再重复记日志（网络重试不会膨胀薄弱词汇错误计数）
  const recallCnt = db.prepare("SELECT COUNT(*) c FROM review_log WHERE user_id='u1' AND type='recall'").get().c
  ok(recallCnt === 2, `重复提交不重复记 recall 日志, 实际 ${recallCnt}`)

  // 当天二轮复习：首轮无未评分到期词时回退到今天已复习过的词
  const fallback = await Q.getTodayWords(env, 'u1', 1)
  ok(fallback.length >= 2, `首轮回退到今天已复习词, 实际 ${fallback.length}`)
  const round2List = await Q.getTodayWords(env, 'u1', 2)
  ok(round2List.length >= 2, `第二轮含今天已复习词, 实际 ${round2List.length}`)
}

console.log('\n--- 抽查回退（待复习池空 → 今天已复习词）---')
{
  // 此时所有到期词都已复习（next_review 推到明天），待复习池为空
  const sc = await Q.startSpotCheck(env, 'u1', 10, 'normal')
  ok(sc.length === 2 && sc.every(w => w.category === '今日已复习'), `抽查回退: ${sc.map(w => w.word).join(',')} (${sc.length}词)`)
}

console.log('\n--- 统计聚合 ---')
{
  const s = await Q.getStats(env, 'u1')
  ok(s.learning === 5 && s.streak === 1 && s.today === 5, `stats learning=5 streak=1 today=5, 实际 ${s.learning}/${s.streak}/${s.today}`)
  const summary = await Q.getStatsSummary(env, 'u1')
  ok(summary.weeks.length === 3, `三周数据一次拉取, 实际 ${summary.weeks.length} 周`)
  const wk0 = summary.weeks[0]
  ok(wk0.offset === 0 && wk0.weekData.length === 7 && wk0.weekData[0].label === '周一', `本周 7 天从周一开始`)
  const todayEntry = wk0.weekData.find(d => d.isToday)
  ok(todayEntry && todayEntry.count === 5, `今天(${todayEntry?.date}) 学 5 词`)
  ok(wk0.weakWords.length === 1 && wk0.weakWords[0].errors === 1, `本周薄弱词=1 错 1 次, 实际 ${wk0.weakWords.length}`)
  ok(summary.weeks.every(w => w.weekData.length === 7), `三周均 7 天结构完整`)
  ok(summary.weeks[1].offset === 1 && summary.weeks[2].offset === 2, `三周 offset 0/1/2`)
  ok(summary.weeks[1].weekData.every(d => d.count === 0) && summary.weeks[2].weekData.every(d => d.count === 0), `历史周无学习数据`)
  ok(summary.weeks[1].weakWords.length === 0 && summary.weeks[2].weakWords.length === 0, `历史周无薄弱词`)
  const parent = await Q.getParentDashboard(env, 'u1')
  ok(parent.stats.learning === 5 && parent.monthData.days.length > 20, `家长看板 learning=5 日历生成`)
}

console.log('\n--- banks 静态总词数 / 学习状态接口 ---')
{
  const bank = db.prepare('SELECT * FROM banks WHERE id = 1').get()
  ok(bank && bank.total_words === 10, `banks 惰性初始化 total_words=10, 实际 ${bank?.total_words}`)
  const st = await Q.getWordState(env, 'u1')
  ok(st.learned.length === 5 && st.bookmarked.length === 0, `getWordState learned=5 bookmarked=0, 实际 ${st.learned.length}/${st.bookmarked.length}`)
  ok(st.learned.every(l => typeof l.word_id === 'number' && typeof l.stage === 'string'), `learned 每项含 word_id/stage`)
}

console.log('\n--- 收藏/加强/抽查 ---')
{
  const words = db.prepare('SELECT id FROM words LIMIT 2').all()
  await Q.addBookmark(env, 'u1', words[0].id)
  const bm = await Q.getBookmarks(env, 'u1')
  ok(bm.length === 1, `收藏 1 词`)
  await Q.removeBookmark(env, 'u1', words[0].id)
  ok((await Q.getBookmarks(env, 'u1')).length === 0, `取消收藏`)

  // 用一个确定已学习的词做加强（避免 RANDOM 不稳定）
  const learned = db.prepare("SELECT word_id FROM word_learning WHERE user_id = 'u1' LIMIT 1").all()
  const learnId = learned[0].word_id
  await Q.reinforceWords(env, 'u1', [learnId])
  const w = db.prepare('SELECT * FROM word_learning WHERE user_id=? AND word_id=?').get('u1', learnId)
  ok(w.stage === 'learning' && w.gap === 1 && w.reps === 0, `加强后重置为 learning`)

  const sc = await Q.startSpotCheck(env, 'u1', 10, 'normal')
  ok(sc.length >= 1, `抽查可出题, 实际 ${sc.length}`)
  const res = await Q.submitSpotCheckResult(env, 'u1', [{ word_id: learnId, result: 1, category: '待复习' }])
  ok(res.correct === 1 && res.total === 1, `抽查提交`)
  const dash = await Q.getParentDashboard(env, 'u1')
  ok(dash.history.length === 1, `抽查历史 1 条`)
}

console.log('\n--- 家长按月看板 / 按天详情 ---')
{
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
  const monthStr = today.slice(0, 7)
  const dash = await Q.getParentDashboard(env, 'u1', monthStr)
  ok(dash.monthData.days.length > 20, `按月看板日历生成`)
  ok(dash.weakWords.length === 1 && dash.weakWords[0].errors === 1, `当月薄弱词 ${JSON.stringify(dash.weakWords)}`)
  ok(dash.history.length === 1, `当月抽查历史 1 条`)
  // 空月份应无数据
  const emptyDash = await Q.getParentDashboard(env, 'u1', '2020-01')
  ok(emptyDash.weakWords.length === 0 && emptyDash.history.length === 0, `2020-01 空月份无数据`)
  // 当天详情
  const detail = await Q.getDayDetail(env, 'u1', today)
  ok(detail.newCount === 5 && detail.reviewed === 2 && detail.correct === 1, `当日详情 新学${detail.newCount} 复习${detail.reviewed} 对${detail.correct}`)
  ok(detail.missedWords.length === 1 && detail.missedWords[0].errors === 1, `当日薄弱词 1 个`)
  ok(detail.spotChecks.length === 1, `当日抽查 1 条`)
}

console.log('\n--- 词库全量查询 ---')
{
  const words = await Q.getBankWords(env, 'u1')
  ok(words.length === 10, `全量拉取 ${words.length} 词`)
  ok(words.every(w => w.status === 'new' || w.status === 'learning' || w.status === 'mastered'), `每条都有 status`)
  ok(words.every(w => typeof w.bookmarked === 'number'), `每条都有 bookmarked`)
}

console.log('\n--- 删除用户（级联清数据，不留垃圾）---')
{
  await Q.createUser(env, { id: 'u2', name: '小红', grade: '初中' })
  const words = await Q.getNewWords(env, 'u2', 3)
  await Q.addNewWords(env, 'u2', words.map(w => w.id))
  const wordId = words[0].id
  await Q.addBookmark(env, 'u2', wordId)
  await Q.submitSpotCheckResult(env, 'u2', [{ word_id: wordId, result: 1, category: '待复习' }])
  // 幂等：同 client_id 重复提交不重复插入（网络重试/缓冲补交场景）
  const first = await Q.submitSpotCheckResult(env, 'u2', [{ word_id: wordId, result: 1, category: '待复习' }], 'u2-session-1')
  const dup = await Q.submitSpotCheckResult(env, 'u2', [{ word_id: wordId, result: 1, category: '待复习' }], 'u2-session-1')
  ok(first.already === undefined && dup.already === true, `同 client_id 第一次插入、第二次 already=true`)
  ok(db.prepare("SELECT COUNT(*) c FROM spot_checks WHERE client_id='u2-session-1'").get().c === 1, `同 client_id 只插 1 条`)

  await Q.deleteUser(env, 'u2')
  ok(db.prepare("SELECT COUNT(*) c FROM users WHERE id='u2'").get().c === 0, `users 表已删 u2`)
  ok(db.prepare("SELECT COUNT(*) c FROM word_learning WHERE user_id='u2'").get().c === 0, `word_learning 已清`)
  ok(db.prepare("SELECT COUNT(*) c FROM review_log WHERE user_id='u2'").get().c === 0, `review_log 已清`)
  ok(db.prepare("SELECT COUNT(*) c FROM bookmarks WHERE user_id='u2'").get().c === 0, `bookmarks 已清`)
  ok(db.prepare("SELECT COUNT(*) c FROM spot_checks WHERE user_id='u2'").get().c === 0, `spot_checks 已清`)
  const orphan = db.prepare('SELECT COUNT(*) c FROM spot_check_items WHERE check_id NOT IN (SELECT id FROM spot_checks)').get().c
  ok(orphan === 0, `spot_check_items 无孤儿（级联删除）`)
  ok(db.prepare("SELECT COUNT(*) c FROM users WHERE id='u1'").get().c === 1, `u1 不受影响`)
}

// 清理
db.close()
rmSync(dir, { recursive: true, force: true })

console.log(`\n========== 结果: ${pass} 通过, ${fail} 失败 ==========`)
process.exit(fail ? 1 : 0)
