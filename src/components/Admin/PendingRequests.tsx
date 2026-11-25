// Pedidos de plano por confirmar: o admin vê o comprovativo recebido por WhatsApp e aceita ou rejeita.
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Loader2, MessageCircle, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Req {
  id: string; user_id: string; plan_name: string; price: number; notes: string | null; created_at: string
  name?: string; phone?: string | null
}

const fmtMZN = (v: number) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 0 }).format(v)
const when = (s: string) => new Date(s).toLocaleString('pt-MZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const waNumber = (p?: string | null) => (p ?? '').replace(/\D/g, '')

export default function PendingRequests({ isDark, onChanged, notify }: {
  isDark: boolean; onChanged: () => void; notify: (msg: string, type?: 'ok' | 'err') => void
}) {
  const [rows, setRows] = useState<Req[]>([])
  const [confirm, setConfirm] = useState<Req | null>(null)
  const [reject, setReject] = useState<Req | null>(null)
  const [months, setMonths] = useState(1)
  const [amount, setAmount] = useState('')
  const [ref, setRef] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('subscriptions')
      .select('id, user_id, plan_name, price, notes, created_at').eq('status', 'pending').order('created_at')
    const list = (data ?? []) as Req[]
    if (list.length) {
      const { data: ps } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', list.map(r => r.user_id))
      const m = new Map((ps ?? []).map(p => [p.user_id, p]))
      list.forEach(r => { r.name = m.get(r.user_id)?.full_name; r.phone = m.get(r.user_id)?.phone })
    }
    setRows(list)
  }, [])

  useEffect(() => {
    void load()
    const ch = supabase.channel('admin-pending-subs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => { void load() })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [load])

  const openConfirm = (r: Req) => { setConfirm(r); setMonths(1); setAmount(String(r.price)); setRef('') }
  const setM = (m: number) => { setMonths(m); if (confirm) setAmount(String(confirm.price * m)) }

  const run = async (fn: string, args: Record<string, unknown>, okMsg: string) => {
    setBusy(true)
    const { data, error } = await supabase.rpc(fn, args)
    setBusy(false)
    const r = data as { success?: boolean; error?: string } | null
    if (error || r?.success === false) { notify(r?.error || 'Operação falhou. Tente novamente.', 'err'); return }
    notify(okMsg); setConfirm(null); setReject(null); await load(); onChanged()
  }

  const doConfirm = () => {
    if (!confirm) return
    const a = Number(amount)
    if (!Number.isFinite(a) || a <= 0) { notify('Valor recebido inválido.', 'err'); return }
    void run('admin_activate_subscription', { p_subscription_id: confirm.id, p_months: months, p_amount: a, p_reference: ref }, `Plano activado para ${confirm.name ?? 'o cliente'}.`)
  }
  const doReject = () => reject && void run('admin_reject_subscription', { p_id: reject.id, p_reason: reason }, 'Pedido rejeitado.')

  if (rows.length === 0) return null

  const box = isDark ? 'bg-[#0d1318] border-white/10' : 'bg-white border-gray-200'
  const inp = `w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200'}`
  const muted = isDark ? 'text-gray-400' : 'text-gray-600'

  return (
    <>
      <section className={`rounded-2xl border p-4 ${isDark ? 'bg-amber-500/5 border-amber-500/30' : 'bg-amber-50 border-amber-300'}`} aria-label="Pedidos por confirmar">
        <h2 className={`font-bold text-sm mb-3 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
          {rows.length} pedido{rows.length > 1 ? 's' : ''} de plano por confirmar
        </h2>
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className={`rounded-xl border p-3 flex flex-wrap items-center gap-3 ${box}`}>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.name || 'Cliente'} · {r.plan_name} · {fmtMZN(r.price)}</p>
                <p className={`text-xs ${muted}`}>{when(r.created_at)} · Ref. <span className="font-mono">{r.notes || '—'}</span></p>
              </div>
              {waNumber(r.phone) && (
                <a href={`https://wa.me/${waNumber(r.phone)}`} target="_blank" rel="noopener noreferrer" aria-label={`Falar com ${r.name ?? 'o cliente'} no WhatsApp`}
                  className={`p-2 rounded-lg border ${isDark ? 'border-white/10 text-green-400 hover:bg-white/5' : 'border-gray-200 text-green-600 hover:bg-gray-50'}`}><MessageCircle size={15} aria-hidden /></a>
              )}
              <button onClick={() => openConfirm(r)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold"><CheckCircle size={14} aria-hidden /> Confirmar pagamento</button>
              <button onClick={() => { setReject(r); setReason('') }} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold ${isDark ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-300 text-red-600 hover:bg-red-50'}`}><XCircle size={14} aria-hidden /> Rejeitar</button>
            </div>
          ))}
        </div>
      </section>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !busy && setConfirm(null)}>
          <div role="dialog" aria-modal="true" aria-label="Confirmar pagamento" className={`w-full max-w-sm rounded-2xl border p-5 space-y-3 ${box}`} onClick={e => e.stopPropagation()}>
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Confirmar pagamento</h3>
            <p className={`text-xs ${muted}`}>{confirm.name} · {confirm.plan_name}. Confirme que o comprovativo recebido por WhatsApp é válido e que o valor entrou na conta.</p>
            <label className="block text-xs font-medium">Duração
              <select value={months} onChange={e => setM(Number(e.target.value))} className={`${inp} mt-1`}>
                {[1, 3, 6, 12].map(m => <option key={m} value={m}>{m} {m === 1 ? 'mês' : 'meses'}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium">Valor recebido (MZN)
              <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" className={`${inp} mt-1`} />
            </label>
            <label className="block text-xs font-medium">Referência do comprovativo
              <input value={ref} onChange={e => setRef(e.target.value)} maxLength={80} placeholder="Código e-Mola / M-Pesa (opcional)" className={`${inp} mt-1`} />
            </label>
            <div className="flex gap-2 pt-1">
              <button disabled={busy} onClick={() => setConfirm(null)} className={`flex-1 py-2.5 rounded-xl border text-sm ${isDark ? 'border-white/10 text-gray-300' : 'border-gray-200 text-gray-600'}`}>Voltar</button>
              <button disabled={busy} onClick={doConfirm} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold inline-flex items-center justify-center gap-2">
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden />} Activar plano
              </button>
            </div>
          </div>
        </div>
      )}

      {reject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !busy && setReject(null)}>
          <div role="dialog" aria-modal="true" aria-label="Rejeitar pedido" className={`w-full max-w-sm rounded-2xl border p-5 space-y-3 ${box}`} onClick={e => e.stopPropagation()}>
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Rejeitar pedido</h3>
            <p className={`text-xs ${muted}`}>O cliente recebe uma notificação com o motivo.</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={300} placeholder="Ex.: comprovativo ilegível ou valor em falta" className={`${inp} resize-none`} />
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => setReject(null)} className={`flex-1 py-2.5 rounded-xl border text-sm ${isDark ? 'border-white/10 text-gray-300' : 'border-gray-200 text-gray-600'}`}>Voltar</button>
              <button disabled={busy} onClick={doReject} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold">Rejeitar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
