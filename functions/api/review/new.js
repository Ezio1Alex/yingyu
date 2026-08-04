import * as Q from '../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'GET') return new Response(null, { status: 405 })
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id')
  if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 })
  // 今日新学回顾：只读拉取今天学的词，练习纯本地、不落库
  const words = await Q.getTodayNewWords(env, userId)
  return Response.json({ words, total: words.length })
}
