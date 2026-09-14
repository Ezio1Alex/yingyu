import { RATE_LIMIT, RATE_LIMIT_BY_PATH } from './config.js'
import { normalizePath } from './routes.js'
import { guardCache } from './store.js'

// 基于 Cache API 的固定窗口计数器。
// 为什么不用 KV：KV 免费额度只有 1000 写/天，拿它做限流会立刻打爆 KV 本身。
//
// 几个有意为之的取舍：
//  1. 读-改-写有竞态（Cache API 没有原子自增），并发下实际放行量可能是阈值的几倍。限流是「近似」的，够用。
//  2. Cache API 按数据中心(colo)隔离，总放行量 ≈ 阈值 × 命中过的 colo 数。单源攻击基本落在一个 colo，够用。
//  3. 条目会被驱逐 —— 失败方向是「放行」，可用性优先。
//  4. 限流键**不含 query**：否则 agent 加个 ?a=1 就能造出新的桶，把限流整个绕过去。
//
// 返回 { ok: true } 或 { ok: false, retryAfter: 秒 }

// 读写分桶；个别路径（如 verify-pin）用 config 里的专属额度覆盖
function resolveLimit(method, pathname) {
  const p = normalizePath(pathname)
  const byPath = RATE_LIMIT_BY_PATH[p]
  if (byPath) return { bucket: 'path:' + p, cfg: byPath }
  const bucket = method === 'GET' ? 'read' : 'write'
  return { bucket, cfg: RATE_LIMIT[bucket] }
}

export async function checkRateLimit(origin, ip, method, pathname) {
  const { bucket, cfg } = resolveLimit(method, pathname)
  const c = await guardCache()
  if (!cfg || !c) return { ok: true } // 降级：拿不到缓存就不限流，不能把正常用户挡在外面

  const nowSec = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(nowSec / cfg.window) * cfg.window
  const key = `${origin}/__guard-rl/${encodeURIComponent(bucket)}/${encodeURIComponent(ip)}/${windowStart}`

  let count = 0
  try {
    const hit = await c.match(key)
    if (hit) count = parseInt(await hit.text(), 10) || 0
  } catch {
    return { ok: true }
  }

  if (count >= cfg.max) {
    return { ok: false, retryAfter: Math.max(1, windowStart + cfg.window - nowSec) }
  }

  try {
    // TTL 盖满整个窗口；窗口切换靠 key 里的 windowStart 天然生效，不需要清理
    await c.put(key, new Response(String(count + 1), {
      headers: { 'Cache-Control': `max-age=${cfg.window}`, 'Content-Type': 'text/plain' },
    }))
  } catch {
    // 计数写失败就退化成不限流
  }

  return { ok: true }
}
