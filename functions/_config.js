// 应用级共享配置（`_` 前缀 = Pages 不会把它当路由）

// 家长 PIN 的兜底默认值：14 位随机组合（已剔除 0/O、1/l/I 等易混字符，方便在手机上输入）。
//
// ⚠️ 本仓库是公开的，所以这个默认值等同于公开的。它只解决「脚本盲猜 0000-9999」这类问题，
//    不构成真正的访问控制。**部署时请务必在 Cloudflare Pages 设置环境变量 `PARENT_PIN` 覆盖它**
//    （Settings → Environment variables）。改这里只影响没配环境变量的情况。
//
// 校验统一走这里，避免各处各写一份默认值导致改了一处漏一处。
export const DEFAULT_PARENT_PIN = 'kxvhb8BRkuSWFN'

export function parentPin(env) {
  return String(env?.PARENT_PIN || DEFAULT_PARENT_PIN)
}

// 常量时间比较，避免通过响应时间差逐位猜 PIN
export function pinMatches(input, expected) {
  const a = String(input ?? '')
  const b = String(expected ?? '')
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
