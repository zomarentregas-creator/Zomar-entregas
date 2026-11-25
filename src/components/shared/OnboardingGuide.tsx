// src/components/shared/OnboardingGuide.tsx
// Guia rápido para novos utilizadores. NÃO é obrigatório:
//  - na primeira visita aparece só um convite discreto ("Começar" / "Agora não");
//  - o guia é um cartão no fundo do ecrã (sem bloquear a app), com "Ver esta página"
//    que leva ao local certo enquanto o passo continua visível;
//  - o estado (concluído/dispensado) fica guardado por utilizador neste dispositivo;
//  - pode ser reaberto a qualquer momento: Ajuda → "Guia rápido" ou menu da conta.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, X, ChevronLeft, ChevronRight, ArrowUpRight, Check,
  PlusCircle, Package, KeyRound, CreditCard, Bot, User, Wallet, Truck, Bell, HelpCircle,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

type GuideRole = 'entrepreneur' | 'deliverer'

interface Step {
  icon: LucideIcon
  title: string
  text: string
  /** Página onde o passo acontece (botão "Ver esta página") */
  path?: string
}

const STEPS: Record<GuideRole, Step[]> = {
  entrepreneur: [
    { icon: Sparkles, title: 'Bem-vindo à ZOMAR',
      text: 'Em poucos passos fica a saber como pedir entregas, acompanhá-las e confirmar a receção. Pode sair deste guia quando quiser.' },
    { icon: CreditCard, title: '1. Escolha um plano', path: '/entrepreneur/subscription',
      text: 'Para criar entregas precisa de um plano ativo. Compare os planos em "Plano" e comece com o período de teste de 7 dias.' },
    { icon: PlusCircle, title: '2. Crie uma entrega', path: '/entrepreneur/new-delivery',
      text: 'Em "Nova Entrega" indique o que vai ser entregue, a morada de recolha, a morada de destino e o valor do item. Os entregadores verificados são avisados na hora.' },
    { icon: Package, title: '3. Acompanhe o pedido', path: '/entrepreneur/active-deliveries',
      text: 'Em "Entregas Ativas" vê o estado de cada entrega: à espera de entregador, a caminho da recolha ou em rota. Pode cancelar enquanto o item não for recolhido.' },
    { icon: KeyRound, title: '4. Código de confirmação',
      text: 'Cada entrega tem um código de 6 caracteres. Dê-o ao destinatário e ele só o entrega ao entregador quando receber o item. É assim que a entrega fica concluída em segurança.' },
    { icon: Bot, title: 'Assistente ZOMAR',
      text: 'O botão flutuante no canto do ecrã responde a dúvidas e mostra as suas entregas. Quando propõe uma ação, como criar ou cancelar, só acontece depois de você confirmar.' },
    { icon: User, title: 'Perfil e segurança', path: '/entrepreneur/profile',
      text: 'Em "Perfil" mantém os seus dados e pode reforçar a segurança da conta. Recebe avisos de cada passo em "Notificações".' },
  ],
  deliverer: [
    { icon: Sparkles, title: 'Bem-vindo à ZOMAR',
      text: 'Em poucos passos fica a saber como aceitar entregas, concluí-las e receber os seus ganhos. Pode sair deste guia quando quiser.' },
    { icon: User, title: '1. Complete o seu perfil', path: '/deliverer/profile',
      text: 'Mantenha os seus dados e contacto atualizados em "Perfil". Os empreendedores confiam mais em perfis completos.' },
    { icon: Package, title: '2. Escolha entregas', path: '/deliverer/available-deliveries',
      text: 'Em "Disponíveis" vê as entregas por aceitar, com origem, destino e quanto vai ganhar. Aceite a que lhe convém: passa a ser sua.' },
    { icon: Truck, title: '3. Recolher e entregar', path: '/deliverer/my-deliveries',
      text: 'Em "Minhas Entregas" marque a recolha do item. Ao chegar ao destino peça o código de 6 caracteres ao destinatário e introduza-o para concluir.' },
    { icon: Wallet, title: '4. Receba os ganhos', path: '/deliverer/earnings',
      text: 'Recebe 80% do valor de cada entrega concluída. Em "Ganhos" pede o levantamento por M-Pesa, e-Mola, mKesh ou transferência (mínimo 50 MZN, taxa fixa de 10 MZN).' },
    { icon: Bot, title: 'Assistente ZOMAR',
      text: 'O botão flutuante responde a dúvidas, mostra entregas disponíveis e o seu saldo. Ações como aceitar só acontecem depois de você confirmar.' },
    { icon: Bell, title: 'Notificações e ajuda', path: '/deliverer/help',
      text: 'Receba avisos em "Notificações". Se tiver um problema numa entrega, reporte-o na própria entrega ou fale com o suporte em "Ajuda".' },
  ],
}

const OPEN_EVENT = 'zomar:open-guide'
const storageKey = (uid: string) => `zomar-guide-v1:${uid}`

/** Reabre o guia a partir de qualquer ecrã (Ajuda, menu da conta…). */
export function openGuide() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

type Mode = 'hidden' | 'invite' | 'tour'

