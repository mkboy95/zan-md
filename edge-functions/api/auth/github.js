/**
 * GitHub OAuth 授权入口。
 *
 * 路由：/api/auth/github            （文件路径 edge-functions/api/auth/github.js）
 * 用法：/api/auth/github?redirect=<前端同源地址>
 *
 * EdgeOne Edge Functions 仅支持 JavaScript，且各函数独立打包，
 * 因此本文件不 import 任何本地模块，helper 全部内联（callback.js 中同样复制一份）。
 *
 * 需要的环境变量（在 EdgeOne 控制台 - 项目 - 环境变量中配置）：
 *   GITHUB_CLIENT_ID     GitHub OAuth App 的 Client ID
 *   OAUTH_STATE_SECRET   任意长随机串，用于给 state 签名
 *   APP_ORIGIN           可选，站点源地址，如 https://md.example.com
 *   GITHUB_SCOPE         可选，默认 repo（访问私有仓库）
 */

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'

export default async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)

  const clientId = env.GITHUB_CLIENT_ID
  const stateSecret = env.OAUTH_STATE_SECRET
  if (!clientId || !stateSecret)
    return json({ error: 'oauth_not_configured' }, 500)

  const origin = resolveOrigin(request, env)
  const redirect = sanitizeRedirect(url.searchParams.get('redirect'), origin)
  if (!redirect)
    return json({ error: 'invalid_redirect' }, 400)

  const state = await signState({ redirect, ts: Date.now() }, stateSecret)

  const authorize = new URL(AUTHORIZE_URL)
  authorize.searchParams.set('client_id', clientId)
  authorize.searchParams.set('scope', env.GITHUB_SCOPE || 'repo')
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('redirect_uri', `${origin}/api/auth/github/callback`)
  return Response.redirect(authorize.toString(), 302)
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/** 站点源地址优先取 APP_ORIGIN，便于自定义域名与预览域名共用同一份配置。 */
function resolveOrigin(request, env) {
  const configured = (env.APP_ORIGIN || '').trim().replace(/\/+$/, '')
  if (configured)
    return configured
  return new URL(request.url).origin
}

/** 只放行同源回跳，避免被当成开放重定向。 */
function sanitizeRedirect(raw, origin) {
  if (!raw)
    return `${origin}/`
  let target
  try {
    target = new URL(raw)
  }
  catch {
    return `${origin}/`
  }
  if (target.origin !== origin)
    return `${origin}/`
  return target.toString()
}

async function signState(payload, secret) {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await hmac(body, secret)
  return `${body}.${signature}`
}

async function hmac(input, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input))
  return base64UrlEncode(new Uint8Array(signature))
}

function base64UrlEncode(bytes) {
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
