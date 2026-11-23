// src/components/shared/ReportProblemModal.tsx
// Regista um incidente (tabela `incidents`) e marca a entrega com problema.
import { useState } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  deliveryId: string
  onClose: () => void
  onReported: () => void
}

const TYPES: Array<[string, string]> = [
  ['delay', 'Atraso na entrega'],
  ['damaged', 'Item danificado'],
  ['wrong_address', 'Morada errada'],
  ['unreachable', 'Contacto não responde'],
  ['other', 'Outro'],
]

export default function ReportProblemModal({ deliveryId, onClose, onReported }: Props) {
  const { user } = useAuth()
  const [description, setDescription] = useState('')
  const [type, setType] = useState('other')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = description.trim()
    if (text.length < 10) { setError('Descreva o problema com pelo menos 10 caracteres.'); return }
    if (!user?.id) { setError('Sessão expirada. Entre novamente.'); return }

    setSubmitting(true); setError('')
    try {
      const { error: insertError } = await supabase.from('incidents').insert({
        delivery_id: deliveryId, reported_by: user.id, incident_type: type,
        description: text.slice(0, 800), status: 'open',
      })
      if (insertError) throw insertError

      await supabase.from('deliveries')
        .update({ current_status: 'problem', updated_at: new Date().toISOString() })
        .eq('id', deliveryId)

      onReported()
    } catch {
      setError('Não foi possível enviar o problema. Tente novamente ou contacte o suporte.')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="zn-fade fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="zn-modal w-full max-w-md rounded-2xl border border-emerald-500/15 bg-[#0d1318] shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/15"><AlertCircle className="text-red-400" size={18} /></div>
            <h2 className="text-base font-bold text-white">Reportar problema</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 hover:bg-white/5 rounded-lg"><X size={18} className="text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Tipo de problema</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50">
              {TYPES.map(([v, l]) => <option key={v} value={v} className="bg-[#0d1318]">{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={800} required
              placeholder="Descreva o que aconteceu…"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none" />
          </div>
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">{error}</div>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-white/10 text-gray-300 rounded-xl text-sm hover:bg-white/5 transition-colors">Cancelar</button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 size={14} className="animate-spin" />}Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
