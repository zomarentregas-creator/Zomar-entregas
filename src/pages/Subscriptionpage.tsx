// src/pages/Subscriptionpage.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle, Zap, Building2, Star, ChevronRight,
  Loader2, Shield, AlertCircle, X, RefreshCw,
  Info, ArrowLeft, Clock, Package, Truck,
  Calendar, TrendingUp, CreditCard, Smartphone,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PLANS, PLAN_MAP, formatMZN, stripeEnabled, type Plan } from '../config/plans'
import { useStripe } from '../hooks/useStripe'

interface Subscription {
  id: string; user_id: string; plan_id: string; plan_name: string; price: number
  status: 'active' | 'trialing' | 'canceled' | 'expired' | 'pending'
  max_deliveries: number; current_usage: number; start_date: string
  end_date: string | null; renewal_date: string | null; payment_method: 'stripe' | 'mobile_money' | null
}

type PayMethod = 'card' | 'mobile'
type Step = 'plans' | 'choose_method' | 'mobile_instructions' | 'processing' | 'success' | 'error'

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '\u2014'

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  active:   { label: 'Activo',                color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  trialing: { label: 'Per\u00edodo de Teste', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  canceled: { label: 'Cancelado',             color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  expired:  { label: 'Expirado',              color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  pending:  { label: 'Pagamento pendente',    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
}

const C: Record<string, { btn: string; bg: string; border: string; text: string; icon: string }> = {
  blue:    { btn: 'bg-blue-500 hover:bg-blue-400 text-white',       bg: 'bg-blue-500/8',    border: 'border-blue-500/25',    text: 'text-blue-400',    icon: 'bg-blue-500/15 text-blue-400' },
  emerald: { btn: 'bg-emerald-500 hover:bg-emerald-400 text-black', bg: 'bg-emerald-500/8', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: 'bg-emerald-500/15 text-emerald-400' },
  purple:  { btn: 'bg-purple-500 hover:bg-purple-400 text-white',   bg: 'bg-purple-500/8',  border: 'border-purple-500/25',  text: 'text-purple-400',  icon: 'bg-purple-500/15 text-purple-400' },
}

export default function SubscriptionPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const stripe = useStripe()

  const [isDark, setIsDark] = useState(() => localStorage.getItem('entrepreneur_theme') !== 'light')
  useEffect(() => {
    const h = () => setIsDark(localStorage.getItem('entrepreneur_theme') !== 'light')
    window.addEventListener('storage', h); return () => window.removeEventListener('storage', h)
  }, [])

  const dk   = (d: string, l: string) => isDark ? d : l
  const card = `rounded-2xl border ${dk('bg-[#1a1a1a] border-white/8', 'bg-white border-gray-200 shadow-sm')}`

  const [sub,       setSub]       = useState<Subscription | null>(null)
  const [loadSub,   setLoadSub]   = useState(true)
  const [actLoad,   setActLoad]   = useState(false)
  const [actMsg,    setActMsg]    = useState<{ ok: boolean; text: string } | null>(null)
  const [step,      setStep]      = useState<Step>('plans')
  const [selPlan,   setSelPlan]   = useState<Plan | null>(null)
  const [payMethod, setPayMethod] = useState<PayMethod>('mobile')
  const [errMsg,    setErrMsg]    = useState('')

  // Retorno Stripe (query params)
  useEffect(() => {
    if (searchParams.get('success') === '1') { setStep('success'); setTimeout(() => load(), 3000) }
    else if (searchParams.get('canceled') === '1') setActMsg({ ok: false, text: 'Pagamento cancelado.' })
  }, []) // eslint-disable-line

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoadSub(true)
    try {
      const { data } = await supabase.from('subscriptions').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      setSub(data || null)
    } catch { setSub(null) }
    finally { setLoadSub(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user?.id) return
    const prevStatus = sub?.status
    const ch = supabase.channel('sub-pg')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions',
        filter: `user_id=eq.${user.id}` }, () => {
          load()
          if (prevStatus === 'pending') setActMsg({ ok: true, text: '\u2705 Plano activado! J\u00e1 podes criar entregas.' })
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, load, sub?.status])

  useEffect(() => {
    if (!actMsg) return
    const t = setTimeout(() => setActMsg(null), 5000); return () => clearTimeout(t)
  }, [actMsg])

  const handleSelect = (plan: Plan) => {
    if (sub?.plan_id === plan.id && (sub?.status === 'active' || sub?.status === 'trialing')) return
    setSelPlan(plan); setErrMsg('')
    if (!stripeEnabled() || !plan.stripe_price_id) { setPayMethod('mobile'); setStep('mobile_instructions') }
    else setStep('choose_method')
  }

  const handleStripeCheckout = async () => {
    if (!selPlan?.stripe_price_id) return
    try {
      setStep('processing')
      await stripe.redirectToCheckout(selPlan.stripe_price_id, selPlan.id, selPlan.name)
      setStep('choose_method')
    } catch {
      setErrMsg(stripe.error || 'Erro ao iniciar pagamento por cart\u00e3o.')
      setStep('error')
    }
  }

  const handleMobileRequest = async () => {
    if (!selPlan || !user?.id) return
    setStep('processing')
    try {
      if (sub?.status === 'pending') await supabase.from('subscriptions').update({ status: 'canceled' }).eq('id', sub.id)
      const ref = `ZOMAR-${selPlan.id.toUpperCase()}-${user.id.slice(0,6).toUpperCase()}-${Date.now()}`
      await supabase.from('subscriptions').insert({
        user_id: user.id, plan_id: selPlan.id, plan_name: selPlan.name, price: selPlan.price,
        status: 'pending', max_deliveries: selPlan.max_deliveries, current_usage: 0,
        payment_method: 'mobile_money', start_date: new Date().toISOString(), renewal_date: null, notes: ref,
      })
      try { await supabase.from('activity_logs').insert({ user_id: user.id, actor_id: user.id,
        action: 'subscription_requested', entity_type: 'subscription',
        metadata: { plan: selPlan.id, price: selPlan.price, method: 'mobile_money', ref } }) } catch {}
      setStep('success'); load()
    } catch (e: any) { setErrMsg(e.message || 'Erro ao registar pedido.'); setStep('error') }
  }

  const handleCancel = async () => {
    if (!sub || !window.confirm('Cancelar a assinatura?\n\nO acesso continua at\u00e9 ao fim do per\u00edodo actual.')) return
    setActLoad(true)
    try {
      await supabase.from('subscriptions').update({ status: 'canceled' }).eq('id', sub.id)
      setSub(p => p ? { ...p, status: 'canceled' } : null)
      setActMsg({ ok: true, text: 'Assinatura cancelada. O acesso continua at\u00e9 ao fim do per\u00edodo.' })
    } catch (e: any) { setActMsg({ ok: false, text: e.message || 'Erro ao cancelar.' }) }
    finally { setActLoad(false) }
  }

  const handleReactivate = async () => {
    if (!sub || !window.confirm('Reactivar a assinatura?')) return
    setActLoad(true)
    try {
      const renewal = new Date(); renewal.setDate(renewal.getDate() + 30)
      await supabase.from('subscriptions').update({ status: 'active', renewal_date: renewal.toISOString() }).eq('id', sub.id)
      setSub(p => p ? { ...p, status: 'active', renewal_date: renewal.toISOString() } : null)
      setActMsg({ ok: true, text: 'Assinatura reactivada!' })
    } catch (e: any) { setActMsg({ ok: false, text: e.message || 'Erro ao reactivar.' }) }
    finally { setActLoad(false) }
  }

  const handleStripePortal = async () => {
    try { await stripe.redirectToPortal() }
    catch { setActMsg({ ok: false, text: stripe.error || 'Erro ao abrir portal.' }) }
  }

  const isActive     = sub?.status === 'active' || sub?.status === 'trialing'
  const isPending    = sub?.status === 'pending'
  const isCanceled   = sub?.status === 'canceled'
  const usagePct     = sub && sub.max_deliveries < 999_999 ? Math.min(100, Math.round((sub.current_usage / sub.max_deliveries) * 100)) : 0
  const subStatus    = sub ? (STATUS_CFG[sub.status] || STATUS_CFG.pending) : null
  const hasPaidByCard = sub?.payment_method === 'stripe'

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">

      <div className="flex items-center gap-3">
        {step !== 'plans' && (
          <button onClick={() => setStep('plans')} className={`p-2 rounded-xl ${dk('hover:bg-white/8 text-gray-400','hover:bg-gray-100 text-gray-500')}`}>
            <ArrowLeft size={18}/>
          </button>
        )}
        <div>
          <h2 className={`text-2xl font-bold ${dk('text-white','text-gray-900')}`}>
            {step==='plans'?'Planos e Subscri\u00e7\u00e3o':step==='choose_method'?'Como queres pagar?':step==='mobile_instructions'?'Instru\u00e7\u00f5es de pagamento':step==='processing'?'A processar\u2026':step==='success'?'Pedido registado!':'Algo correu mal'}
          </h2>
          {step==='plans' && <p className={`text-sm mt-0.5 ${dk('text-gray-400','text-gray-500')}`}>7 dias gr\u00e1tis \u00b7 Cart\u00e3o ou carteira m\u00f3vel \u00b7 Cancela quando quiseres</p>}
        </div>
      </div>

      {(actMsg || stripe.error) && (
        <div className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm ${(actMsg?.ok??false)?dk('bg-emerald-500/10 border-emerald-500/20 text-emerald-300','bg-emerald-50 border-emerald-200 text-emerald-700'):dk('bg-red-500/10 border-red-500/20 text-red-300','bg-red-50 border-red-200 text-red-700')}`}>
          {actMsg?.ok?<CheckCircle size={14}/>:<AlertCircle size={14}/>}
          <span className="flex-1">{actMsg?.text||stripe.error}</span>
          <button onClick={()=>{setActMsg(null);stripe.clearError()}}><X size={12}/></button>
        </div>
      )}

      {/* PLANOS */}
      {step==='plans' && (<>
        {!loadSub && sub && (
          <div className={`${card} p-5`}>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Star size={14} className="text-emerald-400"/>
                  <span className={`text-xs font-bold uppercase tracking-wider ${dk('text-gray-400','text-gray-500')}`}>Plano Actual</span>
                  {subStatus && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${subStatus.color}`}>{subStatus.label}</span>}
                  {sub.payment_method && (
                    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${hasPaidByCard?dk('border-blue-500/20 bg-blue-500/10 text-blue-400','border-blue-200 bg-blue-50 text-blue-700'):dk('border-orange-500/20 bg-orange-500/10 text-orange-400','border-orange-200 bg-orange-50 text-orange-700')}`}>
                      {hasPaidByCard?<CreditCard size={9}/>:<Smartphone size={9}/>} {hasPaidByCard?'Cart\u00e3o':'Carteira m\u00f3vel'}
                    </span>
                  )}
                </div>
                <p className={`text-xl font-black ${dk('text-white','text-gray-900')}`}>{sub.plan_name}</p>
                {PLAN_MAP[sub.plan_id] && <p className={`text-xs mt-0.5 ${dk('text-gray-500','text-gray-400')}`}>Cobertura at\u00e9 {formatMZN(PLAN_MAP[sub.plan_id].coverage)}</p>}
              </div>
              <p className={`text-2xl font-black ${dk('text-white','text-gray-900')}`}>{formatMZN(sub.price)}<span className={`text-sm font-normal ${dk('text-gray-500','text-gray-400')}`}>/m\u00eas</span></p>
            </div>

            {isPending && (
              <div className={`flex items-start gap-3 p-4 rounded-xl mb-4 ${dk('bg-orange-500/8 border border-orange-500/20','bg-orange-50 border border-orange-200')}`}>
                <Clock size={15} className="text-orange-400 flex-shrink-0 mt-0.5"/>
                <div>
                  <p className={`text-sm font-semibold ${dk('text-orange-300','text-orange-700')}`}>A aguardar confirma\u00e7\u00e3o de pagamento</p>
                  <p className={`text-xs mt-0.5 ${dk('text-orange-400','text-orange-600')}`}>
                    Enviaste o comprovativo por WhatsApp? A equipa activa em at\u00e9 2 horas. N\u00e3o enviaste? Envia para <strong>+258 84 XXX XXXX</strong>.
                  </p>
                </div>
              </div>
            )}

            {isActive && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { icon:<Package size={13}/>,   bg:dk('bg-emerald-500/10','bg-emerald-50'), color:'text-emerald-400', label:'Usadas',   value:`${sub.current_usage}${sub.max_deliveries<999_999?` / ${sub.max_deliveries}`:''}` },
                  { icon:<TrendingUp size={13}/>, bg:dk('bg-blue-500/10','bg-blue-50'),      color:'text-blue-400',    label:'Restantes', value:sub.max_deliveries>=999_999?'\u221e':String(Math.max(0,sub.max_deliveries-sub.current_usage)) },
                  { icon:<Calendar size={13}/>,   bg:dk('bg-purple-500/10','bg-purple-50'),  color:'text-purple-400',  label:'Renova\u00e7\u00e3o', value:fmtDate(sub.renewal_date) },
                ].map(({icon,bg,color,label,value})=>(
                  <div key={label} className={`flex items-center gap-2.5 p-3 rounded-xl ${dk('bg-white/4','bg-gray-50')}`}>
                    <div className={`p-2 rounded-lg ${bg}`}><span className={color}>{icon}</span></div>
                    <div>
                      <p className={`text-[10px] uppercase tracking-wider ${dk('text-gray-500','text-gray-400')}`}>{label}</p>
                      <p className={`text-sm font-bold ${dk('text-white','text-gray-900')}`}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isActive && sub.max_deliveries<999_999 && (
              <div className="mb-4">
                <div className={`flex justify-between text-xs mb-1 ${dk('text-gray-500','text-gray-400')}`}><span>Uso do plano</span><span>{usagePct}%</span></div>
                <div className={`w-full rounded-full h-2 ${dk('bg-white/8','bg-gray-200')}`}>
                  <div className={`h-2 rounded-full transition-all ${usagePct>80?'bg-red-500':usagePct>50?'bg-yellow-500':'bg-emerald-500'}`} style={{width:`${usagePct}%`}}/>
                </div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {isActive && <button onClick={()=>navigate('/entrepreneur/new-delivery')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${dk('bg-emerald-500 hover:bg-emerald-400 text-black','bg-emerald-600 hover:bg-emerald-700 text-white')}`}><Truck size={13}/> Nova Entrega</button>}
              {isActive && hasPaidByCard && (
                <button onClick={handleStripePortal} disabled={stripe.loading} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${dk('border-blue-500/25 bg-blue-500/8 text-blue-400 hover:bg-blue-500/15','border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100')}`}>
                  {stripe.loading?<Loader2 size={13} className="animate-spin"/>:<ExternalLink size={13}/>} Gerir cart\u00e3o
                </button>
              )}
              {isCanceled
                ? <button onClick={handleReactivate} disabled={actLoad} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${dk('border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20','border-blue-200 bg-blue-50 text-blue-700')}`}>{actLoad?<Loader2 size={13} className="animate-spin"/>:<RefreshCw size={13}/>} Reactivar</button>
                : isActive && <button onClick={handleCancel} disabled={actLoad} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${dk('border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/15','border-red-200 bg-red-50 text-red-600')}`}>Cancelar plano</button>
              }
            </div>
          </div>
        )}

        {!loadSub && !sub && (
          <div className={`rounded-2xl border p-6 text-center ${dk('bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-emerald-500/20','bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200')}`}>
            <Zap className="text-emerald-400 mx-auto mb-2" size={26}/>
            <h3 className={`text-xl font-bold mb-1 ${dk('text-white','text-gray-900')}`}>\u2728 7 Dias Gr\u00e1tis!</h3>
            <p className={`text-sm ${dk('text-gray-400','text-gray-500')}`}>Cart\u00e3o ou M-Pesa/e-Mola/M-Kesh \u00b7 Cancela quando quiseres</p>
          </div>
        )}

        <div>
          <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${dk('text-gray-500','text-gray-400')}`}>{sub?'Mudar de plano':'Escolhe o teu plano'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map(plan=>{
              const c=C[plan.color], isCur=sub?.plan_id===plan.id&&isActive
              const PIcon=plan.color==='emerald'?Star:plan.color==='blue'?Zap:Building2
              return (
                <div key={plan.id} className={`${card} p-5 flex flex-col relative ${plan.badge?`border-2 ${c.border}`:''}`}>
                  {plan.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-[#1a1a1a]"><span className={c.text}>{plan.badge}</span></div>}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.icon}`}><PIcon size={17}/></div>
                  <h4 className={`text-lg font-black mb-0.5 ${dk('text-white','text-gray-900')}`}>{plan.name}</h4>
                  <p className={`text-xs mb-3 ${dk('text-gray-500','text-gray-400')}`}>{plan.description}</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className={`text-2xl font-black ${c.text}`}>{formatMZN(plan.price)}</span>
                    <span className={`text-xs ${dk('text-gray-500','text-gray-400')}`}>/m\u00eas</span>
                  </div>
                  {!sub && <p className={`text-[11px] mb-3 ${dk('text-emerald-400','text-emerald-600')}`}>\u2728 7 dias gr\u00e1tis</p>}
                  <div className={`flex items-center gap-1.5 mb-3 text-[10px] ${dk('text-gray-600','text-gray-400')}`}>
                    <Smartphone size={10}/> M-Pesa \u00b7 e-Mola \u00b7 M-Kesh
                    {plan.stripe_price_id && <><span className="mx-1">\u00b7</span><CreditCard size={10}/> Cart\u00e3o</>}
                  </div>
                  <div className={`space-y-1.5 mb-4 text-xs ${dk('bg-white/3','bg-gray-50')} rounded-xl p-3`}>
                    <div className={`flex items-center gap-1.5 ${dk('text-gray-400','text-gray-600')}`}><Truck size={11}/>{plan.max_deliveries<999_999?`${plan.max_deliveries} entregas/m\u00eas`:'Ilimitadas'}</div>
                    <div className={`flex items-center gap-1.5 ${dk('text-gray-400','text-gray-600')}`}><Shield size={11}/>Cobertura at\u00e9 {formatMZN(plan.coverage)}</div>
                  </div>
                  <ul className="space-y-2 flex-1 mb-5">
                    {plan.features.map(f=>(
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle size={11} className={`flex-shrink-0 mt-0.5 ${c.text}`}/>
                        <span className={`text-xs ${dk('text-gray-300','text-gray-700')}`}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {isCur
                    ? <div className={`w-full py-2.5 rounded-xl text-center text-sm font-semibold ${dk('bg-white/5 text-gray-400','bg-gray-100 text-gray-500')}`}><CheckCircle size={12} className="inline mr-1"/>Plano actual</div>
                    : <button onClick={()=>handleSelect(plan)} className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] ${c.btn}`}>{sub?'Mudar para este':'Come\u00e7ar agora'} <ChevronRight size={12} className="inline"/></button>
                  }
                </div>
              )
            })}
          </div>
        </div>
      </>)}

      {/* ESCOLHER MÉTODO */}
      {step==='choose_method' && selPlan && (
        <div className="space-y-4">
          <div className={`${card} p-4 flex items-center justify-between`}>
            <div><p className={`text-xs ${dk('text-gray-500','text-gray-400')}`}>Plano</p><p className={`font-bold ${dk('text-white','text-gray-900')}`}>{selPlan.name}</p></div>
            <p className={`text-xl font-black ${C[selPlan.color].text}`}>{formatMZN(selPlan.price)}<span className={`text-xs font-normal ${dk('text-gray-500','text-gray-400')}`}>/m\u00eas</span></p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={()=>{setPayMethod('card');handleStripeCheckout()}} disabled={stripe.loading} className={`${card} p-5 text-left transition-all hover:border-blue-500/40 disabled:opacity-60 group`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${dk('bg-blue-500/15','bg-blue-50')}`}><CreditCard size={22} className="text-blue-400"/></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-bold ${dk('text-white','text-gray-900')}`}>Cart\u00e3o de cr\u00e9dito/d\u00e9bito</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dk('bg-emerald-500/15 text-emerald-400','bg-emerald-100 text-emerald-700')}`}>Autom\u00e1tico</span>
                  </div>
                  <p className={`text-xs ${dk('text-gray-400','text-gray-600')}`}>Visa, Mastercard. Activa\u00e7\u00e3o imediata \u2014 sem espera.</p>
                  <p className={`text-xs mt-2 ${dk('text-blue-400','text-blue-600')}`}>Powered by Stripe \u00b7 Pagamento seguro</p>
                </div>
                <ChevronRight size={16} className={`flex-shrink-0 mt-1 ${dk('text-gray-600 group-hover:text-blue-400','text-gray-300 group-hover:text-blue-600')} transition-colors`}/>
              </div>
            </button>
            <button onClick={()=>{setPayMethod('mobile');setStep('mobile_instructions')}} className={`${card} p-5 text-left transition-all hover:border-orange-500/30 group`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${dk('bg-orange-500/15','bg-orange-50')}`}><Smartphone size={22} className="text-orange-400"/></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-bold ${dk('text-white','text-gray-900')}`}>M-Pesa \u00b7 e-Mola \u00b7 M-Kesh</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dk('bg-orange-500/15 text-orange-400','bg-orange-100 text-orange-700')}`}>At\u00e9 2h</span>
                  </div>
                  <p className={`text-xs ${dk('text-gray-400','text-gray-600')}`}>Transfer\u00eancia manual \u2014 envias comprovativo por WhatsApp e activamos em at\u00e9 2 horas.</p>
                  <p className={`text-xs mt-2 ${dk('text-orange-400','text-orange-600')}`}>Sem conta banc\u00e1ria necess\u00e1ria</p>
                </div>
                <ChevronRight size={16} className={`flex-shrink-0 mt-1 ${dk('text-gray-600 group-hover:text-orange-400','text-gray-300 group-hover:text-orange-600')} transition-colors`}/>
              </div>
            </button>
          </div>
          <p className={`text-center text-xs ${dk('text-gray-600','text-gray-400')}`}>Ambos os m\u00e9todos incluem 7 dias gr\u00e1tis</p>
        </div>
      )}

      {/* INSTRUÇÕES MÓVEL */}
      {step==='mobile_instructions' && selPlan && (
        <div className="space-y-4">
          <div className={`${card} p-4 flex items-center justify-between`}>
            <div><p className={`text-xs ${dk('text-gray-500','text-gray-400')}`}>Plano</p><p className={`font-bold ${dk('text-white','text-gray-900')}`}>{selPlan.name}</p></div>
            <p className={`text-xl font-black ${C[selPlan.color].text}`}>{formatMZN(selPlan.price)}<span className={`text-xs font-normal ${dk('text-gray-500','text-gray-400')}`}>/m\u00eas</span></p>
          </div>
          <div className={`${card} p-5`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-4 ${dk('text-gray-400','text-gray-500')}`}>Como activar o teu plano</p>
            {[
              { n:'1', title:'Faz a transfer\u00eancia', desc:`Envia ${formatMZN(selPlan.price)} via M-Pesa, e-Mola ou M-Kesh para o n\u00famero ZOMAR.` },
              { n:'2', title:'Guarda o comprovativo', desc:'Faz screenshot ou anota o c\u00f3digo da transa\u00e7\u00e3o gerado ap\u00f3s a transfer\u00eancia.' },
              { n:'3', title:'Envia pelo WhatsApp', desc:'Manda o comprovativo para +258 84 XXX XXXX com o teu nome e email da conta ZOMAR.' },
              { n:'4', title:'Activamos em at\u00e9 2h', desc:'A equipa confirma e activa o plano. Recebes uma notifica\u00e7\u00e3o no app.' },
            ].map(({n,title,desc})=>(
              <div key={n} className="flex items-start gap-3 mb-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${dk('bg-emerald-500/20 text-emerald-400','bg-emerald-100 text-emerald-700')}`}>{n}</div>
                <div><p className={`text-sm font-medium ${dk('text-white','text-gray-900')}`}>{title}</p><p className={`text-xs mt-0.5 ${dk('text-gray-400','text-gray-500')}`}>{desc}</p></div>
              </div>
            ))}
            <div className={`rounded-xl p-4 mb-4 ${dk('bg-emerald-500/8 border border-emerald-500/15','bg-emerald-50 border border-emerald-200')}`}>
              <p className={`text-xs font-bold mb-3 ${dk('text-emerald-400','text-emerald-700')}`}>N\u00fameros para transfer\u00eancia</p>
              <div className="space-y-2">
                {[{label:'M-Pesa (Vodacom 84/85)',num:'+258 84 XXX XXXX'},{label:'e-Mola (Movitel 86/87)',num:'+258 86 XXX XXXX'},{label:'M-Kesh (BIM 83)',num:'+258 83 XXX XXXX'}].map(({label,num})=>(
                  <div key={label} className="flex justify-between items-center">
                    <span className={`text-xs ${dk('text-gray-400','text-gray-600')}`}>{label}</span>
                    <span className={`text-sm font-mono font-medium ${dk('text-white','text-gray-900')}`}>{num}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`flex items-start gap-2 p-3 rounded-xl text-xs mb-5 ${dk('bg-blue-500/8 border border-blue-500/15 text-blue-300','bg-blue-50 border border-blue-200 text-blue-700')}`}>
              <Info size={12} className="flex-shrink-0 mt-0.5"/>
              Ao confirmar, registamos o teu pedido. O plano fica activo ap\u00f3s verifica\u00e7\u00e3o manual pela equipa ZOMAR.
            </div>
            <button onClick={handleMobileRequest} className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all ${C[selPlan.color].btn}`}>
              <CheckCircle size={15}/> J\u00e1 paguei \u2014 confirmar pedido
            </button>
            <p className={`text-center text-xs mt-2 ${dk('text-gray-600','text-gray-400')}`}>Activa\u00e7\u00e3o em at\u00e9 2 horas \u00b7 Suporte: zomarentregas@gmail.com</p>
          </div>
        </div>
      )}

      {/* A PROCESSAR */}
      {step==='processing' && (
        <div className={`${card} py-16 text-center`}>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${dk('bg-blue-500/15','bg-blue-50')}`}><Loader2 size={28} className="text-blue-400 animate-spin"/></div>
          <h3 className={`text-lg font-bold mb-2 ${dk('text-white','text-gray-900')}`}>{payMethod==='card'?'A redirecionar para pagamento\u2026':'A registar pedido\u2026'}</h3>
          <p className={`text-sm ${dk('text-gray-400','text-gray-500')}`}>{payMethod==='card'?'Ser\u00e1s redirecionado para o Stripe. N\u00e3o feches esta p\u00e1gina.':'A criar a tua subscri\u00e7\u00e3o\u2026'}</p>
        </div>
      )}

      {/* SUCESSO */}
      {step==='success' && selPlan && (
        <div className={`${card} py-14 px-8 text-center`}>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${dk('bg-emerald-500/15','bg-emerald-50')}`}><CheckCircle size={28} className="text-emerald-400"/></div>
          {payMethod==='card'
            ? <><h3 className={`text-xl font-bold mb-2 ${dk('text-white','text-gray-900')}`}>Plano activado!</h3><p className={`text-sm mb-6 ${dk('text-gray-400','text-gray-500')}`}>O plano <strong>{selPlan.name}</strong> foi activado automaticamente. J\u00e1 podes criar entregas.</p></>
            : <><h3 className={`text-xl font-bold mb-2 ${dk('text-white','text-gray-900')}`}>Pedido registado!</h3><p className={`text-sm mb-3 ${dk('text-gray-400','text-gray-500')}`}>O pedido do plano <strong>{selPlan.name}</strong> foi registado.</p><div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs mb-6 ${dk('bg-orange-500/10 border border-orange-500/15 text-orange-300','bg-orange-50 border border-orange-200 text-orange-700')}`}><Clock size={11}/> A equipa activa em at\u00e9 2 horas ap\u00f3s confirmar o pagamento</div></>
          }
          <div className="flex gap-3 justify-center">
            <button onClick={()=>setStep('plans')} className={`px-5 py-2.5 rounded-xl text-sm font-medium border ${dk('border-white/10 text-gray-300 hover:bg-white/5','border-gray-200 text-gray-600 hover:bg-gray-50')}`}>Ver planos</button>
            <button onClick={()=>navigate('/entrepreneur/overview')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-black">Ir para o painel <ChevronRight size={12}/></button>
          </div>
        </div>
      )}

      {/* ERRO */}
      {step==='error' && (
        <div className={`${card} py-14 px-8 text-center`}>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${dk('bg-red-500/15','bg-red-50')}`}><AlertCircle size={28} className="text-red-400"/></div>
          <h3 className={`text-lg font-bold mb-2 ${dk('text-white','text-gray-900')}`}>Algo correu mal</h3>
          <p className={`text-sm mb-6 ${dk('text-gray-400','text-gray-500')}`}>{errMsg||'Tenta novamente ou contacta o suporte.'}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={()=>setStep('plans')} className={`px-5 py-2.5 rounded-xl text-sm font-medium border ${dk('border-white/10 text-gray-300 hover:bg-white/5','border-gray-200 text-gray-600 hover:bg-gray-50')}`}>Voltar</button>
            <button onClick={()=>{setErrMsg('');setStep(payMethod==='card'?'choose_method':'mobile_instructions')}} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-400 text-white"><RefreshCw size={12}/> Tentar novamente</button>
          </div>
        </div>
      )}
    </div>
  )
}