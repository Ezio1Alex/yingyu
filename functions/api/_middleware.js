import { API_DISABLED, REQUIRE_APP_KEY } from '../_guard/config.js'
import { matchRoute, normalizeParams, cacheTtl } from '../_guard/routes.js'
import { checkRateLimit } from '../_guard/ratelimit.js'
import { matchCached, putCached, purgeForWrite } from '../_guard/cache.js'

// 只作用于 /api/* 的防护中间件（Pages 的目录级 middleware）。
// 顺序按「便宜 → 昂贵」，任一环节拦下就完全不碰 D1：
//   紧急开关 → 路由白名单 → 共享密钥(可选) → 每 IP 限流 → 边缘缓存命中? → handler
//
// 附带说明：Pages 会把 middleware 和 handler 编译进同一个 worker，
// 所以加这一层**不会**额外消耗 Functions 调用次数。

function json(data, status = 200, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      ...extraHeaders,
    },
  })
}

// 响应的头可能是只读的（比如来自 fetch 的响应），改不动就算了，不值得让请求失败
function setHeader(res, name, value) {
  try { res.headers.set(name, value) } catch { /* ignore */ }
}

export async function onRequest(ctx) {
  const { request, env } = ctx
  const url = new URL(request.url)
  const isGet = request.method === 'GET'

  // 1. 紧急开关
  if (API_DISABLED) return json({ error: '服务维护中，请稍后再试' }, 503)

  // 2. 路由白名单：不在表里的路径/方法直接 404，不碰 D1
  const route = matchRoute(request.method, url.pathname)
  if (!route) return json({ error: 'Not found' }, 404)

  // 3. 可选的共享密钥（默认关闭，见 config.js 里 REQUIRE_APP_KEY 的说明）
  if (REQUIRE_APP_KEY && env.APP_KEY) {
    if (request.headers.get('X-App-Key') !== env.APP_KEY) return json({ error: 'Forbidden' }, 403)
  }

  // 4. 每 IP 限流：读/写分桶，个别路径有专属额度。
  //    放在缓存查找之前 —— 要保护的不只是 D1 读额度，还有 Pages Functions 的 10 万次/天调用额度。
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const rl = await checkRateLimit(url.origin, ip, request.method, url.pathname)
  if (!rl.ok) {
    return json({ error: '请求过于频繁，请稍后再试' }, 429, { 'Retry-After': String(rl.retryAfter) })
  }

  // 5. 边缘缓存命中 → 直接返回，0 次 D1 读。
  //    缓存键只由白名单参数构成（防 ?a=1 这类变体绕过）；参数没给全就干脆不缓存 ——
  //    宁可不缓存，也不能让不同用户的响应串味。
  const ttl = isGet ? cacheTtl(route) : 0
  const normQuery = ttl ? normalizeParams(url.searchParams, route.params) : null

  if (ttl && normQuery !== null) {
    const body = await matchCached(url.origin, url.pathname, normQuery)
    if (body !== null) {
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store',
          'X-Cache': 'HIT',
        },
      })
    }
  }

  // 写请求要先克隆一份 body 取 user_id 用于写后失效 ——
  // handler 会把原始 body 读掉，之后再读会抛 "body already used"，所以必须在 ctx.next() 之前克隆。
  const writeBody = isGet ? null : await request.clone().json().catch(() => null)

  const res = await ctx.next()

  if (ttl && normQuery !== null && res.ok) {
    try {
      ctx.waitUntil(putCached(url.origin, url.pathname, normQuery, res.clone(), ttl))
    } catch { /* clone 失败就不缓存 */ }
  }

  if (!isGet && res.ok) {
    ctx.waitUntil(purgeForWrite(url.origin, url.pathname, writeBody))
  }

  // 所有 /api 响应都不让浏览器缓存：都是 per-user 数据，缓存下来只会在切换用户/刷新时出怪事
  setHeader(res, 'Cache-Control', 'private, no-store')
  return res
}
