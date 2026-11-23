// src/pages/admin/AdminWithdrawals.tsx
// Fila de levantamentos dos entregadores: aprovar, concluir (após pagar) ou rejeitar.
import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '../../components/Admin/Adminlayout'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Check, X, Banknote, Loader2, Clock, CheckCircle, XCircle, Phone } from 'lucide-react'

interface Withdrawal {
  id: string; user_id: string; amount: number; fee?: number | null; net_amount?: number | null
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  payment_method: string; phone_number?: string | null; bank_data?: string | null
  requested_at: string; processed_at: string | null; completed_at: string | null
  admin_notes: string | null; rejection_reason: string | null
  name?: string
}

const fmt = (v: number) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 0 }).format(v || 0)
const when = (s: string) => new Date(s).toLocaleString('pt-MZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const STATUS: Record<string, { label: string; cls: string; icon: JSX.Element }> = {
  pending:   { label: 'Pendente',  cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',   icon: <Clock size={11} /> },
  approved:  { label: 'Aprovado',  cls: 'bg-sky-500/15 text-sky-400 border-sky-500/25',            icon: <Check size={11} /> },
  completed: { label: 'Pago',      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', icon: <CheckCircle size={11} /> },
  rejected:  { label: 'Rejeitado', cls: 'bg-red-500/15 text-red-400 border-red-500/25',            icon: <XCircle size={11} /> },
}

export default function AdminWithdrawals() {
  const { isDark } = useTheme()
  const { user } = useAuth()
  const [rows, setRows] = useState<Withdrawal[]>([])
  const [filter, setFilter] = useState<'pending' | 'approved' | 'completed' | 'rejected' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [reject, setReject] = useState<Withdrawal | null>(null)
  const [reason, setReason] = useState('')

  const dk = (d: string, l: string) => (isDark ? d : l)
  const say = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('withdrawals').select('*').order('requested_at', { ascending: false }).limit(200)
    if (filter !== 'all') q = q.eq('status', filter)
    const { data, error } = await q
    if (error) { say('Não foi possível carregar os levantamentos.', false); setLoading(false); return }
    const list = (data ?? []) as Withdrawal[]
    const ids = [...new Set(list.map(w => w.user_id))]
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids)
      const m = new Map((ps ?? []).map((p: any) => [p.user_id, p.full_name]))
      list.forEach(w => { w.name = m.get(w.user_id) || 'Entregador' })
    }
    setRows(list); setLoading(false)
  }, [filter])

  useEffect(() => { void load() }, [load])

  const notify = (w: Withdrawal, title: string, message: string, type: string) =>
    supabase.from('notifications').insert({ user_id: w.user_id, title, message, type, read: false })

  const update = async (w: Withdrawal, patch: Record<string, unknown>, okMsg: string, note?: { title: string; message: string; type: string }) => {
    setBusy(w.id)
    const { error } = await supabase.from('withdrawals')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', w.id)
    if (error) { say('Falha ao actualizar o levantamento.', false); setBusy(null); return }
    if (note) await notify(w, note.title, note.message, note.type)
    await supabase.from('activity_logs').insert({
      actor_id: user?.id, user_id: w.user_id, action: 'withdrawal_updated',
      entity_type: 'withdrawal', entity_id: w.id, metadata: { status: patch.status, amount: w.amount },
    })
    say(okMsg); setBusy(null); void load()
  }

  const approve = (w: Withdrawal) => update(w, { status: 'approved', processed_at: new Date().toISOString() }, 'Levantamento aprovado.',
    { title: 'Levantamento aprovado', message: `O seu levantamento de ${fmt(w.amount)} foi aprovado e será pago em breve.`, type: 'withdrawal_approved' })
  const complete = (w: Withdrawal) => update(w, { status: 'completed', completed_at: new Date().toISOString() }, 'Marcado como pago.',
    { title: 'Levantamento pago', message: `O pagamento de ${fmt(w.net_amount ?? w.amount)} foi enviado.`, type: 'withdrawal_status' })
  const doReject = async () => {
    if (!reject) return
    const r = reason.trim()
    if (r.length < 5) { say('Indique o motivo da rejeição.', false); return }
    const w = reject; setReject(null); setReason('')
    await update(w, { status: 'rejected', rejection_reason: r, processed_at: new Date().toISOString() }, 'Levantamento rejeitado. O saldo volta a ficar disponível.',
      { title: 'Levantamento rejeitado', message: `O seu levantamento de ${fmt(w.amount)} foi rejeitado: ${r}`, type: 'withdrawal_rejected' })
  }

  const card = `rounded-2xl border ${dk('bg-[#0d1318]/80 border-emerald-500/10', 'bg-white border-gray-200 shadow-sm')}`
  const FILTERS: Array<[typeof filter, string]> = [['pending', 'Pendentes'], ['approved', 'Aprovados'], ['completed', 'Pagos'], ['rejected', 'Rejeitados'], ['all', 'Todos']]
  const pendingTotal = rows.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0)

  return (
    <AdminLayout>
      <div className="space-y-5">
        {toast && (
          <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg ${toast.ok ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'}`}>{toast.msg}</div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>Levantamentos</h1>
            <p className={`text-sm mt-0.5 ${dk('text-gray-500', 'text-gray-500')}`}>
              {filter === 'pending' ? `${rows.length} pendente(s) · ${fmt(pendingTotal)}` : 'Aprove, pague e registe os pedidos dos entregadores'}
            </p>
          </div>
          <button onClick={load} aria-label="Actualizar" className={`p-2.5 rounded-xl ${dk('bg-white/5 hover:bg-white/10 text-gray-400', 'bg-gray-100 hover:bg-gray-200 text-gray-500')}`}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter === k ? 'bg-emerald-500 text-black border-emerald-500' : dk('border-white/10 text-gray-400 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-emerald-400" /></div>
        ) : rows.length === 0 ? (
          <div className={`${card} py-14 text-center`}>
            <Banknote size={32} className="mx-auto mb-3 text-gray-500" />
            <p className={`font-semibold ${dk('text-gray-300', 'text-gray-700')}`}>Sem levantamentos nesta lista</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(w => {
              const st = STATUS[w.status] ?? STATUS.pending
              const dest = w.phone_number || w.bank_data || '—'
              return (
                <div key={w.id} className={`${card} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-bold truncate ${dk('text-white', 'text-gray-900')}`}>{w.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{when(w.requested_at)} · #{w.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.icon}{st.label}</span>
                      <p className={`text-lg font-black mt-1 ${dk('text-emerald-400', 'text-emerald-600')}`}>{fmt(w.amount)}</p>
                    </div>
                  </div>
                  <div className={`mt-3 grid sm:grid-cols-3 gap-2 text-xs ${dk('text-gray-400', 'text-gray-600')}`}>
                    <div className={`p-2.5 rounded-xl ${dk('bg-white/5', 'bg-gray-50')}`}>Método<br /><b className={dk('text-white', 'text-gray-900')}>{w.payment_method.toUpperCase()}</b></div>
                    <div className={`p-2.5 rounded-xl ${dk('bg-white/5', 'bg-gray-50')} flex items-center gap-1.5`}><Phone size={12} /><span className="break-all"><b className={dk('text-white', 'text-gray-900')}>{dest}</b></span></div>
                    <div className={`p-2.5 rounded-xl ${dk('bg-white/5', 'bg-gray-50')}`}>A pagar<br /><b className={dk('text-white', 'text-gray-900')}>{fmt(w.net_amount ?? w.amount)}</b>{w.fee ? <span> (taxa {fmt(w.fee)})</span> : null}</div>
                  </div>
                  {w.rejection_reason && <p className="mt-2 text-xs text-red-400">Motivo: {w.rejection_reason}</p>}

                  {(w.status === 'pending' || w.status === 'approved') && (
                    <div className="flex gap-2 mt-3">
                      {w.status === 'pending' && (
                        <button disabled={busy === w.id} onClick={() => approve(w)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-50">
                          {busy === w.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar
                        </button>
                      )}
                      {w.status === 'approved' && (
                        <button disabled={busy === w.id} onClick={() => complete(w)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-50">
                          {busy === w.id ? <Loader2 size={13} className="animate-spin" /> : <Banknote size={13} />} Marcar como pago
                        </button>
                      )}
                      <button disabled={busy === w.id} onClick={() => { setReject(w); setReason('') }} className={`px-4 py-2 rounded-xl border text-xs font-semibold ${dk('border-red-500/30 text-red-400 hover:bg-red-500/10', 'border-red-300 text-red-600 hover:bg-red-50')}`}>
                        <X size={13} className="inline -mt-0.5 mr-1" />Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {reject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setReject(null)}>
            <div className={`w-full max-w-sm rounded-2xl border p-5 ${dk('bg-[#0d1318] border-white/10', 'bg-white border-gray-200')}`} onClick={e => e.stopPropagation()}>
              <h3 className={`font-bold mb-1 ${dk('text-white', 'text-gray-900')}`}>Rejeitar levantamento</h3>
              <p className="text-xs text-gray-500 mb-3">{reject.name} · {fmt(reject.amount)}. O entregador será notificado do motivo.</p>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={300} placeholder="Motivo da rejeição"
                className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none resize-none ${dk('bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500/50', 'bg-gray-50 border-gray-200')}`} />
              <div className="flex gap-2 mt-3">
                <button onClick={() => setReject(null)} className={`flex-1 py-2.5 rounded-xl border text-sm ${dk('border-white/10 text-gray-300', 'border-gray-200 text-gray-600')}`}>Voltar</button>
                <button onClick={doReject} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold">Rejeitar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
