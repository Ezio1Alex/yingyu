import { CACHE_TTL } from './config.js'

// /api/* 路由表：未命中的路径/方法直接 404，完全不碰 D1（挡掉 /api/.env、/api/wp-admin 这类扫路径的机器人，
// 也顺手补上了几个端点缺失的 method 校验 —— 比如 POST /api/home 以前会照跑整个聚合查询）。
//
//   params: 参与缓存键的 query 参数白名单（**顺序固定**）。
//           这一步是防「缓存绕过」的关键：缓存键只由这几个参数构成，
//           攻击者塞 ?user_id=x&a=1、?a=1&user_id=x 之类的变体也只会命中同一条缓存。
//   cache:  config.js 里 CACHE_TTL 的键名；给了就启用边缘缓存。
//           注意：params 里任一参数缺失时不缓存（宁可不缓存，也不能让不同用户的响应互相串）。
//
// 新增端点必须同步这里，否则 middleware 会直接 404
const ROUTES = {
  '/api/users': { GET: {}, POST: {}, DELETE: {}, cache: 'users' },
  '/api/users/bank': { PUT: {} },
  '/api/today': { GET: { params: ['user_id', 'round'] } },
  '/api/home': { GET: { params: ['user_id'], cache: 'home' } },
  '/api/stats': { GET: { params: ['user_id'] } },
  '/api/stats/summary': { GET: { params: ['user_id'], cache: 'statsSummary' } },
  '/api/words': { GET: { params: ['bank_id'], cache: 'words' } },
  '/api/words/new': { GET: { params: ['user_id', 'count'] } },
  '/api/words/state': { GET: { params: ['user_id'], cache: 'wordsState' } },
  '/api/review/new': { GET: { params: ['user_id'] } },
  '/api/review/batch': { POST: {} },
  '/api/learn/batch': { POST: {} },
  '/api/settings': { PUT: {} },
  '/api/bookmarks': { GET: { params: ['user_id'] }, POST: {}, DELETE: {} },
  '/api/parent/dashboard': { GET: { params: ['user_id', 'month'] } },
  '/api/parent/day': { GET: { params: ['user_id', 'date'] } },
  '/api/parent/verify-pin': { POST: {} },
  '/api/parent/spot-check': { POST: {} },
  '/api/parent/spot-check/submit': { POST: {} },
  '/api/parent/reinforce': { POST: {} },
}

// 去掉结尾多余的 /（Pages 路由本身就容忍尾斜杠）。
// 路由判定、缓存键、限流键都走这个函数，保证 /api/words 和 /api/words/ 是同一件事。
export function normalizePath(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

// 命中返回该方法的配置对象，否则 null
export function matchRoute(method, pathname) {
  return ROUTES[normalizePath(pathname)]?.[method] ?? null
}

// 按白名单、固定顺序重建 query —— 这是缓存键与限流键的唯一来源。
// 返回 null 表示白名单里的参数没给全，调用方应跳过缓存。
export function normalizeParams(searchParams, allowed) {
  const parts = []
  for (const key of allowed || []) {
    const value = searchParams.get(key)
    if (value === null || value === '') return null
    parts.push(`${key}=${encodeURIComponent(value)}`)
  }
  return parts.join('&')
}

export function cacheTtl(route) {
  return route?.cache ? (CACHE_TTL[route.cache] || 0) : 0
}
