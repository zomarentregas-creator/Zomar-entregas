// src/components/shared/SupportButton.tsx
// Botão de suporte flutuante reutilizável — abre Gmail em vez de mailto
import React, { useState, useEffect, useRef } from 'react'
import {
  Bot, Phone, Mail, Send, X, ChevronRight,
  Loader2, MessageCircle, Minimize2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface SupportMsg { id: string; role: 'user' | 'assistant'; content: string }

const GMAIL_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=zomarentregas%40gmail.com&su=Suporte%20ZOMAR`

interface Props {
  isDarkMode: boolean
  quickQuestions?: string[]
  /** Sobe o botão no mobile para não tapar a barra de navegação inferior */
  raiseOnMobile?: boolean
}

export default function SupportButton({ isDarkMode, quickQuestions, raiseOnMobile }: Props) {
  const { user } = useAuth() as any
  const [open,    setOpen]    = useState(false)
  const [view,    setView]    = useState<'menu' | 'chat'>('menu')
  const [msgs,    setMsgs]    = useState<SupportMsg[]>([])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [mini,    setMini]    = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const dk = (d: string, l: string) => isDarkMode ? d : l

  const QUICK = quickQuestions ?? [
    'Como criar uma entrega?',
    'Problemas com o meu plano',
    'Não consigo fazer login',
  ]

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const openChat = () => {
    setView('chat')
    if (msgs.length === 0) setMsgs([{
      id: '0', role: 'assistant',
      content: `Olá${user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}! 👋 Sou o assistente ZOMAR. Como posso ajudar?`,
    }])
  }

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: SupportMsg = { id: Date.now().toString(), role: 'user', content: text.trim() }
    setMsgs(p => [...p, userMsg])
    setInput('')
    setLoading(true)
    try {
      const history = [...msgs, userMsg]
        .filter(m => m.id !== '0')
        .map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: 'És o assistente virtual da ZOMAR, plataforma de entregas em Moçambique. Respondes em Português de Moçambique, és conciso e útil. Máximo 3 parágrafos por resposta.',
          messages: history,
        }),
      })
      const data = await res.json()
      const reply = data.content?.find((b: any) => b.type === 'text')?.text || 'Desculpa, tenta novamente.'
      setMsgs(p => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }])
    } catch {
      setMsgs(p => [...p, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Erro de ligação. Tenta via WhatsApp ou Email.' }])
    } finally {
      setLoading(false)
    }
  }

  const openEmail = () => window.open(GMAIL_URL, '_blank', 'noopener,noreferrer')

  return (
    <div className={`fixed right-4 sm:right-6 z-50 flex flex-col items-end gap-3 ${raiseOnMobile ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6' : 'bottom-4 sm:bottom-6'}`}>

      {/* Painel principal */}
      {open && !mini && (
        <div
          className={`rounded-2xl border shadow-2xl overflow-hidden ${dk('bg-[#141414] border-white/10', 'bg-white border-gray-200')}`}
          style={{
            width: 'min(320px, calc(100vw - 32px))',
            maxHeight: view === 'chat' ? 480 : 'auto',
          }}
        >
          {/* Cabeçalho */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${dk('border-white/8 bg-[#1a1a1a]', 'border-gray-100 bg-gray-50')}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <Bot size={15} className="text-white"/>
              </div>
              <div>
                <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>Suporte ZOMAR</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                  <p className={`text-[10px] ${dk('text-gray-500', 'text-gray-500')}`}>Online</p>
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              {view === 'chat' && (
                <button onClick={() => setView('menu')}
                  className={`p-1.5 rounded-lg ${dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}>
                  <ChevronRight size={13} className="rotate-180"/>
                </button>
              )}
              <button onClick={() => setMini(true)}
                className={`p-1.5 rounded-lg ${dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}>
                <Minimize2 size={13}/>
              </button>
              <button onClick={() => { setOpen(false); setView('menu') }}
                className={`p-1.5 rounded-lg ${dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}>
                <X size={13}/>
              </button>
            </div>
          </div>

          {/* Menu de canais */}
          {view === 'menu' && (
            <div className="p-4 space-y-2.5">
              <p className={`text-xs ${dk('text-gray-400', 'text-gray-500')}`}>Como preferes ser atendido?</p>
              {[
                {
                  icon: <Bot size={17} className="text-emerald-400"/>,
                  bg: 'bg-emerald-500/15',
                  title: 'Assistente Virtual',
                  sub: 'Respostas instantâneas com IA',
                  action: openChat,
                },
                {
                  icon: <Phone size={17} className="text-green-400"/>,
                  bg: 'bg-green-500/15',
                  title: 'WhatsApp',
                  sub: '+258 84 258 9799',
                  action: () => window.open('https://wa.me/258842589799', '_blank', 'noopener,noreferrer'),
                },
                {
                  icon: <Mail size={17} className="text-blue-400"/>,
                  bg: 'bg-blue-500/15',
                  title: 'Email',
                  sub: 'zomarentregas@gmail.com',
                  // ← Abre Gmail no browser em vez de mailto:
                  action: openEmail,
                },
              ].map(opt => (
                <button key={opt.title} onClick={opt.action}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${dk('border-white/8 hover:border-white/18 hover:bg-white/5', 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')}`}>
                  <div className={`p-2 rounded-lg flex-shrink-0 ${opt.bg}`}>{opt.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>{opt.title}</p>
                    <p className={`text-xs truncate ${dk('text-gray-500', 'text-gray-500')}`}>{opt.sub}</p>
                  </div>
                  <ChevronRight size={13} className={`flex-shrink-0 ${dk('text-gray-600', 'text-gray-400')}`}/>
                </button>
              ))}
            </div>
          )}

          {/* Chat IA */}
          {view === 'chat' && (
            <div className="flex flex-col" style={{ height: 380 }}>
              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'none' }}>
                {msgs.length <= 1 && (
                  <div className="space-y-1.5">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${dk('text-gray-600', 'text-gray-400')}`}>
                      Perguntas rápidas
                    </p>
                    {QUICK.map(q => (
                      <button key={q} onClick={() => send(q)}
                        className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-all ${dk('border-white/8 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {msgs.map(m => (
                  <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex-shrink-0 flex items-center justify-center mt-0.5">
                        <Bot size={11} className="text-white"/>
                      </div>
                    )}
                    <div className={`max-w-[82%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-emerald-500 text-black rounded-br-sm'
                        : dk('bg-white/8 text-gray-200 rounded-bl-sm', 'bg-gray-100 text-gray-700 rounded-bl-sm')
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                      <Bot size={11} className="text-white"/>
                    </div>
                    <div className={`px-3 py-2 rounded-xl ${dk('bg-white/8', 'bg-gray-100')}`}>
                      <Loader2 size={13} className={`animate-spin ${dk('text-gray-400', 'text-gray-500')}`}/>
                    </div>
                  </div>
                )}
                <div ref={endRef}/>
              </div>

              {/* Input */}
              <div className={`p-3 border-t ${dk('border-white/8', 'border-gray-100')}`}>
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
                    placeholder="Escreve uma mensagem…"
                    className={`flex-1 px-3 py-2 rounded-xl text-xs border focus:outline-none transition-all ${dk('bg-white/8 border-white/10 text-white placeholder-gray-600 focus:border-white/25', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300')}`}
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={!input.trim() || loading}
                    className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-40 transition-all active:scale-95">
                    <Send size={13}/>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mini pill */}
      {open && mini && (
        <button onClick={() => setMini(false)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg ${dk('bg-[#1a1a1a] border-white/10 text-white', 'bg-white border-gray-200 text-gray-900')}`}>
          <MessageCircle size={15} className="text-emerald-400"/>
          <span className="text-sm font-medium">Suporte</span>
        </button>
      )}

      {/* FAB */}
      {!mini && (
        <button
          onClick={() => { setOpen(p => !p); setMini(false); if (!open) setView('menu') }}
          className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all">
          {open
            ? <X size={20} className="text-white"/>
            : <MessageCircle size={20} className="text-white"/>
          }
          {!open && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-black flex items-center justify-center">
              <span className="text-[8px] text-white font-black">!</span>
            </span>
          )}
        </button>
      )}
    </div>
  )
}