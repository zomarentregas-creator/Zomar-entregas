// src/pages/Subscriptionpage.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle, Zap, Building2, Star,
  ChevronRight, Loader2, Shield, Phone,
  AlertCircle, X, RefreshCw, CreditCard,
  Info, ArrowLeft, Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  processPayment, detectProvider, validatePhone, formatPhone,
  isSandbox, recordPaymentTransaction,
  type PaymentProvider, type PaymentResult,
} from '../lib/e2payments'

// ─── Planos ────────────────────────────────────────────────────────────────────

interface Plan {
  id:           string
  name:         string
  price:        number          // MZN/mês
  deliveries:   number | null   // null = ilimitado
  badge?:       string
  color:        string
  features:     string[]
  icon:         React.ReactNode
}

const PLANS: Plan[] = [
  {
    id:         'basic',
    name:       'Básico',
    price:      750,
    deliveries: 30,
    color:      'emerald',
    icon:       <Zap size={20}/>,
    features: [
      '30 entregas/mês incluídas',
      'Entregas extra: 28 MZN cada',
      'Cobertura até 30.000 MZN',
      'Suporte por e-mail (24h)',
      'Rastreamento básico',
      'Relatórios mensais',
    ],
  },
  {
    id:         'professional',
    name:       'Profissional',
    price:      2200,
    deliveries: 100,
    badge:      'POPULAR',
    color:      'blue',
    icon:       <Star size={20}/>,
    features: [
      '100 entregas/mês incluídas',
      'Entregas extra: 22 MZN cada',
      'Cobertura até 100.000 MZN',
      'Suporte prioritário (12h)',
      'Rastreamento em tempo real',
      'Relatórios semanais',
      'API de integração básica',
    ],
  },
  {
    id:         'enterprise',
    name:       'Empresarial',
    price:      3800,
    deliveries: null,
    badge:      'RECOMENDADO',
    color:      'purple',
    icon:       <Building2 size={20}/>,
    features: [
      'Entregas ilimitadas',
      'Cobertura até 500.000 MZN',
      'Suporte 24/7 dedicado',
      'Rastreamento avançado',
      'Relatórios personalizados',
      'API completa',
      'Gestor de conta dedicado',
    ],
  },
]

const COLOR_MAP: Record<string, {
  badge:   string
  button:  string
  bg:      string
  border:  string
  text:    string
  icon:    string
}> = {
  emerald: {
    badge:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    button: 'bg-emerald-500 hover:bg-emerald-400 text-black',
    bg:     'bg-emerald-500/8',
    border: 'border-emerald-500/25',
    text:   'text-emerald-400',
    icon:   'bg-emerald-500/15 text-emerald-400',
  },
  blue: {
    badge:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
    button: 'bg-blue-500 hover:bg-blue-400 text-white',
    bg:     'bg-blue-500/8',
    border: 'border-blue-500/30',
    text:   'text-blue-400',
    icon:   'bg-blue-500/15 text-blue-400',
  },
  purple: {
    badge:  'bg-purple-500/15 text-purple-400 border-purple-500/20',
    button: 'bg-purple-500 hover:bg-purple-400 text-white',
    bg:     'bg-purple-500/8',
    border: 'border-purple-500/25',
    text:   'text-purple-400',
    icon:   'bg-purple-500/15 text-purple-400',
  },
  orange: {
    badge:  'bg-orange-500/15 text-orange-400 border-orange-500/20',
    button: 'bg-orange-500 hover:bg-orange-400 text-white',
    bg:     'bg-orange-500/8',
    border: 'border-orange-500/25',
    text:   'text-orange-400',
    icon:   'bg-orange-500/15 text-orange-400',
  },
}

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

