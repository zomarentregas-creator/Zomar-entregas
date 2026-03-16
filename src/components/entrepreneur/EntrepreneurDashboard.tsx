// src/components/entrepreneur/EntrepreneurDashboard.tsx
/**
 * ============================================================================
 * ENTREPRENEUR DASHBOARD — com Supabase Realtime completo
 * ============================================================================
 *
 * Agora com subscrições em tempo real para:
 *  - Mudanças em entregas feitas por entregadores
 *  - Mudanças na assinatura
 *  - Novas notificações
 *  - Checkpoints de rastreamento
 *
 * @version 4.0 (Realtime Ready)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useEntrepreneurRealtime } from '../../hooks/Userealtimesync'
import {
  Package, Home, History, PlusCircle, Star,
  Sun, Moon, TrendingUp, AlertCircle,
  DollarSign, Clock, CheckCircle, Truck, MapPin,
  ChevronRight, Bell, Loader2, RefreshCw,
  Shield, Zap, Calendar, ArrowRight, Filter,
  Lock, Info, FileText, X
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Delivery {
  id: string
  item_type: string
  origin_address: string
  destination_address: string
  current_status: 'created' | 'accepted' | 'in_progress' | 'completed' | 'problem' | 'cancelled'
  estimated_value: number
  notes: string | null
  created_at: string
  updated_at: string
  deliverer_name: string | null
  deliverer_id: string | null
}

interface Stats {
  totalDeliveries: number
  pendingDeliveries: number
  completedDeliveries: number
  problemDeliveries: number
  totalValue: number
}

interface Subscription {
  id: string
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

interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  delivery_id: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_COVERAGE: Record<string, number> = {
  plan_basic: 500,
  plan_professional: 2000,
  plan_enterprise: 10000,
}

const DEFAULT_PLANS = [
  {
    id: 'plan_basic', name: 'Básico', description: 'Para empreendedores iniciantes',
    price: 29.90, max_deliveries: 20, color: 'blue' as const,
    features: ['Até 20 entregas/mês', 'Suporte por email', 'Rastreamento básico', 'Cobertura até R$ 500'],
  },
  {
    id: 'plan_professional', name: 'Profissional', description: 'Para negócios em crescimento',
    price: 99.90, max_deliveries: 100, color: 'emerald' as const, popular: true,
    features: ['Até 100 entregas/mês', 'Suporte prioritário', 'Rastreamento em tempo real', 'Cobertura até R$ 2.000', 'Relatórios semanais'],
  },
  {
    id: 'plan_enterprise', name: 'Empresarial', description: 'Para grandes volumes',
    price: 299.90, max_deliveries: 999999, color: 'purple' as const,
    features: ['Entregas ilimitadas', 'Suporte 24/7', 'Rastreamento avançado', 'Cobertura até R$ 10.000', 'API completa'],
  },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completed:   { label: 'Entregue',     color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  accepted:    { label: 'Aceita',       color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  created:     { label: 'Disponível',   color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  problem:     { label: 'Problema',     color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  cancelled:   { label: 'Cancelado',    color: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

const STATUS_LABEL_SUB: Record<string, { label: string; color: string }> = {
  active:   { label: 'Ativo',            color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  trialing: { label: 'Período de Teste', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  canceled: { label: 'Cancelado',        color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  expired:  { label: 'Expirado',         color: 'text-red-400 bg-red-500/10 border-red-500/20' },
}

// ─── Toast de notificação em tempo real ──────────────────────────────────────

interface RealtimeToast {
  id: string
  message: string
  type: 'delivery' | 'notification' | 'subscription'
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EntrepreneurDashboard() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const mountedRef = useRef(true)

  // UI state
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'active' | 'new' | 'history' | 'subscription' | 'notifications'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Toast de mudanças em tempo real
  const [realtimeToasts, setRealtimeToasts] = useState<RealtimeToast[]>([])

  // Data state
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [stats, setStats] = useState<Stats>({ totalDeliveries: 0, pendingDeliveries: 0, completedDeliveries: 0, problemDeliveries: 0, totalValue: 0 })
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [subActionLoading, setSubActionLoading] = useState(false)

  // New Delivery form state
  const [newDelivery, setNewDelivery] = useState({ itemType: '', originAddress: '', destinationAddress: '', estimatedValue: '', notes: '' })
  const [newDeliveryLoading, setNewDeliveryLoading] = useState(false)
  const [newDeliverySuccess, setNewDeliverySuccess] = useState(false)

  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => {
    const t = localStorage.getItem('entrepreneur_theme')
    if (t) setIsDarkMode(t === 'dark')
  }, [])

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(t)
    }
  }, [feedback])

  // Auto-remover toasts após 5s
  useEffect(() => {
    if (realtimeToasts.length === 0) return
    const t = setTimeout(() => {
      setRealtimeToasts(prev => prev.slice(1))
    }, 5000)
    return () => clearTimeout(t)
  }, [realtimeToasts])

  // ─── Helper: mostrar toast de tempo real ─────────────────────────

  const showRealtimeToast = useCallback((message: string, type: RealtimeToast['type']) => {
    const id = Math.random().toString(36).slice(2)
    setRealtimeToasts(prev => [...prev.slice(-2), { id, message, type }])
  }, [])

  // ─── Load all data ────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      setError(null)

      const { data: deliveriesData, error: dErr } = await supabase
        .from('deliveries')
        .select('*')
        .eq('entrepreneur_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (dErr) throw dErr

      // Nomes dos entregadores
      let delivererNames: Record<string, string> = {}
      const ids = [...new Set((deliveriesData || []).map((d: any) => d.deliverer_id).filter(Boolean))]
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids)
        if (profiles) delivererNames = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name || 'Entregador']))
      }

      const formatted: Delivery[] = (deliveriesData || []).map((d: any) => ({
        id: d.id, item_type: d.item_type || 'Item', origin_address: d.origin_address || '',
        destination_address: d.destination_address || '', current_status: d.current_status || 'created',
        estimated_value: d.estimated_value || 0, notes: d.notes || null,
        created_at: d.created_at, updated_at: d.updated_at,
        deliverer_id: d.deliverer_id || null,
        deliverer_name: d.deliverer_id ? (delivererNames[d.deliverer_id] || 'Entregador') : null,
      }))

      const { data: subData } = await supabase
        .from('subscriptions').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      const { data: notifData } = await supabase
        .from('notifications').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(50)

      if (!mountedRef.current) return

      setDeliveries(formatted)
      setSubscription(subData || null)
      setNotifications(notifData || [])

      setStats({
        totalDeliveries: formatted.length,
        pendingDeliveries: formatted.filter(d => ['created', 'accepted', 'in_progress'].includes(d.current_status)).length,
        completedDeliveries: formatted.filter(d => d.current_status === 'completed').length,
        problemDeliveries: formatted.filter(d => d.current_status === 'problem').length,
        totalValue: formatted.reduce((s, d) => s + d.estimated_value, 0),
      })
    } catch (err: any) {
      if (mountedRef.current) setError(err.message || 'Erro ao carregar dados')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && user) loadAll()
  }, [authLoading, user, loadAll])

  // ─── REALTIME: atualização granular de entregas ───────────────────
  //
  // Em vez de recarregar tudo (loadAll), fazemos update granular no state
  // para evitar flicker e reduzir chamadas à DB.

  const handleDeliveryChange = useCallback(async (payload: any) => {
    const { eventType, new: newRow, old: oldRow } = payload

    if (eventType === 'INSERT') {
      // Nova entrega criada (improvável no dashboard do empreendedor, mas por segurança)
      const d = newRow
      setDeliveries(prev => [
        {
          id: d.id, item_type: d.item_type || 'Item',
          origin_address: d.origin_address || '',
          destination_address: d.destination_address || '',
          current_status: d.current_status || 'created',
          estimated_value: d.estimated_value || 0,
          notes: d.notes || null,
          created_at: d.created_at, updated_at: d.updated_at,
          deliverer_id: d.deliverer_id || null,
          deliverer_name: null,
        },
        ...prev,
      ])
    } else if (eventType === 'UPDATE') {
      const d = newRow
      const oldStatus = oldRow?.current_status
      const newStatus = d.current_status

      // Buscar nome do entregador se mudou
      let delivererName: string | null = null
      if (d.deliverer_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', d.deliverer_id)
          .maybeSingle()
        delivererName = profile?.full_name || 'Entregador'
      }

      setDeliveries(prev => prev.map(existing =>
        existing.id === d.id
          ? {
              ...existing,
              current_status: d.current_status,
              deliverer_id: d.deliverer_id || null,
              deliverer_name: delivererName || existing.deliverer_name,
              updated_at: d.updated_at,
              notes: d.notes ?? existing.notes,
            }
          : existing
      ))

      // Mostrar toast com mudança relevante
      if (oldStatus !== newStatus) {
        const statusMessages: Record<string, string> = {
          accepted:    '✅ Entrega aceite por um entregador!',
          in_progress: '🚚 Entrega saiu para entrega!',
          completed:   '🎉 Entrega concluída com sucesso!',
          problem:     '⚠️ Problema reportado numa entrega',
          cancelled:   '❌ Entrega foi cancelada',
        }
        if (statusMessages[newStatus]) {
          showRealtimeToast(statusMessages[newStatus], 'delivery')
        }
      }
    } else if (eventType === 'DELETE') {
      setDeliveries(prev => prev.filter(d => d.id !== oldRow?.id))
    }

    // Recalcular stats após qualquer mudança
    setDeliveries(prev => {
      setStats({
        totalDeliveries: prev.length,
        pendingDeliveries: prev.filter(d => ['created', 'accepted', 'in_progress'].includes(d.current_status)).length,
        completedDeliveries: prev.filter(d => d.current_status === 'completed').length,
        problemDeliveries: prev.filter(d => d.current_status === 'problem').length,
        totalValue: prev.reduce((s, d) => s + d.estimated_value, 0),
      })
      return prev
    })
  }, [showRealtimeToast])

  const handleSubscriptionChange = useCallback((payload: any) => {
    const { eventType, new: newRow } = payload
    if (eventType === 'DELETE') {
      setSubscription(null)
    } else {
      setSubscription(newRow)
      showRealtimeToast('💳 Plano atualizado!', 'subscription')
    }
  }, [showRealtimeToast])

  const handleNotificationInsert = useCallback((payload: any) => {
    const notif = payload.new as Notification
    setNotifications(prev => [notif, ...prev])
    showRealtimeToast(`🔔 ${notif.title}`, 'notification')
  }, [showRealtimeToast])

  // ─── Ativar Realtime ──────────────────────────────────────────────

  useEntrepreneurRealtime(user?.id, {
    onDeliveryChange: handleDeliveryChange,
    onSubscriptionChange: handleSubscriptionChange,
    onNotificationInsert: handleNotificationInsert,
  })

  // ─── New Delivery ─────────────────────────────────────────────────

  const handleNewDelivery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !subscription) return

    const value = parseFloat(newDelivery.estimatedValue)
    const maxCoverage = PLAN_COVERAGE[subscription.plan_id] ?? 500
    const remaining = Math.max(0, subscription.max_deliveries - subscription.current_usage)

    if (!newDelivery.itemType.trim()) return setFeedback({ type: 'error', msg: 'Tipo de item obrigatório' })
    if (!newDelivery.originAddress.trim()) return setFeedback({ type: 'error', msg: 'Endereço de origem obrigatório' })
    if (!newDelivery.destinationAddress.trim()) return setFeedback({ type: 'error', msg: 'Endereço de destino obrigatório' })
    if (!value || value <= 0) return setFeedback({ type: 'error', msg: 'Valor estimado inválido' })
    if (value > maxCoverage) return setFeedback({ type: 'error', msg: `Valor excede cobertura do plano (máx R$ ${maxCoverage})` })
    if (remaining <= 0) return setFeedback({ type: 'error', msg: 'Limite de entregas do plano atingido' })

    try {
      setNewDeliveryLoading(true)
      const { data: delivery, error: dErr } = await supabase
        .from('deliveries').insert({
          entrepreneur_id: user.id,
          item_type: newDelivery.itemType.trim(),
          origin_address: newDelivery.originAddress.trim(),
          destination_address: newDelivery.destinationAddress.trim(),
          estimated_value: value,
          notes: newDelivery.notes.trim() || null,
          current_status: 'created',
          created_at: new Date().toISOString(),
        }).select().single()
      if (dErr) throw dErr

      await supabase.from('subscriptions').update({ current_usage: subscription.current_usage + 1 }).eq('id', subscription.id)

      try {
        await supabase.from('delivery_checkpoints').insert({
          delivery_id: delivery.id, status: 'created',
          description: 'Entrega criada e aguardando aceitação',
          created_at: new Date().toISOString(),
        })
      } catch {}

      setNewDeliverySuccess(true)
      setNewDelivery({ itemType: '', originAddress: '', destinationAddress: '', estimatedValue: '', notes: '' })
      setTimeout(() => { setNewDeliverySuccess(false); setActiveTab('overview') }, 2000)
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Erro ao criar entrega' })
    } finally {
      setNewDeliveryLoading(false)
    }
  }

  // ─── Subscription actions ─────────────────────────────────────────

  const handleSelectPlan = async (plan: typeof DEFAULT_PLANS[0]) => {
    if (!user?.id) return
    if (subscription?.plan_id === plan.id && subscription?.status === 'active') {
      return setFeedback({ type: 'error', msg: 'Este já é o teu plano atual.' })
    }
    if (!window.confirm(`Confirmar ${subscription ? 'mudança para' : 'adesão ao'} plano "${plan.name}"?\n\nR$ ${plan.price.toFixed(2)}/mês`)) return

    try {
      setSubActionLoading(true)
      const renewal = new Date(); renewal.setDate(renewal.getDate() + 30)
      const { data, error } = await supabase.from('subscriptions').upsert({
        user_id: user.id, plan_id: plan.id, plan_name: plan.name, price: plan.price,
        status: subscription ? 'active' : 'trialing',
        max_deliveries: plan.max_deliveries,
        current_usage: 0,
        start_date: new Date().toISOString(),
        renewal_date: renewal.toISOString(),
      }, { onConflict: 'user_id', ignoreDuplicates: false }).select().single()
      if (error) throw error
      setSubscription(data)
      setFeedback({ type: 'success', msg: `✅ Plano "${plan.name}" ${subscription ? 'alterado' : 'ativado'} com sucesso!` })
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message || 'Erro ao processar plano' })
    } finally {
      setSubActionLoading(false)
    }
  }

  const handleCancelSub = async () => {
    if (!subscription || !window.confirm('Cancelar assinatura? Terás acesso até ao fim do período.')) return
    try {
      setSubActionLoading(true)
      const { error } = await supabase.from('subscriptions').update({ status: 'canceled' }).eq('id', subscription.id)
      if (error) throw error
      setSubscription(prev => prev ? { ...prev, status: 'canceled' } : null)
      setFeedback({ type: 'success', msg: 'Assinatura cancelada. Acesso mantido até ao fim do período.' })
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message })
    } finally { setSubActionLoading(false) }
  }

  const handleReactivateSub = async () => {
    if (!subscription || !window.confirm('Reativar assinatura?')) return
    try {
      setSubActionLoading(true)
      const renewal = new Date(); renewal.setDate(renewal.getDate() + 30)
      const { error } = await supabase.from('subscriptions').update({ status: 'active', renewal_date: renewal.toISOString() }).eq('id', subscription.id)
      if (error) throw error
      setSubscription(prev => prev ? { ...prev, status: 'active', renewal_date: renewal.toISOString() } : null)
      setFeedback({ type: 'success', msg: '✅ Assinatura reativada!' })
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.message })
    } finally { setSubActionLoading(false) }
  }

  // ─── Notifications ────────────────────────────────────────────────

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    if (!user?.id) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  const toggleTheme = () => {
    setIsDarkMode(p => { localStorage.setItem('entrepreneur_theme', !p ? 'dark' : 'light'); return !p })
  }

  const dk = (dark: string, light: string) => isDarkMode ? dark : light
  const getStatus = (s: string) => STATUS_CONFIG[s] ?? { label: s, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
  const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

  const unreadCount = notifications.filter(n => !n.read).length
  const activeDeliveries = deliveries.filter(d => ['created', 'accepted', 'in_progress'].includes(d.current_status))
  const completedDeliveries = deliveries.filter(d => d.current_status === 'completed')
  const maxCoverage = subscription ? (PLAN_COVERAGE[subscription.plan_id] ?? 500) : 500
  const remaining = subscription ? Math.max(0, subscription.max_deliveries - subscription.current_usage) : 0
  const usagePct = subscription && subscription.max_deliveries < 999999
    ? Math.min(100, Math.round((subscription.current_usage / subscription.max_deliveries) * 100)) : 0

  const tabs = [
    { id: 'overview',       label: 'Visão Geral',  icon: Home },
    { id: 'active',         label: 'Ativas',        icon: Truck },
    { id: 'new',            label: 'Nova Entrega',  icon: PlusCircle },
    { id: 'history',        label: 'Histórico',     icon: History },
    { id: 'subscription',   label: 'Plano',         icon: Star },
    { id: 'notifications',  label: `Notificações${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: Bell },
  ]

  // ─── Loading / Error ──────────────────────────────────────────────

  if (authLoading || loading) return (
    <div className={`min-h-screen flex items-center justify-center ${dk('bg-black', 'bg-gray-50')}`}>
      <div className="text-center">
        <div className={`animate-spin rounded-full h-20 w-20 border-4 mx-auto ${dk('border-emerald-500/20 border-t-emerald-500', 'border-emerald-600/20 border-t-emerald-600')}`} />
        <p className={`mt-6 text-lg font-medium ${dk('text-gray-400', 'text-gray-600')}`}>Carregando dashboard...</p>
      </div>
    </div>
  )

  if (error && deliveries.length === 0) return (
    <div className={`min-h-screen flex items-center justify-center ${dk('bg-black', 'bg-gray-50')}`}>
      <div className={`max-w-md w-full rounded-2xl p-8 border text-center ${dk('bg-[#121212] border-red-500/20', 'bg-white border-red-200')}`}>
        <AlertCircle className={`mx-auto mb-4 ${dk('text-red-400', 'text-red-600')}`} size={48} />
        <h1 className={`text-2xl font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Erro ao Carregar</h1>
        <p className={`mb-6 ${dk('text-gray-400', 'text-gray-600')}`}>{error}</p>
        <button onClick={loadAll} className={`w-full py-3 rounded-xl font-medium ${dk('bg-emerald-500 text-black', 'bg-emerald-600 text-white')}`}>
          🔄 Tentar Novamente
        </button>
      </div>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen ${dk('bg-black', 'bg-gray-50')}`}>

      {/* ── Toasts Realtime (canto superior direito) ── */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-xs">
        {realtimeToasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg border animate-in slide-in-from-right-5 fade-in duration-300 ${
              toast.type === 'delivery'
                ? 'bg-emerald-500/95 text-black border-emerald-400'
                : toast.type === 'subscription'
                ? 'bg-blue-500/95 text-white border-blue-400'
                : 'bg-yellow-500/95 text-black border-yellow-400'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{toast.message}</span>
              <button
                onClick={() => setRealtimeToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="opacity-60 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-40 border-b ${dk('bg-[#121212]/90 backdrop-blur-xl border-white/5', 'bg-white/90 backdrop-blur-xl border-gray-200')}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className={`text-xl font-bold ${dk('text-white', 'text-gray-900')}`}>
                Olá, {user?.full_name || user?.email?.split('@')[0] || 'Utilizador'} 👋
              </h1>
              <p className={`text-sm ${dk('text-gray-500', 'text-gray-600')}`}>Gerencie as suas entregas</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Botão de refresh manual */}
              <button
                onClick={loadAll}
                title="Atualizar dados"
                className={`p-2.5 rounded-xl transition-all ${dk('bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white', 'bg-gray-100 hover:bg-gray-200 text-gray-600')}`}
              >
                <RefreshCw size={18} />
              </button>

              <button onClick={() => setActiveTab('notifications')}
                className={`relative p-2.5 rounded-xl ${dk('bg-white/5 hover:bg-white/10', 'bg-gray-100 hover:bg-gray-200')}`}>
                <Bell size={20} className={dk('text-gray-300', 'text-gray-600')} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <button onClick={toggleTheme} className={`p-2.5 rounded-xl ${dk('bg-white/5 hover:bg-white/10 text-yellow-400', 'bg-gray-100 hover:bg-gray-200 text-gray-700')}`}>
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${dk('bg-white/5 border-white/10', 'bg-gray-50 border-gray-200')}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${dk('bg-emerald-500 text-black', 'bg-emerald-600 text-white')}`}>
                  {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <span className={`text-sm font-medium hidden md:block ${dk('text-white', 'text-gray-900')}`}>
                  {user?.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Indicador de conexão Realtime */}
      <div className={`border-b px-4 py-1.5 flex items-center gap-2 text-xs ${dk('bg-[#0d0d0d] border-white/5 text-gray-600', 'bg-gray-50 border-gray-200 text-gray-500')}`}>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Atualizações em tempo real ativas</span>
      </div>

      {/* Tabs */}
      <div className={`border-b ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200')}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === id
                    ? dk('bg-emerald-500 text-black shadow-lg', 'bg-emerald-600 text-white shadow-lg')
                    : dk('text-gray-400 hover:text-white hover:bg-white/5', 'text-gray-600 hover:text-gray-900 hover:bg-gray-100')
                }`}>
                <Icon size={16} />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className={`rounded-xl p-4 flex items-center gap-3 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}>
            {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span className="flex-1 text-sm">{feedback.msg}</span>
            <button onClick={() => setFeedback(null)}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total',        value: stats.totalDeliveries,     icon: Package,     color: 'emerald' },
                { label: 'Concluídas',   value: stats.completedDeliveries, icon: CheckCircle, color: 'green'   },
                { label: 'Em Andamento', value: stats.pendingDeliveries,   icon: Clock,       color: 'yellow'  },
                { label: 'Valor Total',  value: `R$ ${stats.totalValue.toFixed(2)}`, icon: DollarSign, color: 'purple' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`p-5 rounded-2xl border hover:scale-[1.02] transition-all ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200 shadow-sm')}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-widest ${dk('text-gray-500', 'text-gray-600')}`}>{label}</p>
                      <p className={`text-2xl font-black mt-2 ${dk('text-white', 'text-gray-900')}`}>{value}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-${color}-500/10`}>
                      <Icon className={`text-${color}-400`} size={22} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Deliveries */}
            <div className={`rounded-2xl border overflow-hidden ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200 shadow-sm')}`}>
              <div className={`p-6 border-b ${dk('border-white/5', 'border-gray-200')}`}>
                <div className="flex items-center justify-between">
                  <h2 className={`font-bold text-lg ${dk('text-white', 'text-gray-900')}`}>Entregas Recentes</h2>
                  <button onClick={() => setActiveTab('active')}
                    className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                    Ver todas <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              {deliveries.length === 0 ? (
                <div className="p-12 text-center">
                  <Package className={`mx-auto mb-4 ${dk('text-gray-600', 'text-gray-300')}`} size={48} />
                  <p className={`font-medium mb-4 ${dk('text-gray-400', 'text-gray-600')}`}>Nenhuma entrega ainda</p>
                  <button onClick={() => setActiveTab('new')}
                    className={`px-6 py-2.5 rounded-xl font-medium ${dk('bg-emerald-500 text-black', 'bg-emerald-600 text-white')}`}>
                    Criar Nova Entrega
                  </button>
                </div>
              ) : (
                <div className={`divide-y ${dk('divide-white/5', 'divide-gray-100')}`}>
                  {deliveries.slice(0, 5).map(d => {
                    const s = getStatus(d.current_status)
                    return (
                      <div key={d.id} onClick={() => navigate(`/delivery/${d.id}`)}
                        className={`p-5 flex items-center justify-between gap-4 cursor-pointer transition-colors ${dk('hover:bg-white/5', 'hover:bg-gray-50')}`}>
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`p-2.5 rounded-xl flex-shrink-0 ${dk('bg-emerald-500/10', 'bg-emerald-100')}`}>
                            <Package className={dk('text-emerald-400', 'text-emerald-600')} size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className={`font-bold truncate ${dk('text-white', 'text-gray-900')}`}>{d.item_type}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
                              <span className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>{formatDate(d.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-bold ${dk('text-emerald-400', 'text-emerald-600')}`}>R$ {d.estimated_value.toFixed(2)}</p>
                          <ChevronRight className={dk('text-gray-600', 'text-gray-400')} size={16} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ACTIVE ── */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-bold ${dk('text-white', 'text-gray-900')}`}>
                Entregas Ativas <span className={`text-sm font-normal ${dk('text-gray-400', 'text-gray-600')}`}>({activeDeliveries.length})</span>
              </h2>
              <button onClick={() => setActiveTab('new')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${dk('bg-emerald-500 text-black', 'bg-emerald-600 text-white')}`}>
                <PlusCircle size={16} /> Nova Entrega
              </button>
            </div>

            {activeDeliveries.length === 0 ? (
              <div className={`rounded-2xl border p-12 text-center ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200')}`}>
                <Truck className={`mx-auto mb-4 ${dk('text-gray-600', 'text-gray-300')}`} size={48} />
                <p className={`font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Nenhuma entrega ativa</p>
                <p className={`text-sm mb-6 ${dk('text-gray-400', 'text-gray-600')}`}>As suas entregas ativas aparecem aqui</p>
                <button onClick={() => setActiveTab('new')}
                  className={`px-6 py-2.5 rounded-xl font-medium ${dk('bg-emerald-500 text-black', 'bg-emerald-600 text-white')}`}>
                  Criar Entrega
                </button>
              </div>
            ) : (
              <div className={`rounded-2xl border overflow-hidden ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200')}`}>
                <div className={`divide-y ${dk('divide-white/5', 'divide-gray-100')}`}>
                  {activeDeliveries.map(d => {
                    const s = getStatus(d.current_status)
                    return (
                      <div key={d.id} onClick={() => navigate(`/delivery/${d.id}`)}
                        className={`p-5 cursor-pointer transition-colors ${dk('hover:bg-white/5', 'hover:bg-gray-50')}`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${s.color}`}>{s.label}</span>
                              <span className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>{formatDate(d.created_at)}</span>
                            </div>
                            <p className={`font-bold text-lg ${dk('text-white', 'text-gray-900')}`}>{d.item_type}</p>
                            <div className="flex flex-col gap-1 mt-2">
                              <p className={`text-sm flex items-center gap-1.5 ${dk('text-gray-400', 'text-gray-600')}`}>
                                <MapPin size={13} className="text-emerald-400" />{d.origin_address}
                              </p>
                              <p className={`text-sm flex items-center gap-1.5 ${dk('text-gray-400', 'text-gray-600')}`}>
                                <MapPin size={13} className="text-red-400" />{d.destination_address}
                              </p>
                            </div>
                            {d.deliverer_name && (
                              <p className={`text-xs mt-2 ${dk('text-gray-500', 'text-gray-500')}`}>
                                Entregador: <span className={dk('text-gray-300', 'text-gray-700')}>{d.deliverer_name}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <p className={`text-xl font-black ${dk('text-emerald-400', 'text-emerald-600')}`}>
                              R$ {d.estimated_value.toFixed(2)}
                            </p>
                            <ChevronRight className={dk('text-gray-600', 'text-gray-400')} size={18} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── NEW DELIVERY ── */}
        {activeTab === 'new' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {newDeliverySuccess ? (
              <div className={`rounded-2xl border p-12 text-center ${dk('bg-[#121212] border-emerald-500/20', 'bg-white border-emerald-200')}`}>
                <CheckCircle className="mx-auto mb-4 text-emerald-400" size={56} />
                <h2 className={`text-2xl font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Entrega Criada!</h2>
                <p className={`${dk('text-gray-400', 'text-gray-600')}`}>A aguardar um entregador disponível...</p>
                <p className={`text-sm mt-2 animate-pulse ${dk('text-gray-500', 'text-gray-500')}`}>A redirecionar...</p>
              </div>
            ) : !subscription ? (
              <div className={`rounded-2xl border p-12 text-center ${dk('bg-[#121212] border-red-500/20', 'bg-white border-red-200')}`}>
                <Lock className={`mx-auto mb-4 ${dk('text-red-400', 'text-red-600')}`} size={48} />
                <h2 className={`text-2xl font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Plano Necessário</h2>
                <p className={`mb-6 ${dk('text-gray-400', 'text-gray-600')}`}>Precisa de um plano ativo para criar entregas.</p>
                <button onClick={() => setActiveTab('subscription')}
                  className={`px-6 py-3 rounded-xl font-bold ${dk('bg-emerald-500 text-black', 'bg-emerald-600 text-white')}`}>
                  Ver Planos
                </button>
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-500/20 rounded-xl"><Shield className="text-emerald-400" size={20} /></div>
                      <div>
                        <p className="font-bold text-white">{subscription.plan_name}</p>
                        <p className="text-sm text-gray-400">
                          Entregas restantes: <span className="text-emerald-400 font-bold">{subscription.max_deliveries >= 999999 ? 'Ilimitadas' : remaining}</span>
                          {subscription.max_deliveries < 999999 && ` de ${subscription.max_deliveries}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Cobertura máx.</p>
                      <p className="text-xl font-black text-white">R$ {maxCoverage.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  {subscription.max_deliveries < 999999 && (
                    <div className="mt-4">
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${usagePct > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${usagePct}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleNewDelivery} className={`rounded-2xl border p-8 space-y-5 ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200 shadow-sm')}`}>
                  <h2 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>Nova Entrega Protegida</h2>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${dk('text-gray-400', 'text-gray-700')}`}>Tipo de Item <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input value={newDelivery.itemType} onChange={e => setNewDelivery(p => ({ ...p, itemType: e.target.value }))}
                        placeholder="Ex: Roupas, Eletrônicos, Documentos..."
                        className={`w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all ${dk('bg-white/5 border-white/10 text-white placeholder-gray-500', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')}`}
                        required />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${dk('text-gray-400', 'text-gray-700')}`}>Origem <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
                        <input value={newDelivery.originAddress} onChange={e => setNewDelivery(p => ({ ...p, originAddress: e.target.value }))}
                          placeholder="Rua, número, bairro"
                          className={`w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all ${dk('bg-white/5 border-white/10 text-white placeholder-gray-500', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')}`}
                          required />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${dk('text-gray-400', 'text-gray-700')}`}>Destino <span className="text-red-400">*</span></label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400" size={18} />
                        <input value={newDelivery.destinationAddress} onChange={e => setNewDelivery(p => ({ ...p, destinationAddress: e.target.value }))}
                          placeholder="Rua, número, bairro"
                          className={`w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all ${dk('bg-white/5 border-white/10 text-white placeholder-gray-500', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')}`}
                          required />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${dk('text-gray-400', 'text-gray-700')}`}>Valor Estimado <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                      <input type="number" step="0.01" min="0.01" max={maxCoverage}
                        value={newDelivery.estimatedValue} onChange={e => setNewDelivery(p => ({ ...p, estimatedValue: e.target.value }))}
                        placeholder="0.00"
                        className={`w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all ${dk('bg-white/5 border-white/10 text-white placeholder-gray-500', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')}`}
                        required />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Cobertura máxima: <span className="text-emerald-400">R$ {maxCoverage.toLocaleString('pt-BR')}</span></p>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${dk('text-gray-400', 'text-gray-700')}`}>Observações <span className="text-gray-500 text-xs">(Opcional)</span></label>
                    <textarea value={newDelivery.notes} onChange={e => setNewDelivery(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Instruções especiais, horários, etc..."
                      rows={3} className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 resize-none transition-all ${dk('bg-white/5 border-white/10 text-white placeholder-gray-500', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')}`} />
                  </div>

                  <div className={`p-4 rounded-xl border ${dk('bg-blue-500/5 border-blue-500/20', 'bg-blue-50 border-blue-200')}`}>
                    <div className="flex gap-3">
                      <Info className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-blue-300">Apenas entregadores verificados terão acesso. Cobertura de até <strong>R$ {maxCoverage.toLocaleString('pt-BR')}</strong> em caso de problemas.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button type="button" onClick={() => setActiveTab('overview')}
                      className={`flex-1 py-3.5 rounded-xl font-bold border-2 transition-all ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={newDeliveryLoading || remaining <= 0}
                      className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                      {newDeliveryLoading ? <><Loader2 size={18} className="animate-spin" />A criar...</>
                        : remaining <= 0 ? 'Limite atingido'
                        : <>Criar Entrega <ArrowRight size={18} /></>}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-bold ${dk('text-white', 'text-gray-900')}`}>
                Histórico <span className={`text-sm font-normal ${dk('text-gray-400', 'text-gray-600')}`}>({completedDeliveries.length} concluídas)</span>
              </h2>
            </div>

            {completedDeliveries.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Total concluídas', value: completedDeliveries.length, icon: CheckCircle, color: 'emerald' },
                  { label: 'Valor total', value: `R$ ${completedDeliveries.reduce((s, d) => s + d.estimated_value, 0).toFixed(2)}`, icon: DollarSign, color: 'purple' },
                  { label: 'Entregadores únicos', value: new Set(completedDeliveries.map(d => d.deliverer_id).filter(Boolean)).size, icon: TrendingUp, color: 'blue' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className={`p-5 rounded-xl border ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200 shadow-sm')}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl bg-${color}-500/10`}>
                        <Icon className={`text-${color}-400`} size={20} />
                      </div>
                      <div>
                        <p className={`text-xs ${dk('text-gray-500', 'text-gray-600')}`}>{label}</p>
                        <p className={`text-xl font-bold ${dk('text-white', 'text-gray-900')}`}>{value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedDeliveries.length === 0 ? (
              <div className={`rounded-2xl border p-12 text-center ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200')}`}>
                <History className={`mx-auto mb-4 ${dk('text-gray-600', 'text-gray-300')}`} size={48} />
                <p className={`font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Nenhuma entrega concluída</p>
                <p className={`text-sm ${dk('text-gray-400', 'text-gray-600')}`}>As suas entregas concluídas aparecerão aqui</p>
              </div>
            ) : (
              <div className={`rounded-2xl border overflow-hidden ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200')}`}>
                <div className={`divide-y ${dk('divide-white/5', 'divide-gray-100')}`}>
                  {completedDeliveries.map(d => (
                    <div key={d.id} onClick={() => navigate(`/delivery/${d.id}`)}
                      className={`p-5 cursor-pointer transition-colors ${dk('hover:bg-white/5', 'hover:bg-gray-50')}`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="p-2.5 bg-emerald-500/10 rounded-xl flex-shrink-0">
                            <CheckCircle className="text-emerald-400" size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className={`font-bold truncate ${dk('text-white', 'text-gray-900')}`}>{d.item_type}</p>
                            <p className={`text-sm truncate ${dk('text-gray-400', 'text-gray-600')}`}>{d.destination_address}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {d.deliverer_name && <p className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>por {d.deliverer_name}</p>}
                              <p className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>{formatDate(d.updated_at)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-bold ${dk('text-emerald-400', 'text-emerald-600')}`}>R$ {d.estimated_value.toFixed(2)}</p>
                          <ChevronRight className={dk('text-gray-600', 'text-gray-400')} size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SUBSCRIPTION ── */}
        {activeTab === 'subscription' && (
          <div className="space-y-6">
            {subscription ? (
              <div className={`rounded-2xl border p-6 ${subscription.status === 'canceled' ? dk('bg-yellow-500/5 border-yellow-500/20', 'bg-yellow-50 border-yellow-200') : dk('bg-emerald-500/5 border-emerald-500/20', 'bg-emerald-50 border-emerald-200')}`}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <Star className="text-emerald-400" size={20} />
                      <h2 className={`font-bold text-lg ${dk('text-white', 'text-gray-900')}`}>Plano Atual</h2>
                      {STATUS_LABEL_SUB[subscription.status] && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_LABEL_SUB[subscription.status].color}`}>
                          {STATUS_LABEL_SUB[subscription.status].label}
                        </span>
                      )}
                    </div>
                    <p className={`text-2xl font-black ${dk('text-white', 'text-gray-900')}`}>{subscription.plan_name}</p>
                  </div>
                  <p className={`text-3xl font-black ${dk('text-white', 'text-gray-900')}`}>
                    R$ {subscription.price.toFixed(2)}<span className={`text-sm font-normal ${dk('text-gray-400', 'text-gray-600')}`}>/mês</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    { icon: Package, color: 'emerald', label: 'Usadas', value: subscription.current_usage + (subscription.max_deliveries < 999999 ? ` / ${subscription.max_deliveries}` : '') },
                    { icon: TrendingUp, color: 'blue', label: 'Disponíveis', value: subscription.max_deliveries >= 999999 ? 'Ilimitadas' : remaining },
                    { icon: Calendar, color: 'purple', label: 'Renovação', value: formatDate(subscription.renewal_date) },
                  ].map(({ icon: Icon, color, label, value }) => (
                    <div key={label} className={`flex items-center gap-3 p-3 rounded-xl ${dk('bg-white/3', 'bg-white/50')}`}>
                      <div className={`p-2 bg-${color}-500/10 rounded-lg`}><Icon className={`text-${color}-400`} size={18} /></div>
                      <div>
                        <p className={`text-xs ${dk('text-gray-500', 'text-gray-600')}`}>{label}</p>
                        <p className={`font-bold ${dk('text-white', 'text-gray-900')}`}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {subscription.max_deliveries < 999999 && (
                  <div className="mb-6">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Uso do plano</span><span>{usagePct}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${usagePct > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${usagePct}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {(subscription.status === 'active' || subscription.status === 'trialing') && (
                    <button onClick={() => setActiveTab('new')}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm ${dk('bg-emerald-500 text-black hover:bg-emerald-400', 'bg-emerald-600 text-white hover:bg-emerald-700')}`}>
                      <Truck size={16} /> Nova Entrega
                    </button>
                  )}
                  {subscription.status === 'canceled' ? (
                    <button onClick={handleReactivateSub} disabled={subActionLoading}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm ${dk('bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20', 'bg-blue-100 border border-blue-200 text-blue-700 hover:bg-blue-200')}`}>
                      {subActionLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Reativar
                    </button>
                  ) : (
                    <button onClick={handleCancelSub} disabled={subActionLoading}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm ${dk('bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20', 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100')}`}>
                      Cancelar Plano
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center">
                <Zap className="mx-auto mb-4 text-emerald-400" size={40} />
                <h2 className="text-2xl font-bold text-white mb-2">7 Dias Grátis!</h2>
                <p className="text-gray-400">Escolhe um plano e começa sem compromisso.</p>
              </div>
            )}

            <div>
              <h3 className={`text-xl font-bold mb-6 ${dk('text-white', 'text-gray-900')}`}>
                {subscription ? 'Mudar de Plano' : 'Planos Disponíveis'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {DEFAULT_PLANS.map(plan => {
                  const isCurrent = subscription?.plan_id === plan.id && (subscription?.status === 'active' || subscription?.status === 'trialing')
                  const colorMap = { blue: 'text-blue-400 bg-blue-500/10', emerald: 'text-emerald-400 bg-emerald-500/10', purple: 'text-purple-400 bg-purple-500/10' }
                  const [iconColor, iconBg] = colorMap[plan.color].split(' ')
                  return (
                    <div key={plan.id} className={`rounded-2xl border p-6 relative transition-all ${
                      plan.popular ? dk('border-emerald-500/40 bg-[#1a1a1a]', 'border-emerald-400 bg-white shadow-lg')
                      : isCurrent ? dk('border-blue-500/40 bg-[#1a1a1a]', 'border-blue-400 bg-white')
                      : dk('border-white/8 bg-[#1a1a1a] hover:border-white/15', 'border-gray-200 bg-white hover:border-gray-300')}`}>
                      {plan.popular && !isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-emerald-500 text-black text-xs font-black px-3 py-1 rounded-full">POPULAR</span>
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-blue-500 text-white text-xs font-black px-3 py-1 rounded-full">ATUAL</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2.5 rounded-xl ${iconBg}`}>
                          <Shield className={iconColor} size={20} />
                        </div>
                        <div>
                          <h4 className={`font-black text-lg ${dk('text-white', 'text-gray-900')}`}>{plan.name}</h4>
                          <p className={`text-xs ${dk('text-gray-500', 'text-gray-600')}`}>{plan.description}</p>
                        </div>
                      </div>
                      <div className="mb-1">
                        <span className={`text-3xl font-black ${dk('text-white', 'text-gray-900')}`}>R$ {plan.price.toFixed(2)}</span>
                        <span className={dk('text-gray-500', 'text-gray-500')}>/mês</span>
                      </div>
                      <p className={`text-xs mb-5 p-2.5 rounded-lg ${dk('bg-white/3 text-gray-400', 'bg-gray-50 text-gray-600')}`}>
                        {plan.max_deliveries >= 999999 ? '∞ Entregas ilimitadas' : `📦 Até ${plan.max_deliveries} entregas/mês`}
                      </p>
                      <ul className="space-y-2.5 mb-6">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                            <span className={`text-xs ${dk('text-gray-300', 'text-gray-700')}`}>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <button onClick={() => handleSelectPlan(plan)} disabled={subActionLoading || isCurrent}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                          isCurrent ? dk('bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                          : plan.popular ? 'bg-emerald-500 hover:bg-emerald-400 text-black hover:scale-[1.02]'
                          : dk('bg-white/8 hover:bg-white/14 text-white border border-white/10', 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200')}`}>
                        {subActionLoading ? <Loader2 size={16} className="animate-spin" />
                          : isCurrent ? <><CheckCircle size={14} /> Plano Atual</>
                          : <>Selecionar <ArrowRight size={14} /></>}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-bold ${dk('text-white', 'text-gray-900')}`}>
                Notificações
                {unreadCount > 0 && <span className="ml-2 text-sm text-gray-400 font-normal">({unreadCount} não lidas)</span>}
              </h2>
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  className={`text-sm flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all ${dk('border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10', 'border-emerald-400 text-emerald-700 hover:bg-emerald-50')}`}>
                  <CheckCircle size={14} /> Marcar todas como lidas
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className={`rounded-2xl border p-12 text-center ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200')}`}>
                <Bell className={`mx-auto mb-4 ${dk('text-gray-600', 'text-gray-300')}`} size={48} />
                <p className={`font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Nenhuma notificação</p>
                <p className={`text-sm ${dk('text-gray-400', 'text-gray-600')}`}>As suas notificações aparecerão aqui em tempo real</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map(n => (
                  <div key={n.id} onClick={() => { if (!n.read) markAsRead(n.id); if (n.delivery_id) navigate(`/delivery/${n.delivery_id}`) }}
                    className={`rounded-2xl border p-5 cursor-pointer transition-all group ${
                      n.read ? dk('border-white/5 bg-[#121212] hover:border-white/10', 'border-gray-200 bg-white hover:border-gray-300')
                             : dk('border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30', 'border-emerald-300 bg-emerald-50 hover:border-emerald-400')}`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-xl flex-shrink-0 ${n.read ? dk('bg-white/5', 'bg-gray-100') : dk('bg-emerald-500/10', 'bg-emerald-100')}`}>
                        <Bell className={n.read ? dk('text-gray-500', 'text-gray-400') : 'text-emerald-400'} size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className={`font-bold ${n.read ? dk('text-gray-300', 'text-gray-700') : dk('text-white', 'text-gray-900')}`}>{n.title}</p>
                          {!n.read && <div className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0 mt-1.5" />}
                        </div>
                        <p className={`text-sm mt-1 ${n.read ? dk('text-gray-500', 'text-gray-500') : dk('text-gray-300', 'text-gray-600')}`}>{n.message}</p>
                        <div className="flex items-center justify-between mt-3">
                          <p className={`text-xs ${dk('text-gray-600', 'text-gray-400')}`}>
                            {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <button onClick={e => { e.stopPropagation(); deleteNotification(n.id) }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-500/10 rounded-lg text-red-400">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}