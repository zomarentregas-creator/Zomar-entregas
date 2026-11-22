// src/components/Auth/MfaGate.tsx
// Se o utilizador activou o 2FA (TOTP), pede o código antes de mostrar a área protegida.
// Nota: é um bloqueio da interface. Para impor o 2FA também na base de dados seria preciso
// políticas RLS que exijam `auth.jwt()->>'aal' = 'aal2'`.
import { useEffect, useState } from 'react'
import { ShieldCheck, Loader2, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Loader from '../Common/Loader'

type State = 'checking' | 'ok' | 'challenge'

export default function MfaGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth()
  const [state, setState] = useState<State>('checking')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let on = true
    ;(async () => {
      try {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (!on) return
        if (data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
          const { data: f } = await supabase.auth.mfa.listFactors()
          const totp = (f?.totp ?? []).find(x => x.status === 'verified')
          if (!on) return
          if (totp) { setFactorId(totp.id); setState('challenge'); return }
        }
        setState('ok')
      } catch { if (on) setState('ok') }
    })()
    return () => { on = false }
  }, [])

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId || code.length !== 6 || busy) return
    setBusy(true); setError('')
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
    if (chErr || !ch) { setBusy(false); setError('Não foi possível validar. Tente novamente.'); return }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code })
    setBusy(false)
    if (vErr) { setError('Código incorrecto.'); setCode(''); return }
    setState('ok')
  }

  if (state === 'checking') return <Loader />
  if (state === 'ok') return <>{children}</>

  return (
    <div className="zm-dark min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--zm-bg, #0a0f14)' }}>
      <form onSubmit={verify} className="w-full max-w-sm rounded-2xl border border-emerald-500/20 bg-[#0d1318] p-6 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="text-emerald-400" size={24} />
        </div>
        <h1 className="text-lg font-bold text-white text-center">Verificação em dois passos</h1>
        <p className="text-xs text-gray-500 text-center mt-1 mb-5">Introduza o código de 6 dígitos da sua app autenticadora.</p>
        <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000"
          className="w-full text-center tracking-[0.5em] text-xl px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-700 focus:outline-none focus:border-emerald-500/50" />
        {error && <p className="text-xs text-red-400 text-center mt-3">{error}</p>}
        <button type="submit" disabled={busy || code.length !== 6}
          className="w-full mt-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
          {busy && <Loader2 size={15} className="animate-spin" />}Verificar
        </button>
        <button type="button" onClick={() => signOut()} className="w-full mt-2 py-2 text-xs text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1.5">
          <LogOut size={12} />Sair
        </button>
      </form>
    </div>
  )
}
