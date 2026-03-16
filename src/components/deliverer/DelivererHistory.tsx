// src/components/entrepreneur/DeliveryHistory.tsx
// Também usado pelo entregador via /deliverer/history
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Package, MapPin, CheckCircle, XCircle, Clock,
  RefreshCw, Loader2, Search, ChevronDown, X,
  ChevronLeft, ChevronRight, DollarSign, Filter,
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
  completed_at:        string | null
  other_party_name?:   string   // empreendedor ou entregador conforme o papel
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed: { label: 'Concluída',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', icon: <CheckCircle size={12}/> },
  cancelled: { label: 'Cancelada',  color: 'bg-gray-500/15 text-gray-400 border-gray-500/20',          icon: <XCircle size={12}/>    },
  problem:   { label: 'Problema',   color: 'bg-red-500/15 text-red-400 border-red-500/20',             icon: <XCircle size={12}/>    },
}

const FINISHED = ['completed', 'cancelled', 'problem']

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const calcFee = (v: number) => Math.round(v * 0.8 * 100) / 100

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  deliveries?: any[]   // prop legada — ignorada (carregamos do Supabase)
}

export default function DeliveryHistory(_: Props) {
  const { user } = useAuth()
  const location  = useLocation()
  const isDeliverer = location.pathname.startsWith('/deliverer')

  const themeKey = isDeliverer ? 'deliverer_theme' : 'entrepreneur_theme'
  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem(themeKey) !== 'light'
  )
  useEffect(() => {
    const h = () => setIsDarkMode(localStorage.getItem(themeKey) !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [themeKey])

  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(0)
  const [search,     setSearch]     = useState('')
  const [statusFilter, setStatus]   = useState('all')
  const [periodFilter, setPeriod]   = useState('all')

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  const getPeriodStart = () => {
    if (periodFilter === 'all') return null
    const d = new Date()
    if (periodFilter === 'week')  d.setDate(d.getDate() - 7)
    if (periodFilter === 'month') d.setMonth(d.getMonth() - 1)
    if (periodFilter === 'year')  d.setFullYear(d.getFullYear() - 1)
    return d.toISOString()
  }

  // ── Carregar ───────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const field = isDeliverer ? 'deliverer_id' : 'entrepreneur_id'
      let q = supabase
        .from('deliveries')
        .select('id, item_type, origin_address, destination_address, current_status, estimated_value, notes, created_at, completed_at, entrepreneur_id, deliverer_id',
          { count: 'exact' })
        .eq(field, user.id)
        .in('current_status', FINISHED)

      if (statusFilter !== 'all')   q = q.eq('current_status', statusFilter)
      if (search.trim())            q = q.or(`item_type.ilike.%${search.trim()}%,destination_address.ilike.%${search.trim()}%,origin_address.ilike.%${search.trim()}%`)
      const since = getPeriodStart()
      if (since) q = q.gte('created_at', since)

      const { data, count, error } = await q
        .order('completed_at', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error

      const list = data || []

      // Enriquecer com nome da outra parte
      const otherIds = [...new Set(list.map(d => isDeliverer ? d.entrepreneur_id : d.deliverer_id).filter(Boolean))]
      let nameMap: Record<string, string> = {}
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('user_id, full_name').in('user_id', otherIds)
        if (profiles) profiles.forEach(p => { nameMap[p.user_id] = p.full_name || '' })
      }

      setDeliveries(list.map(d => ({
        ...d,
        other_party_name: isDeliverer
          ? nameMap[d.entrepreneur_id]
          : d.deliverer_id ? nameMap[d.deliverer_id] : undefined,
      })))
      setTotal(count || 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [user?.id, isDeliverer, page, search, statusFilter, periodFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, statusFilter, periodFilter])

  // ── Stats do período ──────────────────────────────────────────────────────
  const completed = deliveries.filter(d => d.current_status === 'completed')
  const totalValue = completed.reduce((s, d) => s + (isDeliverer ? calcFee(d.estimated_value) : d.estimated_value), 0)

  // ── Classes ────────────────────────────────────────────────────────────────
  const card = `rounded-2xl border ${dk('bg-[#1a1a1a] border-white/8', 'bg-white border-gray-200 shadow-sm')}`
  const selectCls = `px-3 py-2.5 rounded-xl text-sm border outline-none appearance-none cursor-pointer transition-all ${
    dk('bg-[#1a1a1a] border-white/10 text-white', 'bg-white border-gray-200 text-gray-900 shadow-sm')
  }`
  const inputCls = `w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-all ${
    dk('bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500/60', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:bg-white shadow-sm')
  }`

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>Histórico</h2>
          <p className={`text-sm mt-0.5 ${dk('text-gray-500', 'text-gray-400')}`}>
            {isDeliverer ? 'As tuas entregas concluídas' : 'As tuas entregas terminadas'}
          </p>
        </div>
        <button onClick={load}
          className={`p-2.5 rounded-xl ${dk('bg-white/5 hover:bg-white/10 text-gray-400', 'bg-gray-100 hover:bg-gray-200 text-gray-500')}`}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',      value: total.toString(),    color: dk('text-white', 'text-gray-900')         },
          { label: 'Concluídas', value: completed.length.toString(), color: dk('text-emerald-400', 'text-emerald-600') },
          { label: isDeliverer ? 'Ganhos' : 'Investido', value: fmtMZN(totalValue), color: dk('text-emerald-400', 'text-emerald-600') },
        ].map(s => (
          <div key={s.label} className={`${card} p-4 text-center`}>
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className={`text-xs mt-0.5 ${dk('text-gray-500', 'text-gray-400')}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className={`${card} p-4 space-y-3`}>
        {/* Search */}
        <div className="relative">
          <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dk('text-gray-500', 'text-gray-400')}`}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por item, origem ou destino…"
            className={inputCls}
          />
          {search && (
            <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${dk('text-gray-500', 'text-gray-400')}`}>
              <X size={13}/>
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select value={statusFilter} onChange={e => setStatus(e.target.value)} className={`${selectCls} w-full`}>
              <option value="all">Todos os estados</option>
              <option value="completed">Concluídas</option>
              <option value="cancelled">Canceladas</option>
              <option value="problem">Problema</option>
            </select>
            <ChevronDown size={13} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${dk('text-gray-500', 'text-gray-400')}`}/>
          </div>
          <div className="relative flex-1">
            <select value={periodFilter} onChange={e => setPeriod(e.target.value)} className={`${selectCls} w-full`}>
              <option value="all">Todo o tempo</option>
              <option value="week">Última semana</option>
              <option value="month">Último mês</option>
              <option value="year">Último ano</option>
            </select>
            <ChevronDown size={13} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${dk('text-gray-500', 'text-gray-400')}`}/>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className={`${card} overflow-hidden`}>
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 size={24} className={`animate-spin mx-auto ${dk('text-gray-500', 'text-gray-400')}`}/>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="py-14 text-center">
            <Package size={32} className={`mx-auto mb-3 ${dk('text-gray-600', 'text-gray-300')}`}/>
            <p className={`font-semibold ${dk('text-gray-300', 'text-gray-700')}`}>Nenhuma entrega encontrada</p>
            <p className={`text-sm mt-1 ${dk('text-gray-500', 'text-gray-400')}`}>Ajusta os filtros para ver mais resultados</p>
          </div>
        ) : (
          <div className={`divide-y ${dk('divide-white/4', 'divide-gray-50')}`}>
            {deliveries.map((d, i) => {
              const sc  = STATUS_CFG[d.current_status] || STATUS_CFG.completed
              const val = isDeliverer ? calcFee(d.estimated_value) : d.estimated_value
              return (
                <div key={d.id}
                  style={{ animationDelay: `${i * 15}ms` }}
                  className={`px-5 py-4 transition-colors ${dk('hover:bg-white/2', 'hover:bg-gray-50/70')}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold truncate ${dk('text-white', 'text-gray-900')}`}>{d.item_type}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 text-xs mb-1 ${dk('text-gray-500', 'text-gray-400')}`}>
                        <MapPin size={10}/> <span className="truncate">{d.destination_address}</span>
                      </div>
                      <div className={`flex items-center gap-3 text-[10px] ${dk('text-gray-600', 'text-gray-400')}`}>
                        <span>{fmtDate(d.completed_at || d.created_at)}</span>
                        {d.other_party_name && <span>· {d.other_party_name}</span>}
                        <span className="font-mono">#{d.id.slice(0, 6).toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${d.current_status === 'completed' ? dk('text-emerald-400', 'text-emerald-600') : dk('text-gray-500', 'text-gray-400')}`}>
                        {d.current_status === 'completed' ? fmtMZN(val) : '—'}
                      </p>
                      {isDeliverer && d.current_status === 'completed' && (
                        <p className={`text-[10px] ${dk('text-gray-600', 'text-gray-400')}`}>80% do valor</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className={`flex items-center justify-between px-5 py-3 border-t ${dk('border-white/5', 'border-gray-100')}`}>
            <span className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
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
      </div>
    </div>
  )
}