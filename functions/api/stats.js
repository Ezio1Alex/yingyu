import * as Q from '../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id')
  if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 })
  const stats = await Q.getStats(env, userId)
  return Response.json(stats)
}
