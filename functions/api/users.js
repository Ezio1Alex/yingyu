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
  return new Response(null, { status: 405 })
}
