import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail, Lock, AlertCircle, Eye, EyeOff,
  User, Truck, Store, Phone, CheckCircle, CreditCard,
  Sun, Moon, X, ShieldCheck, MapPin, Zap,
} from 'lucide-react'
import { useAuth, UserRole } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { usePrefersReducedMotion, useParallax } from '../hooks/useMotion'
import '../styles/zomar-motion.css'

// ─── Capítulos do painel (substituem o carrossel de fotos: mais leve e sem imagens externas) ───

const CHAPTER_MS = 5200

const CHAPTERS = [
  { headline: 'Entregas\nRápidas', sub: 'Em até 2 horas, onde você estiver.', chip: { icon: Zap, label: 'Chega em até 2 horas' } },
  { headline: 'Entregadores\nVerificados', sub: 'Segurança e confiança em cada pedido.', chip: { icon: ShieldCheck, label: 'Estafeta verificado' } },
  { headline: 'Proteção\nTotal', sub: 'Cobertura de até MZN 5.000 por entrega.', chip: { icon: ShieldCheck, label: 'Entrega protegida' } },
  { headline: 'Rastreamento\nem Tempo Real', sub: 'Acompanhe cada etapa da sua entrega.', chip: { icon: MapPin, label: 'A caminho · ao vivo' } },
]

const cssVars = (v: Record<string, string | number>) => v as CSSProperties

function getRoleRedirect(role: string | null) {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'deliverer') return '/deliverer/dashboard'
  return '/entrepreneur/dashboard'
}

// ─── Cena da rota de entrega (SVG leve: linha que se desenha, pontos a pulsar, estafeta em movimento) ───

