/**
 * 本地开发 API 服务器
 * 直接读取 wrangler 生成的 D1 SQLite 文件
 * Node.js 22+ 内置 node:sqlite，零依赖
 *
 * 用法: node scripts/dev-api.mjs
 * 自动:   http://127.0.0.1:8788/api/*
 *
 * 需要先初始化本地 D1:
 *   bash scripts/setup-local.sh
 */

import http from 'http'
import url from 'url'
import fs from 'fs'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import { DEFAULT_PARENT_PIN, parentPin, pinMatches } from '../functions/_config.js'

// ===== 查找本地 D1 SQLite 文件 =====
function findD1Db() {
  const stateDir = path.resolve('.wrangler/state/v3/d1')
  if (!fs.existsSync(stateDir)) return null
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const files = []
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) files.push(...walk(full))
      else if (e.name.endsWith('.sqlite') && e.name !== 'metadata.sqlite') files.push(full)
    }
    return files
  }
  const files = walk(stateDir)
  return files[0] || null
}

const dbPath = findD1Db()
if (!dbPath) {
  console.error('❌ 未找到本地 D1 数据库文件。')
  console.error('   请先运行: bash scripts/setup-local.sh')
  process.exit(1)
}

const db = new DatabaseSync(dbPath)

// ===== SQL 计数（验证缓存是否真的省下了 D1 读取）：API_DEBUG=1 时每个请求打印一次 =====
const sqlStats = { count: 0 }

// ===== D1 兼容封装（使 node:sqlite API 适配 D1 接口） =====
function D1() {
  const runStmt = (sql, params) => {
    sqlStats.count++
    const stmt = db.prepare(sql)
    if (/^\s*SELECT/i.test(sql)) return Promise.resolve({ results: stmt.all(...params) })
    const info = stmt.run(...params)
    return Promise.resolve({ meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } })
  }
  return {
    prepare(sql) {
      const make = (params) => ({
        _sql: sql, _params: params,
        all: () => runStmt(sql, params),
        first: () => { sqlStats.count++; return Promise.resolve(db.prepare(sql).get(...params) ?? null) },
        run: () => runStmt(sql, params),
      })
      // 支持 prepare(sql).all() 无参调用 和 prepare(sql).bind(...).all() 带参调用
      return { ...make([]), bind: (...args) => make(args) }
    },
    batch(stmts) {
      sqlStats.count++
      db.exec('BEGIN')
      try {
        const out = stmts.map(s => {
          const stmt = db.prepare(s._sql)
          if (/^\s*SELECT/i.test(s._sql)) return { results: stmt.all(...s._params) }
          const info = stmt.run(...s._params)
          return { meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } }
        })
        db.exec('COMMIT')
        return Promise.resolve(out)
      } catch (e) { db.exec('ROLLBACK'); throw e }
    },
  }
}

// ===== 本地 Cache API 垫片 =====
// Workers 运行时自带 Cache API，本地 Node 没有，用内存 Map 顶上，
// 目的是让限流/边缘缓存在本地跑的是和生产**完全同一套** _guard 代码。
// 特意复刻生产的两个坑，避免本地通过、线上静默失效：
//   1. 带 Cache-Control: private / no-store 的响应拒绝入缓存（生产是返回 413，不抛异常）
//   2. 带 Vary: * 的响应抛异常
// 故意**不提供 caches.default**：我们的代码不该用它（它是 CDN 的缓存本体），
// 万一有人写错，本地会立刻报错而不是悄悄污染线上 CDN 缓存。
function installCacheShim() {
  const namespaces = new Map()

  function makeCache(store) {
    const norm = (key) => (typeof key === 'string' ? key : key.url)
    return {
      async match(key) {
        const k = norm(key)
        const e = store.get(k)
        if (!e) return undefined
        if (e.expireAt && e.expireAt <= Date.now()) { store.delete(k); return undefined }
        return new Response(e.body, { status: e.status, headers: e.headers })
      },
      async put(key, res) {
        if (res.headers.get('Vary') === '*') throw new Error('Vary: * 不能入缓存')
        const cc = res.headers.get('Cache-Control') || ''
        if (/no-store|private/.test(cc)) {
          console.warn(`⚠️  cache.put 被拒绝（Cache-Control: ${cc}）—— 生产环境这里会静默不缓存`)
          return
        }
        const body = await res.text()
        const ma = /max-age=(\d+)/.exec(cc)
        store.set(norm(key), {
          body,
          status: res.status,
          headers: [...res.headers.entries()],
          expireAt: ma ? Date.now() + Number(ma[1]) * 1000 : 0,
        })
      },
      async delete(key) { store.delete(norm(key)) },
    }
  }

  globalThis.caches = {
    async open(name) {
      if (!namespaces.has(name)) namespaces.set(name, makeCache(new Map()))
      return namespaces.get(name)
    },
  }
}

