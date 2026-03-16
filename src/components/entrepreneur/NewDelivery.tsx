// src/components/entrepreneur/NewDelivery.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Package, DollarSign, Shield,
  AlertCircle, CheckCircle, ArrowRight,
  Info, Truck, Lock, Loader2, KeyRound, Copy,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Cobertura por plano ──────────────────────────────────────────────────────
const PLAN_COVERAGE: Record<string, number> = {
  basic:        30_000,
  professional: 100_000,
  enterprise:   500_000,
}
const DEFAULT_COVERAGE = 30_000

const fmtMZN = (v: number) =>
  v.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 })

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActiveSubscription {
  id:             string
  plan_id:        string
  plan_name:      string
  max_deliveries: number
  current_usage:  number
  renewal_date:   string | null
  end_date:       string | null
  status:         string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewDelivery() {
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem('entrepreneur_theme') !== 'light'
  )
  useEffect(() => {
    const h = () => setIsDarkMode(localStorage.getItem('entrepreneur_theme') !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [])

  // Formulário
  const [itemType,            setItemType]            = useState('')
  const [originAddress,       setOriginAddress]       = useState('')
  const [destinationAddress,  setDestinationAddress]  = useState('')
  const [estimatedValue,      setEstimatedValue]      = useState('')
  const [notes,               setNotes]               = useState('')

  // Estado
  const [loading,       setLoading]       = useState(false)
  const [checkingPlan,  setCheckingPlan]  = useState(true)
  const [subscription,  setSubscription]  = useState<ActiveSubscription | null>(null)
  const [error,         setError]         = useState<string | null>(null)

  // Pós-criação — mostrar código
  const [createdId,     setCreatedId]     = useState<string | null>(null)
  const [deliveryCode,  setDeliveryCode]  = useState<string | null>(null)
  const [codeCopied,    setCodeCopied]    = useState(false)

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  // ── Carregar subscrição activa ─────────────────────────────────────────────
  const loadSub = useCallback(async () => {
    if (!user?.id) return
    setCheckingPlan(true)
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('id, plan_id, plan_name, max_deliveries, current_usage, renewal_date, end_date, status')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setSubscription(data || null)
    } catch { setSubscription(null) }
    finally { setCheckingPlan(false) }
  }, [user?.id])

  useEffect(() => { loadSub() }, [loadSub])

  // Realtime — atualizar se subscrição mudar
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase.channel('nd-sub')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'subscriptions',
        filter: `user_id=eq.${user.id}`,
      }, loadSub)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.id, loadSub])

  // ── Helpers de cobertura ───────────────────────────────────────────────────
  const maxCoverage       = subscription ? (PLAN_COVERAGE[subscription.plan_id] ?? DEFAULT_COVERAGE) : DEFAULT_COVERAGE
  const deliveriesUsed    = subscription?.current_usage  ?? 0
  const deliveriesTotal   = subscription?.max_deliveries ?? 0
  const remainingDels     = Math.max(0, deliveriesTotal - deliveriesUsed)
  const usagePct          = deliveriesTotal > 0 && deliveriesTotal < 999999
    ? Math.min(100, Math.round((deliveriesUsed / deliveriesTotal) * 100)) : 0

  // ── Validação ──────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!itemType.trim())            return 'Tipo de item é obrigatório.'
    if (!originAddress.trim())       return 'Endereço de origem é obrigatório.'
    if (!destinationAddress.trim())  return 'Endereço de destino é obrigatório.'
    const val = parseFloat(estimatedValue)
    if (!estimatedValue || isNaN(val) || val <= 0) return 'Valor estimado inválido.'
    if (val > maxCoverage) return `Valor excede a cobertura do plano (máx: ${fmtMZN(maxCoverage)}).`
    return null
  }

  // ── Submeter ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const err = validate()
    if (err) { setError(err); return }
    if (!subscription) { setError('Nenhum plano activo encontrado.'); return }
    if (deliveriesTotal > 0 && remainingDels <= 0) {
      setError('Limite de entregas do plano atingido este mês.')
      return
    }

    setLoading(true)
    try {
      // ── Criar entrega com status 'accepted' (visível a entregadores) ──────
      const { data: delivery, error: dErr } = await supabase
        .from('deliveries')
        .insert({
          entrepreneur_id:     user!.id,
          item_type:           itemType.trim(),
          origin_address:      originAddress.trim(),
          destination_address: destinationAddress.trim(),
          estimated_value:     parseFloat(estimatedValue),
          notes:               notes.trim() || null,
          current_status:      'accepted',   // ← status correcto do schema real
        })
        .select('id, delivery_code')
        .single()
      if (dErr) throw dErr

      // ── Incrementar uso da subscrição ─────────────────────────────────────
      if (subscription && deliveriesTotal > 0) {
        await supabase.from('subscriptions')
          .update({ current_usage: deliveriesUsed + 1 })
          .eq('id', subscription.id)
      }

      // ── Checkpoint inicial ────────────────────────────────────────────────
      try {
        await supabase.from('delivery_checkpoints').insert({
          delivery_id:  delivery.id,
          status:       'accepted',
          description:  'Entrega criada e disponível para entregadores',
          created_at:   new Date().toISOString(),
        })
      } catch { /* silencioso */ }

      // ── Mostrar código gerado ─────────────────────────────────────────────
      setCreatedId(delivery.id)
      setDeliveryCode(delivery.delivery_code || null)

    } catch (e: any) {
      // Tratar erros de rate limit do trigger SQL
      if (e.message?.includes('RATE_LIMIT_HOUR')) {
        setError('Limite por hora atingido. Aguarda antes de criar mais entregas.')
      } else if (e.message?.includes('RATE_LIMIT_DAY')) {
        setError('Limite diário atingido.')
      } else {
        setError(e.message || 'Erro ao criar entrega. Tenta novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    if (!deliveryCode) return
    navigator.clipboard.writeText(deliveryCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  // ── Ecrã de loading do plano ───────────────────────────────────────────────
  if (checkingPlan) return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className={`animate-spin h-10 w-10 mx-auto mb-4 ${dk('text-emerald-400', 'text-emerald-600')}`}/>
        <p className={`text-sm ${dk('text-gray-400', 'text-gray-500')}`}>A verificar plano activo…</p>
      </div>
    </div>
  )

  // ── Sem plano ──────────────────────────────────────────────────────────────
  if (!subscription) return (
    <div className="max-w-2xl mx-auto">
      <div className={`rounded-2xl border p-8 text-center ${dk('bg-[#121212] border-red-500/20', 'bg-white border-red-200 shadow-sm')}`}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${dk('bg-red-500/10', 'bg-red-50')}`}>
          <Lock className="text-red-400" size={28}/>
        </div>
        <h2 className={`text-xl font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Plano Necessário</h2>
        <p className={`text-sm mb-6 ${dk('text-gray-400', 'text-gray-500')}`}>
          Precisas de um plano activo para criar entregas protegidas.
        </p>
        <button onClick={() => navigate('/entrepreneur/subscription')}
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all">
          Ver Planos Disponíveis
        </button>
      </div>
    </div>
  )

  // ── Ecrã de sucesso com código ─────────────────────────────────────────────
  if (createdId) return (
    <div className="max-w-lg mx-auto space-y-4 py-4">
      <div className={`rounded-2xl border p-6 text-center ${dk('bg-[#1a1a1a] border-emerald-500/20', 'bg-white border-emerald-200 shadow-sm')}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${dk('bg-emerald-500/15', 'bg-emerald-50')}`}>
          <CheckCircle size={28} className="text-emerald-400"/>
        </div>
        <h2 className={`text-xl font-bold mb-1 ${dk('text-white', 'text-gray-900')}`}>Entrega criada!</h2>
        <p className={`text-sm ${dk('text-gray-400', 'text-gray-500')}`}>
          Já está disponível para entregadores. Guarda o código abaixo.
        </p>
      </div>

      {/* Código de confirmação */}
      {deliveryCode && (
        <div className={`rounded-2xl border p-6 ${dk('bg-[#1a1a1a] border-white/8', 'bg-white border-gray-200 shadow-sm')}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`p-2 rounded-lg ${dk('bg-orange-500/15', 'bg-orange-50')}`}>
              <KeyRound size={15} className="text-orange-400"/>
            </div>
            <div>
              <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>Código de Confirmação</p>
              <p className={`text-xs ${dk('text-gray-500', 'text-gray-400')}`}>
                O entregador precisa deste código para concluir a entrega
              </p>
            </div>
          </div>

          <div className={`rounded-xl border-2 border-dashed p-5 text-center mb-4 ${dk('border-orange-500/30 bg-orange-500/5', 'border-orange-300 bg-orange-50')}`}>
            <p className={`text-4xl font-black tracking-[0.3em] ${dk('text-orange-400', 'text-orange-600')}`}>
              {deliveryCode}
            </p>
          </div>

          <button onClick={copyCode}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              codeCopied
                ? dk('bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                : dk('bg-white/8 hover:bg-white/15 text-white border border-white/10', 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200')
            }`}>
            {codeCopied ? <><CheckCircle size={14}/> Copiado!</> : <><Copy size={14}/> Copiar código</>}
          </button>

          <div className={`mt-3 flex items-start gap-2 p-3 rounded-xl text-xs ${dk('bg-yellow-500/8 border border-yellow-500/15 text-yellow-300', 'bg-yellow-50 border border-yellow-200 text-yellow-700')}`}>
            <Shield size={12} className="flex-shrink-0 mt-0.5"/>
            Partilha este código <strong>apenas com o entregador</strong> no momento da entrega ao destinatário.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => { setCreatedId(null); setDeliveryCode(null); setItemType(''); setOriginAddress(''); setDestinationAddress(''); setEstimatedValue(''); setNotes('') }}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
          <RefreshCw size={14}/> Nova Entrega
        </button>
        <button onClick={() => navigate('/entrepreneur/active-deliveries')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold ${dk('bg-emerald-500 hover:bg-emerald-400 text-black', 'bg-emerald-600 hover:bg-emerald-700 text-white')}`}>
          Ver Activas <ArrowRight size={14}/>
        </button>
      </div>
    </div>
  )

  // ── Formulário ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Banner do plano */}
      <div className={`rounded-2xl border p-6 ${dk('bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-emerald-500/20', 'bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200')}`}>
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${dk('bg-emerald-500/20', 'bg-emerald-100')}`}>
              <Shield className="text-emerald-400" size={22}/>
            </div>
            <div>
              <h3 className={`font-bold text-lg ${dk('text-white', 'text-gray-900')}`}>{subscription.plan_name}</h3>
              <p className={`text-sm mt-0.5 ${dk('text-gray-400', 'text-gray-500')}`}>
                {deliveriesTotal > 0 && deliveriesTotal < 999999
                  ? <><span className={`font-bold ${dk('text-emerald-400', 'text-emerald-600')}`}>{remainingDels}</span> de {deliveriesTotal} entregas restantes</>
                  : <span className={dk('text-emerald-400', 'text-emerald-600')}>Entregas ilimitadas</span>
                }
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-xs uppercase tracking-wider ${dk('text-gray-500', 'text-gray-400')}`}>Cobertura máx.</p>
            <p className={`text-xl font-black ${dk('text-white', 'text-gray-900')}`}>{fmtMZN(maxCoverage)}</p>
          </div>
        </div>

        {deliveriesTotal > 0 && deliveriesTotal < 999999 && (
          <div>
            <div className={`flex justify-between text-xs mb-1 ${dk('text-gray-500', 'text-gray-400')}`}>
              <span>Uso do plano</span><span>{usagePct}%</span>
            </div>
            <div className={`w-full rounded-full h-2 ${dk('bg-white/10', 'bg-gray-200')}`}>
              <div className={`h-2 rounded-full transition-all duration-500 ${usagePct > 80 ? 'bg-red-500' : usagePct > 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                style={{ width: `${usagePct}%` }}/>
            </div>
            {remainingDels <= 5 && remainingDels > 0 && (
              <p className={`text-xs mt-1.5 ${dk('text-yellow-400', 'text-yellow-600')}`}>
                ⚠ Apenas {remainingDels} entrega{remainingDels !== 1 ? 's' : ''} restante{remainingDels !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit}
        className={`rounded-2xl border p-8 space-y-6 ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200 shadow-sm')}`}>

        <h2 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>Nova Entrega Protegida</h2>

        {error && (
          <div className={`p-4 rounded-xl flex items-start gap-3 ${dk('bg-red-500/10 border border-red-500/20', 'bg-red-50 border border-red-200')}`}>
            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16}/>
            <p className={`text-sm ${dk('text-red-300', 'text-red-700')}`}>{error}</p>
          </div>
        )}

        {/* Tipo */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${dk('text-gray-400', 'text-gray-600')}`}>
            Tipo de Item <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Package className={`absolute left-4 top-1/2 -translate-y-1/2 ${dk('text-gray-500', 'text-gray-400')}`} size={16}/>
            <input type="text" value={itemType} onChange={e => setItemType(e.target.value)}
              placeholder="Ex: Roupas, Electrónicos, Documentos…"
              className={`w-full pl-11 pr-4 py-3 rounded-xl border outline-none transition-all text-sm ${dk('bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500/50', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:bg-white shadow-sm')}`}/>
          </div>
        </div>

        {/* Rota */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { label: 'Endereço de Origem', value: originAddress, setter: setOriginAddress, color: 'text-emerald-400', placeholder: 'Rua, número, bairro…' },
            { label: 'Endereço de Destino', value: destinationAddress, setter: setDestinationAddress, color: 'text-orange-400', placeholder: 'Rua, número, bairro…' },
          ].map(({ label, value, setter, color, placeholder }) => (
            <div key={label}>
              <label className={`block text-sm font-medium mb-2 ${dk('text-gray-400', 'text-gray-600')}`}>
                {label} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 flex-shrink-0 ${color}`} size={16}/>
                <input type="text" value={value} onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border outline-none transition-all text-sm ${dk('bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500/50', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:bg-white shadow-sm')}`}/>
              </div>
            </div>
          ))}
        </div>

        {/* Valor */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${dk('text-gray-400', 'text-gray-600')}`}>
            Valor Estimado (MZN) <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <DollarSign className={`absolute left-4 top-1/2 -translate-y-1/2 ${dk('text-gray-500', 'text-gray-400')}`} size={16}/>
            <input type="number" step="1" min="1" max={maxCoverage}
              value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)}
              placeholder="0"
              className={`w-full pl-11 pr-4 py-3 rounded-xl border outline-none transition-all text-sm ${dk('bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500/50', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:bg-white shadow-sm')}`}/>
          </div>
          <p className={`text-xs mt-1 ${dk('text-gray-600', 'text-gray-400')}`}>
            Cobertura máxima: <span className={`font-medium ${dk('text-emerald-400', 'text-emerald-600')}`}>{fmtMZN(maxCoverage)}</span>
          </p>
        </div>

        {/* Notas */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${dk('text-gray-400', 'text-gray-600')}`}>
            Notas <span className={`text-xs font-normal ${dk('text-gray-600', 'text-gray-400')}`}>(opcional)</span>
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Instruções especiais, horário preferido, código de acesso…"
            rows={3}
            className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-sm resize-none ${dk('bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500/50', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:bg-white shadow-sm')}`}/>
        </div>

        {/* Info código */}
        <div className={`flex items-start gap-3 p-4 rounded-xl ${dk('bg-blue-500/8 border border-blue-500/15', 'bg-blue-50 border border-blue-200')}`}>
          <Info className="text-blue-400 flex-shrink-0 mt-0.5" size={16}/>
          <p className={`text-sm leading-relaxed ${dk('text-blue-300', 'text-blue-700')}`}>
            Um <strong>código de 6 dígitos</strong> é gerado automaticamente ao criar a entrega.
            Partilha-o com o entregador — é necessário para confirmar a conclusão.
          </p>
        </div>

        {/* Botões */}
        <div className="flex gap-4">
          <button type="button" onClick={() => navigate('/entrepreneur/overview')} disabled={loading}
            className={`flex-1 py-3.5 rounded-xl font-bold border transition-all disabled:opacity-50 ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
            Cancelar
          </button>
          <button type="submit"
            disabled={loading || (deliveriesTotal > 0 && deliveriesTotal < 999999 && remainingDels <= 0)}
            className={`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 ${dk('bg-emerald-500 hover:bg-emerald-400 text-black', 'bg-emerald-600 hover:bg-emerald-700 text-white')}`}>
            {loading
              ? <><Loader2 size={16} className="animate-spin"/> A criar…</>
              : deliveriesTotal > 0 && deliveriesTotal < 999999 && remainingDels <= 0
                ? 'Limite atingido'
                : <><Truck size={16}/> Criar Entrega <ArrowRight size={16}/></>
            }
          </button>
        </div>
      </form>
    </div>
  )
}