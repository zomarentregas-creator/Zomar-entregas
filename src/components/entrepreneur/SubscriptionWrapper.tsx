// src/components/entrepreneur/SubscriptionWrapper.tsx
/**
 * ============================================================================
 * SUBSCRIPTION WRAPPER — Moçambique | MZN
 * ============================================================================
 * @version 5.0 — preços e cobertura corrigidos, fonte única: src/config/plans.ts
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useSubscriptionRealtime } from '../../Hooks/Userealtimesync'
import { PLANS, PLAN_MAP, formatMZN, type Plan } from '../../config/plans'
import {
  CheckCircle, AlertCircle, Star, Zap, Package, Truck,
  Loader2, Calendar, ArrowRight, RefreshCw,
  TrendingUp, Shield, Clock
} from 'lucide-react'

interface Subscription {
  id: string
  user_id: string
  plan_id: string
  plan_name: string
  price: number
  status: 'active' | 'trialing' | 'canceled' | 'expired' | 'pending'
  max_deliveries: number
  current_usage: number
  start_date: string
  end_date: string | null
  renewal_date: string | null
}

const formatDate = (d?: string | null): string => {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return '—' }
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:   { label: 'Activo',           color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  trialing: { label: 'Período de Teste', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  canceled: { label: 'Cancelado',        color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  expired:  { label: 'Expirado',         color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  pending:  { label: 'Pendente',         color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
}

export default function SubscriptionWrapper() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [realtimeAlert, setRealtimeAlert] = useState<string | null>(null)

  // ── Carregar subscrição ──────────────────────────────────────────────────

  const loadSubscription = useCallback(async () => {
    if (!user?.id) { setSubscription(null); setLoading(false); return }
    try {
      setLoading(true); setError(null)
      const { data, error } = await supabase
        .from('subscriptions').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      setSubscription(data)
    } catch (err: any) {
      setError('Erro ao carregar informações do plano.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadSubscription() }, [loadSubscription])

  // ── Realtime ─────────────────────────────────────────────────────────────

  useSubscriptionRealtime(
    user?.id,
    (newData) => {
      setSubscription(newData)
      setRealtimeAlert('💳 O seu plano foi actualizado!')
      refreshUser?.()
    },
    () => {
      setSubscription(null)
      setRealtimeAlert('⚠️ Assinatura removida')
      refreshUser?.()
    }
  )

  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(null), 4000); return () => clearTimeout(t) }
  }, [successMsg])
  useEffect(() => {
    if (realtimeAlert) { const t = setTimeout(() => setRealtimeAlert(null), 5000); return () => clearTimeout(t) }
  }, [realtimeAlert])

  // ── Seleccionar plano ─────────────────────────────────────────────────────

  const handleSelectPlan = async (plan: Plan) => {
    if (!user?.id) return
    if (subscription?.plan_id === plan.id && subscription?.status === 'active') {
      return setError('Este já é o seu plano actual.')
    }
    if (!window.confirm(
      `Confirmar ${subscription ? 'mudança para' : 'adesão ao'} plano "${plan.name}"?\n\n` +
      `💰 ${formatMZN(plan.price)}/mês\n` +
      `📦 ${plan.max_deliveries < 999999 ? plan.max_deliveries + ' entregas/mês' : 'Entregas ilimitadas'}\n` +
      `🛡️ Cobertura até ${formatMZN(plan.coverage)}`
    )) return

    try {
      setActionLoading(true); setError(null)
      const now = new Date()
      const renewal = new Date(now); renewal.setDate(renewal.getDate() + 30)

      const { data, error } = await supabase.from('subscriptions').upsert({
        user_id: user.id,
        plan_id: plan.id,
        plan_name: plan.name,
        price: plan.price,
        status: subscription ? 'active' : 'trialing',
        max_deliveries: plan.max_deliveries,
        current_usage: 0,
        start_date: now.toISOString(),
        renewal_date: renewal.toISOString(),
      }, { onConflict: 'user_id', ignoreDuplicates: false }).select().single()

      if (error) throw error
      setSubscription(data)
      await refreshUser?.()
      setSuccessMsg(subscription
        ? `✅ Plano alterado para "${plan.name}" com sucesso!`
        : `✅ Plano "${plan.name}" activado! Tens 7 dias de teste grátis.`)
    } catch (err: any) {
      setError(err.message || 'Erro ao processar o plano. Tenta novamente.')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Cancelar ──────────────────────────────────────────────────────────────

  const handleCancelSubscription = async () => {
    if (!subscription) return
    if (!window.confirm('⚠️ Cancelar assinatura?\n\nContinuarás a ter acesso até ao fim do período actual.')) return
    try {
      setActionLoading(true)
      const { error } = await supabase.from('subscriptions').update({ status: 'canceled' }).eq('id', subscription.id)
      if (error) throw error
      setSubscription(prev => prev ? { ...prev, status: 'canceled' } : null)
      setSuccessMsg('✅ Assinatura cancelada. O acesso continua até ao fim do período.')
      await refreshUser?.()
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar.')
    } finally { setActionLoading(false) }
  }

  // ── Reactivar ─────────────────────────────────────────────────────────────

  const handleReactivate = async () => {
    if (!subscription) return
    if (!window.confirm('Reactivar a assinatura?')) return
    try {
      setActionLoading(true)
      const renewal = new Date(); renewal.setDate(renewal.getDate() + 30)
      const { error } = await supabase.from('subscriptions').update({
        status: 'active', renewal_date: renewal.toISOString(),
      }).eq('id', subscription.id)
      if (error) throw error
      setSubscription(prev => prev ? { ...prev, status: 'active', renewal_date: renewal.toISOString() } : null)
      setSuccessMsg('✅ Assinatura reactivada com sucesso!')
      await refreshUser?.()
    } catch (err: any) {
      setError(err.message || 'Erro ao reactivar.')
    } finally { setActionLoading(false) }
  }

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin h-12 w-12 text-emerald-400 mx-auto mb-4" />
        <p className="text-gray-400">A carregar informações...</p>
      </div>
    </div>
  )

  const usagePercent = subscription && subscription.max_deliveries < 999999
    ? Math.min(100, Math.round((subscription.current_usage / subscription.max_deliveries) * 100)) : 0
  const statusInfo = subscription ? STATUS_LABEL[subscription.status] ?? STATUS_LABEL.pending : null
  const isCanceled = subscription?.status === 'canceled'
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'

  // Cobertura do plano actual (busca do PLAN_MAP, fallback para o que veio da DB)
  const currentCoverage = subscription
    ? (PLAN_MAP[subscription.plan_id]?.coverage ?? 20_000)
    : 0

  return (
    <div className="space-y-6">

      {/* Alerta realtime */}
      {realtimeAlert && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-300">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-blue-300 text-sm">{realtimeAlert}</span>
        </div>
      )}

      {/* Feedback */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0" size={18} />
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
          <CheckCircle className="text-emerald-400 flex-shrink-0" size={18} />
          <span className="text-emerald-300 text-sm">{successMsg}</span>
        </div>
      )}

      {/* Assinatura actual */}
      {subscription ? (
        <div className={`rounded-2xl border p-6 ${
          isCanceled ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-emerald-500/5 border-emerald-500/20'
        }`}>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Star className="text-emerald-400" size={20} />
                <h2 className="text-lg font-bold text-white">Plano Actual</h2>
                {statusInfo && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-500 ml-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Ao vivo
                </span>
              </div>
              <p className="text-2xl font-black text-white">{subscription.plan_name}</p>
              <p className="text-sm text-gray-500 mt-1">
                Cobertura até <span className="text-emerald-400 font-semibold">{formatMZN(currentCoverage)}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-white">
                {formatMZN(subscription.price)}
                <span className="text-sm font-normal text-gray-400">/mês</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3 bg-white/3 rounded-xl p-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg"><Package className="text-emerald-400" size={18} /></div>
              <div>
                <p className="text-xs text-gray-500">Entregas usadas</p>
                <p className="text-lg font-bold text-white">
                  {subscription.current_usage}
                  {subscription.max_deliveries < 999999 && ` / ${subscription.max_deliveries}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/3 rounded-xl p-3">
              <div className="p-2 bg-blue-500/10 rounded-lg"><TrendingUp className="text-blue-400" size={18} /></div>
              <div>
                <p className="text-xs text-gray-500">Restantes</p>
                <p className="text-lg font-bold text-white">
                  {subscription.max_deliveries >= 999999
                    ? 'Ilimitadas'
                    : Math.max(0, subscription.max_deliveries - subscription.current_usage)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/3 rounded-xl p-3">
              <div className="p-2 bg-purple-500/10 rounded-lg"><Calendar className="text-purple-400" size={18} /></div>
              <div>
                <p className="text-xs text-gray-500">Renovação</p>
                <p className="text-lg font-bold text-white">{formatDate(subscription.renewal_date)}</p>
              </div>
            </div>
          </div>

          {subscription.max_deliveries < 999999 && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Uso do plano</span><span>{usagePercent}%</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${usagePercent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${usagePercent}%` }} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {isActive && (
              <button onClick={() => navigate('/entrepreneur/new-delivery')} disabled={actionLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all text-sm">
                <Truck size={16} /> Nova Entrega
              </button>
            )}
            {isCanceled ? (
              <button onClick={handleReactivate} disabled={actionLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 font-bold rounded-xl transition-all text-sm">
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Reactivar
              </button>
            ) : (
              <button onClick={handleCancelSubscription} disabled={actionLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-bold rounded-xl transition-all text-sm">
                Cancelar Plano
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-4">
            <Zap className="text-emerald-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">✨ 7 Dias Grátis!</h2>
          <p className="text-gray-400 mb-1">Escolhe um plano e começa a usar sem compromisso.</p>
          <p className="text-sm text-gray-500">Cancela a qualquer momento durante o período de teste.</p>
        </div>
      )}

      {/* Planos */}
      <div>
        <h3 className="text-xl font-bold text-white mb-6">
          {subscription ? 'Mudar de Plano' : 'Planos Disponíveis'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = subscription?.plan_id === plan.id && isActive
            const colorMap = {
              blue:    { icon: 'text-blue-400',    bg: 'bg-blue-500/15' },
              emerald: { icon: 'text-emerald-400', bg: 'bg-emerald-500/15' },
              purple:  { icon: 'text-purple-400',  bg: 'bg-purple-500/15' },
            }
            const c = colorMap[plan.color]
            const PlanIcon = plan.color === 'emerald' ? Zap : plan.color === 'blue' ? Package : Star

            return (
              <div key={plan.id} className={`bg-[#1a1a1a] rounded-2xl border transition-all relative overflow-hidden ${
                plan.popular ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : isCurrent ? 'border-blue-500/40'
                : 'border-white/8 hover:border-white/15'
              }`}>
                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      plan.badge === 'POPULAR' ? 'bg-emerald-500 text-black' : 'bg-purple-500 text-white'
                    }`}>{plan.badge}</span>
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`p-2.5 rounded-xl ${c.bg}`}>
                      <PlanIcon className={c.icon} size={22} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white">{plan.name}</h4>
                      <p className="text-xs text-gray-500">{plan.description}</p>
                    </div>
                  </div>

                  {/* Preço */}
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-black text-white">{formatMZN(plan.price)}</span>
                    <span className="text-gray-500 text-sm">/mês</span>
                  </div>

                  {/* Trial */}
                  {!subscription && (
                    <p className="text-xs text-emerald-400 font-medium mb-3">✨ 7 dias grátis para começar</p>
                  )}

                  {/* Entregas + cobertura */}
                  <div className="space-y-1.5 mb-5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-white/3 rounded-lg px-3 py-2">
                      <Truck size={12} />
                      {plan.max_deliveries < 999999 ? `Até ${plan.max_deliveries} entregas/mês` : 'Entregas ilimitadas'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-white/3 rounded-lg px-3 py-2">
                      <Shield size={12} />
                      Cobertura até {formatMZN(plan.coverage)}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-gray-300">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={actionLoading || isCurrent}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      isCurrent
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                        : plan.popular
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-black hover:scale-[1.02] active:scale-95'
                        : 'bg-white/8 hover:bg-white/14 text-white border border-white/10 hover:scale-[1.02] active:scale-95'
                    } disabled:opacity-50`}
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" />
                      : isCurrent ? <><CheckCircle size={14} /> Plano Actual</>
                      : <>Seleccionar <ArrowRight size={14} /></>}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Porquê ZOMAR */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl p-8">
        <h3 className="text-lg font-bold text-white text-center mb-6">Porquê escolher o ZOMAR?</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10', title: 'Segurança Total',   desc: 'Rastreamento e cobertura em todas as entregas' },
            { icon: Zap,    color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  title: 'Entrega Rápida',   desc: 'Entregadores disponíveis 24/7' },
            { icon: Star,   color: 'text-purple-400',  bg: 'bg-purple-500/10',  title: 'Avaliação 5★',     desc: 'Entregadores verificados e avaliados' },
            { icon: Clock,  color: 'text-blue-400',    bg: 'bg-blue-500/10',    title: 'Suporte Dedicado', desc: 'Equipa especializada sempre disponível' },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 ${bg}`}>
                <Icon className={color} size={22} />
              </div>
              <p className="text-white font-semibold text-sm mb-1">{title}</p>
              <p className="text-gray-500 text-xs">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}