installCacheShim()

const env = { DB: D1(), PARENT_PIN: process.env.PARENT_PIN || DEFAULT_PARENT_PIN }

// ===== 导入查询函数 =====
const Q = await import('../functions/_db/queries.js')

// ===== JSON 响应 =====
function json(data, status = 200) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(data),
  }
}

// ===== 路由 =====
async function route(method, path, query, body) {
  const uid = q => q?.user_id

  if (path === '/api/users' && method === 'GET') return json(await Q.getUsers(env))
  if (path === '/api/users' && method === 'POST') {
    if (!pinMatches(body.pin, parentPin(env))) return json({ error: 'PIN 码错误' }, 403)
    const id = body.name.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    return json(await Q.createUser(env, { id, name: body.name, grade: body.grade || '高中' }))
  }
  if (path === '/api/users' && method === 'DELETE') {
    if (!pinMatches(body.pin, parentPin(env))) return json({ error: 'PIN 码错误' }, 403)
    return json(await Q.deleteUser(env, body.user_id))
  }
  if (path === '/api/users/bank' && method === 'PUT') return json(await Q.updateUserBank(env, body.user_id, body.bank_id))
  if (path === '/api/today' && method === 'GET' && uid(query)) { const round = parseInt(query.round || '1'); const words = await Q.getTodayWords(env, uid(query), round); return json({ words, total: words.length }) }
  if (path === '/api/review/new' && method === 'GET' && uid(query)) { const words = await Q.getTodayNewWords(env, uid(query)); return json({ words, total: words.length }) }
  if (path === '/api/words/new' && method === 'GET' && uid(query)) return json({ words: await Q.getNewWords(env, uid(query), parseInt(query.count || '20')) })
  if (path === '/api/words/state' && method === 'GET' && uid(query)) return json(await Q.getWordState(env, uid(query)))
  if (path === '/api/words' && method === 'GET') {
    // 与 functions/api/words.js 保持一致：首选 bank_id，user_id 只作旧客户端兼容
    const bankId = query.bank_id
    if (bankId === '1' || bankId === '2') return json({ words: await Q.getBankWords(env, Number(bankId)) })
    if (bankId) return json({ error: 'bank_id 无效' }, 400)
    if (uid(query)) return json({ words: await Q.getBankWords(env, await Q.getBankId(env, uid(query))) })
    return json({ error: 'bank_id required' }, 400)
  }
  // ---- 聚合端点（每页 1 请求）----
  if (path === '/api/home' && method === 'GET' && uid(query)) return json(await Q.getHomeData(env, uid(query)))
  if (path === '/api/stats/summary' && method === 'GET' && uid(query)) return json(await Q.getStatsSummary(env, uid(query)))
  if (path === '/api/parent/dashboard' && method === 'GET' && uid(query)) return json(await Q.getParentDashboard(env, uid(query), query.month || ''))
  if (path === '/api/parent/day' && method === 'GET' && uid(query)) return json(await Q.getDayDetail(env, uid(query), query.date))
  if (path === '/api/learn/batch' && method === 'POST') return json(await Q.addNewWords(env, body.user_id, body.word_ids || []))
  if (path === '/api/review/batch' && method === 'POST') return json({ results: await Q.submitReviews(env, body.user_id, body.items || [], body.typings || []) })
  if (path === '/api/stats' && method === 'GET' && uid(query)) return json(await Q.getStats(env, uid(query)))
  if (path === '/api/settings' && method === 'PUT') {
    await env.DB.prepare('UPDATE users SET words_per_day = ? WHERE id = ?').bind(body.words_per_day, body.user_id).run()
    return json({ ok: true })
  }
  if (path === '/api/bookmarks' && method === 'GET' && uid(query)) return json({ words: await Q.getBookmarks(env, uid(query)) })
  if (path === '/api/bookmarks' && method === 'POST') return json(await Q.addBookmark(env, body.user_id, body.word_id))
  if (path === '/api/bookmarks' && method === 'DELETE') return json(await Q.removeBookmark(env, body.user_id, body.word_id))
  if (path === '/api/parent/spot-check' && method === 'POST') {
    // 与 functions/api/parent/spot-check.js 保持一致
    const wanted = body.total || 10
    const { words, candidates } = await Q.startSpotCheck(env, body.user_id, wanted, body.mode || 'normal')
    return json({ words, candidates, requested: wanted })
  }
  if (path === '/api/parent/spot-check/submit' && method === 'POST') return json({ summary: await Q.submitSpotCheckResult(env, body.user_id, body.items, body.client_id) })
  if (path === '/api/parent/reinforce' && method === 'POST') return json(await Q.reinforceWords(env, body.user_id, body.word_ids))
  if (path === '/api/parent/verify-pin' && method === 'POST') return json({ ok: String(body.pin || '') === String(env.PARENT_PIN) })

  return json({ error: 'Not found' }, 404)
}

