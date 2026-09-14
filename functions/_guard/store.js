// 命名缓存的唯一入口。
// 用 caches.open() 而不是 caches.default：后者就是本 zone 的边缘缓存本体，
// 往里面写限流计数、per-user 响应这类内部条目，等于把内部数据放进了 CDN 的命名空间。
// 命名缓存只在 Worker 内部可见，外部 URL 取不回来。
//
// 只 memo promise（模块级），绝不把 per-request 的数据放模块级变量。
const CACHE_NAME = 'yingyu-guard'

let cachePromise = null

export function guardCache() {
  if (typeof caches === 'undefined' || typeof caches.open !== 'function') return null
  if (!cachePromise) {
    // open 本身也可能失败；失败后清掉 memo，下次请求重试而不是永久卡在 rejected promise 上
    cachePromise = caches.open(CACHE_NAME).catch(() => {
      cachePromise = null
      return null
    })
  }
  return cachePromise
}
