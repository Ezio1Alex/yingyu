// ===== API 防护配置：所有可调旋钮集中在这里 =====

// 紧急开关：改成 true 并重新部署，所有 /api/* 立刻返回 503
// 想要「秒级」止血请用 Cloudflare Dashboard 的 WAF 自定义规则（见 README）
export const API_DISABLED = false

// ===== 每 IP 限流（固定窗口）=====
// 读/写分两个桶：D1 免费额度读是 500 万行/天、写是 10 万行/天，写洪水同样能打爆额度
// 家里多台设备共用同一个出口 IP 导致误伤时，把 max 调大即可
export const RATE_LIMIT = {
  read: { window: 60, max: 60 }, // GET
  write: { window: 60, max: 15 }, // POST / PUT / DELETE
}

// 个别路径用更严的额度（覆盖上面的桶）
// verify-pin 是猜 PIN 的入口，不给它单独限额等于把 PIN 交给爆破脚本
export const RATE_LIMIT_BY_PATH = {
  '/api/parent/verify-pin': { window: 60, max: 5 },
}

// ===== 热点 GET 的边缘缓存 TTL（秒）=====
// 见 routes.js 里每个路由的 cache 配置。缓存键只由白名单参数构成，攻击者加无关参数无法绕过。
// Cache API 按数据中心隔离，写后失效只清本 colo —— 真正兜底的是 TTL，所以取值都偏保守。
export const CACHE_TTL = {
  words: 600, // 词库全量：按 bank_id 缓存，全站只有 2 个条目
  home: 15, // 含当日计数，TTL 必须短，且写请求后会失效
  statsSummary: 15, // 同上
  wordsState: 30, // 已学/收藏集合，写请求后会失效
  users: 60, // 用户列表
}

// ===== 可选的共享密钥（默认关闭）=====
// 后端读环境变量 APP_KEY、前端读 VITE_APP_KEY，两边都配上才生效。
// 注意：本仓库是公开的，任何打进前端的密钥 F12 就能看到 —— 它不是安全边界，
// 只挡不执行 JS 的裸扫描器。真正扛攻击的是限流 + 零 D1 成本的边缘缓存。
export const REQUIRE_APP_KEY = false
