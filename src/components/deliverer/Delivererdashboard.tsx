// src/components/deliverer/Delivererdashboard.tsx
// @version 5.0 — mobile-first, alinhado com o novo início do cliente
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Phone, MapPin, Wallet, Clock, HelpCircle, Bell, Menu,
  Package, CheckCircle, Truck, ChevronRight, Shield, Activity, Loader2,
  KeyRound, Navigation,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Stats {
  totalDeliveries: number
  activeDeliveries: number
  completedDeliveries: number
  totalEarnings: number
  todayEarnings: number
  completionRate: number
  avgDeliveryTimeHours: number | null
}

interface ActiveDelivery {
  id: string
  entrepreneur_id: string
  item_type: string
  origin_address: string
  destination_address: string
  current_status: string
  estimated_value: number
  created_at: string
  entrepreneur_name?: string
  entrepreneur_phone?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** step = segmentos preenchidos (de 4) */
const STEPS: Record<string, { label: string; hint: string; step: number }> = {
  accepted:    { label: 'A recolher', hint: 'Vai ao local de recolha',  step: 1 },
  in_progress: { label: 'Em curso',   hint: 'Entrega em andamento',     step: 2 },
  picked_up:   { label: 'A entregar', hint: 'A caminho do destino',     step: 3 },
}

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

const calcFee = (v: number) => Math.round(v * 0.8 * 100) / 100

const formatTime = (h: number | null) => {
  if (!h) return '—'
  if (h < 1) return `${Math.round(h * 60)}min`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DelivererDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('deliverer_theme') !== 'light')
  useEffect(() => {
    const h = () => setIsDarkMode(localStorage.getItem('deliverer_theme') !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])
  const dk = (d: string, l: string) => (isDarkMode ? d : l)

  const [stats, setStats] = useState<Stats | null>(null)
  const [active, setActive] = useState<ActiveDelivery[]>([])
  const [profile, setProfile] = useState<{ trust_score: number; phone_verified: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState(0)

  // ── Carregar dados ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0)

      const [{ data: allDels }, { data: profileData }, { count: unreadCount }] = await Promise.all([
        supabase.from('deliveries')
          .select('id, entrepreneur_id, item_type, origin_address, destination_address, current_status, estimated_value, created_at, updated_at, completed_at')
          .eq('deliverer_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('trust_score, phone_verified').eq('user_id', user.id).single(),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
      ])

      const all = allDels || []
      const completed = all.filter(d => d.current_status === 'completed')
      const act = all.filter(d => ['accepted', 'in_progress', 'picked_up'].includes(d.current_status))
      const todayCompleted = completed.filter(d => d.completed_at && new Date(d.completed_at) >= today)

      const totalEarnings = completed.reduce((s, d) => s + calcFee(d.estimated_value || 0), 0)
      const todayEarnings = todayCompleted.reduce((s, d) => s + calcFee(d.estimated_value || 0), 0)

      let avgTime: number | null = null
      const durs = completed
        .filter(d => d.completed_at && d.created_at)
        .map(d => (new Date(d.completed_at!).getTime() - new Date(d.created_at).getTime()) / 3600000)
        .filter(h => h > 0 && h < 48)
      if (durs.length > 0) avgTime = durs.reduce((a, b) => a + b, 0) / durs.length

      setStats({
        totalDeliveries: all.length,
        activeDeliveries: act.length,
        completedDeliveries: completed.length,
        totalEarnings,
        todayEarnings,
        completionRate: all.length > 0 ? Math.round((completed.length / all.length) * 100) : 0,
        avgDeliveryTimeHours: avgTime,
      })

      // nome e telefone do cliente das entregas em curso
      const eIds = [...new Set(act.map(d => d.entrepreneur_id).filter(Boolean))]
      const eMap: Record<string, { name: string; phone?: string }> = {}
      if (eIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', eIds)
        profiles?.forEach(p => { eMap[p.user_id] = { name: p.full_name || '', phone: p.phone || undefined } })
      }

      setActive(act.map(d => ({
        ...d,
        entrepreneur_name: eMap[d.entrepreneur_id]?.name,
        entrepreneur_phone: eMap[d.entrepreneur_id]?.phone,
      })))
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `deliverer_id=eq.${user.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, load])

  // ── Derivados ──────────────────────────────────────────────────────────────
  const firstName = (user?.full_name || '').trim().split(' ')[0] || 'Estafeta'
  const current = active[0] ?? null
  const stepInfo = current ? (STEPS[current.current_status] ?? STEPS.accepted) : null
  // antes da recolha o destino do mapa é a origem; depois, o destino final
  const mapTarget = current
    ? (current.current_status === 'accepted' ? current.origin_address : current.destination_address)
    : ''
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapTarget)}`

  const card = `rounded-2xl border ${dk('bg-[#111a1f] border-white/[0.07]', 'bg-white border-gray-200 shadow-sm')}`
  const subtle = dk('text-gray-400', 'text-gray-500')
  const strong = dk('text-white', 'text-gray-900')
  const roundBtn = `relative w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${dk('bg-[#111a1f] border-white/10 text-gray-300 hover:bg-white/10', 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}`
  const trustColor = (n: number) => (n >= 7 ? 'text-emerald-500' : n >= 4 ? 'text-yellow-500' : 'text-red-400')

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className={`animate-spin ${dk('text-emerald-400', 'text-emerald-600')}`} size={36} />
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-5xl lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6 lg:items-start">

      {/* ═════════ Coluna principal ═════════ */}
      <div className="space-y-4 min-w-0">

        {/* Topo */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <p className={`text-sm pt-2 truncate ${subtle}`}>Olá, {firstName}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigate('/deliverer/notifications')} aria-label="Notificações" className={roundBtn}>
              <Bell size={17} />
              {unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-500" />}
            </button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('zomar:open-menu'))} aria-label="Menu"
              className={`${roundBtn} lg:hidden`}>
              <Menu size={17} />
            </button>
            <button onClick={() => navigate('/deliverer/earnings')}
              className={`h-10 pl-3 pr-4 rounded-full border flex items-center gap-1.5 text-sm font-bold transition-colors ${dk('bg-[#111a1f] border-white/10 text-white hover:bg-white/10', 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50')}`}>
              <Wallet size={15} className="text-emerald-500" />
              <span className="whitespace-nowrap">{fmtMZN(stats?.todayEarnings ?? 0)}</span>
            </button>
          </div>
        </div>

        <h1 className={`text-[1.75rem] sm:text-4xl font-extrabold leading-[1.15] tracking-tight max-w-md ${strong}`}>
          Pronto para fazer entregas?
        </h1>

        {/* CTA */}
        <button onClick={() => navigate('/deliverer/available-deliveries')}
          className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black font-bold text-base flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] transition-all">
          Ver entregas disponíveis <ArrowRight size={18} />
        </button>

        {/* Aviso telefone */}
        {profile && !profile.phone_verified && (
          <button onClick={() => navigate('/deliverer/profile')}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left ${dk('bg-orange-500/10 border-orange-500/20', 'bg-orange-50 border-orange-200')}`}>
            <Shield size={16} className="text-orange-400 flex-shrink-0" />
            <p className={`flex-1 text-sm ${dk('text-orange-300', 'text-orange-700')}`}>Verifica o teu telefone para maior segurança</p>
            <ChevronRight size={14} className="text-orange-400 flex-shrink-0" />
          </button>
        )}

        {/* Entrega em curso */}
        {current && stepInfo ? (
          <section className={`${card} p-4 sm:p-5 space-y-4`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className={`text-sm ${subtle}`}>
                Entrega em curso{active.length > 1 && <span className="ml-1.5 text-emerald-500 font-semibold">+{active.length - 1}</span>}
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
                {stepInfo.label}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={stepInfo.step}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 rounded-full transition-colors duration-500 ${i <= stepInfo.step ? 'bg-emerald-500' : dk('bg-white/10', 'bg-gray-200')}`} />
              ))}
            </div>

            {/* Cliente */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold ${dk('bg-white/10 text-gray-200', 'bg-gray-100 text-gray-700')}`}>
                {current.entrepreneur_name ? current.entrepreneur_name.charAt(0).toUpperCase() : <Package size={18} className={subtle} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-bold truncate ${strong}`}>{current.entrepreneur_name || 'Cliente'}</p>
                <p className={`text-sm truncate ${subtle}`}>{current.item_type} · {stepInfo.hint}</p>
              </div>
              <p className="text-sm font-bold text-emerald-500 flex-shrink-0">{fmtMZN(calcFee(current.estimated_value || 0))}</p>
            </div>

            {/* Trajecto */}
            <div className={`rounded-xl p-3 space-y-2.5 ${dk('bg-black/30', 'bg-gray-50')}`}>
              {[
                { label: 'Recolha', addr: current.origin_address, dot: 'bg-yellow-400' },
                { label: 'Destino', addr: current.destination_address, dot: 'bg-emerald-500' },
              ].map(r => (
                <div key={r.label} className="flex items-start gap-3 min-w-0">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${r.dot}`} />
                  <div className="min-w-0">
                    <p className={`text-[11px] uppercase tracking-wide ${subtle}`}>{r.label}</p>
                    <p className={`text-sm break-words ${strong}`}>{r.addr}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Ações */}
            <div className="grid grid-cols-2 gap-3">
              {current.entrepreneur_phone ? (
                <a href={`tel:${current.entrepreneur_phone}`}
                  className={`h-12 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${dk('border-white/15 text-white hover:bg-white/5', 'border-gray-300 text-gray-800 hover:bg-gray-50')}`}>
                  <Phone size={16} /> Ligar
                </a>
              ) : (
                <button disabled className={`h-12 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold opacity-40 cursor-not-allowed ${dk('border-white/15 text-white', 'border-gray-300 text-gray-800')}`}>
                  <Phone size={16} /> Ligar
                </button>
              )}
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className={`h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${dk('bg-white/[0.07] text-white hover:bg-white/10', 'bg-gray-100 text-gray-800 hover:bg-gray-200')}`}>
                <Navigation size={16} /> Navegar
              </a>
            </div>

            {/* Confirmar entrega */}
            <div className={`pt-4 border-t space-y-3 ${dk('border-white/[0.07]', 'border-gray-200')}`}>
              <button onClick={() => navigate('/deliverer/my-deliveries')}
                className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors ${dk('bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25', 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100')}`}>
                <KeyRound size={16} /> Gerir entrega e inserir código
              </button>
              <p className={`text-xs ${subtle}`}>Pede o código de entrega ao cliente quando entregares.</p>
            </div>
          </section>
        ) : (
          <section className={`${card} p-6 text-center`}>
            <div className={`mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center ${dk('bg-white/5', 'bg-gray-100')}`}>
              <Truck size={22} className={subtle} />
            </div>
            <p className={`font-bold ${strong}`}>Sem entregas em curso</p>
            <p className={`text-sm mt-1 ${subtle}`}>Aceita uma entrega disponível para começar.</p>
          </section>
        )}
      </div>

      {/* ═════════ Coluna lateral ═════════ */}
      <div className="space-y-4 mt-4 lg:mt-0 min-w-0">

        {/* Atalhos */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Ganhos',    icon: Wallet,     to: '/deliverer/earnings' },
            { label: 'Histórico', icon: Clock,      to: '/deliverer/history' },
            { label: 'Ajuda',     icon: HelpCircle, to: '/deliverer/help' },
          ].map(({ label, icon: Icon, to }) => (
            <button key={label} onClick={() => navigate(to)}
              className={`${card} h-20 sm:h-24 flex flex-col items-center justify-center gap-2 text-sm font-semibold transition-colors ${dk('text-white hover:bg-white/5', 'text-gray-800 hover:bg-gray-50')}`}>
              <Icon size={20} className="text-emerald-500" />
              {label}
            </button>
          ))}
        </div>

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Ganhos totais',     value: fmtMZN(stats.totalEarnings), sub: `Hoje: ${fmtMZN(stats.todayEarnings)}`, icon: Wallet,      tone: 'text-emerald-500' },
              { label: 'Em curso',          value: String(stats.activeDeliveries), sub: stats.activeDeliveries ? 'Agora' : 'Nenhuma', icon: Truck,       tone: 'text-blue-400' },
              { label: 'Taxa de conclusão', value: `${stats.completionRate}%`, sub: `${stats.completedDeliveries} de ${stats.totalDeliveries}`, icon: CheckCircle, tone: stats.completionRate >= 80 ? 'text-green-500' : 'text-yellow-500' },
              { label: 'Tempo médio',       value: formatTime(stats.avgDeliveryTimeHours), sub: 'por entrega', icon: Clock,       tone: 'text-purple-400' },
            ].map(({ label, value, sub, icon: Icon, tone }) => (
              <div key={label} className={`${card} p-4`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-xs truncate ${subtle}`}>{label}</p>
                  <Icon size={17} className={`flex-shrink-0 ${tone}`} />
                </div>
                <p className={`text-xl font-bold mt-1.5 truncate ${strong}`}>{value}</p>
                <p className={`text-[11px] mt-0.5 truncate ${subtle}`}>{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reputação */}
        {profile && (
          <section className={`${card} p-4 sm:p-5`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`font-bold text-sm ${strong}`}>A tua reputação</h2>
              <Activity size={15} className={subtle} />
            </div>
            <div className="flex items-end gap-1.5 mb-2">
              <span className={`text-3xl font-black ${trustColor(profile.trust_score)}`}>{profile.trust_score.toFixed(1)}</span>
              <span className={`text-sm mb-1 ${subtle}`}>/10</span>
            </div>
            <div className={`h-2 rounded-full overflow-hidden mb-2 ${dk('bg-white/10', 'bg-gray-100')}`}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(profile.trust_score / 10) * 100}%`,
                  background: profile.trust_score >= 7 ? '#10b981' : profile.trust_score >= 4 ? '#f59e0b' : '#ef4444',
                }} />
            </div>
            <p className={`text-xs ${subtle}`}>
              {profile.trust_score >= 7 ? 'Excelente — continua assim'
                : profile.trust_score >= 4 ? 'Moderado — melhora a taxa de conclusão'
                : 'Baixo — risco de suspensão'}
            </p>
          </section>
        )}

        {/* Mais entregas em curso */}
        {active.length > 1 && (
          <section className={`${card} overflow-hidden`}>
            <div className={`px-4 py-3 flex items-center justify-between border-b ${dk('border-white/[0.07]', 'border-gray-200')}`}>
              <h2 className={`font-bold text-sm ${strong}`}>Outras em curso</h2>
              <button onClick={() => navigate('/deliverer/my-deliveries')}
                className="text-xs font-semibold text-emerald-500 flex items-center gap-0.5">
                Ver todas <ChevronRight size={13} />
              </button>
            </div>
            <ul className={`divide-y ${dk('divide-white/[0.06]', 'divide-gray-100')}`}>
              {active.slice(1, 4).map(d => (
                <li key={d.id}>
                  <button onClick={() => navigate('/deliverer/my-deliveries')}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${dk('hover:bg-white/5', 'hover:bg-gray-50')}`}>
                    <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center ${dk('bg-emerald-500/10', 'bg-emerald-100')}`}>
                      <Package size={16} className="text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${strong}`}>{d.item_type}</p>
                      <p className={`text-xs truncate flex items-center gap-1 ${subtle}`}><MapPin size={10} />{d.destination_address}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 flex-shrink-0">
                      {(STEPS[d.current_status] ?? STEPS.accepted).label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
