// 构建后生成 SPA 兜底用的 404.html（内容 = index.html）
// Cloudflare Pages 对不存在的路径返回 404.html（纯静态 CDN 处理，不消耗 Functions 调用，
// 也不再像 functions/[[path]].js 那样把每个静态请求都计成一次 Worker 调用）
import { copyFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
console.log('✅ 已生成 dist/404.html')
