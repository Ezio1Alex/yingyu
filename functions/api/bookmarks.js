import * as Q from '../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)

  if (request.method === 'GET') {
    const userId = url.searchParams.get('user_id')
    if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 })
    const words = await Q.getBookmarks(env, userId)
    return Response.json({ words })
  }
  if (request.method === 'POST') {
    const { user_id, word_id } = await request.json()
    await Q.addBookmark(env, user_id, word_id)
    return Response.json({ ok: true })
  }
  if (request.method === 'DELETE') {
    const { user_id, word_id } = await request.json()
    await Q.removeBookmark(env, user_id, word_id)
    return Response.json({ ok: true })
  }
  return new Response(null, { status: 405 })
}
