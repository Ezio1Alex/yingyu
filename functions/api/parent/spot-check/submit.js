import * as Q from '../../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const { user_id, items } = await request.json()
  const summary = await Q.submitSpotCheckResult(env, user_id, items)
  return Response.json({ summary })
}
