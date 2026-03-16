// src/components/Common/Deliverydetails.tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Package, MapPin, DollarSign, Clock,
  CheckCircle, AlertCircle, Truck, KeyRound, Shield,
  User, Calendar, RefreshCw, Loader2, Copy, Eye, EyeOff,
  XCircle, ShieldCheck, Phone, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeliveryFull {
  id:                  string
  entrepreneur_id:     string
  deliverer_id:        string | null
  item_type:           string
  origin_address:      string
  destination_address: string
  current_status:      string
  estimated_value:     number
  notes:               string | null
  created_at:          string
  updated_at:          string | null
  completed_at:        string | null
  delivered_at:        string | null
  picked_up_at:        string | null
  delivery_code?:      string | null
  // enriquecido
  entrepreneur_name?:  string
  entrepreneur_phone?: string
  deliverer_name?:     string
  deliverer_phone?:    string
}

interface Checkpoint {
  id:          string
  status:      string
  description: string
  created_at:  string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

const fmtDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const calcFee = (v: number) => Math.round(v * 0.8 * 100) / 100

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  accepted:    { label: 'Disponível',   color: 'text-yellow-400',  bg: 'bg-yellow-500/15 border-yellow-500/25',  icon: <Clock size={15}/>        },
  in_progress: { label: 'Em Andamento', color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/25',      icon: <Truck size={15}/>        },
  picked_up:   { label: 'Recolhido',    color: 'text-purple-400',  bg: 'bg-purple-500/15 border-purple-500/25',  icon: <Package size={15}/>      },
  completed:   { label: 'Concluída',    color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25',icon: <CheckCircle size={15}/>  },
  problem:     { label: 'Problema',     color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/25',        icon: <AlertCircle size={15}/> },
  cancelled:   { label: 'Cancelada',    color: 'text-gray-400',    bg: 'bg-gray-500/15 border-gray-500/25',      icon: <XCircle size={15}/>      },
}

// Passos do progresso
const STEPS = [
  { status: 'accepted',    label: 'Criada'     },
  { status: 'in_progress', label: 'Recolhida'  },
  { status: 'picked_up',   label: 'A caminho'  },
  { status: 'completed',   label: 'Entregue'   },
]
const STEP_ORDER = ['accepted', 'in_progress', 'picked_up', 'completed']

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeliveryDetails() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user }  = useAuth()

  const isDeliverer = location.pathname.startsWith('/deliverer')
  const themeKey    = isDeliverer ? 'deliverer_theme' : 'entrepreneur_theme'

  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem(themeKey) !== 'light'
  )
  useEffect(() => {
    const h = () => setIsDarkMode(localStorage.getItem(themeKey) !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [themeKey])

  const [delivery,     setDelivery]     = useState<DeliveryFull | null>(null)
  const [checkpoints,  setCheckpoints]  = useState<Checkpoint[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  // Código (empreendedor)
  const [codeVisible,  setCodeVisible]  = useState(false)
  const [codeCopied,   setCodeCopied]   = useState(false)
  const [codeData,     setCodeData]     = useState<string | null>(null)
  const [codeLoading,  setCodeLoading]  = useState(false)

  // Modal de acção (entregador)
  const [actionModal,  setActionModal]  = useState<'collect' | 'deliver' | null>(null)
  const [codeInput,    setCodeInput]    = useState('')
  const [codeError,    setCodeError]    = useState('')
  const [actionLoading,setActionLoading]= useState(false)
  const [feedback,     setFeedback]     = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  // ── Carregar entrega ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: dErr } = await supabase
        .from('deliveries')
        .select('*')
        .eq('id', id)
        .single()
      if (dErr) throw dErr

      // Enriquecer com perfis
      const ids = [data.entrepreneur_id, data.deliverer_id].filter(Boolean)
      let pMap: Record<string, { full_name?: string; phone?: string }> = {}
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('user_id, full_name, phone').in('user_id', ids)
        if (profiles) profiles.forEach(p => { pMap[p.user_id] = p })
      }

      setDelivery({
        ...data,
        entrepreneur_name:  pMap[data.entrepreneur_id]?.full_name,
        entrepreneur_phone: pMap[data.entrepreneur_id]?.phone,
        deliverer_name:     data.deliverer_id ? pMap[data.deliverer_id]?.full_name  : undefined,
        deliverer_phone:    data.deliverer_id ? pMap[data.deliverer_id]?.phone       : undefined,
      })

      // Checkpoints
      const { data: cps } = await supabase
        .from('delivery_checkpoints')
        .select('id, status, description, created_at')
        .eq('delivery_id', id)
        .order('created_at', { ascending: true })
      setCheckpoints(cps || [])

    } catch (e: any) {
      setError(e.message || 'Erro ao carregar entrega.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Realtime
  useEffect(() => {
    if (!id) return
    const ch = supabase.channel(`detail-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'deliveries',
        filter: `id=eq.${id}`,
      }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  // ── Ver código (empreendedor) ───────────────────────────────────────────────
  const handleViewCode = async () => {
    if (codeData) { setCodeVisible(v => !v); return }
    setCodeLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_delivery_code', {
        p_delivery_id: id,
      })
      if (error) throw error
      if (data?.success) {
        setCodeData(data.code)
        setCodeVisible(true)
      }
    } catch { /* silencioso */ }
    finally { setCodeLoading(false) }
  }

  const copyCode = () => {
    if (!codeData) return
    navigator.clipboard.writeText(codeData)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  // ── Acções do entregador ────────────────────────────────────────────────────
  const handleAction = async () => {
    if (!delivery || !user?.id) return
    setActionLoading(true)
    setCodeError('')
    try {
      if (actionModal === 'collect') {
        // Recolher — só atualizar status, sem código
        const { error } = await supabase
          .from('deliveries')
          .update({
            current_status: 'in_progress',
            picked_up_at:   new Date().toISOString(),
            updated_at:     new Date().toISOString(),
          })
          .eq('id', delivery.id)
        if (error) throw error

        try {
          await supabase.from('delivery_checkpoints').insert({
            delivery_id: delivery.id, status: 'in_progress',
            description: 'Item recolhido pelo entregador',
            created_at:  new Date().toISOString(),
          })
        } catch { /* silencioso */ }

        setFeedback({ type: 'ok', msg: '📦 Item recolhido com sucesso!' })
        setActionModal(null)
        load()

      } else if (actionModal === 'deliver') {
        // Entregar — verificar código via RPC
        if (codeInput.trim().length < 4) {
          setCodeError('Introduza o código completo.')
          setActionLoading(false)
          return
        }
        const { data, error } = await supabase.rpc('verify_delivery_code', {
          p_delivery_id:  delivery.id,
          p_code:         codeInput.trim().toUpperCase(),
          p_deliverer_id: user.id,
        })
        if (error) throw error
        if (!data?.success) {
          setCodeError(data?.error || 'Código incorrecto.')
          setActionLoading(false)
          return
        }

        try {
          await supabase.from('delivery_checkpoints').insert({
            delivery_id: delivery.id, status: 'completed',
            description: 'Entrega concluída — código verificado',
            created_at:  new Date().toISOString(),
          })
        } catch { /* silencioso */ }

        setFeedback({ type: 'ok', msg: '✅ Entrega concluída com sucesso!' })
        setActionModal(null)
        setCodeInput('')
        load()
      }
    } catch (e: any) {
      setCodeError(e.message || 'Erro. Tenta novamente.')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Loading / Error ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className={`animate-spin ${dk('text-emerald-400', 'text-emerald-600')}`} size={32}/>
    </div>
  )

  if (error || !delivery) return (
    <div className="max-w-lg mx-auto py-8 text-center">
      <AlertCircle className={`mx-auto mb-3 ${dk('text-red-400', 'text-red-600')}`} size={36}/>
      <p className={`font-semibold mb-4 ${dk('text-white', 'text-gray-900')}`}>{error || 'Entrega não encontrada.'}</p>
      <button onClick={() => navigate(-1)}
        className={`flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm font-medium ${dk('bg-white/8 text-gray-300', 'bg-gray-100 text-gray-700')}`}>
        <ArrowLeft size={14}/> Voltar
      </button>
    </div>
  )

  const sc         = STATUS_CFG[delivery.current_status] || STATUS_CFG.accepted
  const stepIdx    = STEP_ORDER.indexOf(delivery.current_status)
  const isProblem  = delivery.current_status === 'problem'
  const isDone     = delivery.current_status === 'completed'
  const isCancelled= delivery.current_status === 'cancelled'
  const card       = `rounded-2xl border ${dk('bg-[#1a1a1a] border-white/8', 'bg-white border-gray-200 shadow-sm')}`

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-4">

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium ${
          feedback.type === 'ok'
            ? dk('bg-emerald-500/10 border-emerald-500/20 text-emerald-300', 'bg-emerald-50 border-emerald-200 text-emerald-700')
            : dk('bg-red-500/10 border-red-500/20 text-red-300', 'bg-red-50 border-red-200 text-red-700')
        }`}>
          {feedback.type === 'ok' ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
          <span className="flex-1">{feedback.msg}</span>
          <button onClick={() => setFeedback(null)}><X size={13}/></button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className={`p-2 rounded-xl transition-all ${dk('hover:bg-white/8 text-gray-400', 'hover:bg-gray-100 text-gray-500')}`}>
          <ArrowLeft size={18}/>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className={`text-xl font-bold truncate ${dk('text-white', 'text-gray-900')}`}>
            {delivery.item_type}
          </h2>
          <p className={`text-xs mt-0.5 font-mono ${dk('text-gray-500', 'text-gray-400')}`}>
            #{delivery.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${sc.bg} ${sc.color}`}>
            {sc.icon} {sc.label}
          </span>
          <button onClick={load}
            className={`p-2 rounded-xl ${dk('hover:bg-white/8 text-gray-400', 'hover:bg-gray-100 text-gray-500')}`}>
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      {/* Barra de progresso */}
      {!isProblem && !isCancelled && (
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((step, i) => {
              const done    = stepIdx >= i
              const current = stepIdx === i
              return (
                <div key={step.status} className="flex-1 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    done
                      ? 'bg-emerald-500 border-emerald-500'
                      : dk('border-white/15 bg-white/4', 'border-gray-200 bg-gray-50')
                  }`}>
                    {done
                      ? <CheckCircle size={14} className="text-white"/>
                      : <span className={`text-[10px] font-bold ${dk('text-gray-600', 'text-gray-400')}`}>{i + 1}</span>
                    }
                  </div>
                  <p className={`text-[10px] mt-1 font-medium text-center ${
                    current ? dk('text-emerald-400', 'text-emerald-600') :
                    done    ? dk('text-gray-300', 'text-gray-600') :
                              dk('text-gray-600', 'text-gray-400')
                  }`}>{step.label}</p>
                  {/* Linha de ligação */}
                  {i < STEPS.length - 1 && (
                    <div className="absolute"
                      style={{ display: 'none' }}/>
                  )}
                </div>
              )
            })}
          </div>
          {/* Linha de progresso */}
          <div className={`h-1.5 rounded-full overflow-hidden mt-1 ${dk('bg-white/8', 'bg-gray-100')}`}>
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: isDone ? '100%' : `${Math.max(0, (stepIdx / (STEPS.length - 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Alerta problema/cancelada */}
      {(isProblem || isCancelled) && (
        <div className={`${card} p-4 flex items-start gap-3 ${dk('border-red-500/25', 'border-red-200')}`}>
          <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5"/>
          <div>
            <p className={`text-sm font-bold ${dk('text-red-300', 'text-red-700')}`}>
              {isProblem ? 'Problema reportado' : 'Entrega cancelada'}
            </p>
            <p className={`text-xs mt-0.5 ${dk('text-red-400/80', 'text-red-600')}`}>
              {isProblem ? 'Contacta o suporte ou o empreendedor para resolver.' : 'Esta entrega foi cancelada.'}
            </p>
          </div>
        </div>
      )}

      {/* Rota */}
      <div className={`${card} p-5`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${dk('text-gray-500', 'text-gray-400')}`}>
          Rota
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${dk('bg-emerald-500/15', 'bg-emerald-50')}`}>
              <MapPin size={14} className="text-emerald-400"/>
            </div>
            <div>
              <p className={`text-[10px] uppercase tracking-wider ${dk('text-gray-600', 'text-gray-400')}`}>Origem</p>
              <p className={`text-sm font-medium mt-0.5 ${dk('text-white', 'text-gray-900')}`}>{delivery.origin_address}</p>
            </div>
          </div>
          <div className={`ml-4 pl-3 border-l-2 border-dashed ${dk('border-white/10', 'border-gray-200')}`}>
            <p className={`text-xs ${dk('text-gray-600', 'text-gray-500')}`}>↓ em trânsito</p>
          </div>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${dk('bg-orange-500/15', 'bg-orange-50')}`}>
              <MapPin size={14} className="text-orange-400"/>
            </div>
            <div>
              <p className={`text-[10px] uppercase tracking-wider ${dk('text-gray-600', 'text-gray-400')}`}>Destino</p>
              <p className={`text-sm font-medium mt-0.5 ${dk('text-white', 'text-gray-900')}`}>{delivery.destination_address}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detalhes */}
      <div className={`${card} p-5`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${dk('text-gray-500', 'text-gray-400')}`}>
          Detalhes
        </h3>
        <div className={`space-y-0 divide-y ${dk('divide-white/5', 'divide-gray-100')}`}>
          {[
            { label: 'Item',         value: delivery.item_type,                              icon: <Package size={13}/> },
            { label: 'Valor',        value: fmtMZN(delivery.estimated_value),                icon: <DollarSign size={13}/> },
            isDeliverer
              ? { label: 'Ganho estimado', value: fmtMZN(calcFee(delivery.estimated_value)), icon: <DollarSign size={13}/> }
              : null,
            { label: 'Criada em',    value: fmtDateTime(delivery.created_at),                icon: <Calendar size={13}/> },
            delivery.picked_up_at
              ? { label: 'Recolhida em', value: fmtDateTime(delivery.picked_up_at),          icon: <Truck size={13}/> }
              : null,
            delivery.delivered_at
              ? { label: 'Entregue em', value: fmtDateTime(delivery.delivered_at),           icon: <CheckCircle size={13}/> }
              : null,
            delivery.notes
              ? { label: 'Notas', value: delivery.notes,                                     icon: <Package size={13}/> }
              : null,
          ].filter(Boolean).map(({ label, value, icon }: any) => (
            <div key={label} className="flex items-center justify-between py-3">
              <div className={`flex items-center gap-2 text-xs ${dk('text-gray-400', 'text-gray-500')}`}>
                <span className={dk('text-gray-600', 'text-gray-400')}>{icon}</span>
                {label}
              </div>
              <span className={`text-sm font-medium text-right max-w-[55%] ${dk('text-white', 'text-gray-900')}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Partes envolvidas */}
      <div className={`${card} p-5`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${dk('text-gray-500', 'text-gray-400')}`}>
          Partes Envolvidas
        </h3>
        <div className="space-y-3">
          {/* Empreendedor */}
          <div className={`flex items-center justify-between p-3 rounded-xl ${dk('bg-white/4', 'bg-gray-50')}`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${dk('bg-blue-500/20', 'bg-blue-50')}`}>
                <User size={14} className="text-blue-400"/>
              </div>
              <div>
                <p className={`text-[10px] uppercase tracking-wider ${dk('text-gray-500', 'text-gray-400')}`}>Empreendedor</p>
                <p className={`text-sm font-semibold ${dk('text-white', 'text-gray-900')}`}>
                  {delivery.entrepreneur_name || 'N/D'}
                </p>
              </div>
            </div>
            {delivery.entrepreneur_phone && (
              <a href={`tel:${delivery.entrepreneur_phone}`}
                className={`p-2 rounded-lg ${dk('bg-blue-500/15 text-blue-400', 'bg-blue-50 text-blue-600')}`}>
                <Phone size={13}/>
              </a>
            )}
          </div>

          {/* Entregador */}
          {delivery.deliverer_id ? (
            <div className={`flex items-center justify-between p-3 rounded-xl ${dk('bg-white/4', 'bg-gray-50')}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${dk('bg-emerald-500/20', 'bg-emerald-50')}`}>
                  <Truck size={14} className="text-emerald-400"/>
                </div>
                <div>
                  <p className={`text-[10px] uppercase tracking-wider ${dk('text-gray-500', 'text-gray-400')}`}>Entregador</p>
                  <p className={`text-sm font-semibold ${dk('text-white', 'text-gray-900')}`}>
                    {delivery.deliverer_name || 'N/D'}
                  </p>
                </div>
              </div>
              {delivery.deliverer_phone && (
                <a href={`tel:${delivery.deliverer_phone}`}
                  className={`p-2 rounded-lg ${dk('bg-emerald-500/15 text-emerald-400', 'bg-emerald-50 text-emerald-600')}`}>
                  <Phone size={13}/>
                </a>
              )}
            </div>
          ) : (
            <div className={`flex items-center gap-3 p-3 rounded-xl ${dk('bg-white/3', 'bg-gray-50')}`}>
              <Clock size={14} className={dk('text-gray-600', 'text-gray-400')}/>
              <p className={`text-sm ${dk('text-gray-500', 'text-gray-400')}`}>A aguardar entregador…</p>
            </div>
          )}
        </div>
      </div>

      {/* Código de confirmação — só empreendedor, só quando activa */}
      {!isDeliverer && !isDone && !isCancelled && (
        <div className={`${card} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={15} className="text-orange-400"/>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${dk('text-gray-500', 'text-gray-400')}`}>
              Código de Confirmação
            </h3>
          </div>
          {codeData && codeVisible ? (
            <>
              <div className={`rounded-xl border-2 border-dashed p-5 text-center mb-3 ${dk('border-orange-500/30 bg-orange-500/5', 'border-orange-300 bg-orange-50')}`}>
                <p className={`text-4xl font-black tracking-[0.3em] ${dk('text-orange-400', 'text-orange-600')}`}>
                  {codeData}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={copyCode}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    codeCopied
                      ? dk('bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                      : dk('bg-white/8 text-white border border-white/10', 'bg-gray-100 text-gray-700 border border-gray-200')
                  }`}>
                  {codeCopied ? <><CheckCircle size={13}/> Copiado!</> : <><Copy size={13}/> Copiar</>}
                </button>
                <button onClick={() => setCodeVisible(false)}
                  className={`px-3 py-2.5 rounded-xl border text-sm ${dk('border-white/10 text-gray-400 hover:bg-white/5', 'border-gray-200 text-gray-500 hover:bg-gray-50')}`}>
                  <EyeOff size={13}/>
                </button>
              </div>
            </>
          ) : (
            <button onClick={handleViewCode} disabled={codeLoading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border transition-all ${
                dk('border-orange-500/25 bg-orange-500/8 text-orange-400 hover:bg-orange-500/15', 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100')
              }`}>
              {codeLoading ? <Loader2 size={14} className="animate-spin"/> : <Eye size={14}/>}
              {codeLoading ? 'A carregar…' : 'Ver código de confirmação'}
            </button>
          )}
          <div className={`mt-3 flex items-start gap-2 p-3 rounded-xl text-xs ${dk('bg-yellow-500/8 border border-yellow-500/15 text-yellow-300', 'bg-yellow-50 border border-yellow-200 text-yellow-700')}`}>
            <Shield size={11} className="flex-shrink-0 mt-0.5"/>
            Partilha apenas com o entregador no momento da entrega.
          </div>
        </div>
      )}

      {/* Acções do entregador */}
      {isDeliverer && !isDone && !isCancelled && (
        <div className={`${card} p-5`}>
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${dk('text-gray-500', 'text-gray-400')}`}>
            Acções
          </h3>
          <div className="space-y-2">
            {delivery.current_status === 'accepted' && (
              <button onClick={() => setActionModal('collect')}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${dk('bg-blue-500 hover:bg-blue-400 text-white', 'bg-blue-600 hover:bg-blue-700 text-white')}`}>
                <Package size={15}/> Confirmar Recolha do Item
              </button>
            )}
            {(delivery.current_status === 'in_progress' || delivery.current_status === 'picked_up') && (
              <button onClick={() => { setActionModal('deliver'); setCodeInput(''); setCodeError('') }}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${dk('bg-emerald-500 hover:bg-emerald-400 text-black', 'bg-emerald-600 hover:bg-emerald-700 text-white')}`}>
                <KeyRound size={15}/> Introduzir Código e Concluir
              </button>
            )}
          </div>
        </div>
      )}

      {/* Timeline de checkpoints */}
      {checkpoints.length > 0 && (
        <div className={`${card} p-5`}>
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-4 ${dk('text-gray-500', 'text-gray-400')}`}>
            Histórico
          </h3>
          <div className="space-y-3">
            {checkpoints.map((cp, i) => (
              <div key={cp.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    i === checkpoints.length - 1
                      ? dk('bg-emerald-500/20 border border-emerald-500/30', 'bg-emerald-50 border border-emerald-200')
                      : dk('bg-white/8 border border-white/15', 'bg-gray-50 border border-gray-200')
                  }`}>
                    <CheckCircle size={11} className={i === checkpoints.length - 1 ? 'text-emerald-400' : dk('text-gray-600', 'text-gray-400')}/>
                  </div>
                  {i < checkpoints.length - 1 && (
                    <div className={`w-px h-6 mt-1 ${dk('bg-white/10', 'bg-gray-200')}`}/>
                  )}
                </div>
                <div className="flex-1 pb-1">
                  <p className={`text-sm font-medium ${dk('text-white', 'text-gray-900')}`}>{cp.description}</p>
                  <p className={`text-[10px] mt-0.5 ${dk('text-gray-600', 'text-gray-400')}`}>
                    {fmtDateTime(cp.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal de acção (entregador) ── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl border p-6 ${dk('bg-[#1a1a1a] border-white/10', 'bg-white border-gray-200 shadow-2xl')}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              actionModal === 'deliver' ? dk('bg-emerald-500/15', 'bg-emerald-50') : dk('bg-blue-500/15', 'bg-blue-50')
            }`}>
              {actionModal === 'deliver'
                ? <KeyRound size={22} className="text-emerald-400"/>
                : <Package  size={22} className="text-blue-400"/>
              }
            </div>
            <h3 className={`text-base font-bold text-center mb-1 ${dk('text-white', 'text-gray-900')}`}>
              {actionModal === 'deliver' ? 'Confirmar entrega' : 'Confirmar recolha'}
            </h3>
            <p className={`text-xs text-center mb-5 ${dk('text-gray-400', 'text-gray-500')}`}>
              {actionModal === 'deliver'
                ? 'Introduz o código de 6 dígitos do empreendedor'
                : 'Confirma que recolheste o item no endereço de origem'}
            </p>

            {actionModal === 'deliver' && (
              <div className="mb-4">
                <input
                  type="text"
                  value={codeInput}
                  onChange={e => { setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setCodeError('') }}
                  placeholder="XXXXXX"
                  maxLength={6}
                  autoFocus
                  className={`w-full text-center text-3xl font-mono font-bold tracking-[0.5em] py-4 rounded-xl border outline-none transition-all ${
                    codeError
                      ? dk('bg-red-500/10 border-red-500/40 text-white', 'bg-red-50 border-red-300 text-gray-900')
                      : dk('bg-white/5 border-white/15 text-white focus:border-emerald-500/60', 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-400')
                  }`}
                />
                {codeError && (
                  <p className="text-xs text-red-400 text-center mt-2 flex items-center justify-center gap-1">
                    <AlertCircle size={11}/> {codeError}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setActionModal(null); setCodeInput(''); setCodeError('') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
                Cancelar
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading || (actionModal === 'deliver' && codeInput.length < 4)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  actionModal === 'deliver'
                    ? 'bg-emerald-500 hover:bg-emerald-400'
                    : 'bg-blue-500 hover:bg-blue-400'
                }`}>
                {actionLoading
                  ? <Loader2 size={14} className="animate-spin"/>
                  : actionModal === 'deliver'
                    ? <><ShieldCheck size={14}/> Confirmar</>
                    : <><Package size={14}/> Confirmar recolha</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}