const PROVIDER_LABELS: Record<PaymentProvider, { label: string; color: string; prefix: string }> = {
  mpesa: { label: 'M-Pesa',  color: 'text-red-400',    prefix: '84/85' },
  emola: { label: 'e-Mola',  color: 'text-blue-400',   prefix: '86/87' },
  mkesh: { label: 'M-Kesh',  color: 'text-yellow-400', prefix: '83'    },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem('entrepreneur_theme') !== 'light'
  )
  useEffect(() => {
    const h = () => setIsDarkMode(localStorage.getItem('entrepreneur_theme') !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  // Estado actual da subscrição
  const [currentSub, setCurrentSub]   = useState<any | null>(null)
  const [loadingSub,  setLoadingSub]  = useState(true)

  // Fluxo de pagamento
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [step,         setStep]         = useState<'plans' | 'payment' | 'processing' | 'success' | 'error'>('plans')
  const [phone,        setPhone]        = useState('')
  const [phoneInfo,    setPhoneInfo]    = useState<{ valid: boolean; provider: PaymentProvider | null; message: string } | null>(null)
  const [processing,   setProcessing]  = useState(false)
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [errorMsg,     setErrorMsg]    = useState('')

  const dk = (dark: string, light: string) => isDarkMode ? dark : light
  const card = `rounded-2xl border ${dk('bg-[#1a1a1a] border-white/8', 'bg-white border-gray-200 shadow-sm')}`

  // ── Carregar subscrição actual ─────────────────────────────────────────────
  const loadSub = useCallback(async () => {
    if (!user?.id) return
    setLoadingSub(true)
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()
      setCurrentSub(data || null)
    } catch { setCurrentSub(null) }
    finally { setLoadingSub(false) }
  }, [user?.id])

  useEffect(() => { loadSub() }, [loadSub])

  // ── Validar telefone ao escrever ───────────────────────────────────────────
  useEffect(() => {
    if (!phone) { setPhoneInfo(null); return }
    const clean = formatPhone(phone)
    if (clean.length >= 2) setPhoneInfo(validatePhone(phone))
    else setPhoneInfo(null)
  }, [phone])

  // ── Seleccionar plano → ir para pagamento ──────────────────────────────────
  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan)
    setStep('payment')
    setPhone('')
    setPhoneInfo(null)
    setPaymentResult(null)
    setErrorMsg('')
  }

  // ── Processar pagamento ────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!selectedPlan || !user?.id || !phoneInfo?.valid) return
    setProcessing(true)
    setStep('processing')

    try {
      const reference = `ZOMAR-${selectedPlan.id.toUpperCase()}-${user.id.slice(0, 6).toUpperCase()}-${Date.now()}`

      const result = await processPayment({
        phone:     formatPhone(phone),
        amount:    selectedPlan.price,
        reference,
        provider:  phoneInfo.provider || undefined,
      })

      setPaymentResult(result)

      if (result.success) {
        // Registar pagamento no Supabase
        await recordPaymentTransaction({
          userId:        user.id,
          provider:      result.provider,
          amount:        selectedPlan.price,
          phone:         formatPhone(phone),
          reference,
          transactionId: result.transactionId || reference,
          status:        'completed',
        })

        // Criar/actualizar subscrição
        const now       = new Date()
        const endDate   = new Date(now); endDate.setMonth(endDate.getMonth() + 1)
        const renewDate = new Date(endDate); renewDate.setDate(renewDate.getDate() - 3)

        // Cancelar plano activo anterior se existir
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('user_id', user.id)
          .eq('status', 'active')

        // Criar nova subscrição
        await supabase.from('subscriptions').insert({
          user_id:        user.id,
          plan_id:        selectedPlan.id,
          plan_name:      selectedPlan.name,
          price:          selectedPlan.price,
          status:         'active',
          max_deliveries: selectedPlan.deliveries || 0,
          current_usage:  0,
          start_date:     now.toISOString(),
          end_date:       endDate.toISOString(),
          renewal_date:   renewDate.toISOString(),
        })

        // Audit log — falha silenciosa, não bloqueia o fluxo
        try {
          await supabase.from('activity_logs').insert({
            user_id:     user.id,
            actor_id:    user.id,
            action:      'subscription_created',
            entity_type: 'subscription',
            metadata:    {
              plan:     selectedPlan.id,
              price:    selectedPlan.price,
              provider: result.provider,
              tx_id:    result.transactionId,
            },
          })
        } catch { /* silencioso */ }

        setStep('success')
        loadSub()
      } else {
        setErrorMsg(result.message || 'Pagamento não foi processado.')
        setStep('error')
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Erro inesperado. Tenta novamente.')
      setStep('error')
    } finally {
      setProcessing(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        {step !== 'plans' && (
          <button onClick={() => setStep('plans')}
            className={`p-2 rounded-xl ${dk('hover:bg-white/8 text-gray-400', 'hover:bg-gray-100 text-gray-500')}`}>
            <ArrowLeft size={18}/>
          </button>
        )}
        <div>
          <h2 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>
            {step === 'plans' ? 'Escolhe o teu Plano' :
             step === 'payment' ? 'Pagamento' :
             step === 'processing' ? 'A processar…' :
             step === 'success' ? 'Pagamento Confirmado!' : 'Erro no Pagamento'}
          </h2>
          <p className={`text-sm mt-0.5 ${dk('text-gray-400', 'text-gray-500')}`}>
            {step === 'plans' ? '7 dias grátis em todos os planos · Cancela quando quiseres' : ''}
          </p>
        </div>
      </div>

      {/* Banner sandbox */}
      {isSandbox() && (
        <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${dk('bg-yellow-500/8 border-yellow-500/20', 'bg-yellow-50 border-yellow-200')}`}>
          <Info size={15} className="text-yellow-400 flex-shrink-0"/>
          <p className={`text-xs ${dk('text-yellow-300', 'text-yellow-700')}`}>
            <strong>Modo Sandbox activo</strong> — Os pagamentos são simulados. Nenhum dinheiro real será cobrado.
            Para produção, configura as variáveis <code className="font-mono">VITE_E2PAY_*</code> no <code className="font-mono">.env</code>.
          </p>
        </div>
      )}

      {/* Plano actual */}
      {step === 'plans' && !loadingSub && currentSub && (
        <div className={`${card} p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${dk('bg-emerald-500/15', 'bg-emerald-50')}`}>
              <CheckCircle size={15} className="text-emerald-400"/>
            </div>
            <div>
              <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>
                Plano {currentSub.plan_name} activo
              </p>
              <p className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>
                {currentSub.current_usage}/{currentSub.max_deliveries || '∞'} entregas · renova {
                  currentSub.renewal_date
                    ? new Date(currentSub.renewal_date).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })
                    : '—'
                }
              </p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${dk('bg-emerald-500/15 text-emerald-400 border-emerald-500/20', 'bg-emerald-50 text-emerald-700 border-emerald-200')}`}>
            Activo
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP: PLANOS
      ══════════════════════════════════════════════════════ */}
      {step === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map(plan => {
            const c   = COLOR_MAP[plan.color]
            const isCurrent = currentSub?.plan_id === plan.id

            return (
              <div key={plan.id}
                className={`${card} p-6 flex flex-col relative ${plan.badge ? dk(`border-2 ${c.border}`, `border-2 ${c.border}`) : ''}`}>

                {/* Badge */}
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${c.badge}`}>
                    {plan.badge}
                  </div>
                )}

                {/* Ícone + nome */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${c.icon}`}>
                  {plan.icon}
                </div>
                <h3 className={`text-lg font-black ${dk('text-white', 'text-gray-900')}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-3xl font-black ${c.text}`}>{fmtMZN(plan.price)}</span>
                  <span className={`text-sm ${dk('text-gray-500', 'text-gray-400')}`}>/mês</span>
                </div>
                <p className={`text-xs mb-5 ${dk('text-gray-500', 'text-gray-400')}`}>
                  {plan.deliveries ? `${plan.deliveries} entregas incluídas` : 'Entregas ilimitadas'}
                </p>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle size={13} className={`flex-shrink-0 mt-0.5 ${c.text}`}/>
                      <span className={`text-xs ${dk('text-gray-300', 'text-gray-700')}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Botão */}
                {isCurrent ? (
                  <div className={`w-full py-3 rounded-xl text-center text-sm font-semibold ${dk('bg-white/5 text-gray-400', 'bg-gray-100 text-gray-500')}`}>
                    Plano actual
                  </div>
                ) : (
                  <button onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${c.button}`}>
                    {currentSub ? 'Mudar para este plano' : 'Começar — 7 dias grátis'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP: PAGAMENTO
      ══════════════════════════════════════════════════════ */}
      {step === 'payment' && selectedPlan && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Resumo do plano */}
          <div className={`${card} p-5`}>
            <h3 className={`font-bold mb-4 ${dk('text-white', 'text-gray-900')}`}>Resumo</h3>
            <div className={`p-4 rounded-xl ${dk('bg-white/4', 'bg-gray-50')}`}>
              <div className="flex justify-between mb-3">
                <span className={`text-sm ${dk('text-gray-400', 'text-gray-600')}`}>Plano</span>
                <span className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between mb-3">
                <span className={`text-sm ${dk('text-gray-400', 'text-gray-600')}`}>Período</span>
                <span className={`text-sm ${dk('text-gray-300', 'text-gray-700')}`}>Mensal</span>
              </div>
              <div className={`flex justify-between pt-3 border-t ${dk('border-white/8', 'border-gray-200')}`}>
                <span className={`font-bold ${dk('text-white', 'text-gray-900')}`}>Total</span>
                <span className={`text-xl font-black ${COLOR_MAP[selectedPlan.color].text}`}>
                  {fmtMZN(selectedPlan.price)}
                </span>
              </div>
            </div>

            <div className={`mt-4 flex items-start gap-2 p-3 rounded-xl text-xs ${dk('bg-blue-500/8 border border-blue-500/15 text-blue-300', 'bg-blue-50 border border-blue-200 text-blue-700')}`}>
              <Shield size={13} className="flex-shrink-0 mt-0.5"/>
              Pagamento seguro processado pelo e2Payments. O teu número é encriptado e nunca é partilhado.
            </div>
          </div>

          {/* Formulário de pagamento */}
          <div className={`${card} p-5`}>
            <h3 className={`font-bold mb-1 ${dk('text-white', 'text-gray-900')}`}>Método de Pagamento</h3>
            <p className={`text-xs mb-5 ${dk('text-gray-500', 'text-gray-400')}`}>
              M-Pesa (84/85), e-Mola (86/87), M-Kesh (83) — o operador é detectado automaticamente
            </p>

            {/* Input do número */}
            <div className="mb-4">
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${dk('text-gray-400', 'text-gray-500')}`}>
                Número de Telemóvel
              </label>
              <div className="relative">
                <div className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono ${dk('text-gray-500', 'text-gray-400')}`}>
                  +258
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
                  placeholder="84 XXX XXXX"
                  maxLength={9}
                  className={`w-full pl-12 pr-4 py-3 rounded-xl text-sm border outline-none transition-all font-mono tracking-wider ${
                    phoneInfo?.valid === false
                      ? dk('bg-red-500/5 border-red-500/40 text-white', 'bg-red-50 border-red-300 text-gray-900')
                      : phoneInfo?.valid === true
                        ? dk('bg-emerald-500/5 border-emerald-500/40 text-white', 'bg-emerald-50 border-emerald-300 text-gray-900')
                        : dk('bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-orange-500/50', 'bg-gray-50 border-gray-200 text-gray-900 focus:border-orange-400')
                  }`}
                />
                {phoneInfo?.valid && (
                  <CheckCircle size={15} className={`absolute right-3 top-1/2 -translate-y-1/2 ${PROVIDER_LABELS[phoneInfo.provider!]?.color}`}/>
                )}
              </div>

              {/* Feedback do número */}
              {phoneInfo && (
                <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${
                  phoneInfo.valid
                    ? (phoneInfo.provider ? PROVIDER_LABELS[phoneInfo.provider].color : 'text-emerald-400')
                    : 'text-red-400'
                }`}>
                  {phoneInfo.valid ? <CheckCircle size={11}/> : <AlertCircle size={11}/>}
                  {phoneInfo.valid && phoneInfo.provider
                    ? `${PROVIDER_LABELS[phoneInfo.provider].label} detectado`
                    : phoneInfo.message}
                </div>
              )}
            </div>

            {/* Logos dos operadores */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {(Object.entries(PROVIDER_LABELS) as [PaymentProvider, typeof PROVIDER_LABELS[PaymentProvider]][]).map(([key, val]) => (
                <div key={key}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    phoneInfo?.provider === key
                      ? dk(`${COLOR_MAP[key === 'mpesa' ? 'orange' : key === 'emola' ? 'blue' : 'orange'].border} ${COLOR_MAP[key === 'mpesa' ? 'orange' : key === 'emola' ? 'blue' : 'orange'].bg}`, `border-orange-300 bg-orange-50`)
                      : dk('border-white/8 bg-white/3', 'border-gray-200 bg-gray-50')
                  }`}>
                  <p className={`text-xs font-bold ${val.color}`}>{val.label}</p>
                  <p className={`text-[10px] ${dk('text-gray-600', 'text-gray-400')}`}>{val.prefix}xxx</p>
                </div>
              ))}
            </div>

            {/* Botão pagar */}
            <button
              onClick={handlePay}
              disabled={!phoneInfo?.valid || processing}
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 ${
                COLOR_MAP[selectedPlan.color].button
              }`}>
              {processing
                ? <><Loader2 size={16} className="animate-spin"/> A processar…</>
                : <><CreditCard size={16}/> Pagar {fmtMZN(selectedPlan.price)}</>
              }
            </button>

            <p className={`text-center text-xs mt-3 ${dk('text-gray-600', 'text-gray-400')}`}>
              Ao pagar, recebes um pedido de confirmação no telemóvel.
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP: A PROCESSAR
      ══════════════════════════════════════════════════════ */}
      {step === 'processing' && selectedPlan && (
        <div className={`${card} py-16 text-center`}>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${dk('bg-orange-500/15', 'bg-orange-50')}`}>
            <Loader2 size={28} className="text-orange-400 animate-spin"/>
          </div>
          <h3 className={`text-lg font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>A processar o pagamento</h3>
          <p className={`text-sm ${dk('text-gray-400', 'text-gray-500')}`}>
            Verifica o teu telemóvel e confirma o pagamento de <strong>{fmtMZN(selectedPlan.price)}</strong>
          </p>
          {isSandbox() && (
            <p className={`text-xs mt-3 ${dk('text-gray-600', 'text-gray-400')}`}>
              Modo sandbox — a simular confirmação automática…
            </p>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP: SUCESSO
      ══════════════════════════════════════════════════════ */}
      {step === 'success' && selectedPlan && paymentResult && (
        <div className={`${card} py-14 px-8 text-center`}>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${dk('bg-emerald-500/15', 'bg-emerald-50')}`}>
            <CheckCircle size={28} className="text-emerald-400"/>
          </div>
          <h3 className={`text-xl font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Plano activado!</h3>
          <p className={`text-sm mb-6 ${dk('text-gray-400', 'text-gray-500')}`}>
            O plano <strong>{selectedPlan.name}</strong> foi activado com sucesso via <strong>{paymentResult.provider.toUpperCase()}</strong>.
          </p>

          {paymentResult.transactionId && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono mb-6 ${dk('bg-white/5 text-gray-400', 'bg-gray-100 text-gray-600')}`}>
              <Clock size={12}/> Ref: {paymentResult.transactionId}
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button onClick={() => setStep('plans')}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium border ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
              Ver planos
            </button>
            <button onClick={() => navigate('/entrepreneur/overview')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-black">
              Ir para o painel <ChevronRight size={14}/>
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP: ERRO
      ══════════════════════════════════════════════════════ */}
      {step === 'error' && (
        <div className={`${card} py-14 px-8 text-center`}>
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${dk('bg-red-500/15', 'bg-red-50')}`}>
            <AlertCircle size={28} className="text-red-400"/>
          </div>
          <h3 className={`text-lg font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Pagamento não processado</h3>
          <p className={`text-sm mb-6 ${dk('text-gray-400', 'text-gray-500')}`}>{errorMsg || 'Tenta novamente ou contacta o suporte.'}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setStep('plans')}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium border ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
              Voltar aos planos
            </button>
            <button onClick={() => { setStep('payment'); setErrorMsg('') }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-400 text-white">
              <RefreshCw size={14}/> Tentar novamente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}