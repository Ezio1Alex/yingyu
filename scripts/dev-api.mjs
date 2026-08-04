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

// ===== D1 兼容封装（使 node:sqlite API 适配 D1 接口） =====
function D1() {
  const runStmt = (sql, params) => {
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
        first: () => Promise.resolve(db.prepare(sql).get(...params) ?? null),
        run: () => runStmt(sql, params),
      })
      // 支持 prepare(sql).all() 无参调用 和 prepare(sql).bind(...).all() 带参调用
      return { ...make([]), bind: (...args) => make(args) }
    },
    batch(stmts) {
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

const env = { DB: D1(), PARENT_PIN: process.env.PARENT_PIN || '7777' }

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

function parseBody(req) {
  return new Promise(resolve => {
    let data = ''
    req.on('data', c => data += c)
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) }
      catch { resolve({}) }
    })
  })
}

// ===== 路由 =====
async function route(method, path, query, body) {
  const uid = q => q?.user_id

  if (path === '/api/users' && method === 'GET') return json(await Q.getUsers(env))
  if (path === '/api/users' && method === 'POST') {
    if (String(body.pin || '') !== String(env.PARENT_PIN)) return json({ error: 'PIN 码错误' }, 403)
    const id = body.name.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    return json(await Q.createUser(env, { id, name: body.name, grade: body.grade || '高中' }))
  }
  if (path === '/api/users' && method === 'DELETE') return json(await Q.deleteUser(env, body.user_id))
  if (path === '/api/users/bank' && method === 'PUT') return json(await Q.updateUserBank(env, body.user_id, body.bank_id))
  if (path === '/api/today' && method === 'GET' && uid(query)) { const round = parseInt(query.round || '1'); const words = await Q.getTodayWords(env, uid(query), round); return json({ words, total: words.length }) }
  if (path === '/api/review/new' && method === 'GET' && uid(query)) { const words = await Q.getTodayNewWords(env, uid(query)); return json({ words, total: words.length }) }
  if (path === '/api/words/new' && method === 'GET' && uid(query)) return json({ words: await Q.getNewWords(env, uid(query), parseInt(query.count || '20')) })
  if (path === '/api/words/state' && method === 'GET' && uid(query)) return json(await Q.getWordState(env, uid(query)))
  if (path === '/api/words' && method === 'GET' && uid(query)) return json({ words: await Q.getBankWords(env, uid(query)) })
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
  if (path === '/api/parent/spot-check' && method === 'POST') return json({ words: await Q.startSpotCheck(env, body.user_id, body.total || 10, body.mode || 'normal') })
  if (path === '/api/parent/spot-check/submit' && method === 'POST') return json({ summary: await Q.submitSpotCheckResult(env, body.user_id, body.items) })
  if (path === '/api/parent/reinforce' && method === 'POST') return json(await Q.reinforceWords(env, body.user_id, body.word_ids))
  if (path === '/api/parent/verify-pin' && method === 'POST') return json({ ok: String(body.pin || '') === String(env.PARENT_PIN) })

  return json({ error: 'Not found' }, 404)
}

// ===== HTTP 处理器 =====
async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, json({}).headers)
    res.end()
    return
  }

  const parsed = url.parse(req.url, true)
  const body = await parseBody(req)

  let result
  try {
    result = await route(req.method, parsed.pathname, parsed.query, body)
  } catch (e) {
    console.error('❌', req.method, parsed.pathname, e.message)
    result = json({ error: e.message || 'Internal error' }, 500)
  }

  res.writeHead(result.status, result.headers)
  res.end(result.body)
}

// ===== 启动服务器 =====
const PORT = parseInt(process.env.API_PORT || '8788')
const server = http.createServer(handler)
server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ API 开发服务器: http://127.0.0.1:${PORT}`)
  console.log(`   前端: npm run dev (端口 5173)`)
  console.log(`   测试: curl http://127.0.0.1:${PORT}/api/users`)
})