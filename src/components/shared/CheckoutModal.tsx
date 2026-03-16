// src/components/shared/CheckoutModal.tsx
import { useState } from 'react'
import { 
  X, CreditCard, Shield, Lock, CheckCircle, Gift, 
  AlertCircle, Loader2, Calendar, DollarSign,
  ChevronRight, Sparkles, Zap
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  plan: {
    id: string
    name: string
    description: string
    price: number
    period: 'monthly' | 'yearly'
    features: string[]
    popular?: boolean
    max_deliveries: number | null
  }
  onConfirm: () => Promise<void>
  loading?: boolean
  isUpgrade?: boolean
  currentPlanPrice?: number
}

interface PaymentMethod {
  id: string
  name: string
  icon: string
}

export default function CheckoutModal({ 
  isOpen, 
  onClose, 
  plan, 
  onConfirm,
  loading = false,
  isUpgrade = false,
  currentPlanPrice = 0
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<string>('credit_card')
  const [saveCard, setSaveCard] = useState(true)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [cardDetails, setCardDetails] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: '',
    installments: 1
  })

  const paymentMethods: PaymentMethod[] = [
    { id: 'credit_card', name: 'Cartão de Crédito', icon: '💳' },
    { id: 'pix', name: 'PIX', icon: '🧾' },
    { id: 'boleto', name: 'Boleto Bancário', icon: '📄' },
  ]

  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    })
  }

  const calculateSavings = () => {
    if (!isUpgrade) return 0
    return currentPlanPrice - plan.price
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = matches && matches[0] || ''
    const parts = []

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }

    return parts.length ? parts.join(' ') : value
  }

  const handleCardNumberChange = (value: string) => {
    setCardDetails({ ...cardDetails, number: formatCardNumber(value) })
  }

  const handleExpiryChange = (value: string) => {
    const v = value.replace(/[^0-9]/g, '')
    if (v.length >= 2) {
      setCardDetails({ ...cardDetails, expiry: v.substring(0, 2) + '/' + v.substring(2, 4) })
    } else {
      setCardDetails({ ...cardDetails, expiry: v })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!acceptTerms) {
      alert('Você precisa aceitar os termos e condições para continuar.')
      return
    }

    await onConfirm()
  }

  if (!isOpen) return null

  const savings = calculateSavings()
  const showTrial = !isUpgrade
  const showUpgradeInfo = isUpgrade

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Card className="relative w-full max-w-4xl overflow-hidden border-0 shadow-2xl">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={loading}
            >
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left Column - Order Summary */}
              <div className="bg-gradient-to-b from-blue-50 to-indigo-50 p-8">
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 rounded-full mb-4">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">
                      {showTrial ? 'PERÍODO DE TESTE ATIVO' : 'UPGRADE DO PLANO'}
                    </span>
                  </div>
                  
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Resumo da Assinatura</h2>
                  <p className="text-gray-600">Confira os detalhes do seu pedido</p>
                </div>

                {/* Plan Info */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                      <p className="text-gray-600 text-sm">{plan.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{formatPrice(plan.price)}</div>
                      <div className="text-sm text-gray-500">/mês</div>
                    </div>
                  </div>

                  {/* Delivery Limit */}
                  <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg mb-4">
                    <Package className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-700">
                      {plan.max_deliveries ? `Até ${plan.max_deliveries} entregas/mês` : 'Entregas ilimitadas'}
                    </span>
                  </div>

                  {/* Features */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">Incluído no plano:</h4>
                    {plan.features.slice(0, 4).map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                    {plan.features.length > 4 && (
                      <button 
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        onClick={() => alert(plan.features.join('\n'))}
                      >
                        Ver todos os recursos
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Trial/Upgrade Info */}
                <div className="space-y-4">
                  {showTrial && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Gift className="h-5 w-5 text-green-600" />
                        <div>
                          <h4 className="font-semibold text-green-800">7 Dias Grátis</h4>
                          <p className="text-sm text-green-700">Teste o plano completo sem custo</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <Calendar className="h-4 w-4" />
                        <span>Após 7 dias: {formatPrice(plan.price)}/mês</span>
                      </div>
                    </div>
                  )}

                  {showUpgradeInfo && savings > 0 && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        <div>
                          <h4 className="font-semibold text-purple-800">Você está economizando!</h4>
                          <p className="text-sm text-purple-700">
                            Economia de {formatPrice(savings)} em relação ao seu plano atual
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Security Badges */}
                <div className="flex flex-wrap gap-3 mt-6">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-gray-700">100% Seguro</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
                    <Lock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-gray-700">Dados Criptografados</span>
                  </div>
                </div>
              </div>

              {/* Right Column - Payment Form */}
              <div className="p-8">
                <form onSubmit={handleSubmit}>
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Informações de Pagamento</h3>

                  {/* Payment Method Selector */}
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Método de Pagamento
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          className={`p-4 rounded-lg border transition-all ${
                            paymentMethod === method.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-2xl mb-2">{method.icon}</div>
                          <span className="text-sm font-medium text-gray-700">{method.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Credit Card Form */}
                  {paymentMethod === 'credit_card' && (
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Número do Cartão
                        </label>
                        <input
                          type="text"
                          value={cardDetails.number}
                          onChange={(e) => handleCardNumberChange(e.target.value)}
                          placeholder="1234 5678 9012 3456"
                          maxLength={19}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nome no Cartão
                          </label>
                          <input
                            type="text"
                            value={cardDetails.name}
                            onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                            placeholder="Como está no cartão"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Validade
                          </label>
                          <input
                            type="text"
                            value={cardDetails.expiry}
                            onChange={(e) => handleExpiryChange(e.target.value)}
                            placeholder="MM/AA"
                            maxLength={5}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            CVV
                          </label>
                          <input
                            type="text"
                            value={cardDetails.cvv}
                            onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value.replace(/\D/g, '') })}
                            placeholder="123"
                            maxLength={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Parcelas
                          </label>
                          <select
                            value={cardDetails.installments}
                            onChange={(e) => setCardDetails({ ...cardDetails, installments: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                              <option key={num} value={num}>
                                {num}x de {formatPrice(plan.price / num)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="saveCard"
                          checked={saveCard}
                          onChange={(e) => setSaveCard(e.target.checked)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="saveCard" className="text-sm text-gray-700">
                          Salvar cartão para pagamentos futuros
                        </label>
                      </div>
                    </div>
                  )}

                  {/* PIX Instructions */}
                  {paymentMethod === 'pix' && (
                    <div className="text-center p-6 bg-gray-50 rounded-lg">
                      <div className="text-4xl mb-4">🧾</div>
                      <h4 className="font-bold text-gray-900 mb-2">Pague com PIX</h4>
                      <p className="text-gray-600 mb-4">Escaneie o QR Code ou use a chave PIX</p>
                      <div className="bg-white p-4 rounded-lg border border-gray-300 mb-4">
                        {/* QR Code placeholder */}
                        <div className="w-48 h-48 bg-gray-200 rounded-lg mx-auto flex items-center justify-center">
                          <span className="text-gray-500">QR Code aqui</span>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-sm text-gray-600 mb-2"><strong>Chave PIX:</strong> suporte@zomar.com</p>
                        <p className="text-sm text-gray-600"><strong>Valor:</strong> {formatPrice(plan.price)}</p>
                      </div>
                    </div>
                  )}

                  {/* Boleto Instructions */}
                  {paymentMethod === 'boleto' && (
                    <div className="text-center p-6 bg-gray-50 rounded-lg">
                      <div className="text-4xl mb-4">📄</div>
                      <h4 className="font-bold text-gray-900 mb-2">Boleto Bancário</h4>
                      <p className="text-gray-600 mb-4">O boleto será gerado após a confirmação</p>
                      <div className="space-y-2 text-left">
                        <p className="text-sm text-gray-700">• Vencimento: 3 dias úteis</p>
                        <p className="text-sm text-gray-700">• Valor: {formatPrice(plan.price)}</p>
                        <p className="text-sm text-gray-700">• Acesso liberado após pagamento</p>
                      </div>
                    </div>
                  )}

                  {/* Terms */}
                  <div className="my-6">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        required
                      />
                      <label htmlFor="terms" className="text-sm text-gray-700">
                        Concordo com os{' '}
                        <a href="/terms" className="text-blue-600 hover:text-blue-800 underline">
                          Termos de Serviço
                        </a>{' '}
                        e{' '}
                        <a href="/privacy" className="text-blue-600 hover:text-blue-800 underline">
                          Política de Privacidade
                        </a>
                        . Entendo que posso cancelar a qualquer momento através da área de assinatura.
                      </label>
                    </div>
                  </div>

                  {/* Price Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-700">Valor do plano:</span>
                      <span className="font-semibold text-gray-900">{formatPrice(plan.price)}</span>
                    </div>
                    {showTrial && (
                      <div className="flex justify-between items-center text-green-600">
                        <span>Período de teste (7 dias):</span>
                        <span className="font-semibold">GRÁTIS</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 mt-3 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-900">
                          {showTrial ? 'Total hoje:' : 'Total a pagar:'}
                        </span>
                        <span className="text-2xl font-bold text-gray-900">
                          {showTrial ? 'R$ 0,00' : formatPrice(plan.price)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Lock className="h-5 w-5 mr-2" />
                        {showTrial ? 'INICIAR PERÍODO DE TESTE' : 'CONFIRMAR ASSINATURA'}
                      </>
                    )}
                  </Button>

                  {/* Security Notice */}
                  <div className="text-center mt-4">
                    <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                      <Shield className="h-4 w-4" />
                      <span>Pagamento 100% seguro • Dados protegidos</span>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-4">
                  <span>Dúvidas?</span>
                  <a href="mailto:suporte@zomar.com" className="text-blue-600 hover:text-blue-800">
                    suporte@zomar.com
                  </a>
                </div>
                <div className="flex items-center gap-4">
                  <span>Precisa de ajuda?</span>
                  <a href="tel:+5511999999999" className="text-blue-600 hover:text-blue-800">
                    (11) 99999-9999
                  </a>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}