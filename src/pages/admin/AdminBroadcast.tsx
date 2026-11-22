// src/pages/admin/AdminBroadcast.tsx
// Envio de notificações em massa para todos, só empreendedores ou só entregadores.
import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/Admin/Adminlayout'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Megaphone, Send, Loader2, Users, Truck, Briefcase, CheckCircle, AlertCircle } from 'lucide-react'

type Audience = 'all' | 'entrepreneur' | 'deliverer'
type Kind = 'info' | 'warning' | 'success'

interface Sent { id: string; created_at: string; metadata: { title?: string; audience?: Audience; recipients?: number } }

const AUDIENCES: Array<{ id: Audience; label: string; icon: JSX.Element }> = [
  { id: 'all', label: 'Todos', icon: <Users size={14} /> },
  { id: 'entrepreneur', label: 'Empreendedores', icon: <Briefcase size={14} /> },
  { id: 'deliverer', label: 'Entregadores', icon: <Truck size={14} /> },
]
const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'info', label: 'Informação' }, { id: 'warning', label: 'Aviso' }, { id: 'success', label: 'Novidade' },
]
const AUD_LABEL: Record<string, string> = { all: 'Todos', entrepreneur: 'Empreendedores', deliverer: 'Entregadores' }

export default function AdminBroadcast() {
  const { isDark } = useTheme()
  const { user } = useAuth()
  const [audience, setAudience] = useState<Audience>('all')
  const [kind, setKind] = useState<Kind>('info')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<Sent[]>([])
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const dk = (d: string, l: string) => (isDark ? d : l)
  const say = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  const recipients = useCallback(async (aud: Audience) => {
    const q = supabase.from('profiles').select('user_id').eq('status', 'ativo').in('role', aud === 'all' ? ['entrepreneur', 'deliverer'] : [aud]).limit(20000)
    const { data } = await q
    return (data ?? []).map((p: any) => p.user_id as string)
  }, [])

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from('activity_logs').select('id, created_at, metadata').eq('action', 'broadcast_sent').order('created_at', { ascending: false }).limit(8)
    setHistory((data ?? []) as Sent[])
  }, [])

  useEffect(() => { void loadHistory() }, [loadHistory])
  useEffect(() => { let on = true; setCount(null); recipients(audience).then(r => { if (on) setCount(r.length) }); return () => { on = false } }, [audience, recipients])

  const send = async () => {
    const t = title.trim(), m = message.trim()
    if (t.length < 3 || m.length < 5) { say('Preencha o título e a mensagem.', false); return }
    if (!window.confirm(`Enviar a ${count ?? '?'} utilizador(es)?`)) return
    setSending(true)
    try {
      const ids = await recipients(audience)
      if (!ids.length) { say('Não há destinatários activos.', false); return }
      for (let i = 0; i < ids.length; i += 500) {
        const rows = ids.slice(i, i + 500).map(uid => ({ user_id: uid, title: t.slice(0, 120), message: m.slice(0, 600), type: kind, read: false }))
        const { error } = await supabase.from('notifications').insert(rows)
        if (error) throw error
      }
      await supabase.from('activity_logs').insert({
        actor_id: user?.id, action: 'broadcast_sent', entity_type: 'broadcast',
        metadata: { title: t, audience, recipients: ids.length },
      })
      setTitle(''); setMessage('')
      say(`Enviado a ${ids.length} utilizador(es).`); void loadHistory()
    } catch {
      say('Falha ao enviar. Algumas notificações podem não ter sido entregues.', false)
    } finally { setSending(false) }
  }

  const card = `rounded-2xl border ${dk('bg-[#0d1318]/80 border-emerald-500/10', 'bg-white border-gray-200 shadow-sm')}`
  const input = `w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${dk('bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500/50', 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500')}`

  return (
    <AdminLayout>
      <div className="space-y-5 max-w-3xl">
        {toast && (
          <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg ${toast.ok ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'}`}>
            {toast.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}{toast.msg}
          </div>
        )}
        <div>
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${dk('text-white', 'text-gray-900')}`}><Megaphone size={22} className="text-emerald-400" />Notificações</h1>
          <p className="text-sm text-gray-500 mt-0.5">Envie um aviso que aparece no centro de notificações de cada utilizador.</p>
        </div>

        <div className={`${card} p-5 space-y-4`}>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Destinatários</label>
            <div className="flex gap-2 flex-wrap">
              {AUDIENCES.map(a => (
                <button key={a.id} onClick={() => setAudience(a.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${audience === a.id ? 'bg-emerald-500 text-black border-emerald-500' : dk('border-white/10 text-gray-400 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
                  {a.icon}{a.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">{count === null ? 'A contar…' : `${count} utilizador(es) activo(s)`}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Tipo</label>
            <div className="flex gap-2">
              {KINDS.map(k => (
                <button key={k.id} onClick={() => setKind(k.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${kind === k.id ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : dk('border-white/10 text-gray-500', 'border-gray-200 text-gray-500')}`}>{k.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Título</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Ex.: Manutenção programada" className={input} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Mensagem <span className="text-gray-600">({message.length}/600)</span></label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={600} rows={4} placeholder="Escreva a mensagem…" className={`${input} resize-none`} />
          </div>

          <button onClick={send} disabled={sending || !title.trim() || !message.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40 active:scale-[0.99] transition-all">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}Enviar notificação
          </button>
        </div>

        <div className={`${card} p-5`}>
          <h2 className={`text-sm font-bold mb-3 ${dk('text-white', 'text-gray-900')}`}>Últimos envios</h2>
          {history.length === 0 ? <p className="text-xs text-gray-500">Ainda não enviou nenhuma notificação.</p> : (
            <ul className="divide-y divide-white/5">
              {history.map(h => (
                <li key={h.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${dk('text-gray-200', 'text-gray-800')}`}>{h.metadata?.title ?? 'Sem título'}</p>
                    <p className="text-xs text-gray-500">{AUD_LABEL[h.metadata?.audience ?? 'all']} · {h.metadata?.recipients ?? 0} destinatário(s)</p>
                  </div>
                  <span className="text-[11px] text-gray-500 flex-shrink-0">{new Date(h.created_at).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
