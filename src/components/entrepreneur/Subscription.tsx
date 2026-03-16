// src/components/entrepreneur/Subscription.tsx
// Adaptado para Moçambique — moeda: Metical (MZN)

import { Check, Star, Zap, Shield, Clock, AlertCircle, TrendingUp, Calendar, Package } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

interface Plan {
  id: string
  name: string
  description: string
  price: number
  period: 'monthly' | 'yearly'
  features: string[]
  popular?: boolean
  max_deliveries: number | null
  subscription_id?: string
  status?: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'
  deliveries_used?: number
  deliveries_remaining?: number
  current_period_end?: string | null
  next_billing_date?: string | null
}

interface SubscriptionProps {
  currentPlan: Plan | null
  plans: Plan[]
  onSelectPlan: (planId: string) => void
  onCancelSubscription?: () => void
  onReactivateSubscription?: () => void
  loading?: boolean
}

export default function Subscription({
  currentPlan,
  plans = [],
  onSelectPlan,
  onCancelSubscription,
  onReactivateSubscription,
  loading = false
}: SubscriptionProps) {

  /** Formata valor em Metical moçambicano */
  const formatPrice = (price: number) =>
    price.toLocaleString('pt-MZ', {
      style: 'currency',
      currency: 'MZN',
      minimumFractionDigits: 2,
    })

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Não definido'
    return new Date(dateString).toLocaleDateString('pt-MZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'trial':
        return { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Zap className="h-3 w-3 mr-1" />, label: 'Período de Teste' }
      case 'active':
        return { bg: 'bg-green-100', text: 'text-green-800', icon: <Check className="h-3 w-3 mr-1" />, label: 'Activo' }
      case 'past_due':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <AlertCircle className="h-3 w-3 mr-1" />, label: 'Pagamento Pendente' }
      case 'canceled':
        return { bg: 'bg-red-100', text: 'text-red-800', icon: <AlertCircle className="h-3 w-3 mr-1" />, label: 'Cancelado' }
      case 'expired':
        return { bg: 'bg-gray-100', text: 'text-gray-800', icon: <AlertCircle className="h-3 w-3 mr-1" />, label: 'Expirado' }
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', icon: <Check className="h-3 w-3 mr-1" />, label: 'Activo' }
    }
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <Shield className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum plano disponível</h3>
        <p className="text-gray-600">Entre em contacto com o suporte para mais informações.</p>
      </div>
    )
  }

  const statusBadge = currentPlan ? getStatusBadge(currentPlan.status) : null
  const isCanceled = currentPlan?.status === 'canceled'
  const canReactivate = isCanceled && onReactivateSubscription

  return (
    <div className="space-y-6">

      {/* Plano Actual */}
      {currentPlan && (
        <Card className={`border-2 ${isCanceled ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Star className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">O Seu Plano Actual</h3>
                  {statusBadge && (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                      {statusBadge.icon}{statusBadge.label}
                    </span>
                  )}
                </div>
                <p className="text-blue-600 font-bold text-2xl">{currentPlan.name}</p>
                <p className="text-gray-600 mt-1">{currentPlan.description}</p>
              </div>
              <div className="mt-4 md:mt-0 text-right">
                <div className="text-3xl font-bold text-gray-900">
                  {formatPrice(currentPlan.price)}
                  <span className="text-sm font-normal text-gray-600">/mês</span>
                </div>
              </div>
            </div>

            {/* Estatísticas de uso */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Entregas este mês</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {currentPlan.deliveries_used || 0}
                    {currentPlan.max_deliveries && ` / ${currentPlan.max_deliveries}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Disponíveis</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {currentPlan.max_deliveries
                      ? currentPlan.deliveries_remaining || (currentPlan.max_deliveries - (currentPlan.deliveries_used || 0))
                      : 'Ilimitadas'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Próxima cobrança</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDate(currentPlan.next_billing_date)}
                  </p>
                </div>
              </div>
            </div>

            {/* Barra de progresso */}
            {currentPlan.max_deliveries && (
              <div className="pt-4 border-t border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Uso do plano</span>
                  <span className="text-sm text-gray-600">
                    {Math.round(((currentPlan.deliveries_used || 0) / currentPlan.max_deliveries) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      ((currentPlan.deliveries_used || 0) / currentPlan.max_deliveries) > 0.8
                        ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, ((currentPlan.deliveries_used || 0) / currentPlan.max_deliveries) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Acções */}
            {(onCancelSubscription || canReactivate) && (
              <div className="flex gap-3 pt-4 border-t border-blue-200">
                {canReactivate ? (
                  <Button variant="primary" onClick={onReactivateSubscription} disabled={loading} className="flex-1">
                    ✨ Reactivar Assinatura
                  </Button>
                ) : (
                  <Button variant="outline" onClick={onCancelSubscription} disabled={loading || isCanceled}
                    className="text-red-600 border-red-300 hover:bg-red-50">
                    Cancelar Assinatura
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Planos disponíveis */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {currentPlan ? 'Mudar de Plano' : 'Planos Disponíveis'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {currentPlan
                ? 'Faça upgrade ou downgrade a qualquer momento'
                : 'Escolha o plano ideal para as suas necessidades'}
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button className="px-3 py-1 text-sm rounded-md bg-white shadow-sm">Mensal</button>
            <button className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">Anual (-20%)</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id
            const isPlanUpgrade = currentPlan && plan.price > currentPlan.price
            const isPlanDowngrade = currentPlan && plan.price < currentPlan.price

            return (
              <Card key={plan.id}
                className={`relative ${plan.popular ? 'border-2 border-blue-500 shadow-lg' : isCurrentPlan ? 'border-2 border-green-500' : 'border border-gray-200'}`}>

                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">Mais Popular</span>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">Plano Actual</span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h4 className="text-xl font-bold text-gray-900">{plan.name}</h4>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">{formatPrice(plan.price)}</span>
                    <span className="text-gray-600">/mês</span>
                  </div>
                  <p className="text-gray-500 mt-2">{plan.description}</p>
                </div>

                <div className="space-y-3 mb-6">
                  {plan.features && plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center">
                      <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Limite de entregas:</span>
                    <span className="font-medium text-gray-900">
                      {plan.max_deliveries ? `${plan.max_deliveries}/mês` : 'Ilimitadas'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Suporte:</span>
                    <span className="font-medium text-gray-900">24/7</span>
                  </div>
                </div>

                <Button
                  variant={isCurrentPlan ? 'outline' : isPlanUpgrade ? 'primary' : plan.popular ? 'primary' : 'outline'}
                  className="w-full"
                  disabled={loading || isCurrentPlan}
                  onClick={() => onSelectPlan(plan.id)}
                >
                  {isCurrentPlan ? '✓ Plano Actual'
                    : isPlanUpgrade ? '⬆️ Fazer Upgrade'
                    : isPlanDowngrade ? '⬇️ Fazer Downgrade'
                    : 'Seleccionar Plano'}
                </Button>

                {isPlanUpgrade && (
                  <p className="text-xs text-center text-gray-500 mt-2">💡 Acesso imediato aos novos recursos</p>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* Secção de benefícios */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900">Porquê escolher a ZOMAR?</h3>
          <p className="text-gray-600 mt-2">Tudo o que precisa numa única plataforma</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Shield, bg: 'bg-blue-100', color: 'text-blue-600', title: 'Segurança Total', desc: 'Rastreamento em tempo real para todas as entregas' },
            { icon: Zap, bg: 'bg-green-100', color: 'text-green-600', title: 'Entrega Rápida', desc: 'Entregadores disponíveis 24/7 para a sua demanda' },
            { icon: Star, bg: 'bg-purple-100', color: 'text-purple-600', title: 'Avaliação 5 Estrelas', desc: 'Sistema de avaliação que garante a qualidade' },
            { icon: Check, bg: 'bg-yellow-100', color: 'text-yellow-600', title: 'Suporte Dedicado', desc: 'Equipa especializada para resolver qualquer problema' },
          ].map(({ icon: Icon, bg, color, title, desc }) => (
            <div key={title} className="text-center p-4">
              <div className={`inline-flex items-center justify-center w-12 h-12 ${bg} rounded-full mb-4`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Banner período de teste */}
      {!currentPlan && (
        <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
          <div className="text-center py-8">
            <Zap className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">7 Dias Grátis!</h3>
            <p className="text-lg mb-4">Teste qualquer plano por 7 dias sem compromisso</p>
            <p className="text-sm opacity-90">Cancele a qualquer momento durante o período de teste</p>
          </div>
        </Card>
      )}
    </div>
  )
}