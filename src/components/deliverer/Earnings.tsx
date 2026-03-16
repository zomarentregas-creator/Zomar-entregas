// src/components/deliverer/Earnings.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DollarSign, TrendingUp, Package, Calendar,
  ChevronDown, RefreshCw, Loader2, CheckCircle,
  ChevronLeft, ChevronRight, BarChart3,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EarningEntry {
  id:              string
  item_type:       string
  origin_address:  string
  destination_address: string
  estimated_value: number
  completed_at:    string
  created_at:      string
}

interface PeriodStats {
  total:     number
  count:     number
  avg:       number
  best:      number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const calcFee = (v: number) => Math.round(v * 0.8 * 100) / 100

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' })

const fmtShort = (s: string) =>
  new Date(s).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })

// ─── Component ────────────────────────────────────────────────────────────────

export default function Earnings() {
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

  const [period,   setPeriod]   = useState<'week' | 'month' | 'year'>('month')
  const [entries,  setEntries]  = useState<EarningEntry[]>([])
  const [stats,    setStats]    = useState<PeriodStats | null>(null)
  const [allTime,  setAllTime]  = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [page,     setPage]     = useState(0)

  const PAGE_SIZE = 10

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  // ── Calcular início do período ──────────────────────────────────────────────
  const getPeriodStart = (p: 'week' | 'month' | 'year') => {
    const d = new Date()
    if (p === 'week')  d.setDate(d.getDate() - 7)
    if (p === 'month') d.setMonth(d.getMonth() - 1)
    if (p === 'year')  d.setFullYear(d.getFullYear() - 1)
    return d.toISOString()
  }

  // ── Carregar ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const since = getPeriodStart(period)

      const [{ data: periodData }, { data: allData }] = await Promise.all([
        supabase.from('deliveries')
          .select('id, item_type, origin_address, destination_address, estimated_value, completed_at, created_at')
          .eq('deliverer_id', user.id)
          .eq('current_status', 'completed')
          .gte('completed_at', since)
          .order('completed_at', { ascending: false }),
        supabase.from('deliveries')
          .select('estimated_value')
          .eq('deliverer_id', user.id)
          .eq('current_status', 'completed'),
      ])

      const list = periodData || []
      const fees = list.map(d => calcFee(d.estimated_value || 0))
      const total = fees.reduce((a, b) => a + b, 0)

      setEntries(list)
      setStats({
        total,
        count: list.length,
        avg:   list.length > 0 ? total / list.length : 0,
        best:  fees.length > 0 ? Math.max(...fees) : 0,
      })
      setAllTime((allData || []).reduce((s, d) => s + calcFee(d.estimated_value || 0), 0))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [user?.id, period])

  useEffect(() => { load(); setPage(0) }, [load])

  // ── Gráfico de barras por dia (últimos N dias) ─────────────────────────────
  const chartData = (() => {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 12
    const unit = period === 'year' ? 'month' : 'day'
    const buckets: Record<string, number> = {}

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      if (unit === 'day')   { d.setDate(d.getDate() - i);       buckets[d.toISOString().slice(0, 10)] = 0 }
      if (unit === 'month') { d.setMonth(d.getMonth() - i);     buckets[d.toISOString().slice(0, 7)]  = 0 }
    }

    entries.forEach(e => {
      const key = unit === 'day'
        ? new Date(e.completed_at).toISOString().slice(0, 10)
        : new Date(e.completed_at).toISOString().slice(0, 7)
      if (key in buckets) buckets[key] += calcFee(e.estimated_value || 0)
    })

    const vals = Object.values(buckets)
    const maxVal = Math.max(...vals, 1)
    return Object.entries(buckets).map(([key, val]) => ({
      label: unit === 'day'
        ? new Date(key).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })
        : new Date(key + '-01').toLocaleDateString('pt-MZ', { month: 'short' }),
      val,
      pct: (val / maxVal) * 100,
    }))
  })()

  // ── Paginação ──────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(entries.length / PAGE_SIZE)
  const paginatedEntries = entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  // ── Classes ────────────────────────────────────────────────────────────────
  const card = `rounded-2xl border ${dk('bg-[#1a1a1a] border-white/8', 'bg-white border-gray-200 shadow-sm')}`

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
          <h2 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>Os Meus Ganhos</h2>
          <p className={`text-sm mt-0.5 ${dk('text-gray-500', 'text-gray-400')}`}>
            Total acumulado: <span className={`font-bold ${dk('text-emerald-400', 'text-emerald-600')}`}>{fmtMZN(allTime)}</span>
          </p>
        </div>
        <button onClick={load}
          className={`p-2.5 rounded-xl ${dk('bg-white/5 hover:bg-white/10 text-gray-400', 'bg-gray-100 hover:bg-gray-200 text-gray-500')}`}>
          <RefreshCw size={16}/>
        </button>
      </div>

      {/* Seletor de período */}
      <div className={`${card} p-1.5 flex gap-1`}>
        {(['week', 'month', 'year'] as const).map(p => (
          <button key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              period === p
                ? dk('bg-emerald-500 text-black', 'bg-emerald-600 text-white')
                : dk('text-gray-400 hover:bg-white/5', 'text-gray-500 hover:bg-gray-50')
            }`}>
            {p === 'week' ? '7 dias' : p === 'month' ? '30 dias' : '12 meses'}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Ganhos',    value: fmtMZN(stats.total),  icon: DollarSign,  color: dk('text-emerald-400', 'text-emerald-600'), bg: dk('bg-emerald-500/10', 'bg-emerald-50') },
            { label: 'Entregas',  value: stats.count.toString(), icon: Package,    color: dk('text-blue-400',    'text-blue-600'),    bg: dk('bg-blue-500/10',    'bg-blue-50')    },
            { label: 'Média',     value: fmtMZN(stats.avg),    icon: TrendingUp,  color: dk('text-purple-400',  'text-purple-600'),  bg: dk('bg-purple-500/10',  'bg-purple-50')  },
            { label: 'Melhor',    value: fmtMZN(stats.best),   icon: BarChart3,   color: dk('text-yellow-400',  'text-yellow-600'),  bg: dk('bg-yellow-500/10',  'bg-yellow-50')  },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className={`${card} p-4`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${k.bg}`}>
                  <Icon size={16} className={k.color}/>
                </div>
                <p className={`text-lg font-black ${k.color}`}>{k.value}</p>
                <p className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>{k.label}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Gráfico de barras */}
      {chartData.length > 0 && stats && stats.total > 0 && (
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-bold text-sm ${dk('text-white', 'text-gray-900')}`}>Evolução</h3>
            <span className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>{fmtMZN(stats.total)}</span>
          </div>
          <div className="flex items-end gap-1 h-24">
            {chartData.map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full relative flex items-end justify-center" style={{ height: '80px' }}>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${bar.val > 0 ? dk('bg-emerald-500/60 group-hover:bg-emerald-500', 'bg-emerald-400 group-hover:bg-emerald-500') : dk('bg-white/5', 'bg-gray-100')}`}
                    style={{ height: `${Math.max(bar.pct, bar.val > 0 ? 4 : 2)}%` }}
                    title={`${bar.label}: ${fmtMZN(bar.val)}`}
                  />
                </div>
                {chartData.length <= 12 && (
                  <span className={`text-[9px] ${dk('text-gray-600', 'text-gray-400')}`}>{bar.label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico de entregas */}
      <div className={`${card} overflow-hidden`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${dk('border-white/5', 'border-gray-100')}`}>
          <h3 className={`font-bold text-sm ${dk('text-white', 'text-gray-900')}`}>
            Histórico do Período
            <span className={`ml-2 text-xs font-normal ${dk('text-gray-500', 'text-gray-400')}`}>
              {entries.length} entrega{entries.length !== 1 ? 's' : ''}
            </span>
          </h3>
        </div>

        {entries.length === 0 ? (
          <div className="py-12 text-center">
            <Package size={28} className={`mx-auto mb-2 ${dk('text-gray-600', 'text-gray-300')}`}/>
            <p className={`text-sm ${dk('text-gray-400', 'text-gray-500')}`}>Sem entregas neste período</p>
          </div>
        ) : (
          <>
            <div className={`divide-y ${dk('divide-white/4', 'divide-gray-50')}`}>
              {paginatedEntries.map((e, i) => {
                const fee = calcFee(e.estimated_value)
                return (
                  <div key={e.id}
                    style={{ animationDelay: `${i * 15}ms` }}
                    className={`px-5 py-4 flex items-center gap-4 ${dk('hover:bg-white/2', 'hover:bg-gray-50/70')}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${dk('bg-emerald-500/15', 'bg-emerald-50')}`}>
                      <CheckCircle size={16} className="text-emerald-400"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${dk('text-white', 'text-gray-900')}`}>{e.item_type}</p>
                      <p className={`text-xs mt-0.5 truncate ${dk('text-gray-500', 'text-gray-400')}`}>
                        → {e.destination_address}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${dk('text-emerald-400', 'text-emerald-600')}`}>{fmtMZN(fee)}</p>
                      <p className={`text-[10px] mt-0.5 ${dk('text-gray-500', 'text-gray-400')}`}>
                        {fmtShort(e.completed_at || e.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className={`flex items-center justify-between px-5 py-3 border-t ${dk('border-white/5', 'border-gray-100')}`}>
                <span className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, entries.length)} de {entries.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className={`p-1.5 rounded-lg disabled:opacity-40 ${dk('hover:bg-white/5 text-gray-400', 'hover:bg-gray-100 text-gray-600')}`}>
                    <ChevronLeft size={14}/>
                  </button>
                  <span className={`text-xs px-2 ${dk('text-gray-400', 'text-gray-600')}`}>{page + 1}/{totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className={`p-1.5 rounded-lg disabled:opacity-40 ${dk('hover:bg-white/5 text-gray-400', 'hover:bg-gray-100 text-gray-600')}`}>
                    <ChevronRight size={14}/>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}