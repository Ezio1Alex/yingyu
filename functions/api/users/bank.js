import * as Q from '../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'PUT') {
    const { user_id, bank_id } = await request.json()
    await Q.updateUserBank(env, user_id, bank_id)
    return Response.json({ ok: true })
  }
  return new Response(null, { status: 405 })
}
