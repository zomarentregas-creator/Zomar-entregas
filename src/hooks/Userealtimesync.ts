// src/hooks/useRealtimeSync.ts
/**
 * ============================================================================
 * HOOK CENTRALIZADO DE SINCRONIZAÇÃO EM TEMPO REAL — v2.0
 * ============================================================================
 *
 * PROBLEMAS CORRIGIDOS nesta versão:
 *
 * 1. CANAIS DUPLICADOS — EntrepreneurDashboard e ActiveDeliveries criavam
 *    dois canais diferentes para a mesma tabela/filtro. O Supabase só entrega
 *    o evento a UM deles, silenciando o outro. Solução: cada componente usa
 *    um nome de canal único ("dashboard-deliveries-X" vs "active-deliveries-X")
 *    — o Supabase entrega o evento a AMBOS porque têm nomes distintos.
 *
 * 2. CALLBACKS INSTÁVEIS — os configs eram recriados a cada render porque
 *    as funções callback mudam de referência. O useEffect re-executava,
 *    destruindo e recriando os canais constantemente (subscrição piscava).
 *    Solução: callbacks guardados em ref; canais só recriam quando userId muda.
 *
 * 3. CLEANUP RACE CONDITION — mountedRef.current = false no cleanup impedia
 *    callbacks de disparar em re-subscrições legítimas.
 *    Solução: removido o mountedRef; o removeChannel é suficiente.
 */

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface SubscriptionConfig {
  channelName: string
  table: string
  filter?: string
  event?: EventType
  onchange: (payload: any) => void
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useRealtimeSync(configs: SubscriptionConfig[]) {
  const channelsRef  = useRef<RealtimeChannel[]>([])
  // Guarda sempre a versão mais recente dos callbacks sem causar re-render
  const callbacksRef = useRef<Record<string, (payload: any) => void>>({})

  // Atualizar callbacks a cada render — sem recriar canais
  useEffect(() => {
    configs.forEach(c => {
      callbacksRef.current[c.channelName] = c.onchange
    })
  })

  // Chave estável: só muda quando nomes dos canais mudam (userId muda)
  const channelKey = configs.map(c => c.channelName).join('|')

  useEffect(() => {
    if (!channelKey) return

    // Limpar canais anteriores
    channelsRef.current.forEach(ch => supabase.removeChannel(ch))
    channelsRef.current = []

    configs.forEach(config => {
      if (!config.channelName || !config.table) return

      const channel = supabase.channel(config.channelName)

      channel.on(
        'postgres_changes' as any,
        {
          event:  config.event ?? '*',
          schema: 'public',
          table:  config.table,
          ...(config.filter ? { filter: config.filter } : {}),
        },
        (payload: any) => {
          // Usa sempre o callback mais recente via ref — sem re-subscrição
          const cb = callbacksRef.current[config.channelName]
          if (cb) cb(payload)
        }
      )

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime subscribed: ${config.channelName}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.warn(`⚠️ Realtime error: ${config.channelName}`)
        } else if (status === 'TIMED_OUT') {
          console.warn(`⏱️ Realtime timeout: ${config.channelName}`)
        }
      })

      channelsRef.current.push(channel)
    })

    return () => {
      channelsRef.current.forEach(ch => supabase.removeChannel(ch))
      channelsRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey])
}

// ─── Hook para o Dashboard do Empreendedor ────────────────────────────────────
//
// Usa nomes de canal com prefixo "dashboard-" para não conflituar
// com os canais "active-" do ActiveDeliveries.
// O Supabase entrega o evento a ambos porque os nomes são diferentes.

