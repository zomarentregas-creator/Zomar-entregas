import { useState } from 'react'
import { X, Mail, Lock, User, Phone } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'login' | 'register'
}

export default function AuthModal({ isOpen, onClose, mode }: AuthModalProps) {
  const { signIn, signUp } = useAuth()
  const [formMode, setFormMode] = useState<'login' | 'register'>(mode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'entrepreneur' as 'entrepreneur' | 'deliverer'
  })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (formMode === 'login') {
        await signIn(formData.email, formData.password)
      } else {
        await signUp(
          formData.email,
          formData.password,
          formData.fullName,
          formData.role,
          formData.phone || undefined
        )
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {formMode === 'login' ? 'Entrar na Conta' : 'Criar Nova Conta'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {formMode === 'register' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="inline-block h-4 w-4 mr-2 text-gray-400" />
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Conta
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="entrepreneur"
                          checked={formData.role === 'entrepreneur'}
                          onChange={(e) => handleInputChange('role', e.target.value)}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2 text-gray-700">Empreendedor</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="deliverer"
                          checked={formData.role === 'deliverer'}
                          onChange={(e) => handleInputChange('role', e.target.value)}
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2 text-gray-700">Entregador</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Phone className="inline-block h-4 w-4 mr-2 text-gray-400" />
                      Telefone (Opcional)
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="inline-block h-4 w-4 mr-2 text-gray-400" />
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Lock className="inline-block h-4 w-4 mr-2 text-gray-400" />
                  Senha
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setFormMode(formMode === 'login' ? 'register' : 'login')}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {formMode === 'login' ? 'Criar uma conta' : 'Já tenho uma conta'}
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {formMode === 'login' ? 'Entrando...' : 'Criando...'}
                    </div>
                  ) : (
                    formMode === 'login' ? 'Entrar' : 'Criar Conta'
                  )}
                </button>
              </div>
            </form>

            {/* Terms */}
            {formMode === 'register' && (
              <p className="text-xs text-gray-500 mt-6 text-center">
                Ao criar uma conta, você concorda com nossos{' '}
                <a href="#" className="text-blue-600 hover:text-blue-800">Termos de Uso</a>{' '}
                e{' '}
                <a href="#" className="text-blue-600 hover:text-blue-800">Política de Privacidade</a>.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}