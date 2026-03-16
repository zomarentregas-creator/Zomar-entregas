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

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Record<string, (d: Record<string, string>) => { title: string; message: string }> = {
  delivery_accepted: d => ({
    title:   '🚚 Entrega aceite',
    message: `${d.deliverer_name || 'Um entregador'} aceitou a tua entrega "${d.item_type || 'item'}".`,
  }),
  delivery_picked_up: d => ({
    title:   '📦 Item recolhido',
    message: `${d.deliverer_name || 'O entregador'} recolheu "${d.item_type || 'item'}" e está em rota.`,
  }),
  delivery_completed: d => ({
    title:   '✅ Entrega concluída!',
    message: `A entrega "${d.item_type || 'item'}" foi concluída com sucesso.`,
  }),
  delivery_cancelled: d => ({
    title:   '❌ Entrega cancelada',
    message: `A entrega "${d.item_type || 'item'}" foi cancelada.`,
  }),
  delivery_problem: d => ({
    title:   '⚠️ Problema na entrega',
    message: `Problema na entrega "${d.item_type || 'item'}". ${d.reason || 'Contacta o suporte.'}`,
  }),
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
 * Notifica o empreendedor de uma entrega.
 * Sem FK joins — usa duas queries separadas.
 */
export async function notifyEntrepreneur(
  deliveryId: string,
  type: NotificationType,
  extraData: Record<string, string> = {}
): Promise<void> {
  try {
    // Query 1: dados da entrega
    const { data: delivery } = await supabase
      .from('deliveries')
      .select('entrepreneur_id, deliverer_id, item_type')
      .eq('id', deliveryId)
      .single()

    if (!delivery?.entrepreneur_id) return

    // Query 2: nome do entregador (se existir)
    let delivererName = 'O entregador'
    if (delivery.deliverer_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', delivery.deliverer_id)
        .single()
      if (profile?.full_name) delivererName = profile.full_name
    }

    const template = TEMPLATES[type]
    if (!template) return

    const { title, message } = template({
      item_type:      delivery.item_type || 'item',
      deliverer_name: delivererName,
      ...extraData,
    })

    await createNotification({
      userId:     delivery.entrepreneur_id,
      type:       type.replace('delivery_', ''),
      title,
      message,
      deliveryId,
    })
  } catch (e) {
    console.warn('[Notify] notifyEntrepreneur falhou:', e)
  }
}

/**
 * Notifica o entregador de uma entrega.
 */
export async function notifyDeliverer(
  deliveryId: string,
  type: NotificationType,
  extraData: Record<string, string> = {}
): Promise<void> {
  try {
    const { data: delivery } = await supabase
      .from('deliveries')
      .select('deliverer_id, entrepreneur_id, item_type')
      .eq('id', deliveryId)
      .single()

    if (!delivery?.deliverer_id) return

    const template = TEMPLATES[type]
    if (!template) return

    const { title, message } = template({
      item_type: delivery.item_type || 'item',
      ...extraData,
    })

    await createNotification({
      userId:     delivery.deliverer_id,
      type:       type.replace('delivery_', ''),
      title,
      message,
      deliveryId,
    })
  } catch (e) {
    console.warn('[Notify] notifyDeliverer falhou:', e)
  }
}

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