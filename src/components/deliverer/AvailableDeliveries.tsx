// src/components/deliverer/AvailableDeliveries.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, MapPin, DollarSign, Clock, CheckCircle,
  Loader2, AlertCircle, RefreshCw, ChevronDown,
  Filter, Truck, KeyRound, X, ShieldCheck,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { notifyEntrepreneur } from '../../lib/Notificationservice'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Delivery {
  id:                  string
  entrepreneur_id:     string
  item_type:           string
  origin_address:      string
  destination_address: string
  current_status:      string
  estimated_value:     number
  notes:               string | null
  created_at:          string
  // enriquecido
  entrepreneur_name?:  string
  entrepreneur_phone?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

const fmtRelative = (s: string) => {
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora mesmo'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

const calcFee = (v: number) => Math.round(v * 0.8 * 100) / 100

// ─── Component ────────────────────────────────────────────────────────────────

export default function AvailableDeliveries() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem('deliverer_theme') !== 'light'
  )
  useEffect(() => {
    const h = () => setIsDarkMode(localStorage.getItem('deliverer_theme') !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const [deliveries,   setDeliveries]   = useState<Delivery[]>([])
  const [loading,      setLoading]      = useState(true)
  const [accepting,    setAccepting]    = useState<string | null>(null)
  const [feedback,     setFeedback]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [filterValue,  setFilterValue]  = useState('all') // 'all' | 'low' | 'mid' | 'high'
  const [sortBy,       setSortBy]       = useState('newest') // 'newest' | 'value_desc' | 'value_asc'

  // Modal de confirmação de aceitação
  const [confirmModal, setConfirmModal] = useState<Delivery | null>(null)

  // Modal de info do código (após aceitar)
  const [codeModal, setCodeModal] = useState<{ delivery: Delivery; accepted: boolean } | null>(null)

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  // ── Carregar entregas disponíveis ──────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Entregas disponíveis = status 'accepted' sem entregador atribuído
      // OU status que permita que um entregador as aceite
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, entrepreneur_id, item_type, origin_address, destination_address, current_status, estimated_value, notes, created_at')
        .eq('current_status', 'accepted')
        .is('deliverer_id', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const list = data || []

      // Enriquecer com dados do empreendedor
      const eIds = [...new Set(list.map(d => d.entrepreneur_id).filter(Boolean))]
      let eMap: Record<string, { full_name?: string; phone?: string }> = {}
      if (eIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', eIds)
        if (profiles) profiles.forEach(p => { eMap[p.user_id] = p })
      }

      setDeliveries(list.map(d => ({
        ...d,
        entrepreneur_name:  eMap[d.entrepreneur_id]?.full_name,
        entrepreneur_phone: eMap[d.entrepreneur_id]?.phone,
      })))
    } catch (e: any) {
      setFeedback({ type: 'error', msg: e.message || 'Erro ao carregar entregas.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime — atualiza quando novas entregas ficam disponíveis
  useEffect(() => {
    const ch = supabase.channel('available-deliveries')
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'deliveries',
        filter: `current_status=eq.accepted`,
      }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  // ── Aceitar entrega ────────────────────────────────────────────────────────
  const handleAccept = async (delivery: Delivery) => {
    if (!user?.id) return
    setAccepting(delivery.id)
    setConfirmModal(null)
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          deliverer_id:   user.id,
          current_status: 'in_progress',
          updated_at:     new Date().toISOString(),
        })
        .eq('id', delivery.id)
        .is('deliverer_id', null) // garantia de que ninguém aceitou entretanto

      if (error) throw error

      // Audit log — falha silenciosa, não bloqueia o fluxo
      try {
        await supabase.from('activity_logs').insert({
          user_id:     delivery.entrepreneur_id,
          actor_id:    user.id,
          action:      'delivery_status_changed',
          entity_type: 'delivery',
          entity_id:   delivery.id,
          metadata:    { old_status: 'accepted', new_status: 'in_progress', deliverer_id: user.id },
        })
      } catch { /* silencioso */ }

      // ── Notificar empreendedor que a entrega foi aceite ───────────────────
      notifyEntrepreneur(delivery.id, 'delivery_accepted')

      // Mostrar modal com instruções do código
      setCodeModal({ delivery, accepted: true })
      setDeliveries(prev => prev.filter(d => d.id !== delivery.id))
      // Guardar no sessionStorage para o MyDeliveries forçar reload ao montar
      sessionStorage.setItem('zomar_force_reload_deliveries', '1')
    } catch (e: any) {
      if (e.message?.includes('deliverer_id')) {
        setFeedback({ type: 'error', msg: 'Esta entrega já foi aceite por outro entregador.' })
      } else {
        setFeedback({ type: 'error', msg: e.message || 'Erro ao aceitar entrega.' })
      }
    } finally {
      setAccepting(null)
    }
  }

  // ── Filtrar e ordenar ─────────────────────────────────────────────────────
  const filtered = deliveries
    .filter(d => {
      if (filterValue === 'low')  return d.estimated_value < 500
      if (filterValue === 'mid')  return d.estimated_value >= 500  && d.estimated_value < 2000
      if (filterValue === 'high') return d.estimated_value >= 2000
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'value_desc') return b.estimated_value - a.estimated_value
      if (sortBy === 'value_asc')  return a.estimated_value - b.estimated_value
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  // ── CSS ───────────────────────────────────────────────────────────────────
  const card    = `rounded-2xl border transition-all duration-200 ${dk('bg-[#1a1a1a] border-white/8', 'bg-white border-gray-200 shadow-sm')}`
  const selectCls = `px-3 py-2 rounded-xl text-xs font-medium border outline-none appearance-none cursor-pointer transition-all ${
    dk('bg-white/5 border-white/10 text-gray-300', 'bg-white border-gray-200 text-gray-700 shadow-sm')
  }`

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* CSS scrollbar */}
      <style>{`
        .avd-scroll::-webkit-scrollbar { height:4px; }
        .avd-scroll::-webkit-scrollbar-track { background:transparent; }
        .avd-scroll::-webkit-scrollbar-thumb { background:${isDarkMode ? '#374151' : '#d1d5db'}; border-radius:99px; }
      `}</style>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium ${
          feedback.type === 'success'
            ? dk('bg-emerald-500/10 border-emerald-500/20 text-emerald-300', 'bg-emerald-50 border-emerald-200 text-emerald-700')
            : dk('bg-red-500/10 border-red-500/20 text-red-300', 'bg-red-50 border-red-200 text-red-700')
        }`}>
          {feedback.type === 'success' ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
          <span className="flex-1">{feedback.msg}</span>
          <button onClick={() => setFeedback(null)}><X size={14}/></button>
        </div>
      )}

      {/* Cabeçalho + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`text-xl font-bold ${dk('text-white', 'text-gray-900')}`}>Entregas Disponíveis</h2>
          <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${dk('text-gray-500', 'text-gray-400')}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"/>
            {loading ? 'A carregar…' : `${filtered.length} entrega${filtered.length !== 1 ? 's' : ''} disponív${filtered.length !== 1 ? 'eis' : 'el'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro valor */}
          <div className="relative">
            <Filter size={11} className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${dk('text-gray-500', 'text-gray-400')}`}/>
            <select value={filterValue} onChange={e => setFilterValue(e.target.value)} className={`${selectCls} pl-7`}>
              <option value="all">Todos os valores</option>
              <option value="low">&lt; 500 MZN</option>
              <option value="mid">500–2000 MZN</option>
              <option value="high">&gt; 2000 MZN</option>
            </select>
          </div>
          {/* Ordenação */}
          <div className="relative">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={selectCls}>
              <option value="newest">Mais recentes</option>
              <option value="value_desc">Maior valor</option>
              <option value="value_asc">Menor valor</option>
            </select>
          </div>
          <button onClick={load} disabled={loading}
            className={`p-2 rounded-xl transition-all ${dk('hover:bg-white/8 text-gray-400', 'hover:bg-gray-100 text-gray-500')}`}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`${card} h-28 animate-pulse`}/>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${card} py-14 text-center`}>
          <Truck size={36} className={`mx-auto mb-3 ${dk('text-gray-600', 'text-gray-300')}`}/>
          <p className={`font-semibold ${dk('text-gray-300', 'text-gray-700')}`}>Sem entregas disponíveis</p>
          <p className={`text-sm mt-1 ${dk('text-gray-500', 'text-gray-400')}`}>
            Novas entregas aparecem aqui em tempo real
          </p>
          <button onClick={load}
            className={`mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              dk('bg-white/8 hover:bg-white/15 text-gray-300', 'bg-gray-100 hover:bg-gray-200 text-gray-700')
            }`}>
            <RefreshCw size={13}/> Actualizar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d, i) => {
            const fee = calcFee(d.estimated_value)
            const isAccepting = accepting === d.id
            return (
              <div key={d.id}
                style={{ animationDelay: `${i * 30}ms` }}
                className={`${card} p-4 hover:border-emerald-500/25`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">

                    {/* Tipo + tempo */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${dk('bg-emerald-500/15', 'bg-emerald-50')}`}>
                        <Package size={13} className="text-emerald-400"/>
                      </div>
                      <span className={`font-bold text-sm ${dk('text-white', 'text-gray-900')}`}>
                        {d.item_type}
                      </span>
                      <span className={`text-[10px] ml-auto flex-shrink-0 ${dk('text-gray-500', 'text-gray-400')}`}>
                        {fmtRelative(d.created_at)}
                      </span>
                    </div>

                    {/* Rota */}
                    <div className="space-y-1 mb-3">
                      <div className="flex items-start gap-1.5">
                        <MapPin size={11} className="text-emerald-400 flex-shrink-0 mt-0.5"/>
                        <span className={`text-xs truncate ${dk('text-gray-300', 'text-gray-700')}`}>
                          {d.origin_address}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <MapPin size={11} className="text-orange-400 flex-shrink-0 mt-0.5"/>
                        <span className={`text-xs truncate ${dk('text-gray-300', 'text-gray-700')}`}>
                          {d.destination_address}
                        </span>
                      </div>
                    </div>

                    {/* Notas */}
                    {d.notes && (
                      <p className={`text-xs mb-3 px-2 py-1.5 rounded-lg ${dk('bg-white/4 text-gray-400', 'bg-gray-50 text-gray-500')}`}>
                        💬 {d.notes}
                      </p>
                    )}

                    {/* Empreendedor + valor + ganho */}
                    <div className="flex items-center justify-between">
                      <div className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>
                        {d.entrepreneur_name || 'Empreendedor'}
                      </div>
                      <div className="text-right">
                        <div className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>
                          Valor: {fmtMZN(d.estimated_value)}
                        </div>
                        <div className={`text-sm font-bold ${dk('text-emerald-400', 'text-emerald-600')}`}>
                          Ganho: {fmtMZN(fee)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botão aceitar */}
                <button
                  onClick={() => setConfirmModal(d)}
                  disabled={isAccepting}
                  className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 ${
                    dk('bg-emerald-500 hover:bg-emerald-400 text-black', 'bg-emerald-600 hover:bg-emerald-700 text-white')
                  }`}
                >
                  {isAccepting
                    ? <><Loader2 size={14} className="animate-spin"/> A aceitar…</>
                    : <><Truck size={14}/> Aceitar Entrega — {fmtMZN(fee)}</>
                  }
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal de confirmação de aceitação ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl border p-6 ${dk('bg-[#1a1a1a] border-white/10', 'bg-white border-gray-200 shadow-2xl')}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${dk('bg-emerald-500/15', 'bg-emerald-50')}`}>
              <Truck size={22} className="text-emerald-400"/>
            </div>
            <h3 className={`text-base font-bold text-center mb-1 ${dk('text-white', 'text-gray-900')}`}>
              Confirmar aceitação
            </h3>
            <p className={`text-xs text-center mb-4 ${dk('text-gray-400', 'text-gray-500')}`}>
              Ao aceitar, esta entrega fica exclusivamente sua
            </p>

            {/* Resumo */}
            <div className={`rounded-xl p-4 mb-5 space-y-2 ${dk('bg-white/4', 'bg-gray-50')}`}>
              <div className="flex items-start gap-2">
                <Package size={12} className={`mt-0.5 flex-shrink-0 ${dk('text-gray-400', 'text-gray-500')}`}/>
                <span className={`text-xs ${dk('text-gray-300', 'text-gray-700')}`}>{confirmModal.item_type}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={12} className="mt-0.5 text-emerald-400 flex-shrink-0"/>
                <span className={`text-xs truncate ${dk('text-gray-300', 'text-gray-700')}`}>{confirmModal.origin_address}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={12} className="mt-0.5 text-orange-400 flex-shrink-0"/>
                <span className={`text-xs truncate ${dk('text-gray-300', 'text-gray-700')}`}>{confirmModal.destination_address}</span>
              </div>
              <div className={`flex justify-between pt-2 border-t ${dk('border-white/8', 'border-gray-200')}`}>
                <span className={`text-xs ${dk('text-gray-400', 'text-gray-500')}`}>O teu ganho</span>
                <span className={`text-sm font-bold ${dk('text-emerald-400', 'text-emerald-600')}`}>
                  {fmtMZN(calcFee(confirmModal.estimated_value))}
                </span>
              </div>
            </div>

            {/* Aviso sobre código */}
            <div className={`flex items-start gap-2 p-3 rounded-xl mb-4 ${dk('bg-blue-500/8 border border-blue-500/15', 'bg-blue-50 border border-blue-200')}`}>
              <KeyRound size={13} className="text-blue-400 flex-shrink-0 mt-0.5"/>
              <p className={`text-xs leading-relaxed ${dk('text-blue-300', 'text-blue-700')}`}>
                Para concluir a entrega, vais precisar de introduzir o <strong>código de 6 dígitos</strong> fornecido pelo empreendedor.
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setConfirmModal(null)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
                Cancelar
              </button>
              <button
                onClick={() => handleAccept(confirmModal)}
                disabled={!!accepting}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${
                  dk('bg-emerald-500 hover:bg-emerald-400 text-black', 'bg-emerald-600 hover:bg-emerald-700 text-white')
                }`}>
                {accepting ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>}
                Aceitar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pós-aceitação: instruções do código ── */}
      {codeModal?.accepted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl border p-6 ${dk('bg-[#1a1a1a] border-white/10', 'bg-white border-gray-200 shadow-2xl')}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${dk('bg-emerald-500/15', 'bg-emerald-50')}`}>
              <ShieldCheck size={22} className="text-emerald-400"/>
            </div>
            <h3 className={`text-base font-bold text-center mb-1 ${dk('text-white', 'text-gray-900')}`}>
              Entrega aceite!
            </h3>
            <p className={`text-xs text-center mb-5 ${dk('text-gray-400', 'text-gray-500')}`}>
              Segue para recolher o item. O empreendedor foi notificado.
            </p>

            {/* Passos */}
            <div className="space-y-3 mb-5">
              {[
                { step: '1', label: 'Vai ao endereço de origem e recolhe o item', icon: <MapPin size={13}/>, color: 'text-emerald-400' },
                { step: '2', label: 'Entrega no destino ao destinatário', icon: <Truck size={13}/>, color: 'text-blue-400' },
                { step: '3', label: 'Pede o código de 6 dígitos ao empreendedor', icon: <KeyRound size={13}/>, color: 'text-orange-400' },
                { step: '4', label: 'Introduz o código em "As Minhas Entregas" para concluir', icon: <CheckCircle size={13}/>, color: 'text-emerald-400' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5 ${dk('bg-white/10 text-gray-300', 'bg-gray-100 text-gray-600')}`}>
                    {s.step}
                  </div>
                  <div className="flex items-start gap-2">
                    <span className={`flex-shrink-0 mt-0.5 ${s.color}`}>{s.icon}</span>
                    <p className={`text-xs leading-relaxed ${dk('text-gray-300', 'text-gray-700')}`}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setCodeModal(null)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
                Fechar
              </button>
              <button
                onClick={() => { setCodeModal(null); navigate('/deliverer/my-deliveries') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${
                  dk('bg-emerald-500 hover:bg-emerald-400 text-black', 'bg-emerald-600 hover:bg-emerald-700 text-white')
                }`}>
                <Truck size={14}/> Ir para as minhas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}