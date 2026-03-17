import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail, Lock, AlertCircle, Eye, EyeOff,
  User, Truck, Store, Phone, CheckCircle, CreditCard,
  Sun, Moon, X, Shield
} from 'lucide-react'
import { useAuth, UserRole } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const HERO_SLIDES = [
  {
    src: 'https://images.pexels.com/photos/30661393/pexels-photo-30661393.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop',
    headline: 'Entregas\nRápidas',
    sub: 'Em até 2 horas, onde você estiver.',
  },
  {
    src: 'https://images.pexels.com/photos/30661401/pexels-photo-30661401.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop',
    headline: 'Entregadores\nVerificados',
    sub: 'Segurança e confiança em cada pedido.',
  },
  {
    src: 'https://images.pexels.com/photos/7552577/pexels-photo-7552577.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop',
    headline: 'Proteção\nTotal',
    sub: 'Cobertura de até R$ 5.000 por entrega.',
  },
  {
    src: 'https://images.pexels.com/photos/5647265/pexels-photo-5647265.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop',
    headline: 'Rastreamento\nem Tempo Real',
    sub: 'Acompanhe cada etapa da sua entrega.',
  },
]

function getRoleRedirect(role: string | null) {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'deliverer') return '/deliverer/dashboard'
  return '/entrepreneur/dashboard'
}

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp, resetPassword, user, loading: authLoading, isAuthenticated } = useAuth()

  const [slide, setSlide] = useState(0)
  const [slideIn, setSlideIn] = useState(true)
  const [imgLoaded, setImgLoaded] = useState(false)

  // ── NOTA: modo 'admin' removido da UI pública.
  // O admin faz login normalmente com 'login' — o redirecionamento
  // acontece automaticamente pelo RoleGuard com base no role do Supabase.
  // Para criar um admin, faz directamente no Supabase Dashboard:
  //   UPDATE profiles SET role = 'admin' WHERE user_id = 'uuid-do-utilizador';
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [isDarkMode, setIsDarkMode] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [userType, setUserType] = useState<UserRole>('entrepreneur')
  const [phone, setPhone] = useState('')
  const [docVal, setDocVal] = useState('')
  const [localLoading, setLocalLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    const next = (slide + 1) % HERO_SLIDES.length
    const img = new Image()
    img.src = HERO_SLIDES[next].src
  }, [slide])

  useEffect(() => {
    const t = setInterval(() => {
      setSlideIn(false)
      setImgLoaded(false)
      setTimeout(() => { setSlide(s => (s + 1) % HERO_SLIDES.length); setSlideIn(true) }, 550)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (isAuthenticated && !authLoading && user) {
      navigate(getRoleRedirect(user.role), { replace: true })
    }
  }, [isAuthenticated, authLoading, user, navigate])

  useEffect(() => {
    if (successMessage || error) {
      const t = setTimeout(() => { setSuccessMessage(''); setError(null) }, 5000)
      return () => clearTimeout(t)
    }
  }, [successMessage, error])

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setFullName('')
    setPhone('')
    setDocVal('')
    setError(null)
    setSuccessMessage('')
  }

  const switchMode = (newMode: typeof mode) => {
    resetForm()
    setMode(newMode)
  }

  const validateForm = () => {
    if (!email.includes('@')) return 'Email inválido'
    if (mode === 'forgot') return null
    if (password.length < 6) return 'A senha deve ter pelo menos 6 caracteres'
    if (mode === 'signup') {
      if (!fullName.trim()) return 'Nome completo é obrigatório'
      if (password !== confirmPassword) return 'As senhas não coincidem'
      if (userType === 'deliverer' && !phone) return 'Telefone é obrigatório para entregadores'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const validationError = validateForm()
    if (validationError) { setError(validationError); return }
    setLocalLoading(true)

    try {
      if (mode === 'forgot') {
        const result = await resetPassword(email)
        if (!result.success) throw new Error(result.error || 'Erro ao enviar email')
        setSuccessMessage('✅ Email de recuperação enviado!')
        setEmail('')
        setTimeout(() => switchMode('login'), 3000)

      } else if (mode === 'signup') {
        // ── Impede criação de conta com role 'admin' via UI ──
        // O role 'admin' só pode ser atribuído directamente no Supabase Dashboard.
        const safeRole: UserRole = userType === ('admin' as any) ? 'entrepreneur' : userType
        const result = await signUp(email, password, fullName, safeRole, phone)
        if (!result.success) throw new Error(result.error || 'Erro ao criar conta')
        setSuccessMessage('✅ Conta criada! Verifique o seu email.')

      } else {
        // Login normal — admin é redirecionado pelo RoleGuard automaticamente
        const result = await signIn(email, password)
        if (!result.success) {
          if (result.error?.includes('Email not confirmed')) throw new Error('Email não confirmado. Verifique a sua caixa de entrada.')
          if (result.error?.includes('Invalid login credentials')) throw new Error('Email ou senha incorretos.')
          throw new Error(result.error || 'Erro ao fazer login')
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLocalLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      const redirectTo = window.location.origin + '/auth/callback'
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      })
      if (error) throw new Error(error.message)
    } catch (err: any) {
      setError('Erro ao autenticar com Google. Tente novamente.')
      setGoogleLoading(false)
    }
  }

  const bg = isDarkMode ? '#0a0f14' : '#f1f5f9'
  const cardBg = isDarkMode ? '#0d1318' : '#ffffff'

  const inputCls = `w-full pl-12 pr-4 py-3.5 rounded-xl text-sm outline-none transition-all duration-200 ${
    isDarkMode
      ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-emerald-500/60 focus:bg-white/8 focus:shadow-lg focus:shadow-emerald-500/10'
      : 'bg-black/5 border border-black/10 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:shadow-lg focus:shadow-emerald-500/15'
  }`

  const iconCls = `absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
    isDarkMode ? 'text-white/30 group-focus-within:text-emerald-400' : 'text-gray-400 group-focus-within:text-emerald-600'
  }`

  const current = HERO_SLIDES[slide]

  const getTitle = () => {
    if (mode === 'forgot') return 'Recuperar Senha'
    if (mode === 'signup') return 'Criar Conta'
    return 'Bem-vindo de volta'
  }

  const getSubtitle = () => {
    if (mode === 'forgot') return 'Digite seu email para recuperar'
    if (mode === 'signup') return 'Preencha os dados para começar'
    return 'Entre com suas credenciais'
  }

  return (
    <div style={{ backgroundColor: bg }} className="min-h-screen flex items-center justify-center p-4 transition-colors duration-500">

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-0 left-1/4 w-[700px] h-[700px] rounded-full blur-[140px] ${isDarkMode ? 'bg-emerald-600/6' : 'bg-emerald-400/12'}`} />
        <div className={`absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] ${isDarkMode ? 'bg-teal-500/5' : 'bg-teal-300/15'}`} />
      </div>

      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className={`fixed top-5 right-5 z-50 p-2.5 rounded-xl transition-all ${
          isDarkMode
            ? 'bg-white/8 border border-white/12 text-yellow-400 hover:bg-white/14'
            : 'bg-black/8 border border-black/10 text-gray-700 hover:bg-black/14'
        }`}
      >
        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="z-0 absolute-card-glow" />

      <div className={`relative z-10 w-full max-w-[860px] rounded-[28px] p-[1.5px] animated-border`}>

        <div style={{ backgroundColor: cardBg }} className="relative w-full rounded-[26.5px] overflow-hidden flex min-h-[560px]">

          {/* LEFT: Hero */}
          <div className="relative hidden md:flex md:w-[46%] flex-shrink-0 overflow-hidden bg-gray-950">
            <img
              key={current.src}
              src={current.src}
              alt="Hero delivery"
              onLoad={() => setImgLoaded(true)}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                slideIn && imgLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.04]'
              }`}
            />
            {!imgLoaded && <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-teal-950 to-gray-950 animate-pulse" />}
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/55 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/30" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_92%,rgba(16,185,129,0.28)_0%,transparent_50%)]" />

            <div className="absolute top-6 left-6 flex items-center gap-2.5 z-10">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                <Truck size={20} className="text-white" />
              </div>
              <div>
                <span className="text-white font-black text-lg tracking-widest drop-shadow-md">ZOMAR</span>
                <p className="text-white/50 text-[10px] font-medium -mt-0.5">Entregas Inteligentes</p>
              </div>
            </div>

            <div className="absolute top-6 right-6 z-10 flex gap-1.5 items-center">
              {HERO_SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setSlide(i); setSlideIn(true); setImgLoaded(false) }}
                  className={`rounded-full transition-all duration-350 ${
                    i === slide ? 'w-6 h-1.5 bg-emerald-400 shadow-sm shadow-emerald-400/60' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>

            <div className={`absolute bottom-0 left-0 right-0 p-7 z-10 transition-all duration-500 ${slideIn && imgLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
              <h2 className="text-white font-black text-[2.55rem] leading-[1.05] tracking-tight whitespace-pre-line mb-2 drop-shadow-xl">{current.headline}</h2>
              <p className="text-white/60 text-sm font-medium mb-4">{current.sub}</p>
              <div className="flex gap-2 flex-wrap">
                {['⚡ 2 horas', '🛡️ R$ 5.000', '⭐ Verificados', '📍 Ao vivo'].map(f => (
                  <span key={f} className="text-[11px] font-semibold text-white/85 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/15">{f}</span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Form */}
          <div className={`flex-1 flex flex-col justify-center p-8 lg:p-10 overflow-y-auto ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>

            {/* Mobile brand */}
            <div className="flex md:hidden items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                <Truck size={16} className="text-white" />
              </div>
              <span className="font-black text-lg tracking-widest">ZOMAR</span>
            </div>

            <div className="mb-7">
              <h3 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{getTitle()}</h3>
              <p className={`text-sm ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>{getSubtitle()}</p>
            </div>

            {error && (
              <div className={`mb-5 p-3.5 rounded-xl flex items-start gap-3 text-sm ${
                isDarkMode ? 'bg-red-500/10 border border-red-500/25 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
              </div>
            )}
            {successMessage && (
              <div className={`mb-5 p-3.5 rounded-xl flex items-start gap-3 text-sm ${
                isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              }`}>
                <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />{successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">

              {/* Role picker — apenas entrepreneur e deliverer */}
              {mode === 'signup' && (
                <div className="grid grid-cols-2 gap-2.5 mb-1">
                  {(['entrepreneur', 'deliverer'] as UserRole[]).map(role => (
                    <button key={role} type="button" onClick={() => setUserType(role)}
                      className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all duration-200 border ${
                        userType === role
                          ? isDarkMode ? 'bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'bg-emerald-50 border-emerald-400'
                          : isDarkMode ? 'bg-white/4 border-white/8 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {role === 'entrepreneur'
                        ? <Store size={20} className={userType === role ? 'text-emerald-400' : isDarkMode ? 'text-white/35' : 'text-gray-400'} />
                        : <Truck size={20} className={userType === role ? 'text-emerald-400' : isDarkMode ? 'text-white/35' : 'text-gray-400'} />}
                      <span className={`text-xs font-bold ${userType === role ? isDarkMode ? 'text-white' : 'text-gray-900' : isDarkMode ? 'text-white/35' : 'text-gray-400'}`}>
                        {role === 'entrepreneur' ? 'Empreendedor' : 'Entregador'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Full name */}
              {mode === 'signup' && (
                <div className="group relative">
                  <User size={17} className={iconCls} />
                  <input type="text" placeholder="Nome Completo" value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
                </div>
              )}

              {/* Email */}
              <div className="group relative">
                <Mail size={17} className={iconCls} />
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} required />
              </div>

              {/* Phone */}
              {mode === 'signup' && (
                <div className="group relative">
                  <Phone size={17} className={iconCls} />
                  <input type="tel" placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
                </div>
              )}

              {/* Doc (deliverer only) */}
              {mode === 'signup' && userType === 'deliverer' && (
                <div className="group relative">
                  <CreditCard size={17} className={iconCls} />
                  <input type="text" placeholder="CPF / BI" value={docVal} onChange={e => setDocVal(e.target.value)} className={inputCls} />
                </div>
              )}

              {/* Password */}
              {mode !== 'forgot' && (
                <>
                  <div className="group relative">
                    <Lock size={17} className={iconCls} />
                    <input type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className={`${inputCls} pr-12`} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/25 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <div className="group relative">
                      <Lock size={17} className={iconCls} />
                      <input type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirmar Senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`${inputCls} pr-12`} required />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/25 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`}>
                        {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Forgot password link */}
              {mode === 'login' && (
                <div className="text-right -mt-1">
                  <button type="button" onClick={() => switchMode('forgot')} className={`text-xs font-semibold ${isDarkMode ? 'text-emerald-400/80 hover:text-emerald-400' : 'text-emerald-600 hover:text-emerald-700'}`}>
                    Esqueceu a senha?
                  </button>
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={localLoading}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 mt-1 ${
                  localLoading
                    ? isDarkMode ? 'bg-white/8 text-white/30 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                {localLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    Processando...
                  </span>
                ) : mode === 'forgot' ? 'Enviar Email' : mode === 'signup' ? 'Criar Conta' : 'Entrar'}
              </button>
            </form>

            {/* Google OAuth */}
            {(mode === 'login' || mode === 'signup') && (
              <>
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className={`w-full border-t ${isDarkMode ? 'border-white/8' : 'border-gray-200'}`} />
                  </div>
                  <div className="relative flex justify-center">
                    <span style={{ backgroundColor: cardBg }} className={`px-3 text-xs ${isDarkMode ? 'text-white/30' : 'text-gray-400'}`}>ou continue com</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all duration-200 border font-semibold text-sm ${
                    googleLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01] active:scale-[0.99]'
                  } ${
                    isDarkMode
                      ? 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/22'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                  }`}
                >
                  {googleLoading ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : (
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {googleLoading ? 'A autenticar...' : 'Continuar com Google'}
                </button>
              </>
            )}

            {/* Footer links */}
            <div className="mt-6 space-y-3">
              {mode === 'login' && (
                <p className={`text-center text-xs ${isDarkMode ? 'text-white/35' : 'text-gray-500'}`}>
                  Não tem uma conta?{' '}
                  <button onClick={() => switchMode('signup')} className={`font-bold ${isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                    Criar Conta
                  </button>
                </p>
              )}
              {mode === 'signup' && (
                <p className={`text-center text-xs ${isDarkMode ? 'text-white/35' : 'text-gray-500'}`}>
                  Já tem uma conta?{' '}
                  <button onClick={() => switchMode('login')} className={`font-bold ${isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'}`}>
                    Entrar
                  </button>
                </p>
              )}
              {mode === 'forgot' && (
                <button onClick={() => switchMode('login')} className={`text-xs text-center w-full flex items-center justify-center gap-1.5 ${isDarkMode ? 'text-white/35 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`}>
                  <X size={13} /> Voltar ao login
                </button>
              )}

              {/* ── ACESSO ADMIN REMOVIDO DA UI PÚBLICA ──
                  Para aceder como admin, usa o login normal com as credenciais
                  de uma conta que tenha role='admin' no Supabase.
                  Para promover um utilizador a admin, corre no SQL Editor:
                  UPDATE profiles SET role = 'admin' WHERE user_id = 'uuid';
              */}
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @property --ba { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        .animated-border {
          --ba: 0deg;
          background: conic-gradient(from var(--ba), rgba(16,185,129,0.05) 0%, rgba(16,185,129,0.90) 18%, rgba(52,211,153,0.85) 28%, rgba(6,182,212,0.75) 38%, rgba(20,184,166,0.50) 50%, rgba(6,182,212,0.15) 62%, rgba(16,185,129,0.05) 72%, rgba(16,185,129,0.05) 100%);
          animation: spin-border 6s linear infinite;
        }
        @keyframes spin-border { from { --ba: 0deg; } to { --ba: 360deg; } }
        @property --sa { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        .absolute-card-glow {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
          width: min(900px,96vw); height: 600px; border-radius: 32px; z-index: 1; pointer-events: none;
          --sa: 0deg;
          background: conic-gradient(from var(--sa), rgba(16,185,129,0.40) 0%, rgba(52,211,153,0.28) 15%, rgba(6,182,212,0.22) 30%, rgba(20,184,166,0.12) 45%, transparent 60%, rgba(16,185,129,0.08) 75%, rgba(16,185,129,0.40) 100%);
          filter: blur(45px); animation: spin-glow 9s linear infinite; opacity: 0.75;
        }
        @keyframes spin-glow { from { --sa: 0deg; } to { --sa: 360deg; } }
      `}</style>
    </div>
  )
}