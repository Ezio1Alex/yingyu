import * as Q from '../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const { user_id, word_ids } = await request.json()
  const result = await Q.addNewWords(env, user_id, word_ids || [])
  return Response.json(result)
}
