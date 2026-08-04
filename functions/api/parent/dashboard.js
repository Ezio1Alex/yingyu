import * as Q from '../../_db/queries.js'

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id')
  if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 })
  // 按所选月份返回（薄弱词/抽查历史/日历均为该月），缺省当前月
  const month = url.searchParams.get('month') || ''
  const data = await Q.getParentDashboard(env, userId, month)
  return Response.json(data)
}
