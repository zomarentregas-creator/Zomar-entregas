import { supabase } from './supabase'

/** Elimina a conta do utilizador autenticado (edge function `delete-account`). */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'ELIMINAR' } })
  if (!error) return
  let msg = 'Não foi possível eliminar a conta. Tente novamente.'
  try {
    const res = (error as { context?: Response }).context
    const body = res && typeof res.json === 'function' ? await res.json() : null
    if (body?.error) msg = String(body.error)
  } catch { /* mantém a mensagem genérica */ }
  throw new Error(msg)
}