function RouteScene({ variant, reduced }: { variant: 'panel' | 'strip'; reduced: boolean }) {
  const strip = variant === 'strip'
  const id = strip ? 'zs' : 'zp'
  const d = strip
    ? 'M22 84 C 80 84, 96 28, 156 46 S 246 92, 290 52 S 316 30, 326 28'
    : 'M60 340 C 130 320, 70 250, 150 222 S 270 205, 292 150 S 312 104, 344 78'
  const start = strip ? { x: 22, y: 84 } : { x: 60, y: 340 }
  const mid = strip ? { x: 156, y: 46 } : { x: 150, y: 222 }
  const end = strip ? { x: 326, y: 28 } : { x: 344, y: 78 }

  return (
    <svg
      viewBox={strip ? '0 0 360 110' : '0 0 400 560'}
      preserveAspectRatio={strip ? 'xMidYMid meet' : 'xMidYMid slice'}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="0.6" stopColor="#34d399" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <filter id={`${id}-b`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={strip ? 3 : 5} />
        </filter>
        {!strip && (
          <>
            <pattern id="zp-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            </pattern>
            <radialGradient id="zp-fade" cx="50%" cy="48%" r="62%">
              <stop offset="0" stopColor="#fff" stopOpacity="1" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id="zp-mask">
              <rect width="400" height="560" fill="url(#zp-fade)" />
            </mask>
          </>
        )}
      </defs>

      {!strip && (
        <g mask="url(#zp-mask)">
          <rect width="400" height="560" fill="url(#zp-grid)" />
          {[
            [30, 90, 120, 80], [172, 70, 90, 110], [286, 130, 84, 90],
            [40, 220, 100, 70], [190, 238, 100, 60], [302, 262, 70, 100],
            [60, 372, 80, 90], [212, 388, 130, 70], [300, 412, 70, 110],
          ].map(([x, y, w, h]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="10" fill="none" stroke="rgba(255,255,255,0.06)" />
          ))}
        </g>
      )}

      {/* trilho base tracejado */}
      <path d={d} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" />
      {/* brilho + linha principal que se desenha */}
      <path d={d} pathLength={1} className="zm-route-draw" fill="none" stroke={`url(#${id}-g)`} strokeWidth={strip ? 6 : 10} strokeLinecap="round" opacity="0.45" filter={`url(#${id}-b)`} />
      <path d={d} pathLength={1} className="zm-route-draw" fill="none" stroke={`url(#${id}-g)`} strokeWidth={strip ? 2.5 : 3.5} strokeLinecap="round" />

      {/* paragem intermédia */}
      <circle cx={mid.x} cy={mid.y} r={strip ? 3 : 4} fill="rgba(255,255,255,0.55)" />

      {/* recolha */}
      <g transform={`translate(${start.x} ${start.y})`}>
        {!reduced && <circle className="zm-ring" r="10" fill="none" stroke="#34d399" strokeWidth="1.5" />}
        <circle r={strip ? 4.5 : 5.5} fill="#0d1318" stroke="#34d399" strokeWidth="2" />
      </g>

      {/* destino */}
      <g transform={`translate(${end.x} ${end.y})`}>
        {!reduced && <circle className="zm-ring" style={{ animationDelay: '1.1s' }} r="12" fill="none" stroke="#22d3ee" strokeWidth="1.5" />}
        <circle r={strip ? 5.5 : 7} fill="#22d3ee" opacity="0.25" />
        <circle r={strip ? 3 : 4} fill="#ecfeff" />
      </g>

      {/* estafeta a percorrer a rota */}
      {!reduced && (
        <g>
          <circle r={strip ? 9 : 14} fill="rgba(52,211,153,0.22)" />
          <circle r={strip ? 4 : 6} fill="#ffffff" />
          <animateMotion dur={strip ? '5s' : '7s'} begin="2.2s" repeatCount="indefinite" path={d} />
        </g>
      )}
    </svg>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp, resetPassword, user, loading: authLoading, isAuthenticated } = useAuth()
  const reduced = usePrefersReducedMotion()
  const rootRef = useParallax<HTMLDivElement>()

  const [chapter, setChapter]   = useState(0)
  const [mode, setMode]         = useState<'login' | 'signup' | 'forgot'>('login')
  const [isDarkMode, setIsDarkMode] = useState(true)

  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName]               = useState('')
  const [userType, setUserType]               = useState<UserRole>('entrepreneur')
  const [phone, setPhone]                     = useState('')
  const [docVal, setDocVal]                   = useState('')
  const [localLoading, setLocalLoading]       = useState(false)
  const [showPassword, setShowPassword]       = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const [successMessage, setSuccessMessage]   = useState('')
  const [googleLoading, setGoogleLoading]     = useState(false)

  // Avança os capítulos (parado se o sistema pedir "reduzir movimento")
  useEffect(() => {
    if (reduced) return
    const t = setTimeout(() => setChapter(c => (c + 1) % CHAPTERS.length), CHAPTER_MS)
    return () => clearTimeout(t)
  }, [chapter, reduced])

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
    setEmail(''); setPassword(''); setConfirmPassword('')
    setFullName(''); setPhone(''); setDocVal('')
    setError(null); setSuccessMessage('')
  }

  const switchMode = (newMode: typeof mode) => { resetForm(); setMode(newMode) }

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
        const safeRole: UserRole = userType === ('admin' as any) ? 'entrepreneur' : userType
        const result = await signUp(email, password, fullName, safeRole, phone)
        if (!result.success) throw new Error(result.error || 'Erro ao criar conta')
        setSuccessMessage('✅ Conta criada! Verifique o seu email.')
      } else {
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
    setGoogleLoading(true); setError(null)
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

  const iconCls = 'absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none zm-muted transition-colors duration-300 group-focus-within:text-emerald-400'
  const inputCls = 'zm-input w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none'
  const eyeCls = `absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-white/25 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`
  const linkCls = isDarkMode ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'

  const current = CHAPTERS[chapter]
  const ChipIcon = current.chip.icon

  const getTitle    = () => mode === 'forgot' ? 'Recuperar Senha'   : mode === 'signup' ? 'Criar Conta'              : 'Bem-vindo de volta'
  const getSubtitle = () => mode === 'forgot' ? 'Digite seu email'  : mode === 'signup' ? 'Preencha os seus dados'   : 'Entre com suas credenciais'

  return (
    <div
      ref={rootRef}
      className={`zm-login ${isDarkMode ? 'zm-dark' : 'zm-light'} relative min-h-screen w-full overflow-x-hidden flex items-center justify-center p-3 sm:p-4`}
    >
      {/* Fundo ambiente e brilho atrás do cartão */}
      <div className="zm-aurora" aria-hidden="true">
        <span className="zm-blob zm-blob-a" />
        <span className="zm-blob zm-blob-b" />
      </div>
      <div className="zm-card-glow" aria-hidden="true" />

      {/* Botão tema */}
      <button
        type="button"
        onClick={() => setIsDarkMode(!isDarkMode)}
        aria-label={isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
        className={`zm-press fixed top-4 right-4 z-50 p-2.5 rounded-xl transition-colors ${
          isDarkMode
            ? 'bg-white/10 border border-white/10 text-yellow-400 hover:bg-white/15'
            : 'bg-black/5 border border-black/10 text-gray-700 hover:bg-black/10'
        }`}
      >
        {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* Cartão principal */}
      <div
        className="zm-card-border zm-enter relative z-10 w-full rounded-[26px] p-[1.5px]"
        style={{ maxWidth: 'min(860px, 96vw)' }}
      >
        <div
          className="zm-card relative w-full rounded-[24.5px] overflow-hidden flex"
          style={{ minHeight: 'min(560px, 85vh)' }}
        >

          {/* ── ESQUERDA: rota de entrega + capítulos (oculta em mobile) ── */}
          <div className="zm-hero relative hidden md:flex md:w-[44%] flex-shrink-0 overflow-hidden">
            <div className="zm-parallax absolute inset-0" style={cssVars({ '--zm-px': '-14px', '--zm-py': '-10px' })}>
              <RouteScene variant="panel" reduced={reduced} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-transparent" />

            {/* Logo */}
            <div className="absolute top-5 left-5 flex items-center gap-2.5 z-10">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                <Truck size={18} className="text-white" />
              </div>
              <div>
                <span className="text-white font-black text-base tracking-widest drop-shadow-md">ZOMAR</span>
                <p className="text-white/50 text-[10px] font-medium -mt-0.5">Entregas Inteligentes</p>
              </div>
            </div>

            {/* Progresso dos capítulos */}
            <div className="absolute top-6 right-5 z-10 flex gap-1.5 items-center">
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.headline}
                  type="button"
                  aria-label={`Ver: ${c.headline.replace('\n', ' ')}`}
                  onClick={() => setChapter(i)}
                  className="p-1 -m-1"
                >
                  <span
                    className={`zm-chbar block w-7 ${i < chapter ? 'is-done' : i === chapter ? 'is-active' : ''}`}
                    style={cssVars({ '--zm-ch-ms': `${CHAPTER_MS}ms` })}
                  >
                    <i />
                  </span>
                </button>
              ))}
            </div>

            {/* Cartão flutuante do capítulo */}
            <div key={`chip-${chapter}`} className="zm-swap absolute left-5 top-[27%] z-10">
              <div className="zm-float inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md text-white text-xs font-semibold shadow-[0_10px_30px_-12px_rgba(16,185,129,0.5)]">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/25 flex items-center justify-center">
                  <ChipIcon size={13} className="text-emerald-300" />
                </span>
                {current.chip.label}
              </div>
            </div>

            {/* Texto do capítulo */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
              <div key={chapter}>
                <h2 className="text-white font-black text-[2.2rem] leading-[1.05] tracking-tight mb-2 drop-shadow-xl">
                  {current.headline.split('\n').map((line, i) => (
                    <span key={line} className="block overflow-hidden pb-1 -mb-1">
                      <span className="zm-line-up block" style={cssVars({ '--zm-d': `${i * 90}ms` })}>{line}</span>
                    </span>
                  ))}
                </h2>
                <p className="zm-swap text-white/60 text-sm font-medium mb-3" style={cssVars({ '--zm-d': '180ms' })}>{current.sub}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['⚡ 2 horas', '🛡️ MZN 5.000', '⭐ Verificados', '📍 Ao vivo'].map(f => (
                  <span key={f} className="text-[10px] font-semibold text-white/85 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15">{f}</span>
                ))}
              </div>
            </div>
          </div>

          {/* ── DIREITA: formulário ── */}
          <div className="zm-text flex-1 min-w-0 flex flex-col justify-center p-6 sm:p-8 overflow-y-auto overflow-x-hidden zm-scroll">

            {/* Faixa de marca em mobile */}
            <div className="zm-hero md:hidden relative h-[104px] rounded-2xl overflow-hidden mb-5 flex-shrink-0">
              <RouteScene variant="strip" reduced={reduced} />
              <div className="absolute top-3 left-3.5 flex items-center gap-2 z-10">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                  <Truck size={15} className="text-white" />
                </div>
                <span className="text-white font-black text-base tracking-widest">ZOMAR</span>
              </div>
            </div>

            <div key={mode} className="zm-stagger">

              <div className="mb-5">
                <h3 className="text-xl font-bold mb-1">{getTitle()}</h3>
                <p className="text-sm zm-muted">{getSubtitle()}</p>
              </div>

              {error && (
                <div role="alert" className={`zm-swap mb-4 p-3 rounded-xl flex items-start gap-3 text-sm ${
                  isDarkMode ? 'bg-red-500/10 border border-red-500/25 text-red-300' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{error}
                </div>
              )}
              {successMessage && (
                <div role="status" className={`zm-swap mb-4 p-3 rounded-xl flex items-start gap-3 text-sm ${
                  isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                }`}>
                  <CheckCircle size={15} className="flex-shrink-0 mt-0.5" />{successMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-2.5 zm-stagger">

                {/* Role picker */}
                {mode === 'signup' && (
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    {(['entrepreneur', 'deliverer'] as UserRole[]).map(role => {
                      const selected = userType === role
                      return (
                        <button key={role} type="button" onClick={() => setUserType(role)} aria-pressed={selected}
                          className={`zm-press zm-lift relative p-3 rounded-xl flex flex-col items-center gap-1.5 transition-colors duration-300 border ${
                            selected
                              ? isDarkMode ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_8px_24px_-14px_rgba(16,185,129,0.6)]' : 'bg-emerald-50 border-emerald-400'
                              : isDarkMode ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {selected && <CheckCircle size={13} className="zm-pop absolute top-2 right-2 text-emerald-400" />}
                          {role === 'entrepreneur'
                            ? <Store size={18} className={selected ? 'text-emerald-400' : isDarkMode ? 'text-white/35' : 'text-gray-400'} />
                            : <Truck size={18} className={selected ? 'text-emerald-400' : isDarkMode ? 'text-white/35' : 'text-gray-400'} />}
                          <span className={`text-xs font-bold ${selected ? 'zm-text' : isDarkMode ? 'text-white/35' : 'text-gray-400'}`}>
                            {role === 'entrepreneur' ? 'Empreendedor' : 'Entregador'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Nome */}
                {mode === 'signup' && (
                  <div className="group relative">
                    <User size={15} className={iconCls} />
                    <input type="text" placeholder="Nome Completo" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
                  </div>
                )}

                {/* Email */}
                <div className="group relative">
                  <Mail size={15} className={iconCls} />
                  <input type="email" placeholder="Email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} required />
                </div>

                {/* Telefone */}
                {mode === 'signup' && (
                  <div className="group relative">
                    <Phone size={15} className={iconCls} />
                    <input type="tel" placeholder="Telefone" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
                  </div>
                )}

                {/* Documento */}
                {mode === 'signup' && userType === 'deliverer' && (
                  <div className="group relative">
                    <CreditCard size={15} className={iconCls} />
                    <input type="text" placeholder="BI / Documento" value={docVal} onChange={e => setDocVal(e.target.value)} className={inputCls} />
                  </div>
                )}

                {/* Senha */}
                {mode !== 'forgot' && (
                  <>
                    <div className="group relative">
                      <Lock size={15} className={iconCls} />
                      <input type={showPassword ? 'text' : 'password'} placeholder="Senha" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password}
                        onChange={e => setPassword(e.target.value)} className={`${inputCls} pr-11`} required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'} className={eyeCls}>
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {mode === 'signup' && (
                      <div className="group relative">
                        <Lock size={15} className={iconCls} />
                        <input type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirmar Senha" autoComplete="new-password" value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)} className={`${inputCls} pr-11`} required />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Esconder senha' : 'Mostrar senha'} className={eyeCls}>
                          {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Esqueceu a senha */}
                {mode === 'login' && (
                  <div className="text-right">
                    <button type="button" onClick={() => switchMode('forgot')}
                      className={`text-xs font-semibold transition-colors ${isDarkMode ? 'text-emerald-400/80 hover:text-emerald-400' : 'text-emerald-600 hover:text-emerald-700'}`}>
                      Esqueceu a senha?
                    </button>
                  </div>
                )}

                {/* Submit */}
                <button type="submit" disabled={localLoading}
                  className={`zm-press w-full py-3 rounded-xl font-bold text-sm transition-[background-color,box-shadow,transform] duration-300 ${
                    localLoading
                      ? isDarkMode ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'zm-sheen bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/45'
                  }`}
                >
                  {localLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                      Processando...
                    </span>
                  ) : mode === 'forgot' ? 'Enviar Email' : mode === 'signup' ? 'Criar Conta' : 'Entrar'}
                </button>
              </form>

              {/* Google OAuth */}
              {(mode === 'login' || mode === 'signup') && (
                <div>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t zm-divider" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="zm-surface zm-muted px-3 text-xs">ou continue com</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className={`zm-press zm-lift w-full py-3 rounded-xl flex items-center justify-center gap-3 border font-semibold text-sm transition-colors duration-300 ${
                      googleLoading ? 'opacity-50 cursor-not-allowed' : ''
                    } ${
                      isDarkMode
                        ? 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                    }`}
                  >
                    {googleLoading
                      ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      : (
                        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )
                    }
                    {googleLoading ? 'A autenticar...' : 'Continuar com Google'}
                  </button>
                </div>
              )}

              {/* Links de navegação */}
              <div className="mt-5 space-y-2">
                {mode === 'login' && (
                  <p className="text-center text-xs zm-muted">
                    Não tem uma conta?{' '}
                    <button type="button" onClick={() => switchMode('signup')} className={`font-bold transition-colors ${linkCls}`}>
                      Criar Conta
                    </button>
                  </p>
                )}
                {mode === 'signup' && (
                  <p className="text-center text-xs zm-muted">
                    Já tem uma conta?{' '}
                    <button type="button" onClick={() => switchMode('login')} className={`font-bold transition-colors ${linkCls}`}>
                      Entrar
                    </button>
                  </p>
                )}
                {mode === 'forgot' && (
                  <button type="button" onClick={() => switchMode('login')} className={`text-xs text-center w-full flex items-center justify-center gap-1.5 transition-colors ${isDarkMode ? 'text-white/35 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`}>
                    <X size={13} /> Voltar ao login
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
