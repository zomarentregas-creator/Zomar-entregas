// src/hooks/useRealtimeDelivery.ts
// Hooks de sincronização em tempo real para entregas e notificações

import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface UseRealtimeDeliveryOptions {
  onChange: () => void
  debounceMs?: number
}

/**
 * Hook v6 – canal com nome único por instância para evitar conflitos
 * entre componentes, mas todos ouvem o mesmo evento 'delivery_changed'
 * via broadcast no canal fixo 'delivery-updates'.
 *
 * Problema anterior: múltiplos componentes subscreviam o mesmo canal
 * 'delivery-updates' e o Supabase fechava e reabria constantemente
 * (CLOSED/SUBSCRIBED loop) porque só pode haver uma subscrição ativa
 * por nome de canal no mesmo cliente.
 *
 * Solução: cada componente cria um canal com nome único para
 * postgres_changes, e um canal separado com nome único para ouvir
 * broadcasts. O broadcastDeliveryUpdate envia para 'delivery-updates'
 * e o Supabase entrega a TODOS os canais que estejam a ouvir o
 * mesmo evento – independentemente do nome do canal.
 */
export function useRealtimeDelivery({
  onChange,
  debounceMs = 300,
}: UseRealtimeDeliveryOptions) {
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)
  const idRef       = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const fire = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChangeRef.current(), debounceMs)
  }, [debounceMs])

  useEffect(() => {
    const id = idRef.current

    const channel = supabase
      .channel(`delivery-listener-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        fire
      )
      .on(
        'broadcast',
        { event: 'delivery_changed' },
        fire
      )
      .subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [fire])
}

/**
 * Envia um broadcast 'delivery_changed'.
 * Chega a TODOS os componentes com useRealtimeDelivery montado,
 * em qualquer tab do mesmo browser.
 */
export async function broadcastDeliveryUpdate(payload: {
  deliveryId: string
  newStatus: string
}) {
  try {
    const ch = supabase.channel(`delivery-send-${Date.now()}`)
    await ch.send({
      type: 'broadcast',
      event: 'delivery_changed',
      payload,
    })
    supabase.removeChannel(ch)
  } catch (err) {
    console.warn('[broadcastDeliveryUpdate]', err)
  }
}

export function useRealtimeNotifications(
  userId: string | undefined,
  onNew: () => void
) {
  const onNewRef = useRef(onNew)
  useEffect(() => { onNewRef.current = onNew }, [onNew])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => onNewRef.current()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])
}