import * as Q from '../_db/queries.js'
import { parentPin, pinMatches } from '../_config.js'

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'GET') {
    const users = await Q.getUsers(env)
    return Response.json(users)
  }

  if (request.method === 'POST') {
    const { name, grade, pin } = await request.json().catch(() => ({}))
    if (!name || !String(name).trim()) return Response.json({ error: 'name required' }, { status: 400 })
    // 创建用户需家长 PIN 管控，防止陌生人无限刷号
    if (!pinMatches(pin, parentPin(env))) {
      return Response.json({ error: 'PIN 码错误' }, { status: 403 })
    }
    const id = String(name).trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
    const user = await Q.createUser(env, { id, name: String(name).trim(), grade })
    return Response.json(user)
  }

  if (request.method === 'DELETE') {
    const { user_id, pin } = await request.json().catch(() => ({}))
    if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 })
    // 删除会级联清空该用户的全部学习记录，破坏性远超创建，同样要家长 PIN。
    // （user_id 可以通过 GET /api/users 枚举出来，所以这里不能只靠「知道 id」来授权）
    if (!pinMatches(pin, parentPin(env))) {
      return Response.json({ error: 'PIN 码错误' }, { status: 403 })
    }
    return Response.json(await Q.deleteUser(env, user_id))
  }

  return new Response(null, { status: 405 })
}
