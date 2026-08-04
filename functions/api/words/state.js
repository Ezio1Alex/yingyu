import * as Q from '../../_db/queries.js'

// 学习状态小接口：只返回用户已学/收藏列表，前端合并本地词条缓存
export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'GET') return new Response(null, { status: 405 })
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id')
  if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 })
  return Response.json(await Q.getWordState(env, userId))
}
