import * as Q from '../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const { user_id, total, mode } = await request.json()
  const words = await Q.startSpotCheck(env, user_id, total || 10, mode || 'normal')
  return Response.json({ words })
}
