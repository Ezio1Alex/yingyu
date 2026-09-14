import * as Q from '../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'GET') return new Response(null, { status: 405 })
  const url = new URL(request.url)

  // 首选 bank_id：词库内容是只读语料、与用户无关，按 bank 拉取才能做边缘缓存
  // （全站只有 2 个缓存条目，攻击者拿随机 user_id 刷也只会命中缓存，产生 0 次 D1 读）
  const bankId = url.searchParams.get('bank_id')
  if (bankId) {
    if (bankId !== '1' && bankId !== '2') return Response.json({ error: 'bank_id 无效' }, { status: 400 })
    return Response.json({ words: await Q.getBankWords(env, Number(bankId)) })
  }

  // 兼容还没更新的旧客户端（只传 user_id）：多一次 users 查询，且不参与边缘缓存
  const userId = url.searchParams.get('user_id')
  if (!userId) return Response.json({ error: 'bank_id required' }, { status: 400 })
  return Response.json({ words: await Q.getBankWords(env, await Q.getBankId(env, userId)) })
}
