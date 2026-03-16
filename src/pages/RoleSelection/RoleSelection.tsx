// src/pages/RoleSelection/RoleSelection.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Truck, User, Building, AlertCircle, Loader2 } from 'lucide-react'

function getRoleRedirect(role: string | null) {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'deliverer') return '/deliverer/dashboard'
  return '/entrepreneur/dashboard'
}

export default function RoleSelection() {
  const navigate = useNavigate()
  const { user: authUser, refreshUser, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<'entrepreneur' | 'deliverer' | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (authUser?.full_name) setFullName(authUser.full_name)
  }, [authUser])

  useEffect(() => {
    if (!authLoading && authUser?.role) {
      navigate(getRoleRedirect(authUser.role), { replace: true })
    }
  }, [authUser, authLoading, navigate])

  const handleCompleteProfile = async () => {
    if (!selectedRole) { setError('Seleciona o tipo de conta antes de continuar.'); return }
    if (!fullName.trim()) { setError('O nome completo é obrigatório.'); return }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setError('Sessão expirada. Por favor, faz login novamente.')
      navigate('/login', { replace: true })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const userId = session.user.id

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          email: session.user.email,
          full_name: fullName.trim(),
          role: selectedRole,
          phone: phone.trim() || null,
          status: 'ativo',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (profileError) throw profileError

      if (selectedRole === 'deliverer') {
        const { error: delivererError } = await supabase
          .from('delivery_persons')
          .upsert({
            user_id: userId,
            status: 'ativo',
            rating: 5.0,
            total_deliveries: 0,
            available: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })

        if (delivererError) console.warn('⚠️ Aviso ao inicializar entregador:', delivererError.message)
      }

      await refreshUser()
      navigate(getRoleRedirect(selectedRole), { replace: true })

    } catch (err: any) {
      console.error('❌ RoleSelection - Erro:', err)
      setError(err.message || 'Erro ao guardar perfil. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f14]">
        <Loader2 className="animate-spin text-emerald-400" size={40} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] bg-emerald-600/8" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[100px] bg-teal-500/6" />
      </div>

      <div className="relative z-10 max-w-md w-full bg-[#0d1318] rounded-2xl border border-white/8 shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-4 border border-emerald-500/20">
            <User className="text-emerald-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Configurar Perfil</h1>
          <p className="text-white/40 mt-2 text-sm">Como pretendes utilizar o ZOMAR?</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0" size={18} />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {[
              { role: 'entrepreneur' as const, label: 'Empreendedor', sub: 'Enviar encomendas', icon: Building, color: 'blue' },
              { role: 'deliverer' as const, label: 'Entregador', sub: 'Realizar entregas', icon: Truck, color: 'emerald' },
            ].map(({ role, label, sub, icon: Icon, color }) => {
              const isSelected = selectedRole === role
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  disabled={loading}
                  className={`p-5 rounded-xl text-center transition-all border-2 ${
                    isSelected
                      ? color === 'blue'
                        ? 'border-blue-500/60 bg-blue-500/10'
                        : 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-white/8 bg-white/3 hover:border-white/15'
                  } disabled:opacity-50`}
                >
                  <Icon
                    className={`mx-auto mb-2 ${
                      isSelected
                        ? color === 'blue' ? 'text-blue-400' : 'text-emerald-400'
                        : 'text-white/30'
                    }`}
                    size={28}
                  />
                  <span className={`font-bold block text-sm ${isSelected ? 'text-white' : 'text-white/50'}`}>{label}</span>
                  <span className="text-[10px] text-white/25 uppercase tracking-wider">{sub}</span>
                </button>
              )
            })}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Nome Completo *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="O teu nome completo"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Telefone / WhatsApp</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="(84) 000-0000"
                disabled={loading}
              />
            </div>
          </div>

          <button
            onClick={handleCompleteProfile}
            disabled={loading || !selectedRole || !fullName.trim()}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
              selectedRole === 'deliverer'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
            } disabled:bg-white/8 disabled:text-white/20 disabled:shadow-none disabled:cursor-not-allowed`}
          >
            {loading ? <><Loader2 className="animate-spin" size={20} /> A configurar...</> : 'Finalizar Configuração'}
          </button>
        </div>
      </div>
    </div>
  )
}