// src/components/deliverer/WithdrawModal.tsx
// Pedido de levantamento. A validação final (saldo, mínimo, taxa, formato) é feita
// no servidor pela função request_withdrawal; aqui só se valida para dar feedback rápido.
import { useState } from 'react'
import { X, Loader2, Wallet, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Props {
  isDarkMode: boolean
  balance: number
  onClose: () => void
  onDone: () => void
}

type Method = 'm-pesa' | 'e-mola' | 'mkesh' | 'bank_transfer'

const METHODS: Array<{ id: Method; label: string }> = [
  { id: 'm-pesa', label: 'M-Pesa' },
  { id: 'e-mola', label: 'e-Mola' },
  { id: 'mkesh', label: 'mKesh' },
  { id: 'bank_transfer', label: 'Banco' },
]

const MIN = 50
const FEE = 10
const fmt = (v: number) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 0 }).format(v || 0)

export default function WithdrawModal({ isDarkMode, balance, onClose, onDone }: Props) {
  const [method, setMethod] = useState<Method>('m-pesa')
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState('+258')
  const [nib, setNib] = useState('')
  const [bankName, setBankName] = useState('')
  const [holder, setHolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const dk = (d: string, l: string) => (isDarkMode ? d : l)
  const value = Number(amount.replace(',', '.'))
  const valid = Number.isFinite(value) && value >= MIN && value <= balance

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!valid) { setError(value > balance ? 'Saldo insuficiente.' : `O valor mínimo é ${fmt(MIN)}.`); return }
    if (method === 'bank_transfer') {
      if (!/^[0-9]{21}$/.test(nib.replace(/\s/g, ''))) { setError('O NIB tem 21 dígitos.'); return }
      if (!bankName.trim() || !holder.trim()) { setError('Indique o banco e o titular da conta.'); return }
    } else if (!/^\+258[0-9]{8,9}$/.test(phone.replace(/\s/g, ''))) {
      setError('Use o formato +258XXXXXXXXX.'); return
    }
    setBusy(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('request_withdrawal', {
        p_amount: value,
        p_method: method,
        p_phone: method === 'bank_transfer' ? null : phone.replace(/\s/g, ''),
        p_bank: method === 'bank_transfer'
          ? { nib: nib.replace(/\s/g, ''), bankName: bankName.trim(), accountHolder: holder.trim() }
          : null,
      })
      if (rpcError) throw rpcError
      if (!data?.success) { setError(data?.error || 'Não foi possível pedir o levantamento.'); return }
      setDone(true)
      setTimeout(onDone, 1600)
    } catch {
      setError('Não foi possível concluir o pedido. Tente novamente dentro de instantes.')
    } finally { setBusy(false) }
  }

  const input = `w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none transition-all ${dk('bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500/50', 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500')}`

  return (
    <div className="zn-fade fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`zn-modal w-full max-w-md rounded-2xl border shadow-2xl max-h-[92vh] overflow-y-auto ${dk('bg-[#0d1318] border-emerald-500/15', 'bg-white border-gray-200')}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-5 border-b ${dk('border-white/8', 'border-gray-100')}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15"><Wallet size={18} className="text-emerald-400" /></div>
            <div>
              <h3 className={`font-bold ${dk('text-white', 'text-gray-900')}`}>Levantar saldo</h3>
              <p className="text-xs text-gray-500">Disponível: <b className="text-emerald-400">{fmt(balance)}</b></p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-white/5"><X size={18} className="text-gray-400" /></button>
        </div>

        {done ? (
          <div className="p-10 text-center">
            <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
            <p className={`font-bold ${dk('text-white', 'text-gray-900')}`}>Pedido enviado</p>
            <p className="text-sm text-gray-500 mt-1">Fica pendente até ser processado pela equipa. Será notificado.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2">Receber por</label>
              <div className="grid grid-cols-4 gap-2">
                {METHODS.map(m => (
                  <button type="button" key={m.id} onClick={() => setMethod(m.id)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all ${method === m.id ? 'bg-emerald-500 text-black border-emerald-500' : dk('border-white/10 text-gray-400 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>{m.label}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Valor (MZN)</label>
              <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder={`Mínimo ${MIN}`} className={input} />
              <button type="button" onClick={() => setAmount(String(Math.floor(balance)))} className="mt-1.5 text-xs text-emerald-400 hover:text-emerald-300">Usar todo o saldo</button>
            </div>

            {method === 'bank_transfer' ? (
              <>
                <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">NIB (21 dígitos)</label>
                  <input inputMode="numeric" value={nib} onChange={e => setNib(e.target.value.replace(/[^0-9 ]/g, ''))} maxLength={26} className={input} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">Banco</label>
                    <input value={bankName} onChange={e => setBankName(e.target.value)} maxLength={60} className={input} /></div>
                  <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">Titular</label>
                    <input value={holder} onChange={e => setHolder(e.target.value)} maxLength={80} className={input} /></div>
                </div>
              </>
            ) : (
              <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">Número {METHODS.find(m => m.id === method)?.label}</label>
                <input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9+ ]/g, ''))} maxLength={16} className={input} /></div>
            )}

            {valid && (
              <div className={`rounded-xl p-3 text-xs space-y-1 ${dk('bg-white/5', 'bg-gray-50')}`}>
                <div className="flex justify-between text-gray-400"><span>Valor</span><span>{fmt(value)}</span></div>
                <div className="flex justify-between text-gray-400"><span>Taxa</span><span>− {fmt(FEE)}</span></div>
                <div className={`flex justify-between font-bold pt-1 border-t ${dk('border-white/10 text-white', 'border-gray-200 text-gray-900')}`}><span>Recebe</span><span className="text-emerald-400">{fmt(value - FEE)}</span></div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{error}
              </div>
            )}

            <button type="submit" disabled={busy || !amount}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-40 active:scale-[0.99] transition-all">
              {busy && <Loader2 size={15} className="animate-spin" />}Pedir levantamento
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
