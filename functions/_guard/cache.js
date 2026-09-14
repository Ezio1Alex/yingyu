import { normalizePath, normalizeParams } from './routes.js'
import { guardCache } from './store.js'

// 缓存键由「规范化路径 + 白名单参数」构成，agent 塞无关参数无法制造出新的键来绕过缓存
function cacheKey(origin, pathname, normQuery) {
  return `${origin}/__guard${normalizePath(pathname)}${normQuery ? '?' + normQuery : ''}`
}

// 命中返回 body 字符串（0 次 D1 读），否则 null
export async function matchCached(origin, pathname, normQuery) {
  const c = await guardCache()
  if (!c) return null
  try {
    const hit = await c.match(cacheKey(origin, pathname, normQuery))
    return hit ? await hit.text() : null
  } catch {
    return null // 缓存出问题就当没有，不能连累正常请求
  }
}

// res 必须是 clone() —— 这里会把 body 读掉。
// 注意 cache.put 对带 Cache-Control: private / no-store 的响应不会抛异常，而是返回 413 静默不缓存，
// 所以这份入缓存的响应必须显式写 max-age；遇到 Vary: * 或非 GET 才真的会抛，用 try/catch 兜住。
export async function putCached(origin, pathname, normQuery, res, ttl) {
  const c = await guardCache()
  if (!c || !ttl || !res || !res.ok) return
  try {
    const body = await res.text()
    await c.put(cacheKey(origin, pathname, normQuery), new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `max-age=${ttl}`,
      },
    }))
  } catch {
    // 缓存失败不影响已经返回给用户的响应
  }
}

// 写请求成功后失效该用户的只读缓存。
// Cache API 是 per-colo 的，delete 也只清本 colo，所以这里只是「尽力而为」——真正兜底的是短 TTL。
// 注意 /api/words 按 bank_id 缓存、与用户无关，所以不在失效列表里。
const PURGE_BY_USER = ['/api/home', '/api/stats/summary', '/api/words/state']

export async function purgeForWrite(origin, pathname, body) {
  const c = await guardCache()
  if (!c) return
  const userId = body && typeof body.user_id === 'string' ? body.user_id : null
  const isUserWrite = normalizePath(pathname) === '/api/users'

  const keys = []
  if (isUserWrite) {
    keys.push(cacheKey(origin, '/api/users', normalizeParams(new URLSearchParams(), [])))
  }
  if (userId) {
    const q = normalizeParams(new URLSearchParams({ user_id: userId }), ['user_id'])
    for (const p of PURGE_BY_USER) keys.push(cacheKey(origin, p, q))
  }

  await Promise.all(keys.map(async (key) => {
    try { await c.delete(key) } catch { /* 单个键删不掉就算了 */ }
  }))
}
