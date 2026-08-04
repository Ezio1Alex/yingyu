import * as Q from '../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'GET') {
    const users = await Q.getUsers(env)
    return Response.json(users)
  }
  if (request.method === 'POST') {
    const { name, grade, pin } = await request.json()
    // 创建用户需家长 PIN 管控，防止陌生人无限刷号
    const expected = env.PARENT_PIN || '7777'
    if (String(pin || '') !== String(expected)) {
      return Response.json({ error: 'PIN 码错误' }, { status: 403 })
    }
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