export default function OnboardingGuide({ role, isDarkMode }: { role: GuideRole; isDarkMode: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const steps = STEPS[role]
  const [mode, setMode] = useState<Mode>('hidden')
  const [i, setI] = useState(0)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const uid = user?.id

  const remember = useCallback((state: 'done' | 'skipped') => {
    if (!uid) return
    try { localStorage.setItem(storageKey(uid), state) } catch { /* sem storage */ }
  }, [uid])

  // Convite na primeira visita (só se nunca foi concluído nem dispensado)
  useEffect(() => {
    if (!uid) return
    let seen: string | null = null
    try { seen = localStorage.getItem(storageKey(uid)) } catch { /* sem storage */ }
    if (seen) return
    const t = setTimeout(() => setMode('invite'), 1200)
    return () => clearTimeout(t)
  }, [uid])

  // Reabrir manualmente
  useEffect(() => {
    const open = () => { setI(0); setMode('tour') }
    window.addEventListener(OPEN_EVENT, open)
    return () => window.removeEventListener(OPEN_EVENT, open)
  }, [])

  const close = useCallback((state: 'done' | 'skipped') => {
    remember(state)
    setMode('hidden')
  }, [remember])

  // ESC fecha e foco no botão principal ao mudar de passo
  useEffect(() => {
    if (mode === 'hidden') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close('skipped') }
    window.addEventListener('keydown', onKey)
    primaryRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, i, close])

  if (!uid || mode === 'hidden') return null

  const dk = <T,>(dark: T, light: T) => (isDarkMode ? dark : light)
  const card = dk('bg-[#0f1a16]/95 border-emerald-500/25 text-white', 'bg-white/95 border-emerald-600/20 text-gray-900')
  const muted = dk('text-white/60', 'text-gray-600')
  const ghost = dk('text-white/70 hover:bg-white/10', 'text-gray-600 hover:bg-black/5')
  const wrap = 'fixed z-[70] left-1/2 -translate-x-1/2 bottom-24 sm:bottom-6 w-[calc(100%-2rem)] max-w-md'

  if (mode === 'invite') {
    return (
      <div className={wrap} role="dialog" aria-labelledby="zg-invite-title">
        <style>{`@keyframes zg-in{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
        <div className={`rounded-2xl border backdrop-blur-xl shadow-2xl p-4 ${card}`} style={{ animation: 'zg-in .35s ease both' }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p id="zg-invite-title" className="font-bold text-sm">Primeira vez por aqui?</p>
              <p className={`text-xs mt-0.5 ${muted}`}>Faça um guia rápido de 1 minuto. É opcional e fica sempre disponível em Ajuda.</p>
            </div>
            <button type="button" aria-label="Fechar convite" onClick={() => close('skipped')}
              className={`w-9 h-9 -mr-1 -mt-1 shrink-0 rounded-lg flex items-center justify-center ${ghost}`}>
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button ref={primaryRef} type="button" onClick={() => { setI(0); setMode('tour') }}
              className="flex-1 min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-bold">
              Começar guia
            </button>
            <button type="button" onClick={() => close('skipped')}
              className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold ${ghost}`}>
              Agora não
            </button>
          </div>
        </div>
      </div>
    )
  }

  const step = steps[i]
  const Icon = step.icon
  const last = i === steps.length - 1

  return (
    <div className={wrap} role="dialog" aria-labelledby="zg-title" aria-live="polite">
      <style>{`@keyframes zg-in{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
      <div className={`rounded-2xl border backdrop-blur-xl shadow-2xl p-4 sm:p-5 ${card}`} style={{ animation: 'zg-in .35s ease both' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
            <Icon size={20} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${dk('text-emerald-400', 'text-emerald-700')}`}>
              Guia rápido · {i + 1} de {steps.length}
            </p>
            <h2 id="zg-title" className="font-bold text-base leading-tight mt-0.5">{step.title}</h2>
          </div>
          <button type="button" aria-label="Sair do guia" onClick={() => close('skipped')}
            className={`w-9 h-9 -mr-1 -mt-1 shrink-0 rounded-lg flex items-center justify-center ${ghost}`}>
            <X size={16} />
          </button>
        </div>

        <p className={`text-sm mt-3 leading-relaxed ${muted}`}>{step.text}</p>

        {step.path && (
          <button type="button" onClick={() => navigate(step.path!)}
            className={`mt-3 inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-sm font-semibold ${dk('text-emerald-300 hover:bg-emerald-500/10', 'text-emerald-700 hover:bg-emerald-600/10')}`}>
            Ver esta página <ArrowUpRight size={15} />
          </button>
        )}

        <div className="flex items-center gap-1.5 mt-3" aria-hidden="true">
          {steps.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-emerald-500' : dk('w-1.5 bg-white/20', 'w-1.5 bg-black/15')}`} />
          ))}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button type="button" onClick={() => setI(v => Math.max(0, v - 1))} disabled={i === 0}
            aria-label="Passo anterior"
            className={`min-h-[44px] px-3 rounded-xl text-sm font-semibold flex items-center gap-1 disabled:opacity-30 ${ghost}`}>
            <ChevronLeft size={16} /> Anterior
          </button>
          <button ref={primaryRef} type="button"
            onClick={() => (last ? close('done') : setI(v => v + 1))}
            className="flex-1 min-h-[44px] rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-bold flex items-center justify-center gap-1.5">
            {last ? <>Concluir <Check size={16} /></> : <>Seguinte <ChevronRight size={16} /></>}
          </button>
        </div>

        <div className="flex items-center justify-between mt-2">
          <button type="button" onClick={() => close('skipped')}
            className={`min-h-[36px] text-xs font-semibold px-1 ${muted} hover:underline`}>
            Saltar guia
          </button>
          <span className={`text-[11px] flex items-center gap-1 ${muted}`}><HelpCircle size={12} /> Reabrir em Ajuda</span>
        </div>
      </div>
    </div>
  )
}
