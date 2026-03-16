// src/components/Common/SupportButton.tsx
/**
 * ============================================================================
 * SUPPORT BUTTON — Botão flutuante de suporte / assistente
 * ============================================================================
 * Funcionalidades:
 *  - Botão flutuante no canto inferior direito (todos os layouts)
 *  - Chat com assistente de IA via Anthropic API
 *  - Opções de suporte rápido (WhatsApp, Email, FAQ)
 *  - Compatível com modo claro/escuro
 */

import { useState, useRef, useEffect } from 'react'
import {
  MessageCircle, X, Send, Bot, Mail, HelpCircle,
  ChevronRight, Loader2, Phone, ExternalLink, Minimize2
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface SupportButtonProps {
  isDarkMode?: boolean
  userRole?: 'entrepreneur' | 'deliverer' | 'admin'
  userName?: string
}

const QUICK_QUESTIONS = [
  'Como criar uma nova entrega?',
  'Como rastrear a minha encomenda?',
  'Como alterar o meu plano?',
  'Problemas com pagamento',
]

const SYSTEM_PROMPT = `És o assistente virtual da ZOMAR, uma plataforma de entregas em Moçambique. 
Respondes sempre em Português (variante moçambicana/brasileira). 
És prestável, conciso e profissional. 
A plataforma tem três tipos de utilizadores: Empreendedores (que criam entregas), Entregadores (que fazem as entregas) e Administradores.
Ajudas com: criação de entregas, rastreamento, planos/subscrições, problemas técnicos, e questões gerais da plataforma.
Mantém as respostas curtas (máx. 3 parágrafos) e objectivas.`

export default function SupportButton({ isDarkMode = true, userRole, userName }: SupportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'chat'>('menu')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  useEffect(() => {
    if (isOpen && view === 'chat' && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, view, isMinimized])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openChat = () => {
    setView('chat')
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Olá${userName ? `, ${userName.split(' ')[0]}` : ''}! 👋 Sou o assistente da ZOMAR. Como posso ajudar${userRole === 'entrepreneur' ? ' com as tuas entregas' : userRole === 'deliverer' ? '-te hoje' : ''}?`,
        timestamp: new Date(),
      }])
    }
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const history = [...messages, userMsg]
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: history,
        }),
      })

      const data = await response.json()
      const text = data.content?.find((b: any) => b.type === 'text')?.text || 'Desculpa, não consegui processar a tua mensagem.'

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: text,
        timestamp: new Date(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Ocorreu um erro. Por favor tenta novamente ou contacta o suporte via WhatsApp.',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const accentColor = userRole === 'admin' ? 'orange' : 'emerald'
  const accentClasses = {
    button: userRole === 'admin'
      ? 'bg-gradient-to-br from-orange-500 to-amber-500 shadow-orange-500/40'
      : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/40',
    badge: userRole === 'admin'
      ? dk('bg-orange-500/15 text-orange-400 border-orange-500/25', 'bg-orange-50 text-orange-600 border-orange-200')
      : dk('bg-emerald-500/15 text-emerald-400 border-emerald-500/25', 'bg-emerald-50 text-emerald-600 border-emerald-200'),
    send: userRole === 'admin'
      ? 'bg-orange-500 hover:bg-orange-400'
      : 'bg-emerald-500 hover:bg-emerald-400',
    dot: userRole === 'admin' ? 'bg-orange-400' : 'bg-emerald-400',
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* ── Painel principal ── */}
      {isOpen && !isMinimized && (
        <div className={`w-80 rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          dk('bg-[#141414] border-white/10', 'bg-white border-gray-200')
        }`}
          style={{ maxHeight: view === 'chat' ? '480px' : 'auto' }}>

          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            dk('border-white/8 bg-[#1a1a1a]', 'border-gray-100 bg-gray-50')
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                userRole === 'admin'
                  ? 'bg-gradient-to-br from-orange-500 to-amber-500'
                  : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
              }`}>
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>
                  {view === 'chat' ? 'Assistente ZOMAR' : 'Suporte ZOMAR'}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${accentClasses.dot}`} />
                  <p className={`text-[10px] ${dk('text-gray-500', 'text-gray-500')}`}>Online agora</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {view === 'chat' && (
                <button onClick={() => setView('menu')}
                  className={`p-1.5 rounded-lg transition-colors text-xs ${dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}
                  title="Voltar ao menu">
                  <ChevronRight size={14} className="rotate-180" />
                </button>
              )}
              <button onClick={() => setIsMinimized(true)}
                className={`p-1.5 rounded-lg transition-colors ${dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}>
                <Minimize2 size={14} />
              </button>
              <button onClick={() => { setIsOpen(false); setView('menu') }}
                className={`p-1.5 rounded-lg transition-colors ${dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Vista: Menu de suporte ── */}
          {view === 'menu' && (
            <div className="p-4 space-y-3">
              <p className={`text-xs ${dk('text-gray-400', 'text-gray-500')}`}>
                Como preferes ser atendido?
              </p>

              {/* Chat com assistente */}
              <button onClick={openChat}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  dk('border-white/8 hover:border-white/18 hover:bg-white/5', 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')
                }`}>
                <div className={`p-2 rounded-lg ${
                  userRole === 'admin' ? 'bg-orange-500/15' : 'bg-emerald-500/15'
                }`}>
                  <Bot size={18} className={userRole === 'admin' ? 'text-orange-400' : 'text-emerald-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>
                    Assistente Virtual
                  </p>
                  <p className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>
                    Respostas instantâneas com IA
                  </p>
                </div>
                <ChevronRight size={14} className={dk('text-gray-500', 'text-gray-400')} />
              </button>

              {/* WhatsApp */}
              <a href="https://wa.me/258840000000?text=Olá, preciso de ajuda com a ZOMAR"
                target="_blank" rel="noopener noreferrer"
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  dk('border-white/8 hover:border-white/18 hover:bg-white/5', 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')
                }`}>
                <div className="p-2 rounded-lg bg-green-500/15">
                  <Phone size={18} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>
                    WhatsApp
                  </p>
                  <p className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>
                    +258 84 000 0000
                  </p>
                </div>
                <ExternalLink size={12} className={dk('text-gray-500', 'text-gray-400')} />
              </a>

              {/* Email */}
              <a href="mailto:suporte@zomar.co.mz"
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  dk('border-white/8 hover:border-white/18 hover:bg-white/5', 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')
                }`}>
                <div className="p-2 rounded-lg bg-blue-500/15">
                  <Mail size={18} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>
                    Email
                  </p>
                  <p className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>
                    suporte@zomar.co.mz
                  </p>
                </div>
                <ExternalLink size={12} className={dk('text-gray-500', 'text-gray-400')} />
              </a>

              {/* FAQ */}
              <a href={`/${userRole || 'deliverer'}/help`}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  dk('border-white/8 hover:border-white/18 hover:bg-white/5', 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')
                }`}>
                <div className="p-2 rounded-lg bg-purple-500/15">
                  <HelpCircle size={18} className="text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>
                    Centro de Ajuda
                  </p>
                  <p className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>
                    Perguntas frequentes
                  </p>
                </div>
                <ChevronRight size={14} className={dk('text-gray-500', 'text-gray-400')} />
              </a>
            </div>
          )}

          {/* ── Vista: Chat ── */}
          {view === 'chat' && (
            <div className="flex flex-col" style={{ height: '380px' }}>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'none' }}>

                {/* Perguntas rápidas (só no início) */}
                {messages.length <= 1 && (
                  <div className="space-y-1.5">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${dk('text-gray-600', 'text-gray-400')}`}>
                      Perguntas frequentes
                    </p>
                    {QUICK_QUESTIONS.map((q) => (
                      <button key={q}
                        onClick={() => sendMessage(q)}
                        className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                          dk('border-white/8 text-gray-300 hover:bg-white/5 hover:border-white/18',
                             'border-gray-200 text-gray-600 hover:bg-gray-50')
                        }`}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {messages.map((msg) => (
                  <div key={msg.id}
                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5 ${
                        userRole === 'admin'
                          ? 'bg-gradient-to-br from-orange-500 to-amber-500'
                          : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                      }`}>
                        <Bot size={12} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? userRole === 'admin'
                          ? 'bg-orange-500 text-white rounded-br-sm'
                          : 'bg-emerald-500 text-black rounded-br-sm'
                        : dk('bg-white/8 text-gray-200 rounded-bl-sm', 'bg-gray-100 text-gray-700 rounded-bl-sm')
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-2 justify-start">
                    <div className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center ${
                      userRole === 'admin'
                        ? 'bg-gradient-to-br from-orange-500 to-amber-500'
                        : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                    }`}>
                      <Bot size={12} className="text-white" />
                    </div>
                    <div className={`px-3 py-2 rounded-xl rounded-bl-sm ${dk('bg-white/8', 'bg-gray-100')}`}>
                      <Loader2 size={14} className={`animate-spin ${dk('text-gray-400', 'text-gray-500')}`} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className={`p-3 border-t ${dk('border-white/8', 'border-gray-100')}`}>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                    placeholder="Escreve uma mensagem..."
                    className={`flex-1 px-3 py-2 rounded-xl text-xs border focus:outline-none transition-all ${
                      dk(
                        'bg-white/8 border-white/10 text-white placeholder-gray-600 focus:border-white/25',
                        'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-gray-300'
                      )
                    }`}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isLoading}
                    className={`p-2 rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${accentClasses.send}`}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Estado minimizado ── */}
      {isOpen && isMinimized && (
        <button onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg transition-all ${
            dk('bg-[#1a1a1a] border-white/10 text-white', 'bg-white border-gray-200 text-gray-900')
          }`}>
          <MessageCircle size={16} className={userRole === 'admin' ? 'text-orange-400' : 'text-emerald-400'} />
          <span className="text-sm font-medium">Suporte</span>
        </button>
      )}

      {/* ── Botão flutuante principal ── */}
      {!isMinimized && (
        <button
          onClick={() => {
            setIsOpen(p => !p)
            setIsMinimized(false)
            if (!isOpen) setView('menu')
          }}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 ${accentClasses.button}`}>
          {isOpen
            ? <X size={22} className="text-white" />
            : <MessageCircle size={22} className="text-white" />
          }
          {/* Pulse indicator */}
          {!isOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-black flex items-center justify-center">
              <span className="text-[8px] text-white font-black">!</span>
            </span>
          )}
        </button>
      )}
    </div>
  )
}