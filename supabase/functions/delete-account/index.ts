// supabase/functions/delete-account/index.ts
// Elimina a conta do utilizador autenticado (RGPD / "direito a ser esquecido").
//
// Regras:
//   - Só o próprio utilizador pode apagar a sua conta (identidade vem do JWT).
//   - Recusa se houver entregas em curso ou levantamentos pendentes.
//   - O histórico de entregas é anonimizado em vez de apagado quando necessário
//     (a outra parte da entrega continua a precisar do registo).

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { json, preflight } from '../_shared/http.ts'

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre
  if (req.method !== 'POST') return json(req, { error: 'Método não permitido' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return json(req, { error: 'Não autorizado' }, 401)

  let body: { confirm?: string } = {}
  try { body = await req.json() } catch { /* body opcional */ }
  if (body.confirm !== 'ELIMINAR') {
    return json(req, { error: 'Confirmação em falta.' }, 400)
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Bloqueios: entregas em curso e levantamentos por processar
  const { count: active } = await admin.from('deliveries').select('id', { count: 'exact', head: true })
    .or(`entrepreneur_id.eq.${user.id},deliverer_id.eq.${user.id}`)
    .in('current_status', ['accepted', 'in_progress', 'problem'])
  if ((active ?? 0) > 0) {
    return json(req, { error: 'Tem entregas em curso. Conclua ou cancele-as antes de eliminar a conta.' }, 409)
  }
  const { count: pendingW } = await admin.from('withdrawals').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).in('status', ['pending', 'approved'])
  if ((pendingW ?? 0) > 0) {
    return json(req, { error: 'Tem levantamentos por processar. Aguarde a conclusão antes de eliminar a conta.' }, 409)
  }

  // 2. Apagar dados pessoais (tabelas com ON DELETE CASCADE tratam o resto)
  const steps: Array<[string, PromiseLike<{ error: unknown }>]> = [
    ['avatar',   admin.storage.from('avatars').list(user.id).then(async ({ data }) => {
      if (data?.length) await admin.storage.from('avatars').remove(data.map(f => `${user.id}/${f.name}`))
      return { error: null }
    })],
    ['settings', admin.from('user_settings').delete().eq('user_id', user.id)],
    ['notif',    admin.from('notification_settings').delete().eq('user_id', user.id)],
    ['messages', admin.from('agent_messages').delete().eq('user_id', user.id)],
    ['notifications', admin.from('notifications').delete().eq('user_id', user.id)],
  ]
  for (const [name, p] of steps) {
    const { error } = await p
    if (error) console.error(`[delete-account] ${name}:`, error)
  }

  // 3. Perfil: as entregas antigas referenciam profiles (sem cascata). Se houver
  //    histórico, anonimiza o perfil em vez de o apagar.
  const { count: history } = await admin.from('deliveries').select('id', { count: 'exact', head: true })
    .or(`entrepreneur_id.eq.${user.id},deliverer_id.eq.${user.id}`)
  if ((history ?? 0) > 0) {
    await admin.from('profiles').update({
      full_name: 'Conta eliminada', email: `deleted+${user.id}@zomar.invalid`,
      phone: null, avatar_url: null, address: null, document_number: null,
      document_url: null, document_type: null, status: 'eliminado',
    }).eq('user_id', user.id)
  } else {
    await admin.from('profiles').delete().eq('user_id', user.id)
  }

  // 4. Apagar a identidade (termina todas as sessões)
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
  if (delErr) {
    console.error('[delete-account] deleteUser:', delErr)
    return json(req, { error: 'Não foi possível concluir a eliminação. Contacte o suporte.' }, 500)
  }
  return json(req, { success: true })
})
