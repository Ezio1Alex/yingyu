import * as Q from '../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id')
  const round = parseInt(url.searchParams.get('round') || '1')
  if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 })
  const words = await Q.getTodayWords(env, userId, round)
  return Response.json({ words, total: words.length })
}
