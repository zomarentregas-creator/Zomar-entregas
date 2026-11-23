// src/components/shared/DeleteAccountModal.tsx
import { useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { deleteAccount } from '../../lib/deleteAccount'

interface Props {
  userEmail: string
  /** Contas criadas com Google não têm palavra-passe: só pedem a palavra de confirmação. */
  requirePassword?: boolean
  onClose: () => void
  onDeleted: () => void
}

export default function DeleteAccountModal({ userEmail, requirePassword = true, onClose, onDeleted }: Props) {
  const [password, setPassword] = useState('')
  const [word, setWord] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ready = word.trim().toUpperCase() === 'ELIMINAR' && (!requirePassword || password.length > 0)

  const handleConfirm = async () => {
    if (!ready || loading) return
    setError(''); setLoading(true)
    try {
      if (requirePassword) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: userEmail, password })
        if (signInError) { setError('Palavra-passe incorrecta.'); return }
      }
      await deleteAccount()
      onDeleted()
    } catch (err) {
      setError((err as Error).message)
    } finally { setLoading(false) }
  }

  const field = 'w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50'

  return (
    <div className="zn-fade fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={loading ? undefined : onClose}>
      <div className="zn-modal w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0d1318] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/15"><AlertTriangle size={18} className="text-red-400" /></div>
            <h2 className="text-base font-bold text-white">Eliminar conta</h2>
          </div>
          <button onClick={onClose} disabled={loading} aria-label="Fechar" className="p-1.5 hover:bg-white/5 rounded-lg"><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-gray-300 text-sm leading-relaxed">
            Esta ação é <b className="text-red-400">irreversível</b>. O seu perfil e as suas definições são removidos.
            Entregas concluídas são mantidas de forma anónima para o histórico dos outros utilizadores.
          </p>
          <p className="text-xs text-gray-500">Não é possível eliminar com entregas em curso ou levantamentos pendentes.</p>

          {requirePassword && (
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
              placeholder="A sua palavra-passe" className={field} />
          )}
          <input value={word} onChange={e => setWord(e.target.value)} placeholder='Escreva ELIMINAR para confirmar' className={field} autoCapitalize="characters" />

          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">{error}</div>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 border border-white/10 text-gray-300 rounded-xl text-sm hover:bg-white/5 transition-colors">Cancelar</button>
            <button onClick={handleConfirm} disabled={loading || !ready}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-400 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
