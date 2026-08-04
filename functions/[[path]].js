// SPA 路由兜底：不存在的路径（如 /home、/stats）返回 index.html，交给前端路由接管
// 注意：[[path]] 会接管所有未被具体 Function 匹配的路径（含静态文件），
// 所以必须先让 ASSETS.fetch 命中真实静态资源，仅对 404 才 fallback。
// fallback 用根路径 `/` 而非 `/index.html`——后者会触发 Pages 的 clean-URL 308 导致重定向循环。
export async function onRequest(context) {
  const { env, request } = context
  const url = new URL(request.url)
  // /api 下的 404 保持 JSON 错误，不 fallback 成页面
  if (url.pathname.startsWith('/api/')) {
    return new Response('Not found', { status: 404 })
  }
  // 先尝试命中静态资源（js/css/png/svg 等真实文件）
  const res = await env.ASSETS.fetch(request)
  if (res.status !== 404) return res
  // 未命中的路径 → SPA fallback
  return env.ASSETS.fetch(new Request(new URL('/', url), request))
}
