'use client';

/**
 * COMPONENTE DE DIAGNÓSTICO – adiciona temporariamente a qualquer página.
 * Usa o mesmo canal 'delivery-updates' que o hook useRealtimeDelivery.
 *
 * Como usar:
 *   import RealtimeDiagnostic from './RealtimeDiagnostic'
 *   <RealtimeDiagnostic />
 *
 * Resultados esperados após subscrição:
 *   ✅ Status: "SUBSCRIBED"
 *   ✅ Ao aceitar entrega noutro tab → aparecem 2 eventos (PG + broadcast)
 *   ✅ Botão "Testar Broadcast" → evento aparece imediatamente
 */

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { broadcastDeliveryUpdate } from '../../Hooks/Userealtimedelivery'

interface LogEntry {
  time: string
  type: 'info' | 'event' | 'error' | 'status'
  msg: string
}

export default function RealtimeDiagnostic() {
  const [logs, setLogs]     = useState<LogEntry[]>([])
  const [status, setStatus] = useState('...')

  const addLog = (type: LogEntry['type'], msg: string) =>
    setLogs(prev => [{ time: new Date().toLocaleTimeString('pt-BR'), type, msg }, ...prev].slice(0, 30))

  useEffect(() => {
    addLog('info', 'A subscrever canal "delivery-updates"...')

    // Mesmo canal fixo que o hook usa
    const channel = supabase
      .channel('delivery-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, (p) => {
        addLog('event', `[PG] ${p.eventType} | status: ${(p.new as any)?.current_status ?? '—'} | deliverer: ${(p.new as any)?.deliverer_id ?? 'null'}`)
      })
      .on('broadcast', { event: 'delivery_changed' }, (p) => {
        addLog('event', `[BC] delivery_changed | ${JSON.stringify(p.payload)}`)
      })
      .subscribe((s) => {
        setStatus(s)
        addLog(s === 'SUBSCRIBED' ? 'info' : 'status', `Canal: ${s}`)
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  const typeColor: Record<LogEntry['type'], string> = {
    info: 'text-blue-400', event: 'text-emerald-400',
    error: 'text-red-400', status: 'text-yellow-400',
  }

  return (
    <div className="fixed bottom-4 right-4 w-[500px] bg-[#0a0a0a] border border-white/20 rounded-2xl shadow-2xl z-50 overflow-hidden text-xs font-mono">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#121212]">
        <span className="text-white font-bold text-sm">🔌 Realtime Diagnostic</span>
        <span className={status === 'SUBSCRIBED' ? 'text-emerald-400' : 'text-yellow-400'}>
          {status}
        </span>
      </div>
      <div className="p-3 space-y-1 max-h-52 overflow-y-auto">
        {logs.length === 0
          ? <p className="text-gray-500">A aguardar eventos...</p>
          : logs.map((l, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gray-600 flex-shrink-0">{l.time}</span>
                <span className={typeColor[l.type]}>{l.msg}</span>
              </div>
            ))
        }
      </div>
      <div className="px-4 py-2 border-t border-white/10 bg-[#121212] flex justify-between items-center">
        <p className="text-gray-500">Aceita uma entrega noutro tab</p>
        <button
          onClick={() => {
            broadcastDeliveryUpdate({ deliveryId: 'test-diag', newStatus: 'test' })
            addLog('info', 'Broadcast enviado...')
          }}
          className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30"
        >
          Testar Broadcast
        </button>
      </div>
    </div>
  )
}