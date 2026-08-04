import * as Q from '../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const { user_id, items, typings } = await request.json()
  const results = await Q.submitReviews(env, user_id, items || [], typings || [])
  return Response.json({ results })
}
