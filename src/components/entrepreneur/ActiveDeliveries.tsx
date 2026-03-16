// src/components/entrepreneur/ActiveDeliveries.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, MapPin, Clock, CheckCircle, AlertCircle,
  RefreshCw, Loader2, ChevronRight, Truck, X,
  KeyRound, Eye, EyeOff, Phone,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Delivery {
  id:                  string
  item_type:           string
  origin_address:      string
  destination_address: string
  current_status:      string
  estimated_value:     number
  notes:               string | null
  created_at:          string
  updated_at:          string | null
  picked_up_at:        string | null
  deliverer_id:        string | null
  deliverer_name?:     string
  deliverer_phone?:    string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; step: number }> = {
  accepted:    { label: 'Aceite',       color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',   step: 1 },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25',         step: 2 },
  picked_up:   { label: 'Recolhido',    color: 'bg-purple-500/15 text-purple-400 border-purple-500/25',   step: 3 },
  problem:     { label: 'Problema',     color: 'bg-red-500/15 text-red-400 border-red-500/25',            step: 0 },
}

const ACTIVE_STATUSES = ['accepted', 'in_progress', 'picked_up', 'problem']

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActiveDeliveries() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem('entrepreneur_theme') !== 'light'
  )
  useEffect(() => {
    const h = () => setIsDarkMode(localStorage.getItem('entrepreneur_theme') !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading,    setLoading]    = useState(true)
  const [codeModal,  setCodeModal]  = useState<Delivery | null>(null)
  const [codeData,   setCodeData]   = useState<{ code: string; visible: boolean } | null>(null)
  const [codeLoading,setCodeLoading]= useState(false)

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  // ── Carregar ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, item_type, origin_address, destination_address, current_status, estimated_value, notes, created_at, updated_at, picked_up_at, deliverer_id')
        .eq('entrepreneur_id', user.id)
        .in('current_status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })

      if (error) throw error

      const list = data || []
      const dIds = [...new Set(list.map(d => d.deliverer_id).filter(Boolean))]
      let dMap: Record<string, { full_name?: string; phone?: string }> = {}
      if (dIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('user_id, full_name, phone').in('user_id', dIds)
        if (profiles) profiles.forEach(p => { dMap[p.user_id] = p })
      }

      setDeliveries(list.map(d => ({
        ...d,
        deliverer_name:  d.deliverer_id ? dMap[d.deliverer_id]?.full_name  : undefined,
        deliverer_phone: d.deliverer_id ? dMap[d.deliverer_id]?.phone       : undefined,
      })))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user?.id) return
    const ch = supabase.channel('active-dels')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'deliveries',
        filter: `entrepreneur_id=eq.${user.id}`,
      }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, load])

  // ── Ver código de confirmação (via RPC segura) ─────────────────────────────
  const handleViewCode = async (delivery: Delivery) => {
    setCodeModal(delivery)
    setCodeData(null)
    setCodeLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_delivery_code', {
        p_delivery_id: delivery.id,
      })
      if (error) throw error
      if (data?.success) {
        setCodeData({ code: data.code, visible: false })
      }
    } catch { /* silencioso */ }
    finally { setCodeLoading(false) }
  }

  // ── Classes ────────────────────────────────────────────────────────────────
  const card = `rounded-2xl border transition-all duration-200 ${dk('bg-[#1a1a1a] border-white/8', 'bg-white border-gray-200 shadow-sm')}`

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <Loader2 className={`animate-spin ${dk('text-emerald-400', 'text-emerald-600')}`} size={32}/>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>Entregas Activas</h2>
          <p className={`text-sm mt-0.5 flex items-center gap-1.5 ${dk('text-gray-500', 'text-gray-400')}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/>
            {deliveries.length} entrega{deliveries.length !== 1 ? 's' : ''} em curso
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className={`p-2.5 rounded-xl ${dk('bg-white/5 hover:bg-white/10 text-gray-400', 'bg-gray-100 hover:bg-gray-200 text-gray-500')}`}>
            <RefreshCw size={16}/>
          </button>
          <button onClick={() => navigate('/entrepreneur/new-delivery')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${dk('bg-emerald-500 text-black hover:bg-emerald-400', 'bg-emerald-600 text-white hover:bg-emerald-700')}`}>
            + Nova
          </button>
        </div>
      </div>

      {/* Lista vazia */}
      {deliveries.length === 0 && (
        <div className={`${card} py-14 text-center`}>
          <Truck size={36} className={`mx-auto mb-3 ${dk('text-gray-600', 'text-gray-300')}`}/>
          <p className={`font-semibold ${dk('text-gray-300', 'text-gray-700')}`}>Nenhuma entrega activa</p>
          <p className={`text-sm mt-1 mb-4 ${dk('text-gray-500', 'text-gray-400')}`}>
            Cria uma nova entrega para começar
          </p>
          <button onClick={() => navigate('/entrepreneur/new-delivery')}
            className={`mx-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold ${dk('bg-emerald-500 text-black', 'bg-emerald-600 text-white')}`}>
            Criar entrega
          </button>
        </div>
      )}

      {/* Cards de entrega */}
      {deliveries.map(d => {
        const sc  = STATUS_CFG[d.current_status] || STATUS_CFG.accepted
        const isProblem = d.current_status === 'problem'

        return (
          <div key={d.id} className={`${card} overflow-hidden ${isProblem ? dk('border-red-500/30', 'border-red-300') : ''}`}>

            {/* Barra de progresso do status */}
            {!isProblem && (
              <div className={`h-1 w-full ${dk('bg-white/5', 'bg-gray-100')}`}>
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${(sc.step / 3) * 100}%`,
                    background: sc.step === 3 ? 'linear-gradient(90deg,#8b5cf6,#a78bfa)' :
                                sc.step === 2 ? 'linear-gradient(90deg,#3b82f6,#60a5fa)' :
                                               'linear-gradient(90deg,#eab308,#fcd34d)',
                  }}
                />
              </div>
            )}

            <div className="p-5">
              {/* Linha 1: ID + status + valor */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className={`text-xs font-mono ${dk('text-gray-500', 'text-gray-400')}`}>
                    #{d.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className={`text-base font-bold mt-0.5 ${dk('text-white', 'text-gray-900')}`}>
                    {d.item_type}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border ${sc.color}`}>
                    {sc.label}
                  </span>
                  <p className={`text-sm font-bold mt-1 ${dk('text-emerald-400', 'text-emerald-600')}`}>
                    {fmtMZN(d.estimated_value)}
                  </p>
                </div>
              </div>

              {/* Rota */}
              <div className={`space-y-1.5 p-3 rounded-xl mb-3 ${dk('bg-white/3', 'bg-gray-50')}`}>
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-emerald-400 flex-shrink-0 mt-0.5"/>
                  <span className={`text-xs ${dk('text-gray-300', 'text-gray-700')}`}>{d.origin_address}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-orange-400 flex-shrink-0 mt-0.5"/>
                  <span className={`text-xs ${dk('text-gray-300', 'text-gray-700')}`}>{d.destination_address}</span>
                </div>
              </div>

              {/* Info entregador */}
              {d.deliverer_id && (
                <div className={`flex items-center justify-between p-3 rounded-xl mb-3 ${dk('bg-emerald-500/8 border border-emerald-500/15', 'bg-emerald-50 border border-emerald-200')}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dk('bg-emerald-500/20', 'bg-emerald-100')}`}>
                      <Truck size={13} className="text-emerald-400"/>
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${dk('text-emerald-300', 'text-emerald-700')}`}>
                        {d.deliverer_name || 'Entregador atribuído'}
                      </p>
                      {d.deliverer_phone && (
                        <p className={`text-[10px] ${dk('text-emerald-500', 'text-emerald-600')}`}>{d.deliverer_phone}</p>
                      )}
                    </div>
                  </div>
                  {d.deliverer_phone && (
                    <a href={`tel:${d.deliverer_phone}`}
                      className={`p-1.5 rounded-lg ${dk('bg-emerald-500/15 text-emerald-400', 'bg-emerald-100 text-emerald-700')}`}>
                      <Phone size={13}/>
                    </a>
                  )}
                </div>
              )}

              {/* Datas + acções */}
              <div className="flex items-center justify-between">
                <div className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>
                  Criada {fmtDate(d.created_at)} às {fmtTime(d.created_at)}
                  {d.picked_up_at && (
                    <span className={`ml-2 ${dk('text-purple-400', 'text-purple-600')}`}>
                      · Recolhido {fmtTime(d.picked_up_at)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleViewCode(d)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
                    dk('bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/20',
                       'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200')
                  }`}>
                  <KeyRound size={12}/> Ver código
                </button>
              </div>

              {/* Alerta problema */}
              {isProblem && (
                <div className={`mt-3 flex items-center gap-2 p-3 rounded-xl ${dk('bg-red-500/10 border border-red-500/20', 'bg-red-50 border border-red-200')}`}>
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0"/>
                  <p className={`text-xs ${dk('text-red-300', 'text-red-700')}`}>
                    Esta entrega tem um problema reportado. Contacta o entregador ou o suporte.
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* ── Modal: código de confirmação ── */}
      {codeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl border p-6 ${dk('bg-[#1a1a1a] border-white/10', 'bg-white border-gray-200 shadow-2xl')}`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${dk('bg-orange-500/15', 'bg-orange-50')}`}>
                  <KeyRound size={18} className="text-orange-400"/>
                </div>
                <div>
                  <h3 className={`font-bold ${dk('text-white', 'text-gray-900')}`}>Código de Confirmação</h3>
                  <p className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>{codeModal.item_type}</p>
                </div>
              </div>
              <button onClick={() => { setCodeModal(null); setCodeData(null) }}
                className={dk('text-gray-500 hover:text-gray-300', 'text-gray-400 hover:text-gray-600')}>
                <X size={18}/>
              </button>
            </div>

            {codeLoading ? (
              <div className="py-8 text-center">
                <Loader2 size={24} className={`animate-spin mx-auto ${dk('text-orange-400', 'text-orange-500')}`}/>
                <p className={`text-sm mt-2 ${dk('text-gray-400', 'text-gray-500')}`}>A carregar código…</p>
              </div>
            ) : codeData ? (
              <>
                <div className={`rounded-xl border-2 border-dashed p-6 text-center mb-4 ${dk('border-orange-500/30 bg-orange-500/5', 'border-orange-300 bg-orange-50')}`}>
                  <p className={`text-4xl font-black tracking-[0.3em] ${
                    codeData.visible ? dk('text-orange-400', 'text-orange-600') : dk('text-gray-600', 'text-gray-300')
                  }`}>
                    {codeData.visible ? codeData.code : '● ● ● ● ● ●'}
                  </p>
                  <button
                    onClick={() => setCodeData(d => d ? { ...d, visible: !d.visible } : null)}
                    className={`mt-3 flex items-center gap-1.5 mx-auto text-xs font-medium ${dk('text-gray-400 hover:text-gray-200', 'text-gray-500 hover:text-gray-700')}`}>
                    {codeData.visible ? <><EyeOff size={12}/> Ocultar</> : <><Eye size={12}/> Mostrar código</>}
                  </button>
                </div>
                <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${dk('bg-yellow-500/8 border border-yellow-500/15 text-yellow-300', 'bg-yellow-50 border border-yellow-200 text-yellow-700')}`}>
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5"/>
                  Partilha este código <strong>apenas com o entregador</strong>, no momento da entrega ao destinatário.
                </div>
              </>
            ) : (
              <p className={`text-center text-sm py-6 ${dk('text-gray-400', 'text-gray-500')}`}>
                Não foi possível carregar o código.
              </p>
            )}

            <button onClick={() => { setCodeModal(null); setCodeData(null) }}
              className={`w-full mt-4 py-2.5 rounded-xl text-sm font-medium border ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}