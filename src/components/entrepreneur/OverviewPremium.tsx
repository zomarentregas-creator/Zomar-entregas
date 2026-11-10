/**
 * ============================================================================
 * OVERVIEW — INÍCIO DO CLIENTE / EMPREENDEDOR  (versão animada)
 * ============================================================================
 * Mesma lógica de dados da versão anterior (entregas, estafeta, créditos,
 * tempo real e código de entrega). Muda a apresentação:
 *  - entrada em cascata e revelação ao rolar
 *  - progresso da entrega com trajecto animado
 *  - contadores, esqueleto de carregamento e luz que segue o rato
 * Animações em src/styles/zomar-motion.css (classes zm-*), hooks em src/hooks/useMotion.ts
 */

import { useEffect, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Phone, MapPin, Wallet, Clock, HelpCircle, Plus, Bell, Menu,
  Package, CheckCircle, AlertTriangle, Truck, ChevronRight, Eye, EyeOff,
  Loader2, RefreshCw,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../hooks/useNotifications'
import { useReveal, useCountUp, spotlight } from '../../hooks/useMotion'
import '../../styles/zomar-motion.css'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DeliveryRow {
  id: string
  item_type: string
  destination_address: string
  current_status: string
  estimated_value: number
  created_at: string
  deliverer_id: string | null
}

interface Courier { name: string; phone?: string }

interface Credits { remaining: number; unlimited: boolean; planName?: string }

// ─── Configuração de estados ──────────────────────────────────────────────────

const ACTIVE = ['created', 'accepted', 'in_progress', 'picked_up']

/** step = nº de segmentos preenchidos (de 4) */
const ACTIVE_STEPS: Record<string, { label: string; hint: string; step: number }> = {
  created:     { label: 'A procurar', hint: 'À procura de um estafeta',      step: 1 },
  accepted:    { label: 'Aceite',     hint: 'Estafeta a caminho da recolha', step: 2 },
  in_progress: { label: 'Em curso',   hint: 'Estafeta em andamento',         step: 3 },
  picked_up:   { label: 'A caminho',  hint: 'A caminho do destino',          step: 3 },
}

/** Posição do estafeta no trajecto (% do percurso) para cada passo */
const STEP_POSITION = [0, 8, 38, 70, 100]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed:   { label: 'Entregue',     color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  in_progress: { label: 'Em andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  picked_up:   { label: 'A caminho',    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  accepted:    { label: 'Aceite',       color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  created:     { label: 'Disponível',   color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  problem:     { label: 'Problema',     color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  cancelled:   { label: 'Cancelado',    color: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })

/** Define o atraso (ms) de uma animação via variável CSS */
const delay = (ms: number) => ({ '--zm-d': `${ms}ms` }) as CSSProperties

/** Número animado */
function CountUp({ value }: { value: number }) {
  const v = useCountUp(value)
  return <>{v}</>
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Overview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { unreadCount } = useNotifications(user?.id)

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('entrepreneur_theme') !== 'light')
  useEffect(() => {
    const h = () => setIsDarkMode(localStorage.getItem('entrepreneur_theme') !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])
  const dk = (d: string, l: string) => (isDarkMode ? d : l)

  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [courier, setCourier] = useState<Courier | null>(null)
  const [credits, setCredits] = useState<Credits | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // código de confirmação (só carregado a pedido, via RPC segura)
  const [code, setCode] = useState<string | null>(null)
  const [codeVisible, setCodeVisible] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)

  const active = deliveries.find(d => ACTIVE.includes(d.current_status)) ?? null

  // ─── Carregar dados ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      setError(null)

      const { data, error: dErr } = await supabase
        .from('deliveries')
        .select('id, item_type, destination_address, current_status, estimated_value, created_at, deliverer_id')
        .eq('entrepreneur_id', user.id)
        .order('created_at', { ascending: false })
      if (dErr) throw dErr
      const list = (data || []) as DeliveryRow[]
      setDeliveries(list)

      // estafeta da entrega em curso
      const current = list.find(d => ACTIVE.includes(d.current_status))
      if (current?.deliverer_id) {
        const { data: p } = await supabase
          .from('profiles').select('full_name, phone').eq('user_id', current.deliverer_id).maybeSingle()
        setCourier({ name: p?.full_name || 'Estafeta', phone: p?.phone || undefined })
      } else {
        setCourier(null)
      }

      // créditos (entregas restantes do plano)
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan_name, max_deliveries, current_usage')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (sub) {
        const max = sub.max_deliveries ?? 0
        setCredits({
          remaining: Math.max(0, max - (sub.current_usage ?? 0)),
          unlimited: max >= 999999,
          planName: sub.plan_name,
        })
      } else {
        setCredits(null)
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!user?.id) return
    const ch = supabase.channel('overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries', filter: `entrepreneur_id=eq.${user.id}` }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, loadData])

  // esconder código quando muda a entrega em curso
  useEffect(() => { setCode(null); setCodeVisible(false) }, [active?.id])

  const toggleCode = async () => {
    if (!active) return
    if (codeVisible) { setCodeVisible(false); return }
    if (code) { setCodeVisible(true); return }
    setCodeLoading(true)
    try {
      const { data, error: e } = await supabase.rpc('get_delivery_code', { p_delivery_id: active.id })
      if (e) throw e
      if (data?.success && data.code) { setCode(String(data.code)); setCodeVisible(true) }
    } catch { /* silencioso */ }
    finally { setCodeLoading(false) }
  }

  // ─── Derivados ──────────────────────────────────────────────────────────────

  const firstName = (user?.full_name || '').trim().split(' ')[0] || 'Cliente'
  const stats = {
    total: deliveries.length,
    done: deliveries.filter(d => d.current_status === 'completed').length,
    ongoing: deliveries.filter(d => ACTIVE.includes(d.current_status)).length,
    problems: deliveries.filter(d => d.current_status === 'problem').length,
  }
  const recent = deliveries.slice(0, 4)
  const stepInfo = active ? (ACTIVE_STEPS[active.current_status] ?? ACTIVE_STEPS.created) : null
  const codeChars = codeVisible && code ? code.split('') : Array(4).fill('–')
  const mapsUrl = active
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(active.destination_address)}`
    : '#'

  const creditsLabel = credits ? (credits.unlimited ? 'Ilimitados' : `${credits.remaining} créditos`) : 'Sem plano'

  // Posição do estafeta no trajecto: começa em 0 e desliza até ao passo actual
  const targetPos = stepInfo ? STEP_POSITION[stepInfo.step] : 0
  const [courierPos, setCourierPos] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setCourierPos(targetPos), 120)
    return () => clearTimeout(t)
  }, [targetPos])

  // Revelação ao rolar (volta a procurar quando o conteúdo aparece)
  const rootRef = useReveal<HTMLDivElement>([loading, error, active?.id])

  // ─── Classes reutilizáveis ──────────────────────────────────────────────────

  const card = `rounded-2xl border transition-[border-color,background-color,box-shadow] duration-300 ease-out ${dk('bg-gradient-to-br from-[#121c21] via-[#111a1f] to-[#0d1519] border-white/[0.07] shadow-[0_8px_30px_-18px_rgba(0,0,0,0.8)]', 'bg-white border-gray-200 shadow-sm')}`
  const subtle = dk('text-gray-400', 'text-gray-500')
  const strong = dk('text-white', 'text-gray-900')
  const circleBtn = `w-10 h-10 rounded-full border flex items-center justify-center transition-colors zm-press ${dk('bg-[#111a1f] border-white/10 text-gray-300 hover:bg-white/10', 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}`

  // ─── Estados de carregamento / erro ─────────────────────────────────────────

  if (loading) {
    const sk = `zm-skeleton ${dk('', 'is-light')}`
    return (
      <div className="mx-auto w-full max-w-5xl lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6 lg:items-start" aria-busy="true" aria-label="A carregar">
        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between pt-1">
            <div className={`${sk} h-4 w-24 rounded-lg`} />
            <div className={`${sk} h-10 w-32 rounded-full`} />
          </div>
          <div className={`${sk} h-10 w-3/4 rounded-xl`} />
          <div className={`${sk} h-14 w-full rounded-2xl`} />
          <div className={`${sk} h-64 w-full rounded-2xl`} />
        </div>
        <div className="space-y-4 mt-4 lg:mt-0 min-w-0">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => <div key={i} className={`${sk} h-20 rounded-2xl`} />)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map(i => <div key={i} className={`${sk} h-[74px] rounded-2xl`} />)}
          </div>
          <div className={`${sk} h-56 w-full rounded-2xl`} />
        </div>
      </div>
    )
  }

  if (error) return (
    <div className={`${card} zm-enter max-w-md mx-auto p-8 text-center`}>
      <AlertTriangle className="mx-auto mb-3 text-red-400" size={36} />
      <p className={`font-bold mb-1 ${strong}`}>Erro ao carregar</p>
      <p className={`text-sm mb-4 ${subtle}`}>{error}</p>
      <button onClick={loadData}
        className="zm-press zm-sheen inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-emerald-500 text-black hover:bg-emerald-400 transition-colors">
        <RefreshCw size={15} /> Tentar novamente
      </button>
    </div>
  )

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-5xl lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6 lg:items-start">

      {/* Brilho ambiente suave no topo */}
      <div className="pointer-events-none absolute inset-x-0 -top-16 flex justify-center" aria-hidden="true">
        <div className={`zm-float w-[min(560px,100%)] h-[300px] rounded-full blur-[90px] ${dk('bg-emerald-500/10', 'bg-emerald-400/15')}`} />
      </div>

      {/* ═════════ Coluna principal ═════════ */}
      <div className="relative space-y-4 min-w-0 zm-stagger">

        {/* Topo: saudação + créditos */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <p className={`text-sm pt-2 truncate ${subtle}`}>Olá, {firstName}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigate('/entrepreneur/notifications')} aria-label="Notificações"
              className={`relative ${circleBtn}`}>
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-500 zm-live" />
              )}
            </button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('zomar:open-menu'))} aria-label="Menu"
              className={`lg:hidden ${circleBtn}`}>
              <Menu size={17} />
            </button>
            <button onClick={() => navigate('/entrepreneur/subscription')}
              className={`zm-press h-10 pl-3 pr-4 rounded-full border flex items-center gap-1.5 text-sm font-bold transition-colors ${dk('bg-[#111a1f] border-white/10 text-white hover:bg-white/10', 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50')}`}>
              <Plus size={15} className="text-emerald-500" />
              <span className="whitespace-nowrap">{creditsLabel}</span>
            </button>
          </div>
        </div>

        <h1 className={`text-[1.75rem] sm:text-4xl font-extrabold leading-[1.15] tracking-tight max-w-md ${strong}`}>
          Que entrega precisas <span className="zm-gradient-text">hoje?</span>
        </h1>

        {/* CTA */}
        <button onClick={() => navigate('/entrepreneur/new-delivery')}
          className="group zm-press zm-sheen w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 bg-[length:180%_100%] bg-left hover:bg-right text-black font-bold text-base flex items-center justify-center gap-2 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.42)] hover:shadow-[0_14px_34px_-8px_rgba(16,185,129,0.55)] transition-[background-position,box-shadow,transform] duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080d10]">
          Pedir entrega <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1.5" />
        </button>

        {/* Entrega em curso */}
        {active && stepInfo ? (
          <section className={`${card} zm-spot p-4 sm:p-5 space-y-4 hover:border-emerald-500/20`} onPointerMove={spotlight}>
            <div className="flex items-center justify-between gap-3">
              <h2 className={`text-sm flex items-center gap-2 ${subtle}`}>
                <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500 zm-live" aria-hidden="true" />
                Entrega em curso
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
                {stepInfo.label}
              </span>
            </div>

            {/* Progresso */}
            <div className="grid grid-cols-4 gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={stepInfo.step}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 rounded-full overflow-hidden ${dk('bg-white/10', 'bg-gray-200')}`}>
                  {i <= stepInfo.step && (
                    <div
                      className={`zm-seg-fill h-full w-full rounded-full bg-emerald-500 ${i === stepInfo.step ? 'zm-bar-shine' : ''}`}
                      style={delay(i * 110)}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Trajecto: recolha → destino */}
            <div>
              <div className="relative h-9">
                <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-px"
                  style={{ backgroundImage: `repeating-linear-gradient(90deg, ${dk('rgba(255,255,255,0.22)', 'rgba(0,0,0,0.18)')} 0 4px, transparent 4px 9px)` }} />
                <div className="absolute inset-x-3 top-0 bottom-0">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 zm-travel"
                    style={{ width: `${courierPos}%` }} />
                  <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${dk('border-cyan-300 bg-[#0d1519]', 'border-cyan-500 bg-white')}`} />
                  <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 zm-travel" style={{ left: `${courierPos}%` }}>
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-[0_6px_18px_-4px_rgba(16,185,129,0.7)]">
                      <Truck size={15} />
                    </div>
                  </div>
                </div>
              </div>
              <div className={`flex justify-between text-[10px] font-semibold uppercase tracking-wider mt-1 ${subtle}`}>
                <span>Recolha</span><span>Destino</span>
              </div>
            </div>

            {/* Estafeta */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`relative w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold ${dk('bg-white/10 text-gray-200', 'bg-gray-100 text-gray-700')}`}>
                {courier ? courier.name.charAt(0).toUpperCase() : <Truck size={18} className={subtle} />}
                {courier && (
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 zm-live ${dk('border-[#111a1f]', 'border-white')}`} aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <p className={`font-bold truncate ${strong}`}>{courier?.name ?? 'Estafeta por atribuir'}</p>
                <p className={`text-sm truncate ${subtle}`}>{stepInfo.hint}</p>
              </div>
            </div>

            {/* Ações */}
            <div className="grid grid-cols-2 gap-3">
              {courier?.phone ? (
                <a href={`tel:${courier.phone}`}
                  className={`zm-press zm-lift h-12 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${dk('border-white/15 text-white hover:bg-white/5', 'border-gray-300 text-gray-800 hover:bg-gray-50')}`}>
                  <Phone size={16} /> Ligar
                </a>
              ) : (
                <button disabled
                  className={`h-12 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold opacity-40 cursor-not-allowed ${dk('border-white/15 text-white', 'border-gray-300 text-gray-800')}`}>
                  <Phone size={16} /> Ligar
                </button>
              )}
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className={`zm-press zm-lift h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${dk('bg-white/[0.07] text-white hover:bg-white/10', 'bg-gray-100 text-gray-800 hover:bg-gray-200')}`}>
                <MapPin size={16} /> Ver mapa
              </a>
            </div>

            {/* Código de entrega */}
            <div className={`pt-4 border-t space-y-3 ${dk('border-white/[0.07]', 'border-gray-200')}`}>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm ${subtle}`}>Código de entrega</p>
                <button onClick={toggleCode} disabled={codeLoading}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 hover:text-emerald-400 disabled:opacity-50 transition-colors">
                  {codeLoading ? <Loader2 size={13} className="animate-spin" /> : codeVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                  {codeVisible ? 'Esconder' : 'Mostrar'}
                </button>
              </div>
              <div className="flex gap-2 sm:gap-3">
                {codeChars.map((c, i) => (
                  <div key={`${i}-${codeVisible && !!code}`}
                    style={codeVisible && code ? delay(i * 70) : undefined}
                    className={`flex-1 min-w-0 h-14 sm:h-16 rounded-xl border flex items-center justify-center text-2xl font-bold font-mono ${dk('bg-black/40 border-white/[0.07]', 'bg-gray-50 border-gray-200')} ${codeVisible && code ? `zm-pop ${strong}` : subtle}`}>
                    {c}
                  </div>
                ))}
              </div>
              <p className={`text-xs ${subtle}`}>Diz este código ao estafeta quando receberes.</p>
            </div>
          </section>
        ) : (
          <section className={`${card} p-6 text-center`}>
            <div className={`zm-float mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center ${dk('bg-white/5', 'bg-gray-100')}`}>
              <Package size={22} className={subtle} />
            </div>
            <p className={`font-bold ${strong}`}>Sem entregas em curso</p>
            <p className={`text-sm mt-1 ${subtle}`}>Quando pedires uma entrega, acompanhas tudo aqui.</p>
          </section>
        )}
      </div>

      {/* ═════════ Coluna lateral ═════════ */}
      <div className="relative space-y-4 mt-4 lg:mt-0 min-w-0">

        {/* Atalhos */}
        <div className="zm-reveal" style={delay(60)}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Créditos',  icon: Wallet,     to: '/entrepreneur/subscription' },
              { label: 'Histórico', icon: Clock,      to: '/entrepreneur/delivery-history' },
              { label: 'Ajuda',     icon: HelpCircle, to: '/entrepreneur/help' },
            ].map(({ label, icon: Icon, to }) => (
              <button key={label} onClick={() => navigate(to)}
                onPointerMove={spotlight}
                className={`${card} zm-spot zm-press zm-lift group h-20 sm:h-24 flex flex-col items-center justify-center gap-2 text-sm font-semibold hover:border-emerald-500/25 ${dk('text-white hover:bg-white/[0.06] hover:shadow-[0_10px_26px_-16px_rgba(16,185,129,0.4)]', 'text-gray-800 hover:bg-gray-50')}`}>
                <Icon size={20} className="text-emerald-500 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Resumo */}
        <div className="zm-reveal" style={delay(120)}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total',        value: stats.total,    icon: Package,       tone: 'text-emerald-500' },
              { label: 'Concluídas',   value: stats.done,     icon: CheckCircle,   tone: 'text-green-500' },
              { label: 'Em andamento', value: stats.ongoing,  icon: Clock,         tone: 'text-yellow-500' },
              { label: 'Problemas',    value: stats.problems, icon: AlertTriangle, tone: 'text-red-400' },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div key={label} onPointerMove={spotlight}
                className={`${card} zm-spot p-4 flex items-center justify-between gap-2 hover:border-emerald-500/20`}>
                <div className="min-w-0">
                  <p className={`text-xs truncate ${subtle}`}>{label}</p>
                  <p className={`text-2xl font-bold mt-0.5 tabular-nums ${strong}`}><CountUp value={value} /></p>
                </div>
                <Icon size={20} className={`flex-shrink-0 ${tone}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Recentes */}
        <div className="zm-reveal" style={delay(180)}>
          <section className={`${card} overflow-hidden`}>
            <div className={`px-4 py-3 flex items-center justify-between border-b ${dk('border-white/[0.07]', 'border-gray-200')}`}>
              <h2 className={`font-bold text-sm ${strong}`}>Entregas recentes</h2>
              <button onClick={() => navigate('/entrepreneur/delivery-history')}
                className="group text-xs font-semibold text-emerald-500 hover:text-emerald-400 flex items-center gap-0.5 transition-colors">
                Ver todas <ChevronRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </div>
            {recent.length === 0 ? (
              <p className={`p-6 text-center text-sm ${subtle}`}>Nenhuma entrega ainda</p>
            ) : (
              <ul className={`divide-y ${dk('divide-white/[0.06]', 'divide-gray-100')}`}>
                {recent.map((d, i) => {
                  const s = STATUS_CONFIG[d.current_status] ?? { label: d.current_status, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
                  return (
                    <li key={d.id} className="zm-swap" style={delay(260 + i * 70)}>
                      <button onClick={() => navigate(`/entrepreneur/delivery/${d.id}`)}
                        className={`group w-full px-4 py-3 flex items-center gap-3 text-left transition-colors duration-200 ${dk('hover:bg-emerald-500/[0.045]', 'hover:bg-gray-50')}`}>
                        <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 ${dk('bg-emerald-500/10', 'bg-emerald-100')}`}>
                          <Truck size={16} className="text-emerald-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold truncate ${strong}`}>{d.item_type}</p>
                          <p className={`text-xs truncate ${subtle}`}>{d.destination_address}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
                            <span className={`text-[10px] ${subtle}`}>{fmtDate(d.created_at)}</span>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-emerald-500 flex-shrink-0">{fmtMZN(d.estimated_value)}</p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
