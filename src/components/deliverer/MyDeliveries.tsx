'use client';

/**
 * ============================================================================
 * MY DELIVERIES — Entregador
 * ============================================================================
 * - Botão "Ver" → /deliverer/delivery/:id (dentro do layout correto)
 * - Ganhos usam deliverer_fee se disponível, senão 80% do estimated_value
 * - Tema lido do localStorage (deliverer_theme) — sincroniza com o layout
 * - console.log/warn/error removidos de produção
 * - Feedback inline sem dependências externas
 * @version 2.0 (Fully Functional)
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Package, Truck, CheckCircle, XCircle, Clock, MapPin,
  DollarSign, Calendar, TrendingUp, Loader2, AlertCircle,
  Eye, ChevronDown, KeyRound, ShieldCheck,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
// notifyEntrepreneur e broadcastDeliveryUpdate substituídos por triggers Supabase (SQL)
// useRealtimeDelivery substituído por postgres_changes nativo

// ─── Types ────────────────────────────────────────────────────────────────────

interface Delivery {
  id: string
  entrepreneur_id: string
  deliverer_id: string
  item_type: string
  origin_address: string
  destination_address: string
  current_status: string
  estimated_value: number
  notes: string | null
  created_at: string
  updated_at: string | null
  completed_at: string | null
  delivered_at: string | null
  picked_up_at: string | null
  // campo calculado — não existe na tabela
  entrepreneur_name?: string
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed:   { label: 'Entregue',     color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: <CheckCircle size={16} /> },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',         icon: <Truck size={16} />       },
  accepted:    { label: 'Aceita',       color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',   icon: <Clock size={16} />       },
  picked_up:   { label: 'Recolhido',    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',   icon: <Package size={16} />     },
  problem:     { label: 'Problema',     color: 'bg-red-500/10 text-red-400 border-red-500/30',             icon: <XCircle size={16} />     },
  cancelled:   { label: 'Cancelado',    color: 'bg-red-500/10 text-red-400 border-red-500/30',             icon: <XCircle size={16} />     },
}

const getStatus = (status: string) =>
  STATUS_CONFIG[status] ?? {
    label: status,
    color: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    icon: <Package size={16} />,
  }

/** Ganhos estimados: 80% do estimated_value (deliverer_fee não existe na tabela ainda) */
const calcFee = (d: Delivery): number => d.estimated_value * 0.8

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyDeliveries() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user }  = useAuth()

  // ── Tema sincronizado com DelivererLayout ───────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem('deliverer_theme') !== 'light'
  )
  useEffect(() => {
    const handle = (e: StorageEvent) => {
      if (e.key === 'deliverer_theme') setIsDarkMode(e.newValue !== 'light')
    }
    window.addEventListener('storage', handle)
    return () => window.removeEventListener('storage', handle)
  }, [])

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  // ── Estado ──────────────────────────────────────────────────────────────────
  const [deliveries,    setDeliveries]    = useState<Delivery[]>([])
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusFilter,  setStatusFilter]  = useState('all')
  const [timeFilter,    setTimeFilter]    = useState('all')
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; msg: string } | null>(null)
  const [statusOpen,   setStatusOpen]   = useState(false)
  const [timeOpen,     setTimeOpen]     = useState(false)

  // ── Modal de código de confirmação ──
  const [codeModal,    setCodeModal]    = useState<{ deliveryId: string; mode: 'collect' | 'deliver' } | null>(null)
  const [codeInput,    setCodeInput]    = useState('')
  const [codeError,    setCodeError]    = useState('')
  const [codeLoading,  setCodeLoading]  = useState(false)

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(t)
  }, [feedback])

  // Carregar entregas
  const loadMyDeliveries = useCallback(async () => {
    if (!user?.id) { navigate('/login'); return }
    try {
      // Usar auth.uid() implicitamente via RLS — comparar com user.id do contexto
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, entrepreneur_id, deliverer_id, item_type, origin_address, destination_address, current_status, estimated_value, notes, created_at, updated_at, completed_at, delivered_at, picked_up_at')
        .eq('deliverer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      const rows = data || []

      // Se não encontrou nada, tentar verificar se há discrepância de IDs
      // (auth.uid() vs profiles.user_id)
      if (rows.length === 0) {
        // Verificar via auth.getUser() se o ID coincide
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser && authUser.id !== user.id) {
          // ID do contexto diferente do auth — retentar com o ID correcto
          const { data: data2 } = await supabase
            .from('deliveries')
            .select('id, entrepreneur_id, deliverer_id, item_type, origin_address, destination_address, current_status, estimated_value, notes, created_at, updated_at, completed_at, delivered_at, picked_up_at')
            .eq('deliverer_id', authUser.id)
            .order('created_at', { ascending: false })
          if (data2 && data2.length > 0) {
            const eIds2 = [...new Set(data2.map((d: any) => d.entrepreneur_id).filter(Boolean))]
            const nm2: Record<string, string> = {}
            if (eIds2.length > 0) {
              const { data: p2 } = await supabase.from('profiles').select('user_id, full_name').in('user_id', eIds2)
              ;(p2 || []).forEach((p: any) => { nm2[p.user_id] = p.full_name ?? 'Empreendedor' })
            }
            setDeliveries(data2.map((d: any) => ({ ...d, entrepreneur_name: nm2[d.entrepreneur_id] ?? 'Empreendedor' })))
            setLoading(false)
            return
          }
        }
      }

      // Nomes dos empreendedores
      const entrepreneurIds = [...new Set(rows.map((d: any) => d.entrepreneur_id).filter(Boolean))]
      const nameMap: Record<string, string> = {}
      if (entrepreneurIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', entrepreneurIds)
        ;(profiles || []).forEach((p: any) => {
          if (p.user_id) nameMap[p.user_id] = p.full_name ?? 'Empreendedor'
        })
      }

      setDeliveries(
        rows.map((d: any) => ({
          ...d,
          entrepreneur_name: nameMap[d.entrepreneur_id] ?? 'Empreendedor',
        }))
      )
    } catch (err: any) {
      setFeedback({ type: 'error', msg: `Erro ao carregar: ${err?.message || 'Tente novamente.'}` })
    } finally {
      setLoading(false)
    }
  }, [navigate, user])

  useEffect(() => {
    // Forçar reload se vier da página de aceitar entrega
    const forceReload = sessionStorage.getItem('zomar_force_reload_deliveries')
    if (forceReload) {
      sessionStorage.removeItem('zomar_force_reload_deliveries')
    }
    loadMyDeliveries()
  }, [loadMyDeliveries])

  // Realtime — sem filtro: detecta qualquer UPDATE/INSERT na tabela
  // (filtro por deliverer_id não detecta a transição null → userId)
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase.channel('my-deliveries-rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliveries' },
          () => loadMyDeliveries())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deliveries' },
          () => loadMyDeliveries())
      .subscribe()

    // Fallback: poll de 4s para garantir que a entrega aceite aparece
    // (o realtime pode ter latência na primeira ligação)
    const poll = setTimeout(() => loadMyDeliveries(), 4000)

    return () => {
      supabase.removeChannel(ch)
      clearTimeout(poll)
    }
  }, [user?.id, loadMyDeliveries])


  // ── Atualizar status ────────────────────────────────────────────────────────
  const updateDeliveryStatus = async (deliveryId: string, newStatus: string) => {
    if (!user) { navigate('/login'); return }

    try {
      setActionLoading(deliveryId)

      // Tenta update completo; se coluna não existir (42703), tenta só current_status
      const updates: Record<string, string> = { current_status: newStatus }
      if (newStatus === 'in_progress') updates.picked_up_at = new Date().toISOString()
      if (newStatus === 'completed')   updates.delivered_at  = new Date().toISOString()

      const { error: err1 } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', deliveryId)

      if (err1) {
        if (err1.code === '42703') {
          // Coluna de data ainda não existe — atualiza só o status
          const { error: err2 } = await supabase
            .from('deliveries')
            .update({ current_status: newStatus })
            .eq('id', deliveryId)
          if (err2) throw err2
        } else {
          throw err1
        }
      }

      // Checkpoint — falha silenciosa
      try {
        await supabase.from('delivery_checkpoints').insert({
          delivery_id: deliveryId,
          status: newStatus,
          description:
            newStatus === 'in_progress' ? 'Item recolhido pelo entregador' :
            newStatus === 'completed'   ? 'Entrega concluída com sucesso'  :
            `Status atualizado: ${newStatus}`,
          created_at: new Date().toISOString(),
        })
      } catch { /* silencioso */ }

      const labels: Record<string, string> = {
        in_progress: '📦 Item recolhido!',
        completed:   '✅ Entrega concluída!',
      }
      setFeedback({ type: 'success', msg: labels[newStatus] ?? 'Status atualizado!' })
      loadMyDeliveries()
    } catch (err: any) {
      setFeedback({
        type: 'error',
        msg: `Erro ao atualizar status: ${err?.message ?? 'Tente novamente.'}`,
      })
    } finally {
      setActionLoading(null)
    }
  }

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const filteredDeliveries = deliveries.filter(d => {
    if (statusFilter !== 'all' && d.current_status !== statusFilter) return false
    if (timeFilter !== 'all') {
      const diffDays = (Date.now() - new Date(d.created_at).getTime()) / 86_400_000
      if (timeFilter === 'today' && diffDays > 1)  return false
      if (timeFilter === 'week'  && diffDays > 7)  return false
      if (timeFilter === 'month' && diffDays > 30) return false
    }
    return true
  })

  // ── Stats ───────────────────────────────────────────────────────────────────
  // ── Verificar código de confirmação via RPC ────────────────────────────────
  const handleVerifyCode = async () => {
    if (!codeModal || !user) return
    if (codeInput.trim().length < 4) {
      setCodeError('Introduza o código completo.')
      return
    }
    setCodeLoading(true)
    setCodeError('')
    try {
      if (codeModal.mode === 'collect') {
        // Recolha — não precisa de código, só confirmar
        await updateDeliveryStatus(codeModal.deliveryId, 'in_progress')
        setCodeModal(null)
        setCodeInput('')
        return
      }
      // Entrega — verificar código via RPC segura
      const { data, error } = await supabase.rpc('verify_delivery_code', {
        p_delivery_id:  codeModal.deliveryId,
        p_code:         codeInput.trim().toUpperCase(),
        p_deliverer_id: user.id,
      })
      if (error) throw error
      if (!data?.success) {
        setCodeError(data?.error || 'Código incorrecto. Verifique com o empreendedor.')
        return
      }
      // Sucesso — checkpoint + notificação
      try {
        await supabase.from('delivery_checkpoints').insert({
          delivery_id: codeModal.deliveryId,
          status: 'completed',
          description: 'Entrega concluída — código verificado',
          created_at: new Date().toISOString(),
        })
      } catch { /* silencioso */ }
      setFeedback({ type: 'success', msg: '✅ Entrega concluída com sucesso!' })
      setCodeModal(null)
      setCodeInput('')
      loadMyDeliveries()
    } catch (e: any) {
      setCodeError(e.message || 'Erro ao verificar código.')
    } finally {
      setCodeLoading(false)
    }
  }
  const totalEarnings = filteredDeliveries
    .filter(d => d.current_status === 'completed')
    .reduce((sum, d) => sum + calcFee(d), 0)

  const completedAll   = deliveries.filter(d => d.current_status === 'completed')
  const completionRate = deliveries.length > 0
    ? Math.round((completedAll.length / deliveries.length) * 100)
    : 0

  const todayCount = filteredDeliveries.filter(
    d => new Date(d.created_at).toDateString() === new Date().toDateString()
  ).length

  // ── Render ──────────────────────────────────────────────────────────────────
  const scrollbarCSS = `
    .scrollbar-themed::-webkit-scrollbar { height: 6px; width: 6px; }
    .scrollbar-themed::-webkit-scrollbar-track { background: transparent; }
    .scrollbar-dark::-webkit-scrollbar-thumb {
      background: linear-gradient(90deg, #10b981, #059669);
      border-radius: 10px;
    }
    .scrollbar-dark::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(90deg, #059669, #047857);
      box-shadow: 0 0 6px rgba(16,185,129,0.4);
    }
    .scrollbar-light::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 10px;
    }
    .scrollbar-light::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }
  `

  return (
    <div className={`min-h-screen p-4 md:p-6 transition-colors ${
      dk('text-white', 'text-gray-900')
    }`}>
      <style>{scrollbarCSS}</style>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Título */}
        <div>
          <h1 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>
            Minhas Entregas
          </h1>
          <p className={`mt-1 text-sm ${dk('text-gray-400', 'text-gray-600')}`}>
            Acompanhe todas as suas entregas em tempo real
          </p>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-2xl p-4 flex items-center gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
              : 'bg-red-500/10 border-red-500/20 text-red-200'
          }`}>
            {feedback.type === 'success'
              ? <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />
              : <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
            }
            <span className="flex-1 text-sm">{feedback.msg}</span>
            <button
              onClick={() => setFeedback(null)}
              className="ml-auto opacity-60 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Total',
              value: filteredDeliveries.length,
              Icon: Package,
              color: 'text-blue-400',
              bg: dk('bg-blue-500/20', 'bg-blue-100'),
            },
            {
              label: 'Ganhos',
              value: fmtMZN(totalEarnings),
              Icon: DollarSign,
              color: 'text-emerald-400',
              bg: dk('bg-emerald-500/20', 'bg-emerald-100'),
            },
            {
              label: 'Hoje',
              value: todayCount,
              Icon: TrendingUp,
              color: 'text-purple-400',
              bg: dk('bg-purple-500/20', 'bg-purple-100'),
            },
            {
              label: 'Conclusão',
              value: `${completionRate}%`,
              Icon: CheckCircle,
              color: 'text-yellow-400',
              bg: dk('bg-yellow-500/20', 'bg-yellow-100'),
            },
          ].map(({ label, value, Icon, color, bg }) => (
            <div
              key={label}
              className={`rounded-xl p-4 flex items-center justify-between border ${
                dk('bg-white/5 border-white/10', 'bg-white border-gray-200 shadow-sm')
              }`}
            >
              <div>
                <p className={`text-xs ${dk('text-gray-400', 'text-gray-500')}`}>{label}</p>
                <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
              <div className={`p-2 ${bg} rounded-lg`}>
                <Icon className={color} size={20} />
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        {/* Fechar dropdowns ao clicar fora */}
        {(statusOpen || timeOpen) && (
          <div className="fixed inset-0 z-10" onClick={() => { setStatusOpen(false); setTimeOpen(false) }} />
        )}

        <div className={`rounded-xl p-4 border grid grid-cols-1 md:grid-cols-2 gap-3 ${
          dk('bg-white/5 border-white/10', 'bg-white border-gray-200 shadow-sm')
        }`}>
          {/* Dropdown Status */}
          <div>
            <label className={`block text-xs font-medium mb-2 ${dk('text-gray-400', 'text-gray-600')}`}>
              Status
            </label>
            <div className="relative z-20">
              <button
                onClick={() => { setStatusOpen(!statusOpen); setTimeOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all ${
                  statusOpen
                    ? dk('bg-white/10 border-emerald-500/50 text-white', 'bg-white border-emerald-400 text-gray-900')
                    : dk('bg-white/5 border-white/15 text-white hover:border-white/30', 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300')
                }`}
              >
                <span>{{
                  all: 'Todos', accepted: 'Aceitas', in_progress: 'Em Andamento',
                  picked_up: 'Recolhido', completed: 'Concluídas', problem: 'Problemas'
                }[statusFilter]}</span>
                <ChevronDown size={16} className={`transition-transform ${statusOpen ? 'rotate-180' : ''} ${dk('text-gray-400', 'text-gray-500')}`} />
              </button>
              {statusOpen && (
                <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-xl overflow-hidden z-30 ${
                  dk('bg-[#1a1a1a] border-white/10', 'bg-white border-gray-200')
                }`}>
                  {[
                    { value: 'all',         label: 'Todos'         },
                    { value: 'accepted',    label: 'Aceitas'       },
                    { value: 'in_progress', label: 'Em Andamento'  },
                    { value: 'picked_up',   label: 'Recolhido'     },
                    { value: 'completed',   label: 'Concluídas'    },
                    { value: 'problem',     label: 'Problemas'     },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setStatusFilter(opt.value); setStatusOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        statusFilter === opt.value
                          ? dk('bg-emerald-500/20 text-emerald-400', 'bg-emerald-50 text-emerald-700')
                          : dk('text-gray-300 hover:bg-white/8 hover:text-white', 'text-gray-700 hover:bg-gray-50')
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dropdown Período */}
          <div>
            <label className={`block text-xs font-medium mb-2 ${dk('text-gray-400', 'text-gray-600')}`}>
              Período
            </label>
            <div className="relative z-20">
              <button
                onClick={() => { setTimeOpen(!timeOpen); setStatusOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all ${
                  timeOpen
                    ? dk('bg-white/10 border-emerald-500/50 text-white', 'bg-white border-emerald-400 text-gray-900')
                    : dk('bg-white/5 border-white/15 text-white hover:border-white/30', 'bg-gray-50 border-gray-200 text-gray-900 hover:border-gray-300')
                }`}
              >
                <span>{{
                  all: 'Todo período', today: 'Hoje',
                  week: 'Última semana', month: 'Último mês'
                }[timeFilter]}</span>
                <ChevronDown size={16} className={`transition-transform ${timeOpen ? 'rotate-180' : ''} ${dk('text-gray-400', 'text-gray-500')}`} />
              </button>
              {timeOpen && (
                <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-xl overflow-hidden z-30 ${
                  dk('bg-[#1a1a1a] border-white/10', 'bg-white border-gray-200')
                }`}>
                  {[
                    { value: 'all',   label: 'Todo período'  },
                    { value: 'today', label: 'Hoje'          },
                    { value: 'week',  label: 'Última semana' },
                    { value: 'month', label: 'Último mês'    },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setTimeFilter(opt.value); setTimeOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        timeFilter === opt.value
                          ? dk('bg-emerald-500/20 text-emerald-400', 'bg-emerald-50 text-emerald-700')
                          : dk('text-gray-300 hover:bg-white/8 hover:text-white', 'text-gray-700 hover:bg-gray-50')
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className={`animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 ${
              dk('border-emerald-500', 'border-emerald-600')
            }`} />
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className={`rounded-xl p-8 text-center border ${
            dk('bg-white/5 border-white/10', 'bg-white border-gray-200 shadow-sm')
          }`}>
            <Truck className={`mx-auto ${dk('text-gray-600', 'text-gray-300')}`} size={48} />
            <h3 className={`text-lg font-bold mt-4 ${dk('text-white', 'text-gray-900')}`}>
              Nenhuma entrega encontrada
            </h3>
            <p className={`mt-2 text-sm ${dk('text-gray-400', 'text-gray-600')}`}>
              Tente ajustar os filtros ou aceite novas entregas
            </p>
          </div>
        ) : (
          <div className={`rounded-xl border overflow-hidden ${
            dk('bg-white/5 border-white/10', 'bg-white border-gray-200 shadow-sm')
          }`}>
            <div className={`overflow-x-auto scrollbar-themed ${isDarkMode ? 'scrollbar-dark' : 'scrollbar-light'}`}>
              <table className="min-w-full">
                <thead>
                  <tr className={`border-b ${dk('border-white/10', 'border-gray-200')}`}>
                    {['Item', 'Status', 'Empreendedor', 'Ganhos', 'Data', 'Ações'].map(h => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                          dk('text-gray-400', 'text-gray-500')
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${dk('divide-white/5', 'divide-gray-100')}`}>
                  {filteredDeliveries.map(delivery => {
                    const s = getStatus(delivery.current_status)
                    const isActioning = actionLoading === delivery.id
                    const fee = calcFee(delivery)

                    return (
                      <tr
                        key={delivery.id}
                        className={`transition-colors ${dk('hover:bg-white/5', 'hover:bg-gray-50')}`}
                      >
                        {/* Item */}
                        <td className="px-4 py-3">
                          <p className={`font-medium text-sm ${dk('text-white', 'text-gray-900')}`}>
                            {delivery.item_type}
                          </p>
                          <div className={`flex items-center text-xs mt-1 ${dk('text-gray-400', 'text-gray-500')}`}>
                            <MapPin size={12} className="mr-1 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">{delivery.origin_address}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded border ${s.color}`}>
                            {s.icon}
                            {s.label}
                          </div>
                        </td>

                        {/* Empreendedor */}
                        <td className="px-4 py-3">
                          <p className={`text-sm ${dk('text-gray-300', 'text-gray-700')}`}>
                            {delivery.entrepreneur_name}
                          </p>
                        </td>

                        {/* Ganhos — deliverer_fee ou fallback 80% */}
                        <td className="px-4 py-3">
                          <p className="font-bold text-emerald-400 text-sm">
                            {fmtMZN(fee)}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${dk('text-gray-600', 'text-gray-400')}`}>
                            estimado
                          </p>
                        </td>

                        {/* Data */}
                        <td className="px-4 py-3">
                          <div className={`flex items-center text-xs ${dk('text-gray-400', 'text-gray-500')}`}>
                            <Calendar size={12} className="mr-1 flex-shrink-0" />
                            {new Date(delivery.created_at).toLocaleDateString('pt-MZ')}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap items-center">

                            {/* Ver — rota correta dentro do layout do entregador */}
                            <button
                              onClick={() => navigate(`/deliverer/delivery/${delivery.id}`)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
                                dk(
                                  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30',
                                  'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                )
                              }`}
                            >
                              <Eye size={12} />
                              Ver
                            </button>

                            {/* Coletar — só quando accepted */}
                            {delivery.current_status === 'accepted' && (
                              <button
                                onClick={() => { setCodeModal({ deliveryId: delivery.id, mode: 'collect' }); setCodeInput(''); setCodeError('') }}
                                disabled={isActioning}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors disabled:opacity-50 ${
                                  dk(
                                    'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
                                    'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                  )
                                }`}
                              >
                                {isActioning ? <Loader2 size={12} className="animate-spin"/> : <Package size={12}/>}
                                Coletar
                              </button>
                            )}

                            {/* Entregar — requer código do empreendedor */}
                            {delivery.current_status === 'in_progress' && (
                              <button
                                onClick={() => { setCodeModal({ deliveryId: delivery.id, mode: 'deliver' }); setCodeInput(''); setCodeError('') }}
                                disabled={isActioning}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors disabled:opacity-50 ${
                                  dk(
                                    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30',
                                    'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  )
                                }`}
                              >
                                {isActioning ? <Loader2 size={12} className="animate-spin"/> : <KeyRound size={12}/>}
                                Entregar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Rodapé da tabela — total de registos */}
            <div className={`px-4 py-3 border-t text-xs ${
              dk('border-white/10 text-gray-500', 'border-gray-200 text-gray-500')
            }`}>
              {filteredDeliveries.length} entrega{filteredDeliveries.length !== 1 ? 's' : ''} encontrada{filteredDeliveries.length !== 1 ? 's' : ''}
              {statusFilter !== 'all' || timeFilter !== 'all'
                ? ` · filtros ativos`
                : ''
              }
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Código de confirmação ── */}
      {codeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl border p-6 ${
            isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200 shadow-2xl'
          }`}>
            {/* Cabeçalho */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                codeModal.mode === 'deliver'
                  ? isDarkMode ? 'bg-emerald-500/15' : 'bg-emerald-50'
                  : isDarkMode ? 'bg-blue-500/15'    : 'bg-blue-50'
              }`}>
                {codeModal.mode === 'deliver'
                  ? <KeyRound size={24} className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}/>
                  : <Package  size={24} className={isDarkMode ? 'text-blue-400'    : 'text-blue-600'}/>
                }
              </div>
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {codeModal.mode === 'deliver' ? 'Confirmar entrega' : 'Confirmar recolha'}
              </h3>
              <p className={`text-sm mt-1 leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {codeModal.mode === 'deliver'
                  ? 'Peça ao destinatário o código de 6 dígitos que o empreendedor recebeu ao criar a entrega.'
                  : 'Confirme que está a recolher este item. Certifique-se de que corresponde à descrição.'}
              </p>
            </div>

            {/* Input do código (só para entrega) */}
            {codeModal.mode === 'deliver' && (
              <div className="mb-4">
                <input
                  type="text"
                  value={codeInput}
                  onChange={e => {
                    setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                    setCodeError('')
                  }}
                  placeholder="XXXXXX"
                  maxLength={6}
                  autoFocus
                  className={`w-full text-center text-3xl font-mono font-bold tracking-[0.5em] py-4 rounded-xl border outline-none transition-all ${
                    codeError
                      ? isDarkMode ? 'bg-red-500/10 border-red-500/40 text-red-300' : 'bg-red-50 border-red-300 text-red-700'
                      : isDarkMode ? 'bg-white/5 border-white/15 text-white focus:border-emerald-500/60' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-400'
                  }`}
                />
                {codeError && (
                  <p className="text-xs text-red-400 text-center mt-2 flex items-center justify-center gap-1.5">
                    <AlertCircle size={12}/> {codeError}
                  </p>
                )}
                <p className={`text-[10px] text-center mt-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                  Este código garante que a entrega foi efectuada correctamente
                </p>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3">
              <button
                onClick={() => { setCodeModal(null); setCodeInput(''); setCodeError('') }}
                className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
                  isDarkMode ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                Cancelar
              </button>
              <button
                onClick={handleVerifyCode}
                disabled={codeLoading || (codeModal.mode === 'deliver' && codeInput.length < 4)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  codeModal.mode === 'deliver'
                    ? 'bg-emerald-500 hover:bg-emerald-400'
                    : 'bg-blue-500 hover:bg-blue-400'
                }`}>
                {codeLoading
                  ? <Loader2 size={14} className="animate-spin"/>
                  : codeModal.mode === 'deliver'
                    ? <><ShieldCheck size={14}/> Confirmar código</>
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