// ===== 防护中间件：直接复用生产那一份，本地跑的就是线上跑的 =====
const guard = await import('../functions/api/_middleware.js')

function toFetchRequest(req, bodyBuf, port) {
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v)
  }
  // 生产由 Cloudflare 注入这个头；本地用回环地址顶上，
  // 想模拟不同 IP 可以带 x-real-ip（方便测限流分桶）
  if (!headers.has('CF-Connecting-IP')) {
    headers.set('CF-Connecting-IP', req.headers['x-real-ip'] || req.socket.remoteAddress || '127.0.0.1')
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && bodyBuf.length > 0
  return new Request(`http://127.0.0.1:${port}${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? bodyBuf : undefined,
  })
}

async function routeToResponse(fetchReq) {
  const parsed = url.parse(fetchReq.url, true)
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/'
  const body = await fetchReq.json().catch(() => ({}))
  const result = await route(fetchReq.method, pathname, parsed.query, body)
  return new Response(result.body, { status: result.status, headers: result.headers })
}

// ===== HTTP 处理器 =====
async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, json({}).headers)
    res.end()
    return
  }

  const chunks = []
  for await (const c of req) chunks.push(c)
  const fetchReq = toFetchRequest(req, Buffer.concat(chunks), PORT)

  const pending = []
  const ctx = {
    request: fetchReq,
    env,
    waitUntil: (p) => pending.push(p),
    next: () => routeToResponse(fetchReq.clone()),
  }

  const sqlBefore = sqlStats.count
  let out
  try {
    out = await guard.onRequest(ctx)
  } catch (e) {
    console.error('❌', req.method, req.url, e.message)
    out = Response.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
  // 本地把 waitUntil 的任务等完，保证缓存写入对下一个请求立即可见（生产是后台执行）
  await Promise.allSettled(pending)

  if (process.env.API_DEBUG) {
    const sql = sqlStats.count - sqlBefore
    console.log(`${req.method} ${req.url} → ${out.status} [SQL:${sql}] cache=${out.headers.get('X-Cache') || '-'}`)
  }

  const headers = {}
  for (const [k, v] of out.headers) headers[k] = v
  res.writeHead(out.status, headers)
  res.end(Buffer.from(await out.arrayBuffer()))
}

// ===== 启动服务器 =====
const PORT = parseInt(process.env.API_PORT || '8788')
const server = http.createServer(handler)
server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ API 开发服务器: http://127.0.0.1:${PORT}`)
  console.log(`   前端: npm run dev (端口 5173)`)
  console.log(`   测试: curl http://127.0.0.1:${PORT}/api/users`)
})