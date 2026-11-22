// src/lib/Notificationservice.ts
// ─────────────────────────────────────────────────────────────────────────────
// Serviço de notificações in-app para o ZOMAR.
//
// NOTA: A maioria das notificações é criada automaticamente pelos triggers SQL
// (fix_notifications.sql). Este serviço serve para casos edge que os triggers
// não cobrem, ou para notificações manuais desde o frontend.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'delivery_accepted'
  | 'delivery_picked_up'
  | 'delivery_completed'
  | 'delivery_cancelled'
  | 'delivery_problem'
  | 'payment_received'
  | 'payment_alert'
  | 'system'
  | 'alert'
  | 'warning'

export interface AppNotification {
  id:          string
  user_id:     string
  title:       string
  message:     string
  type:        string
  read:        boolean
  delivery_id: string | null
  created_at:  string
}

// ─── Funções principais ───────────────────────────────────────────────────────

/**
 * Cria uma notificação directamente para um utilizador.
 * Falha silenciosamente — não bloqueia o fluxo principal.
 */
export async function createNotification(params: {
  userId:     string
  type:       string
  title:      string
  message:    string
  deliveryId?: string
}): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_id:     params.userId,
      type:        params.type,
      title:       params.title,
      message:     params.message,
      delivery_id: params.deliveryId || null,
      read:        false,
    })
  } catch (e) {
    console.warn('[Notify] createNotification falhou:', e)
  }
}

/**
 * As notificações de ciclo de vida da entrega (aceite, recolhida, concluída,
 * cancelada, problema) são criadas no servidor por `notify_delivery_events`.
 * Estas funções mantêm-se por compatibilidade mas já não fazem nada: criar a
 * notificação aqui duplicava a do servidor (e a RLS impede escrever para
 * outros utilizadores).
 */
export async function notifyEntrepreneur(
  _deliveryId: string,
  _type: NotificationType,
  _extraData: Record<string, string> = {}
): Promise<void> { /* feito pelo trigger */ }

export async function notifyDeliverer(
  _deliveryId: string,
  _type: NotificationType,
  _extraData: Record<string, string> = {}
): Promise<void> { /* feito pelo trigger */ }

/**
 * Marca uma notificação como lida.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId)
  } catch (e) {
    console.warn('[Notify] markAsRead falhou:', e)
  }
}

/**
 * Número de notificações não lidas de um utilizador.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    return count || 0
  } catch {
    return 0
  }
}