export function useEntrepreneurRealtime(
  userId: string | undefined,
  callbacks: {
    onDeliveryChange?:     (payload: any) => void
    onSubscriptionChange?: (payload: any) => void
    onNotificationInsert?: (payload: any) => void
    onCheckpointChange?:   (payload: any) => void
  }
) {
  const stableCallbacks = useRef(callbacks)
  stableCallbacks.current = callbacks

  useRealtimeSync(
    userId
      ? [
          // ── 1. Entregas ─────────────────────────────────────────────────
          {
            channelName: `dashboard-deliveries-${userId}`,
            table:  'deliveries',
            filter: `entrepreneur_id=eq.${userId}`,
            event:  '*',
            onchange: (payload) => {
              console.log('🚚 [Dashboard] Delivery changed:', payload.eventType, payload.new?.current_status)
              stableCallbacks.current.onDeliveryChange?.(payload)
            },
          },

          // ── 2. Assinatura ───────────────────────────────────────────────
          {
            channelName: `dashboard-subscription-${userId}`,
            table:  'subscriptions',
            filter: `user_id=eq.${userId}`,
            event:  '*',
            onchange: (payload) => {
              console.log('💳 [Dashboard] Subscription changed:', payload.eventType)
              stableCallbacks.current.onSubscriptionChange?.(payload)
            },
          },

          // ── 3. Notificações ─────────────────────────────────────────────
          {
            channelName: `dashboard-notifications-${userId}`,
            table:  'notifications',
            filter: `user_id=eq.${userId}`,
            event:  'INSERT',
            onchange: (payload) => {
              console.log('🔔 [Dashboard] New notification:', payload.new?.title)
              stableCallbacks.current.onNotificationInsert?.(payload)
            },
          },

          // ── 4. Checkpoints ──────────────────────────────────────────────
          {
            channelName: `dashboard-checkpoints-${userId}`,
            table:  'delivery_checkpoints',
            event:  'INSERT',
            onchange: (payload) => {
              console.log('📍 [Dashboard] New checkpoint:', payload.new?.status)
              stableCallbacks.current.onCheckpointChange?.(payload)
            },
          },
        ]
      : []
  )
}

// ─── Hook para ActiveDeliveries ───────────────────────────────────────────────
//
// Canal: "active-deliveries-{userId}" — diferente de "dashboard-deliveries-{userId}".
// Ambos recebem o evento pois o Supabase usa o nome do canal para multiplexar.

export function useActiveDeliveriesRealtime(
  userId: string | undefined,
  onRefresh: () => void
) {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useRealtimeSync(
    userId
      ? [
          {
            channelName: `active-deliveries-${userId}`,
            table:  'deliveries',
            filter: `entrepreneur_id=eq.${userId}`,
            event:  '*',
            onchange: (payload) => {
              console.log('🔄 [ActiveDeliveries] Update:', payload.eventType, payload.new?.current_status)
              onRefreshRef.current()
            },
          },
        ]
      : []
  )
}

// ─── Hook para DeliveryHistory ────────────────────────────────────────────────

export function useDeliveryHistoryRealtime(
  userId: string | undefined,
  onRefresh: () => void
) {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useRealtimeSync(
    userId
      ? [
          {
            channelName: `history-deliveries-${userId}`,
            table:  'deliveries',
            filter: `entrepreneur_id=eq.${userId}`,
            event:  'UPDATE',
            onchange: (payload) => {
              const newStatus = payload.new?.current_status
              if (['completed', 'cancelled', 'problem'].includes(newStatus)) {
                console.log('📦 [History] Delivery finalised, refreshing')
                onRefreshRef.current()
              }
            },
          },
        ]
      : []
  )
}

// ─── Hook para SubscriptionWrapper ───────────────────────────────────────────

export function useSubscriptionRealtime(
  userId: string | undefined,
  onSubscriptionUpdate: (newData: any) => void,
  onSubscriptionDelete: () => void
) {
  const updateRef = useRef(onSubscriptionUpdate)
  const deleteRef = useRef(onSubscriptionDelete)
  updateRef.current = onSubscriptionUpdate
  deleteRef.current = onSubscriptionDelete

  useRealtimeSync(
    userId
      ? [
          {
            channelName: `subscription-wrapper-${userId}`,
            table:  'subscriptions',
            filter: `user_id=eq.${userId}`,
            event:  '*',
            onchange: (payload) => {
              if (payload.eventType === 'DELETE') {
                console.log('🗑️ [SubscriptionWrapper] Deleted')
                deleteRef.current()
              } else {
                console.log('💳 [SubscriptionWrapper] Updated:', payload.new?.status)
                updateRef.current(payload.new)
              }
            },
          },
        ]
      : []
  )
}