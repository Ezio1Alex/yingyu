import * as Q from '../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'GET') {
    const users = await Q.getUsers(env)
    return Response.json(users)
  }
  if (request.method === 'POST') {
    const { name, grade } = await request.json()
    const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    const user = await Q.createUser(env, { id, name, grade })
    return Response.json(user)
  }
  if (request.method === 'DELETE') {
    const { user_id } = await request.json()
    if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 })
    return Response.json(await Q.deleteUser(env, user_id))
  }
  return new Response(null, { status: 405 })
}
