// 家长 PIN 校验：PIN 只存在服务器端（环境变量 PARENT_PIN），前端比对不返回值本身
// 开源仓库不暴露真实 PIN；部署时在 Cloudflare Pages 设置环境变量覆盖默认值
import { parentPin, pinMatches } from '../../_config.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const body = await request.json().catch(() => ({}))
  return Response.json({ ok: pinMatches(body.pin, parentPin(env)) })
}
