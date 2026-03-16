// src/components/deliverer/Delivererdashboard.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, CheckCircle, Clock, DollarSign,
  TrendingUp, Truck, RefreshCw, Loader2,
  PlusCircle, ChevronRight, MapPin, AlertCircle,
  Star, Shield, Bell, Activity,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalDeliveries:     number
  activeDeliveries:    number
  completedDeliveries: number
  totalEarnings:       number
  todayEarnings:       number
  completionRate:      number
  avgDeliveryTimeHours: number | null
}

interface ActiveDelivery {
  id:                  string
  entrepreneur_id:     string
  item_type:           string
  origin_address:      string
  destination_address: string
  current_status:      string
  estimated_value:     number
  created_at:          string
  entrepreneur_name?:  string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  accepted:    { label: 'Aceite',        color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  in_progress: { label: 'Em Andamento',  color: 'bg-blue-500/15 text-blue-400 border-blue-500/25'      },
  picked_up:   { label: 'Recolhido',     color: 'bg-purple-500/15 text-purple-400 border-purple-500/25'},
  completed:   { label: 'Concluída',     color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'},
  problem:     { label: 'Problema',      color: 'bg-red-500/15 text-red-400 border-red-500/25'         },
  cancelled:   { label: 'Cancelada',     color: 'bg-gray-500/15 text-gray-400 border-gray-500/25'      },
}

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

const fmtRelative = (s: string) => {
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const calcFee = (v: number) => Math.round(v * 0.8 * 100) / 100

// ─── Component ────────────────────────────────────────────────────────────────

export default function DelivererDashboard() {
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

  const [stats,    setStats]    = useState<Stats | null>(null)
  const [active,   setActive]   = useState<ActiveDelivery[]>([])
  const [profile,  setProfile]  = useState<{ trust_score: number; phone_verified: boolean } | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [unread,   setUnread]   = useState(0)

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  // ── Carregar dados ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0)

      const [
        { data: allDels },
        { data: profileData },
        { count: unreadCount },
      ] = await Promise.all([
        supabase.from('deliveries')
          .select('id, entrepreneur_id, item_type, origin_address, destination_address, current_status, estimated_value, created_at, updated_at, completed_at')
          .eq('deliverer_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('profiles')
          .select('trust_score, phone_verified')
          .eq('user_id', user.id)
          .single(),
        supabase.from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false),
      ])

      const all       = allDels || []
      const completed = all.filter(d => d.current_status === 'completed')
      const active    = all.filter(d => ['accepted','in_progress','picked_up'].includes(d.current_status))
      const todayCompleted = completed.filter(d =>
        d.completed_at && new Date(d.completed_at) >= today
      )

      const totalEarnings = completed.reduce((s, d) => s + calcFee(d.estimated_value || 0), 0)
      const todayEarnings = todayCompleted.reduce((s, d) => s + calcFee(d.estimated_value || 0), 0)

      let avgTime: number | null = null
      if (completed.length > 0) {
        const durs = completed
          .filter(d => d.completed_at && d.created_at)
          .map(d => (new Date(d.completed_at!).getTime() - new Date(d.created_at).getTime()) / 3600000)
          .filter(h => h > 0 && h < 48)
        if (durs.length > 0) avgTime = durs.reduce((a, b) => a + b, 0) / durs.length
      }

      setStats({
        totalDeliveries:      all.length,
        activeDeliveries:     active.length,
        completedDeliveries:  completed.length,
        totalEarnings,
        todayEarnings,
        completionRate:       all.length > 0 ? Math.round((completed.length / all.length) * 100) : 0,
        avgDeliveryTimeHours: avgTime,
      })

      // Enriquecer entregas activas com nome do empreendedor
      const eIds = [...new Set(active.map(d => d.entrepreneur_id).filter(Boolean))]
      let eMap: Record<string, string> = {}
      if (eIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('user_id, full_name').in('user_id', eIds)
        if (profiles) profiles.forEach(p => { eMap[p.user_id] = p.full_name || '' })
      }

      setActive(active.map(d => ({ ...d, entrepreneur_name: eMap[d.entrepreneur_id] })))
      setProfile({ trust_score: profileData?.trust_score ?? 5.0, phone_verified: profileData?.phone_verified ?? false })
      setUnread(unreadCount || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user?.id) return
    const ch = supabase.channel('dash-deliverer')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'deliveries',
        filter: `deliverer_id=eq.${user.id}`,
      }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, load])

  // ── Helpers visuais ────────────────────────────────────────────────────────
  const card = `rounded-2xl border transition-all duration-200 ${dk('bg-[#1a1a1a] border-white/8', 'bg-white border-gray-200 shadow-sm')}`

  const trustColor = (s: number) => s >= 7 ? 'text-emerald-400' : s >= 4 ? 'text-yellow-400' : 'text-red-400'

