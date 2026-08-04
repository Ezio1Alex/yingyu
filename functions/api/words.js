import * as Q from '../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'GET') return new Response(null, { status: 405 })
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id')
  if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 })
  // 全量返回用户词库（前端本地搜索/筛选/收藏）
  const words = await Q.getBankWords(env, userId)
  return Response.json({ words })
}
