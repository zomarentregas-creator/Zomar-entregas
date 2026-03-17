/**
 * ============================================================================
 * OVERVIEW - VISÃO GERAL DO EMPREENDEDOR
 * ============================================================================
 * @version 4.1 — moeda MZN, responsividade mobile melhorada
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, CheckCircle, Clock, AlertTriangle,
  DollarSign, TrendingUp, Truck, RefreshCw, Loader2,
  PlusCircle, ChevronRight, MapPin
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalDeliveries: number
  pendingDeliveries: number
  completedDeliveries: number
  problemDeliveries: number
  totalValue: number
}

interface RecentDelivery {
  id: string
  item_type: string
  destination_address: string
  current_status: string
  estimated_value: number
  created_at: string
  updated_at: string
}

interface ComputedMetrics {
  successRate: number
  avgDeliveryTimeHours: number | null
  activeDeliverers: number
}

// ─── Helper de moeda ─────────────────────────────────────────────────────────

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', {
    style: 'currency',
    currency: 'MZN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(v)

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed:   { label: 'Entregue',     color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  accepted:    { label: 'Aceita',       color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  created:     { label: 'Disponível',   color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  problem:     { label: 'Problema',     color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  cancelled:   { label: 'Cancelado',    color: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Overview() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem('entrepreneur_theme') !== 'light'
  )
  useEffect(() => {
    const h = () => setIsDarkMode(localStorage.getItem('entrepreneur_theme') !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  const [stats, setStats] = useState<Stats>({
    totalDeliveries: 0, pendingDeliveries: 0,
    completedDeliveries: 0, problemDeliveries: 0, totalValue: 0,
  })
  const [metrics, setMetrics] = useState<ComputedMetrics>({
    successRate: 0, avgDeliveryTimeHours: null, activeDeliverers: 0,
  })
  const [recentDeliveries, setRecentDeliveries] = useState<RecentDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ─── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoading(true); setError(null)

      const { data: deliveries, error: dErr } = await supabase
        .from('deliveries')
        .select('id, item_type, destination_address, current_status, estimated_value, created_at, updated_at')
        .eq('entrepreneur_id', user.id)
        .order('created_at', { ascending: false })
      if (dErr) throw dErr

      const all        = deliveries || []
      const completed  = all.filter(d => d.current_status === 'completed')
      const pending    = all.filter(d => ['created', 'accepted', 'in_progress'].includes(d.current_status))
      const problems   = all.filter(d => d.current_status === 'problem')
      const totalValue = all.reduce((s, d) => s + (d.estimated_value || 0), 0)

      setStats({ totalDeliveries: all.length, pendingDeliveries: pending.length,
        completedDeliveries: completed.length, problemDeliveries: problems.length, totalValue })

      const successRate = all.length > 0 ? Math.round((completed.length / all.length) * 100) : 0

      let avgDeliveryTimeHours: number | null = null
      if (completed.length > 0) {
        const durations = completed.map(d => {
          const s = new Date(d.created_at).getTime()
          const e = new Date(d.updated_at).getTime()
          return (e - s) / (1000 * 60 * 60)
        }).filter(h => h > 0)
        if (durations.length > 0)
          avgDeliveryTimeHours = durations.reduce((a, b) => a + b, 0) / durations.length
      }

      const { data: activeDels } = await supabase
        .from('deliveries').select('deliverer_id')
        .in('current_status', ['accepted', 'in_progress'])
        .not('deliverer_id', 'is', null)
      const activeDeliverers = new Set((activeDels || []).map((d: any) => d.deliverer_id)).size

      setMetrics({ successRate, avgDeliveryTimeHours, activeDeliverers })
      setRecentDeliveries(all.slice(0, 5))
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados')
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!user?.id) return
    const ch = supabase.channel('overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries',
        filter: `entrepreneur_id=eq.${user.id}` }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, loadData])

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  const formatAvgTime = (h: number | null) => {
    if (!h) return '—'
    if (h < 1)  return `${Math.round(h * 60)}min`
    if (h < 24) return `${h.toFixed(1)}h`
    return `${(h / 24).toFixed(1)}d`
  }

  const getStatus = (s: string) =>
    STATUS_CONFIG[s] ?? { label: s, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })

  // ─── Loading / Error ───────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className={`mx-auto animate-spin mb-4 ${dk('text-emerald-400','text-emerald-600')}`} size={40}/>
        <p className={`text-sm ${dk('text-gray-400','text-gray-600')}`}>A carregar visão geral...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className={`rounded-2xl border p-8 text-center ${dk('bg-[#121212] border-red-500/20','bg-white border-red-200')}`}>
      <AlertTriangle className={`mx-auto mb-4 ${dk('text-red-400','text-red-600')}`} size={40}/>
      <p className={`font-bold mb-2 ${dk('text-white','text-gray-900')}`}>Erro ao carregar</p>
      <p className={`text-sm mb-4 ${dk('text-gray-400','text-gray-600')}`}>{error}</p>
      <button onClick={loadData}
        className={`flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl font-medium text-sm ${dk('bg-emerald-500 text-black','bg-emerald-600 text-white')}`}>
        <RefreshCw size={16}/> Tentar novamente
      </button>
    </div>
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={`text-xl sm:text-2xl font-bold ${dk('text-white','text-gray-900')}`}>Visão Geral</h2>
          <p className={`text-xs sm:text-sm mt-1 flex items-center gap-1.5 ${dk('text-gray-500','text-gray-600')}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/>
            Atualizado em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData}
            className={`p-2 sm:p-2.5 rounded-xl ${dk('bg-white/5 hover:bg-white/10 text-gray-400','bg-gray-100 hover:bg-gray-200 text-gray-600')}`}>
            <RefreshCw size={15}/>
          </button>
          <button onClick={() => navigate('/entrepreneur/new-delivery')}
            className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap ${dk('bg-emerald-500 text-black hover:bg-emerald-400','bg-emerald-600 text-white hover:bg-emerald-700')}`}>
            <PlusCircle size={14}/>
            <span>Nova Entrega</span>
          </button>
        </div>
      </div>

      {/* Stats Cards — 2 colunas mobile, 4 desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total',        value: stats.totalDeliveries,     icon: Package,      border: dk('border-emerald-500/20','border-emerald-200'), iconColor: dk('text-emerald-400','text-emerald-600'), iconBg: dk('bg-emerald-500/10','bg-emerald-100'), labelColor: dk('text-emerald-400','text-emerald-600') },
          { label: 'Concluídas',   value: stats.completedDeliveries, icon: CheckCircle,  border: dk('border-green-500/20','border-green-200'),     iconColor: dk('text-green-400','text-green-600'),     iconBg: dk('bg-green-500/10','bg-green-100'),     labelColor: dk('text-green-400','text-green-600') },
          { label: 'Em Andamento', value: stats.pendingDeliveries,   icon: Clock,        border: dk('border-yellow-500/20','border-yellow-200'),   iconColor: dk('text-yellow-400','text-yellow-600'),   iconBg: dk('bg-yellow-500/10','bg-yellow-100'),   labelColor: dk('text-yellow-400','text-yellow-600') },
          { label: 'Problemas',    value: stats.problemDeliveries,   icon: AlertTriangle,border: dk('border-red-500/20','border-red-200'),         iconColor: dk('text-red-400','text-red-600'),         iconBg: dk('bg-red-500/10','bg-red-100'),         labelColor: dk('text-red-400','text-red-600') },
        ].map(({ label, value, icon: Icon, border, iconColor, iconBg, labelColor }) => (
          <div key={label}
            className={`p-4 sm:p-5 rounded-2xl border transition-all hover:scale-[1.02] ${dk('bg-[#121212]','bg-white shadow-sm')} ${border}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-[10px] sm:text-xs font-medium truncate ${labelColor}`}>{label}</p>
                <p className={`text-2xl sm:text-3xl font-bold mt-1.5 sm:mt-2 ${dk('text-white','text-gray-900')}`}>{value}</p>
              </div>
              <div className={`p-2 sm:p-3 rounded-xl flex-shrink-0 ${iconBg}`}>
                <Icon className={iconColor} size={18}/>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Valor Total */}
      <div className={`p-5 sm:p-6 rounded-2xl border ${dk('bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20','bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 shadow-sm')}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-sm font-medium ${dk('text-purple-400','text-purple-600')}`}>Valor Total das Entregas</p>
            <p className={`text-2xl sm:text-4xl font-bold mt-2 ${dk('text-white','text-gray-900')}`}>
              {fmtMZN(stats.totalValue)}
            </p>
            <p className={`text-xs sm:text-sm mt-1.5 sm:mt-2 ${dk('text-gray-500','text-gray-600')}`}>
              Valor agregado de todas as suas entregas
            </p>
          </div>
          <div className={`p-3 sm:p-4 rounded-xl flex-shrink-0 ${dk('bg-gradient-to-r from-purple-500/20 to-pink-500/20','bg-gradient-to-r from-purple-100 to-pink-100')}`}>
            <DollarSign className={dk('text-purple-400','text-purple-600')} size={28}/>
          </div>
        </div>
      </div>

      {/* Métricas — 1 coluna mobile, 3 desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">

        <div className={`p-4 sm:p-5 rounded-2xl border ${dk('bg-[#121212] border-white/5','bg-white border-gray-200 shadow-sm')}`}>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className={`text-xs sm:text-sm font-medium ${dk('text-gray-400','text-gray-600')}`}>Taxa de Sucesso</p>
              <TrendingUp className={dk('text-emerald-400','text-emerald-600')} size={15}/>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex-1 h-2 rounded-full overflow-hidden ${dk('bg-gray-800','bg-gray-200')}`}>
                <div className={`h-full rounded-full transition-all duration-700 ${
                  metrics.successRate >= 80 ? 'bg-emerald-500'
                  : metrics.successRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`} style={{ width: `${metrics.successRate}%` }}/>
              </div>
              <span className={`text-sm font-bold ${dk('text-white','text-gray-900')}`}>{metrics.successRate}%</span>
            </div>
            <p className={`text-xs ${dk('text-gray-600','text-gray-400')}`}>
              {stats.completedDeliveries} de {stats.totalDeliveries} entrega{stats.totalDeliveries !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className={`p-4 sm:p-5 rounded-2xl border ${dk('bg-[#121212] border-white/5','bg-white border-gray-200 shadow-sm')}`}>
          <div className="space-y-1.5">
            <p className={`text-xs sm:text-sm font-medium ${dk('text-gray-400','text-gray-600')}`}>Tempo Médio</p>
            <p className={`text-xl sm:text-2xl font-bold ${dk('text-white','text-gray-900')}`}>
              {formatAvgTime(metrics.avgDeliveryTimeHours)}
            </p>
            <p className={`text-xs ${dk('text-gray-500','text-gray-600')}`}>
              {metrics.avgDeliveryTimeHours !== null
                ? `Com base em ${stats.completedDeliveries} entrega${stats.completedDeliveries !== 1 ? 's' : ''}`
                : 'Sem dados ainda'}
            </p>
          </div>
        </div>

        <div className={`p-4 sm:p-5 rounded-2xl border ${dk('bg-[#121212] border-white/5','bg-white border-gray-200 shadow-sm')}`}>
          <div className="space-y-1.5">
            <p className={`text-xs sm:text-sm font-medium ${dk('text-gray-400','text-gray-600')}`}>Entregadores Ativos</p>
            <div className="flex items-end gap-2">
              <p className={`text-xl sm:text-2xl font-bold ${dk('text-white','text-gray-900')}`}>{metrics.activeDeliverers}</p>
              {metrics.activeDeliverers > 0 && (
                <span className="mb-0.5 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">em rota</span>
              )}
            </div>
            <p className={`text-xs ${dk('text-gray-500','text-gray-600')}`}>
              {metrics.activeDeliverers === 0 ? 'Nenhum em rota agora' : `${metrics.activeDeliverers} em andamento`}
            </p>
          </div>
        </div>
      </div>

      {/* Entregas Recentes */}
      <div className={`rounded-2xl border overflow-hidden ${dk('bg-[#121212] border-white/5','bg-white border-gray-200 shadow-sm')}`}>
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${dk('border-white/5','border-gray-200')}`}>
          <h3 className={`font-bold text-base sm:text-lg ${dk('text-white','text-gray-900')}`}>Entregas Recentes</h3>
          <button onClick={() => navigate('/entrepreneur/active-deliveries')}
            className={`text-xs sm:text-sm flex items-center gap-1 ${dk('text-emerald-400 hover:text-emerald-300','text-emerald-600 hover:text-emerald-700')}`}>
            Ver todas <ChevronRight size={13}/>
          </button>
        </div>

        {recentDeliveries.length === 0 ? (
          <div className="p-10 sm:p-12 text-center">
            <Package className={`mx-auto mb-4 ${dk('text-gray-600','text-gray-300')}`} size={40}/>
            <p className={`font-medium mb-4 ${dk('text-gray-400','text-gray-600')}`}>Nenhuma entrega ainda</p>
            <button onClick={() => navigate('/entrepreneur/new-delivery')}
              className={`px-6 py-2.5 rounded-xl font-medium text-sm ${dk('bg-emerald-500 text-black','bg-emerald-600 text-white')}`}>
              Criar primeira entrega
            </button>
          </div>
        ) : (
          <div className={`divide-y ${dk('divide-white/5','divide-gray-100')}`}>
            {recentDeliveries.map(d => {
              const s = getStatus(d.current_status)
              return (
                <div key={d.id}
                  onClick={() => navigate(`/entrepreneur/delivery/${d.id}`)}
                  className={`p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${dk('hover:bg-white/5','hover:bg-gray-50')}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 sm:p-2.5 rounded-xl flex-shrink-0 ${dk('bg-emerald-500/10','bg-emerald-100')}`}>
                      <Truck className={dk('text-emerald-400','text-emerald-600')} size={16}/>
                    </div>
                    <div className="min-w-0">
                      <p className={`font-bold text-sm truncate ${dk('text-white','text-gray-900')}`}>{d.item_type}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={10} className={dk('text-gray-500','text-gray-400')}/>
                        <p className={`text-xs truncate ${dk('text-gray-500','text-gray-500')}`}>{d.destination_address}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
                        <span className={`text-[10px] sm:text-xs ${dk('text-gray-600','text-gray-400')}`}>{formatDate(d.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <p className={`text-sm font-bold ${dk('text-emerald-400','text-emerald-600')}`}>{fmtMZN(d.estimated_value)}</p>
                    <ChevronRight className={dk('text-gray-600','text-gray-400')} size={14}/>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}