import * as Q from '../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'GET') return new Response(null, { status: 405 })
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id')
  const date = url.searchParams.get('date') // YYYY-MM-DD
  if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 })
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  const data = await Q.getDayDetail(env, userId, date)
  return Response.json(data)
}
