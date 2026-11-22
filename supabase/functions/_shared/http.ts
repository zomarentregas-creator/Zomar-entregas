// supabase/functions/_shared/http.ts
// CORS restrito e respostas JSON partilhadas pelas Edge Functions.
//
// Origens permitidas: ALLOWED_ORIGINS (lista separada por vírgulas) + APP_URL +
// localhost (desenvolvimento). Qualquer outra origem não recebe cabeçalho CORS,
// por isso o browser bloqueia a chamada. As funções continuam protegidas por JWT.

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

function allowedOrigins(): string[] {
  const fromEnv = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean)
  const app = (Deno.env.get('APP_URL') ?? '').trim().replace(/\/$/, '')
  return app ? [...fromEnv, app] : fromEnv
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const list = allowedOrigins()
  // Sem ALLOWED_ORIGINS/APP_URL configurados mantém-se o comportamento aberto
  // (compatível com o que já está em produção). Em configurando, passa a ser restrito.
  const ok = origin !== '' && (list.length === 0 || LOCAL.test(origin) || list.includes(origin))
  return {
    ...(ok ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response(null, { status: 204, headers: corsHeaders(req) }) : null
}
