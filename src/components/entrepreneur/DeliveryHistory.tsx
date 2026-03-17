// src/components/entrepreneur/DeliveryHistory.tsx
// Também usado pelo entregador via /deliverer/history
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Package, DollarSign, TrendingUp, CheckCircle,
  User, Calendar, ChevronRight, AlertCircle,
  RefreshCw, XCircle, Search, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeliveryHistoryItem {
  id:                  string
  item_type:           string
  destination_address: string
  current_status:      string
  updated_at:          string
  created_at:          string
  deliverer_id:        string | null
  entrepreneur_id:     string
  deliverer_name:      string | null
  entrepreneur_name:   string | null
  estimated_value:     number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', {
    style: 'currency', currency: 'MZN', minimumFractionDigits: 0,
  }).format(v)

const calcFee = (v: number) => Math.round(v * 0.8 * 100) / 100

const FINISHED = ['completed', 'cancelled', 'problem']

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  completed: { label: 'Concluída', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  cancelled: { label: 'Cancelada', color: 'bg-gray-500/15 text-gray-400 border-gray-500/20'         },
  problem:   { label: 'Problema',  color: 'bg-red-500/15 text-red-400 border-red-500/20'             },
}

const PER_PAGE = 15

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  deliveries?: any[]
  isDarkMode?: boolean
}

