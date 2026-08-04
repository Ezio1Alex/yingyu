export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'PUT') return new Response(null, { status: 405 })
  const { user_id, words_per_day } = await request.json()
  await env.DB.prepare('UPDATE users SET words_per_day = ? WHERE id = ?').bind(words_per_day, user_id).run()
  return Response.json({ ok: true })
}
