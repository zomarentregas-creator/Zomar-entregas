// Linha do tempo de 4 etapas (criado → atribuído → recolhido → entregue).
import { Check } from 'lucide-react'
import type { TrackStep } from '../../lib/tracking'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('pt-MZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function TrackingTimeline({ steps, dark }: { steps: TrackStep[]; dark: boolean }) {
  return (
    <ol className="space-y-0" aria-label="Etapas da entrega">
      {steps.map((st, i) => {
        const last = i === steps.length - 1
        const active = st.done || st.current
        return (
          <li key={st.key} className="flex gap-3" aria-current={st.current ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0 ${
                st.done ? 'bg-emerald-500 border-emerald-500 text-black'
                : st.current ? (dark ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10' : 'border-emerald-600 text-emerald-700 bg-emerald-50')
                : (dark ? 'border-white/20 text-transparent' : 'border-gray-300 text-transparent')}`}>
                {st.done ? <Check size={14} aria-hidden /> : st.current ? <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" aria-hidden /> : null}
              </span>
              {!last && <span className={`w-0.5 flex-1 min-h-[28px] ${st.done ? 'bg-emerald-500' : dark ? 'bg-white/15' : 'bg-gray-200'}`} />}
            </div>
            <div className="pb-5">
              <p className={`text-sm font-semibold ${active ? (dark ? 'text-white' : 'text-gray-900') : (dark ? 'text-gray-500' : 'text-gray-400')}`}>{st.label}</p>
              <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                {st.at ? fmt(st.at) : st.current ? st.hint : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
