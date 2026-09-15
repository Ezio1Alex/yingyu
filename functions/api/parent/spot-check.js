import * as Q from '../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const { user_id, total, mode } = await request.json()
  const wanted = total || 10
  // candidates = 候选池实际词数（切片前）。前端据此提示家长「池子不够，只能出 N 题」，
  // 而不是像以前那样静默给个 1 题的短会话，让家长以为坏了反复重试。
  const { words, candidates } = await Q.startSpotCheck(env, user_id, wanted, mode || 'normal')
  return Response.json({ words, candidates, requested: wanted })
}