export default function DeliveryHistory({ isDarkMode: isDarkProp }: Props) {
  const { user }  = useAuth()
  const location  = useLocation()
  const navigate  = useNavigate()

  const isDeliverer = location.pathname.startsWith('/deliverer')
  const themeKey    = isDeliverer ? 'deliverer_theme' : 'entrepreneur_theme'

  const [isDarkMode, setIsDarkMode] = useState(() =>
    isDarkProp !== undefined ? isDarkProp : localStorage.getItem(themeKey) !== 'light'
  )
  useEffect(() => {
    if (isDarkProp !== undefined) return
    const h = () => setIsDarkMode(localStorage.getItem(themeKey) !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [themeKey, isDarkProp])

  const [deliveries,   setDeliveries]   = useState<DeliveryHistoryItem[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  // ── Carregar ───────────────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!user?.id) return
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const field = isDeliverer ? 'deliverer_id' : 'entrepreneur_id'
      const { data, error: qErr } = await supabase
        .from('deliveries')
        .select('id, item_type, destination_address, current_status, updated_at, created_at, deliverer_id, entrepreneur_id, estimated_value')
        .eq(field, user.id)
        .in('current_status', FINISHED)
        .order('updated_at', { ascending: false, nullsFirst: false })
      if (qErr) throw qErr

      const list = data || []
      const otherIds = [...new Set(
        list.map(d => isDeliverer ? d.entrepreneur_id : d.deliverer_id).filter(Boolean)
      )]
      let nameMap: Record<string, string> = {}
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('user_id, full_name').in('user_id', otherIds)
        if (profiles) profiles.forEach(p => { nameMap[p.user_id] = p.full_name || '' })
      }

      setDeliveries(list.map(d => ({
        ...d,
        deliverer_name:    d.deliverer_id    ? nameMap[d.deliverer_id]    || null : null,
        entrepreneur_name: d.entrepreneur_id ? nameMap[d.entrepreneur_id] || null : null,
      })))
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar histórico.')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [user?.id, isDeliverer])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user?.id) return
    const field = isDeliverer ? 'deliverer_id' : 'entrepreneur_id'
    const ch = supabase.channel('hist-rt')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'deliveries',
        filter: `${field}=eq.${user.id}`,
      }, () => load(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, isDeliverer, load])

  // ── Filtros ────────────────────────────────────────────────────────────────
  const filtered = deliveries.filter(d => {
    if (statusFilter !== 'all' && d.current_status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return d.item_type.toLowerCase().includes(q) || d.destination_address.toLowerCase().includes(q)
    }
    return true
  })

  const totalValue       = filtered.filter(d => d.current_status === 'completed')
    .reduce((s, d) => s + (isDeliverer ? calcFee(d.estimated_value) : d.estimated_value), 0)
  const uniqueDeliverers = new Set(filtered.map(d => d.deliverer_id).filter(Boolean)).size
  const paginated        = filtered.slice(0, page * PER_PAGE)
  const hasMore          = filtered.length > page * PER_PAGE

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className={`animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 ${dk('border-emerald-500','border-emerald-600')}`}/>
    </div>
  )

  if (error) return (
    <div className={`rounded-2xl p-8 text-center border ${dk('bg-red-500/10 border-red-500/20','bg-red-50 border-red-200')}`}>
      <AlertCircle className={`mx-auto mb-3 ${dk('text-red-400','text-red-600')}`} size={36}/>
      <p className={`font-bold mb-4 ${dk('text-red-300','text-red-700')}`}>{error}</p>
      <button onClick={() => load()}
        className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-xl font-medium">
        Tentar Novamente
      </button>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-5">

      {/* Cabeçalho + Stats */}
      <div className={`rounded-2xl border p-4 sm:p-6 ${dk('bg-[#121212] border-white/5','bg-white border-gray-200 shadow-sm')}`}>
        <div className="flex items-center justify-between mb-4 sm:mb-5 flex-wrap gap-3">
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold ${dk('text-white','text-gray-900')}`}>Histórico</h2>
            <p className={`text-xs sm:text-sm mt-0.5 ${dk('text-gray-400','text-gray-500')}`}>
              {isDeliverer ? 'Todas as tuas entregas terminadas' : 'Todas as entregas finalizadas'}
            </p>
          </div>
          <button onClick={() => load(true)} disabled={refreshing}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl ${dk('text-gray-400 hover:text-white hover:bg-white/8','text-gray-600 hover:bg-gray-100')}`}>
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''}/>
            {refreshing ? 'A actualizar…' : 'Actualizar'}
          </button>
        </div>

        {/* Stats — 3 colunas em todos os tamanhos, texto compacto no mobile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { icon: CheckCircle, label: 'Concluídas', value: filtered.filter(d => d.current_status === 'completed').length,  color: 'text-emerald-400', bg: dk('bg-emerald-500/10','bg-emerald-50') },
            { icon: DollarSign,  label: isDeliverer ? 'Ganhos' : 'Investido', value: fmtMZN(totalValue), color: 'text-purple-400', bg: dk('bg-purple-500/10','bg-purple-50') },
            { icon: TrendingUp,  label: isDeliverer ? 'Empresas' : 'Entregadores', value: isDeliverer ? new Set(filtered.map(d => d.entrepreneur_id)).size : uniqueDeliverers, color: 'text-blue-400', bg: dk('bg-blue-500/10','bg-blue-50') },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={`p-3 sm:p-3.5 rounded-xl ${bg}`}>
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <Icon size={13} className={color}/>
                <p className={`text-[9px] sm:text-[11px] uppercase tracking-wider truncate ${dk('text-gray-500','text-gray-500')}`}>{label}</p>
              </div>
              <p className={`text-base sm:text-xl font-black truncate ${dk('text-white','text-gray-900')}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className={`rounded-2xl border p-3 sm:p-4 space-y-3 ${dk('bg-[#1a1a1a] border-white/8','bg-white border-gray-200 shadow-sm')}`}>
        {/* Pesquisa */}
        <div className="relative">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${dk('text-gray-500','text-gray-400')}`}/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por item ou destino…"
            className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-all ${dk('bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500/50','bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500')}`}/>
          {search && (
            <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${dk('text-gray-500','text-gray-400')}`}>
              <X size={13}/>
            </button>
          )}
        </div>
        {/* Filtros de status — scroll horizontal no mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(['all', 'completed', 'cancelled', 'problem'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                statusFilter === s
                  ? dk('bg-emerald-500 text-black','bg-emerald-600 text-white')
                  : dk('bg-white/5 text-gray-400 hover:bg-white/10','bg-gray-100 text-gray-600 hover:bg-gray-200')
              }`}>
              {s === 'all' ? 'Todas' : STATUS_CFG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className={`rounded-2xl border p-10 sm:p-12 text-center ${dk('bg-[#121212] border-white/5','bg-white border-gray-200 shadow-sm')}`}>
          <Package className={`mx-auto mb-3 ${dk('text-gray-600','text-gray-300')}`} size={36}/>
          <h3 className={`font-bold mb-1 ${dk('text-white','text-gray-900')}`}>
            {search || statusFilter !== 'all' ? 'Nenhum resultado' : 'Nenhuma entrega no histórico'}
          </h3>
          <p className={`text-sm ${dk('text-gray-400','text-gray-500')}`}>
            {search || statusFilter !== 'all'
              ? 'Ajusta os filtros para ver mais resultados'
              : 'As entregas concluídas, canceladas ou com problema aparecem aqui.'}
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${dk('bg-[#121212] border-white/5','bg-white border-gray-200 shadow-sm')}`}>
          <div className={`divide-y ${dk('divide-white/5','divide-gray-100')}`}>
            {paginated.map(d => {
              const sc = STATUS_CFG[d.current_status] || STATUS_CFG.completed
              const val = isDeliverer ? calcFee(d.estimated_value) : d.estimated_value
              const otherName = isDeliverer ? d.entrepreneur_name : d.deliverer_name

              return (
                <div key={d.id}
                  onClick={() => navigate(`/${isDeliverer ? 'deliverer' : 'entrepreneur'}/delivery/${d.id}`)}
                  className={`p-4 sm:p-5 cursor-pointer group transition-all ${dk('hover:bg-white/4','hover:bg-gray-50')}`}>
                  <div className="flex items-start justify-between gap-3">
                    {/* Ícone + info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 sm:p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${dk('bg-white/5','bg-gray-50 border border-gray-100')}`}>
                        {d.current_status === 'completed'
                          ? <CheckCircle className={dk('text-emerald-400','text-emerald-600')} size={15}/>
                          : <XCircle className={d.current_status === 'cancelled' ? dk('text-gray-400','text-gray-500') : dk('text-red-400','text-red-600')} size={15}/>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className={`font-bold text-sm truncate ${dk('text-white','text-gray-900')}`}>{d.item_type}</h4>
                          <span className={`text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full border flex-shrink-0 ${sc.color}`}>
                            {sc.label}
                          </span>
                        </div>
                        {/* Endereço — truncado no mobile */}
                        <p className={`text-xs truncate mb-1.5 ${dk('text-gray-400','text-gray-500')}`}>
                          → {d.destination_address}
                        </p>
                        {/* Meta info — stack no mobile */}
                        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] ${dk('text-gray-600','text-gray-400')}`}>
                          {otherName && (
                            <span className="flex items-center gap-1"><User size={9}/> {otherName}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar size={9}/>
                            {new Date(d.updated_at || d.created_at).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Valor + seta */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                      <div className="text-right">
                        <p className={`text-sm sm:text-base font-black ${d.current_status === 'completed' ? dk('text-emerald-400','text-emerald-600') : dk('text-gray-500','text-gray-400')}`}>
                          {d.current_status === 'completed' ? fmtMZN(val) : '—'}
                        </p>
                        {isDeliverer && d.current_status === 'completed' && (
                          <p className={`text-[9px] sm:text-[10px] ${dk('text-gray-600','text-gray-400')}`}>80%</p>
                        )}
                      </div>
                      <ChevronRight size={14} className={`transition-colors ${dk('text-gray-700 group-hover:text-emerald-400','text-gray-300 group-hover:text-emerald-600')}`}/>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div className={`p-4 sm:p-5 border-t text-center ${dk('border-white/5','border-gray-100')}`}>
              <p className={`text-xs mb-3 ${dk('text-gray-500','text-gray-400')}`}>
                A mostrar {paginated.length} de {filtered.length}
              </p>
              <button onClick={() => setPage(p => p + 1)}
                className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${dk('bg-white/8 text-gray-300 hover:bg-white/15','bg-gray-100 text-gray-700 hover:bg-gray-200')}`}>
                Carregar mais
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}