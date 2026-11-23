// src/components/shared/SupportButton.tsx
// Botão flutuante com o assistente ZOMAR (agente) + canais humanos (WhatsApp / Email).
// O agente corre na edge function `zomar-agent` com o JWT do utilizador.
// Ações que alteram dados vêm como "proposta" e só executam após confirmação aqui.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, Phone, Mail, Send, X, ChevronRight, Loader2, MessageCircle,
  Minimize2, Check, Trash2, ArrowUpRight, Sparkles,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Proposal { id: string; name: string; args: Record<string, unknown>; summary: string }
interface AgentLink { label: string; path: string }
interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  proposal?: Proposal | null
  proposalState?: 'pending' | 'running' | 'done' | 'dismissed'
  links?: AgentLink[]
}

const GMAIL_URL = 'https://mail.google.com/mail/?view=cm&fs=1&to=zomarentregas%40gmail.com&su=Suporte%20ZOMAR'
const WHATSAPP_URL = 'https://wa.me/258842589799'

interface Props {
  isDarkMode: boolean
  quickQuestions?: string[]
  /** Sobe o botão no mobile para não tapar a barra de navegação inferior */
  raiseOnMobile?: boolean
}

// ── Markdown mínimo (negrito + listas) sem dangerouslySetInnerHTML ──────────
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${keyBase}-${i}`} className="font-bold">{part.slice(2, -2)}</strong>
      : <React.Fragment key={`${keyBase}-${i}`}>{part}</React.Fragment>)
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className={line.trim() === '' ? 'h-2' : i > 0 ? 'mt-1' : ''}>
          {renderInline(line, String(i))}
        </p>
      ))}
    </>
  )
}

const safePath = (p: string) => (p.startsWith('/') && !p.startsWith('//') ? p : '/')

async function errorMessage(err: unknown): Promise<string> {
  try {
    const ctx = (err as { context?: Response })?.context
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json()
      if (body?.error) return String(body.error)
    }
  } catch { /* ignora */ }
  return 'Não consegui contactar o assistente. Tente de novo ou fale connosco por WhatsApp.'
}

export default function SupportButton({ isDarkMode, quickQuestions, raiseOnMobile }: Props) {
  const { user } = useAuth() as any
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'chat'>('menu')
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mini, setMini] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dk = (d: string, l: string) => (isDarkMode ? d : l)

  const QUICK = quickQuestions ?? ['Como criar uma entrega?', 'Qual é o meu plano?', 'Não consigo fazer login']
  const firstName = String(user?.full_name || '').split(' ')[0]

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, loading, view])

  // Carrega o histórico guardado (só o do próprio utilizador — RLS)
  const loadHistory = useCallback(async () => {
    if (historyLoaded) return
    setHistoryLoaded(true)
    const { data } = await supabase.from('agent_messages')
      .select('id, role, content, created_at').order('created_at', { ascending: false }).limit(30)
    if (data?.length) {
      setMsgs(data.reverse().map((m: any) => ({ id: m.id, role: m.role, content: m.content })))
    }
  }, [historyLoaded])

  const openChat = () => {
    setView('chat')
    void loadHistory()
    setTimeout(() => inputRef.current?.focus(), 150)
  }

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('zomar-agent', { body })
    if (error) throw new Error(await errorMessage(error))
    return data as { reply?: string; proposal?: Proposal | null; links?: AgentLink[]; error?: string }
  }

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || loading) return
    const uid = `u-${Date.now()}`
    setMsgs(p => [...p, { id: uid, role: 'user', content: t }])
    setInput('')
    setLoading(true)
    try {
      const r = await call({ message: t })
      setMsgs(p => [...p, {
        id: `a-${Date.now()}`, role: 'assistant', content: r.reply || 'Sem resposta. Tente reformular.',
        proposal: r.proposal ?? null, proposalState: r.proposal ? 'pending' : undefined, links: r.links ?? [],
      }])
    } catch (e) {
      setMsgs(p => [...p, { id: `e-${Date.now()}`, role: 'assistant', content: (e as Error).message }])
    } finally { setLoading(false) }
  }

  const setProposalState = (id: string, state: ChatMsg['proposalState']) =>
    setMsgs(p => p.map(m => (m.id === id ? { ...m, proposalState: state } : m)))

  const confirm = async (m: ChatMsg) => {
    if (!m.proposal || m.proposalState !== 'pending') return
    setProposalState(m.id, 'running')
    try {
      const r = await call({ confirm: { name: m.proposal.name, args: m.proposal.args } })
      setProposalState(m.id, 'done')
      setMsgs(p => [...p, { id: `a-${Date.now()}`, role: 'assistant', content: r.reply || 'Feito.', links: r.links ?? [] }])
    } catch (e) {
      setProposalState(m.id, 'pending')
      setMsgs(p => [...p, { id: `e-${Date.now()}`, role: 'assistant', content: (e as Error).message }])
    }
  }

  const clearHistory = async () => {
    if (loading) return
    try { await call({ clear: true }) } catch { /* mesmo assim limpa o ecrã */ }
    setMsgs([])
  }

  const go = (path: string) => { navigate(safePath(path)); setMini(true) }

  const showWelcome = msgs.length === 0
  const closeAll = () => { setOpen(false); setView('menu') }

  return (
    <div className={`fixed right-4 sm:right-6 z-50 flex flex-col items-end gap-3 ${raiseOnMobile ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6' : 'bottom-4 sm:bottom-6'}`}>

      {open && !mini && (
        <div role="dialog" aria-label="Assistente ZOMAR"
          className={`relative rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl ${dk('bg-[#0d1318]/95 border-emerald-500/15 shadow-emerald-950/40', 'bg-white/95 border-gray-200')}`}
          style={{ width: 'min(360px, calc(100vw - 32px))' }}>
          <div className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 rounded-full bg-emerald-500/10 blur-3xl"/>

          {/* Cabeçalho */}
          <div className={`relative flex items-center justify-between px-4 py-3 border-b ${dk('border-white/8', 'border-gray-100')}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Bot size={16} className="text-white"/>
              </div>
              <div>
                <p className={`text-sm font-bold leading-tight ${dk('text-white', 'text-gray-900')}`}>Assistente ZOMAR</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                  <p className="text-[10px] text-gray-500">Online</p>
                </div>
              </div>
            </div>
            <div className="flex gap-0.5">
              {view === 'chat' && msgs.length > 0 && (
                <button onClick={clearHistory} aria-label="Limpar conversa" title="Limpar conversa"
                  className={`p-1.5 rounded-lg ${dk('text-gray-500 hover:text-red-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}>
                  <Trash2 size={13}/>
                </button>
              )}
              {view === 'chat' && (
                <button onClick={() => setView('menu')} aria-label="Voltar"
                  className={`p-1.5 rounded-lg ${dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}>
                  <ChevronRight size={13} className="rotate-180"/>
                </button>
              )}
              <button onClick={() => setMini(true)} aria-label="Minimizar"
                className={`p-1.5 rounded-lg ${dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}>
                <Minimize2 size={13}/>
              </button>
              <button onClick={closeAll} aria-label="Fechar"
                className={`p-1.5 rounded-lg ${dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}>
                <X size={13}/>
              </button>
            </div>
          </div>

          {/* Menu de canais */}
          {view === 'menu' && (
            <div className="relative p-4 space-y-2.5">
              <p className={`text-xs ${dk('text-gray-400', 'text-gray-500')}`}>
                {firstName ? `Olá, ${firstName}.` : 'Olá.'} Como prefere ser atendido?
              </p>
              {[
                { icon: <Sparkles size={17} className="text-emerald-400"/>, bg: 'bg-emerald-500/15', title: 'Assistente virtual', sub: 'Consulta e age na sua conta', action: openChat },
                { icon: <Phone size={17} className="text-green-400"/>, bg: 'bg-green-500/15', title: 'WhatsApp', sub: '+258 84 258 9799', action: () => window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer') },
                { icon: <Mail size={17} className="text-sky-400"/>, bg: 'bg-sky-500/15', title: 'Email', sub: 'zomarentregas@gmail.com', action: () => window.open(GMAIL_URL, '_blank', 'noopener,noreferrer') },
              ].map(opt => (
                <button key={opt.title} onClick={opt.action}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${dk('border-white/8 hover:border-emerald-500/30 hover:bg-white/5', 'border-gray-200 hover:border-gray-300 hover:bg-gray-50')}`}>
                  <div className={`p-2 rounded-lg flex-shrink-0 ${opt.bg}`}>{opt.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>{opt.title}</p>
                    <p className="text-xs truncate text-gray-500">{opt.sub}</p>
                  </div>
                  <ChevronRight size={13} className={dk('text-gray-600', 'text-gray-400')}/>
                </button>
              ))}
            </div>
          )}

          {/* Chat */}
          {view === 'chat' && (
            <div className="relative flex flex-col" style={{ height: 'min(440px, calc(100vh - 220px))' }}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'none' }}>
                {showWelcome && (
                  <div className="space-y-3">
                    <div className={`text-xs leading-relaxed ${dk('text-gray-300', 'text-gray-600')}`}>
                      Sou o assistente da ZOMAR. Posso consultar as suas entregas, o plano e os ganhos, e preparar ações (criar, cancelar, aceitar…) que só executo depois de confirmar consigo.
                    </div>
                    <div className="space-y-1.5">
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${dk('text-gray-600', 'text-gray-400')}`}>Experimente</p>
                      {QUICK.map(q => (
                        <button key={q} onClick={() => send(q)}
                          className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-all ${dk('border-white/8 text-gray-300 hover:border-emerald-500/30 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {msgs.map(m => (
                  <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex-shrink-0 flex items-center justify-center mt-0.5">
                        <Bot size={11} className="text-white"/>
                      </div>
                    )}
                    <div className="max-w-[84%] space-y-2">
                      <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed break-words ${
                        m.role === 'user'
                          ? 'bg-emerald-500 text-black rounded-br-sm'
                          : dk('bg-white/8 text-gray-200 rounded-bl-sm', 'bg-gray-100 text-gray-700 rounded-bl-sm')}`}>
                        <RichText text={m.content}/>
                      </div>

                      {m.proposal && (
                        <div className={`rounded-xl border p-3 ${m.proposalState === 'done' ? dk('border-emerald-500/30 bg-emerald-500/5', 'border-emerald-300 bg-emerald-50') : m.proposalState === 'dismissed' ? dk('border-white/8 opacity-60', 'border-gray-200 opacity-60') : dk('border-emerald-500/30 bg-emerald-500/8', 'border-emerald-300 bg-emerald-50')}`}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1.5">
                            {m.proposalState === 'done' ? 'Confirmado' : m.proposalState === 'dismissed' ? 'Cancelado' : 'Confirmar ação'}
                          </p>
                          <div className={`text-xs ${dk('text-gray-200', 'text-gray-700')}`}><RichText text={m.proposal.summary}/></div>
                          {(m.proposalState === 'pending' || m.proposalState === 'running') && (
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => confirm(m)} disabled={m.proposalState === 'running'}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold disabled:opacity-60 active:scale-[0.98] transition-all">
                                {m.proposalState === 'running' ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
                                Confirmar
                              </button>
                              <button onClick={() => setProposalState(m.id, 'dismissed')} disabled={m.proposalState === 'running'}
                                className={`px-3 py-2 rounded-lg border text-xs font-medium ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')}`}>
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {!!m.links?.length && (
                        <div className="flex flex-wrap gap-1.5">
                          {m.links.map(l => (
                            <button key={l.path} onClick={() => go(l.path)}
                              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${dk('border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10', 'border-emerald-300 text-emerald-700 hover:bg-emerald-50')}`}>
                              {l.label}<ArrowUpRight size={11}/>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                      <Bot size={11} className="text-white"/>
                    </div>
                    <div className={`px-3 py-2.5 rounded-xl flex gap-1 ${dk('bg-white/8', 'bg-gray-100')}`}>
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${i * 120}ms` }}/>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={endRef}/>
              </div>

              <div className={`p-3 border-t ${dk('border-white/8', 'border-gray-100')}`}>
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    rows={1}
                    maxLength={1500}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
                    placeholder="Escreva uma mensagem…"
                    className={`flex-1 resize-none max-h-24 px-3 py-2 rounded-xl text-xs border focus:outline-none transition-all ${dk('bg-white/6 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500/40', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-400')}`}
                  />
                  <button onClick={() => send(input)} disabled={!input.trim() || loading} aria-label="Enviar"
                    className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-40 transition-all active:scale-95">
                    <Send size={13}/>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {open && mini && (
        <button onClick={() => setMini(false)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg ${dk('bg-[#0d1318] border-emerald-500/20 text-white', 'bg-white border-gray-200 text-gray-900')}`}>
          <MessageCircle size={15} className="text-emerald-400"/>
          <span className="text-sm font-medium">Assistente</span>
        </button>
      )}

      {!mini && (
        <button
          onClick={() => { setOpen(p => !p); setMini(false); if (!open) setView('menu') }}
          aria-label={open ? 'Fechar assistente' : 'Abrir assistente'}
          className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all">
          {open ? <X size={20} className="text-white"/> : <MessageCircle size={20} className="text-white"/>}
        </button>
      )}
    </div>
  )
}
