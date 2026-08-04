import * as Q from '../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  if (request.method !== 'GET') return new Response(null, { status: 405 })
  const userId = url.searchParams.get('user_id')
  const count = parseInt(url.searchParams.get('count') || '20')
  if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 })
  const words = await Q.getNewWords(env, userId, count)
  return Response.json({ words })
}
