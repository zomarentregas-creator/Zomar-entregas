// Página pública de rastreio: /rastreio/:code — não exige login.
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, MapPin, Package, RefreshCw, Truck, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { buildSteps, timeAgo, type TrackResult } from '../lib/tracking'
import TrackingTimeline from '../components/shared/TrackingTimeline'

const POLL_MS = 30_000

export default function TrackingPage() {
  const { code = '' } = useParams()
  const [data, setData] = useState<TrackResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [updated, setUpdated] = useState<string | null>(null)
  const dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches

  const load = useCallback(async () => {
    const { data: res, error } = await supabase.rpc('track_delivery', { p_code: code })
    if (error) { setFailed(true); setLoading(false); return }
    setFailed(false)
    setData(res as TrackResult)
    setUpdated(new Date().toISOString())
    setLoading(false)
  }, [code])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  const finished = data?.status === 'completed' || data?.status === 'cancelled'
  useEffect(() => { document.title = 'Acompanhar entrega · ZOMAR' }, [])

  const steps = data?.found && data.status ? buildSteps(data.status, data.checkpoints ?? []) : []
  const cardCls = `rounded-2xl border p-5 ${dark ? 'bg-[#0d1318] border-white/10' : 'bg-white border-gray-200 shadow-sm'}`
  const muted = dark ? 'text-gray-400' : 'text-gray-600'

  return (
    <div className={`min-h-dvh px-4 py-8 ${dark ? 'bg-[#0a0f14] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <main className="max-w-md mx-auto space-y-4">
        <header className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-emerald-500 text-black flex items-center justify-center"><Truck size={18} aria-hidden /></span>
          <div>
            <h1 className="font-bold leading-tight">Acompanhar entrega</h1>
            <p className={`text-xs ${muted}`}>ZOMAR</p>
          </div>
        </header>

        {loading && <div className={cardCls} role="status">A carregar…</div>}

        {!loading && failed && !data && (
          <div className={cardCls} role="alert">
            <p className="font-semibold">Não foi possível consultar agora.</p>
            <p className={`text-sm mt-1 ${muted}`}>Verifique a ligação à internet e tente novamente.</p>
            <button onClick={() => void load()} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-black"><RefreshCw size={14} aria-hidden /> Tentar de novo</button>
          </div>
        )}

        {!loading && data && !data.found && (
          <div className={cardCls} role="alert">
            <p className="font-semibold">Entrega não encontrada.</p>
            <p className={`text-sm mt-1 ${muted}`}>Confirme o link recebido. Se o problema continuar, fale com quem lhe enviou o link.</p>
          </div>
        )}

        {data?.found && (
          <>
            {data.status === 'cancelled' && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex gap-3 text-sm" role="status">
                <XCircle className="text-red-500 shrink-0" size={18} aria-hidden /> Esta entrega foi cancelada.
              </div>
            )}
            {data.status === 'problem' && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3 text-sm" role="status">
                <AlertTriangle className="text-amber-500 shrink-0" size={18} aria-hidden /> Foi reportado um problema. A equipa ZOMAR está a tratar do assunto.
              </div>
            )}

            <section className={cardCls} aria-label="Resumo">
              <div className="flex items-start gap-3">
                <Package size={18} className="mt-0.5 text-emerald-500 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold break-words">{data.item_type}</p>
                  <p className={`text-xs mt-1 flex items-center gap-1 ${muted}`}>
                    <MapPin size={12} aria-hidden /> {data.origin_area || '—'} → {data.destination_area || '—'}
                  </p>
                  {data.deliverer_first_name && <p className={`text-xs mt-1 ${muted}`}>Entregador: {data.deliverer_first_name}</p>}
                </div>
              </div>
            </section>

            <section className={cardCls} aria-label="Progresso">
              <TrackingTimeline steps={steps} dark={dark} />
            </section>

            <p className={`text-xs text-center ${muted}`} aria-live="polite">
              {updated && <>Actualizado {timeAgo(updated)}{finished ? '' : ' · atualiza sozinho'}</>}
            </p>
          </>
        )}
      </main>
    </div>
  )
}
