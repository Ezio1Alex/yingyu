import * as Q from '../../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const { user_id, items, client_id } = await request.json()
  const summary = await Q.submitSpotCheckResult(env, user_id, items, client_id)
  return Response.json({ summary })
}
