/**
 * GitHub OAuth 回调。
 *
 * 路由：/api/auth/github/callback   （文件路径 edge-functions/api/auth/github/callback.js）
 *
 * 流程：校验 state → 用 client_secret 换取 access_token → 302 回前端
 *      `<redirect>#account_token=<ghToken>`（错误则回 `#oauth_error=<code>`）。
 *
 * 说明：access_token 通过 URL fragment 回传，fragment 不会发送到任何服务器。
 * 前端拿到后即可直接调用 api.github.com 读写自己的仓库，因此本服务无需数据库。
 *
 * 环境变量：GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / OAUTH_STATE_SECRET / APP_ORIGIN(可选)
 */

const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const STATE_TTL_MS = 10 * 60 * 1000

export default async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const origin = resolveOrigin(request, env)

  const denied = url.searchParams.get('error')
  if (denied)
    return bounce(`${origin}/`, { oauth_error: denied })

  const code = url.searchParams.get('code')
  const rawState = url.searchParams.get('state')
  if (!code || !rawState)
    return bounce(`${origin}/`, { oauth_error: 'invalid_request' })

  const clientId = env.GITHUB_CLIENT_ID
  const clientSecret = env.GITHUB_CLIENT_SECRET
  const stateSecret = env.OAUTH_STATE_SECRET
  if (!clientId || !clientSecret || !stateSecret)
    return bounce(`${origin}/`, { oauth_error: 'oauth_not_configured' })

  const state = await verifyState(rawState, stateSecret)
  if (!state)
    return bounce(`${origin}/`, { oauth_error: 'invalid_state' })
  if (Date.now() - Number(state.ts) > STATE_TTL_MS)
    return bounce(`${origin}/`, { oauth_error: 'state_expired' })

  const redirect = sanitizeRedirect(state.redirect, origin)

  let token = ''
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${origin}/api/auth/github/callback`,
      }),
    })
    const payload = await response.json()
    if (typeof payload?.access_token === 'string')
      token = payload.access_token
  }
  catch {
    return bounce(redirect, { oauth_error: 'token_exchange_failed' })
  }

  if (!token)
    return bounce(redirect, { oauth_error: 'token_exchange_failed' })

  return bounce(redirect, { account_token: token }, true)
}

function bounce(base, params, keepQuery = false) {
  const target = new URL(base)
  const hash = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    hash.set(key, value)
  target.hash = hash.toString()
  if (!keepQuery)
    target.search = ''
  return Response.redirect(target.toString(), 302)
}

function resolveOrigin(request, env) {
  const configured = (env.APP_ORIGIN || '').trim().replace(/\/+$/, '')
  if (configured)
    return configured
  return new URL(request.url).origin
}

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

async function verifyState(raw, secret) {
  const separator = raw.lastIndexOf('.')
  if (separator <= 0)
    return null
  const body = raw.slice(0, separator)
  const signature = raw.slice(separator + 1)
  const expected = await hmac(body, secret)
  if (expected !== signature)
    return null
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(body)))
  }
  catch {
    return null
  }
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

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)
  return bytes
}