  const formatTime = (h: number | null) => {
    if (!h) return '—'
    if (h < 1) return `${Math.round(h * 60)}min`
    if (h < 24) return `${h.toFixed(1)}h`
    return `${(h / 24).toFixed(1)}d`
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className={`mx-auto animate-spin mb-4 ${dk('text-emerald-400', 'text-emerald-600')}`} size={36}/>
        <p className={`text-sm ${dk('text-gray-400', 'text-gray-500')}`}>A carregar…</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ── Cabeçalho ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>
            Olá, {user?.full_name?.split(' ')[0] || 'Entregador'} 👋
          </h2>
          <p className={`text-sm mt-1 flex items-center gap-1.5 ${dk('text-gray-500', 'text-gray-400')}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/>
            Actualizado em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/deliverer/notifications')}
            className={`relative p-2.5 rounded-xl transition-all ${dk('bg-white/5 hover:bg-white/10 text-gray-400', 'bg-gray-100 hover:bg-gray-200 text-gray-600')}`}>
            <Bell size={18}/>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button onClick={load}
            className={`p-2.5 rounded-xl transition-all ${dk('bg-white/5 hover:bg-white/10 text-gray-400', 'bg-gray-100 hover:bg-gray-200 text-gray-600')}`}>
            <RefreshCw size={18}/>
          </button>
        </div>
      </div>

      {/* ── Aviso telefone não verificado ── */}
      {profile && !profile.phone_verified && (
        <div className={`flex items-center justify-between p-4 rounded-2xl border ${dk('bg-orange-500/8 border-orange-500/20', 'bg-orange-50 border-orange-200')}`}>
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-orange-400 flex-shrink-0"/>
            <p className={`text-sm ${dk('text-orange-300', 'text-orange-700')}`}>
              Verifica o teu número de telefone para maior segurança
            </p>
          </div>
          <button onClick={() => navigate('/deliverer/profile')}
            className={`text-xs font-bold flex items-center gap-1 flex-shrink-0 ${dk('text-orange-400', 'text-orange-600')}`}>
            Verificar <ChevronRight size={12}/>
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Ganhos Totais',
              value: fmtMZN(stats.totalEarnings),
              sub:   `Hoje: ${fmtMZN(stats.todayEarnings)}`,
              icon:  DollarSign,
              color: dk('text-emerald-400', 'text-emerald-600'),
              bg:    dk('bg-emerald-500/10', 'bg-emerald-50'),
              border: dk('border-emerald-500/20', 'border-emerald-200'),
            },
            {
              label: 'Entregas Activas',
              value: stats.activeDeliveries.toString(),
              sub:   stats.activeDeliveries > 0 ? 'Em curso agora' : 'Nenhuma em curso',
              icon:  Truck,
              color: dk('text-blue-400', 'text-blue-600'),
              bg:    dk('bg-blue-500/10', 'bg-blue-50'),
              border: dk('border-blue-500/20', 'border-blue-200'),
            },
            {
              label: 'Taxa de Conclusão',
              value: `${stats.completionRate}%`,
              sub:   `${stats.completedDeliveries} de ${stats.totalDeliveries}`,
              icon:  CheckCircle,
              color: stats.completionRate >= 80 ? dk('text-emerald-400', 'text-emerald-600') : dk('text-yellow-400', 'text-yellow-600'),
              bg:    stats.completionRate >= 80 ? dk('bg-emerald-500/10', 'bg-emerald-50') : dk('bg-yellow-500/10', 'bg-yellow-50'),
              border: stats.completionRate >= 80 ? dk('border-emerald-500/20', 'border-emerald-200') : dk('border-yellow-500/20', 'border-yellow-200'),
            },
            {
              label: 'Tempo Médio',
              value: formatTime(stats.avgDeliveryTimeHours),
              sub:   'por entrega',
              icon:  Clock,
              color: dk('text-purple-400', 'text-purple-600'),
              bg:    dk('bg-purple-500/10', 'bg-purple-50'),
              border: dk('border-purple-500/20', 'border-purple-200'),
            },
          ].map((kpi, i) => {
            const Icon = kpi.icon
            return (
              <div key={kpi.label}
                style={{ animationDelay: `${i * 50}ms` }}
                className={`${card} p-5 border ${kpi.border}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${kpi.bg}`}>
                  <Icon size={18} className={kpi.color}/>
                </div>
                <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
                <p className={`text-xs font-semibold mt-0.5 ${dk('text-gray-300', 'text-gray-700')}`}>{kpi.label}</p>
                <p className={`text-[11px] mt-0.5 ${dk('text-gray-500', 'text-gray-400')}`}>{kpi.sub}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Entregas activas ── */}
        <div className={`${card} lg:col-span-2 p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`font-bold ${dk('text-white', 'text-gray-900')}`}>
              Entregas em Curso
              {active.length > 0 && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${dk('bg-blue-500/15 text-blue-400', 'bg-blue-50 text-blue-600')}`}>
                  {active.length}
                </span>
              )}
            </h3>
            <button onClick={() => navigate('/deliverer/my-deliveries')}
              className={`text-xs font-medium flex items-center gap-1 ${dk('text-emerald-400 hover:text-emerald-300', 'text-emerald-600 hover:text-emerald-700')}`}>
              Ver todas <ChevronRight size={12}/>
            </button>
          </div>

          {active.length === 0 ? (
            <div className={`py-10 text-center rounded-xl ${dk('bg-white/3', 'bg-gray-50')}`}>
              <Truck size={28} className={`mx-auto mb-2 ${dk('text-gray-600', 'text-gray-300')}`}/>
              <p className={`text-sm font-medium ${dk('text-gray-400', 'text-gray-500')}`}>Nenhuma entrega activa</p>
              <button onClick={() => navigate('/deliverer/available-deliveries')}
                className={`mt-3 flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-xs font-bold ${
                  dk('bg-emerald-500 text-black hover:bg-emerald-400', 'bg-emerald-600 text-white hover:bg-emerald-700')
                }`}>
                <PlusCircle size={13}/> Ver disponíveis
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {active.slice(0, 4).map(d => {
                const sc = STATUS_CFG[d.current_status] || STATUS_CFG.accepted
                return (
                  <div key={d.id}
                    onClick={() => navigate('/deliverer/my-deliveries')}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${dk('hover:bg-white/5 bg-white/2', 'hover:bg-gray-50 bg-gray-50/50')}`}>
                    <div className={`p-2 rounded-lg flex-shrink-0 ${dk('bg-white/5', 'bg-gray-100')}`}>
                      <Package size={14} className={dk('text-gray-300', 'text-gray-600')}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${dk('text-white', 'text-gray-900')}`}>{d.item_type}</p>
                      <div className={`flex items-center gap-1 text-xs mt-0.5 ${dk('text-gray-500', 'text-gray-400')}`}>
                        <MapPin size={10}/>
                        <span className="truncate">{d.destination_address}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${sc.color}`}>
                        {sc.label}
                      </span>
                      <span className={`text-[10px] ${dk('text-gray-500', 'text-gray-400')}`}>
                        {fmtRelative(d.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Painel lateral: perfil + atalhos ── */}
        <div className="space-y-4">

          {/* Trust score */}
          {profile && (
            <div className={`${card} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-bold text-sm ${dk('text-white', 'text-gray-900')}`}>A Tua Reputação</h3>
                <Activity size={14} className={dk('text-gray-500', 'text-gray-400')}/>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className={`text-3xl font-black ${trustColor(profile.trust_score)}`}>
                  {profile.trust_score.toFixed(1)}
                </span>
                <span className={`text-sm mb-1 ${dk('text-gray-500', 'text-gray-400')}`}>/10</span>
              </div>
              <div className={`h-2 rounded-full overflow-hidden mb-2 ${dk('bg-white/8', 'bg-gray-100')}`}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(profile.trust_score / 10) * 100}%`,
                    background: profile.trust_score >= 7 ? '#10b981' : profile.trust_score >= 4 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
              <p className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>
                {profile.trust_score >= 7 ? '✓ Excelente — continua assim' :
                 profile.trust_score >= 4 ? '⚠ Moderado — melhora a taxa de conclusão' :
                 '✗ Baixo — risco de suspensão'}
              </p>
            </div>
          )}

          {/* Atalhos rápidos */}
          <div className={`${card} p-5`}>
            <h3 className={`font-bold text-sm mb-3 ${dk('text-white', 'text-gray-900')}`}>Atalhos</h3>
            <div className="space-y-1">
              {[
                { label: 'Ver disponíveis',     path: '/deliverer/available-deliveries', icon: Truck,        color: 'text-emerald-400' },
                { label: 'As minhas entregas',  path: '/deliverer/my-deliveries',        icon: Package,      color: 'text-blue-400'    },
                { label: 'Os meus ganhos',      path: '/deliverer/earnings',             icon: DollarSign,   color: 'text-yellow-400'  },
                { label: 'Notificações',         path: '/deliverer/notifications',        icon: Bell,         color: 'text-orange-400'  },
              ].map(({ label, path, icon: Icon, color }) => (
                <button key={path}
                  onClick={() => navigate(path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${
                    dk('hover:bg-white/5 text-gray-300', 'hover:bg-gray-50 text-gray-700')
                  }`}>
                  <Icon size={15} className={color}/>
                  {label}
                  <ChevronRight size={12} className={`ml-auto ${dk('text-gray-600', 'text-gray-400')}`}/>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}