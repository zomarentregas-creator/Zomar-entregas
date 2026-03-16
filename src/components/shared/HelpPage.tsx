/**
 * ============================================================================
 * HELP PAGE — Centro de Ajuda ZOMAR
 * ============================================================================
 *
 * Totalmente funcional:
 * - Tema sincronizado com o sistema do app (entrepreneur_theme / deliverer_theme)
 * - handleTicketSubmit guarda o chamado na tabela support_tickets do Supabase
 * - Fallback por e-mail caso a tabela não exista ainda
 * - Sem console.log como única acção
 *
 * @version 2.0 (Fully Functional)
 */

import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Search, MessageCircle, Mail, BookOpen,
  ChevronDown, ChevronRight, Copy, Info,
  Lightbulb, Clock, Star, Phone, ArrowLeft,
  CheckCircle, AlertCircle, HelpCircle, Zap, Loader2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
  helpful: number
  tags: string[]
}

interface SupportTicket {
  subject: string
  message: string
  priority: 'low' | 'medium' | 'high'
  category: string
}

interface ToastState {
  type: 'success' | 'error'
  message: string
}

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

const FAQ_DATA: FAQItem[] = [
  {
    id: '1',
    question: 'Como criar uma nova entrega?',
    answer: 'Para criar uma nova entrega:\n\n1. Acesse o menu "Nova Entrega"\n2. Preencha os dados: tipo do item, endereços de origem e destino\n3. Defina o valor estimado do item\n4. Adicione observações se necessário\n5. Clique em "Criar Entrega Protegida"\n\nLembre-se: você precisa ter um plano ativo para criar entregas.',
    category: 'entregas',
    helpful: 245,
    tags: ['nova entrega', 'criar', 'formulário'],
  },
  {
    id: '2',
    question: 'Como rastrear minha entrega?',
    answer: 'Para rastrear sua entrega:\n\n1. Acesse "Entregas Ativas" no menu principal\n2. Clique na entrega desejada para ver detalhes\n3. Visualize o status atual\n4. Acompanhe os checkpoints em tempo real\n\nVocê também receberá notificações automáticas sobre mudanças de status.',
    category: 'entregas',
    helpful: 189,
    tags: ['rastreamento', 'status', 'acompanhar'],
  },
  {
    id: '3',
    question: 'Como funciona o sistema de proteção ZOMAR?',
    answer: 'O ZOMAR protege suas entregas com:\n\n• Entregadores verificados e avaliados\n• Cobertura financeira até o valor do seu plano\n• Rastreamento em tempo real\n• Suporte para resolver problemas\n\nEm caso de problemas confirmados, você será ressarcido conforme os termos do seu plano.',
    category: 'seguranca',
    helpful: 156,
    tags: ['proteção', 'zomar', 'segurança', 'cobertura'],
  },
  {
    id: '4',
    question: 'Quais são os planos disponíveis?',
    answer: 'Acesse a secção "Plano" no menu lateral para ver os planos atuais com preços e limites de entregas.\n\nTodos os planos incluem:\n• Rastreamento em tempo real\n• Entregadores verificados\n• Suporte por email\n\nPlanos superiores incluem maior cobertura financeira e suporte prioritário.',
    category: 'planos',
    helpful: 203,
    tags: ['planos', 'preços', 'assinatura'],
  },
  {
    id: '5',
    question: 'Como alterar meu plano?',
    answer: 'Para alterar seu plano:\n\n1. Acesse "Plano" no menu lateral\n2. Escolha o novo plano desejado\n3. Confirme a alteração\n\nUpgrades são aplicados imediatamente. Downgrades entram em vigor no próximo ciclo de cobrança.',
    category: 'planos',
    helpful: 98,
    tags: ['alterar plano', 'upgrade', 'downgrade'],
  },
  {
    id: '6',
    question: 'E se minha entrega tiver problemas?',
    answer: 'Se sua entrega tiver problemas:\n\n1. Acesse a entrega com problema nas "Entregas Ativas"\n2. Clique em "Reportar Problema"\n3. Descreva o que aconteceu\n4. Nossa equipe investigará em até 2 horas\n\nProblemas cobertos: extravio, danos, atraso excessivo.',
    category: 'problemas',
    helpful: 167,
    tags: ['problemas', 'ressarcimento', 'suporte'],
  },
  {
    id: '7',
    question: 'Como funciona a avaliação de entregadores?',
    answer: 'Após a conclusão de cada entrega, pode avaliar o entregador de 1 a 5 estrelas.\n\nAs avaliações são consideradas no ranking dos entregadores e entregadores com avaliações consistentemente baixas são removidos da plataforma.\n\nIsso garante qualidade e confiança nas entregas.',
    category: 'entregas',
    helpful: 142,
    tags: ['avaliação', 'entregador', 'qualidade'],
  },
]

const CATEGORIES = [
  { id: 'all',       label: 'Todas'      },
  { id: 'entregas',  label: 'Entregas'   },
  { id: 'planos',    label: 'Planos'     },
  { id: 'seguranca', label: 'Segurança'  },
  { id: 'problemas', label: 'Problemas'  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Detecta role pela URL para sincronizar o tema correto
  const isEntrepreneur = location.pathname.startsWith('/entrepreneur')
  const themeKey = isEntrepreneur ? 'entrepreneur_theme' : 'deliverer_theme'

  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem(themeKey) !== 'light'
  )

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === themeKey) setIsDarkMode(e.newValue !== 'light')
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [themeKey])

  const [searchTerm,        setSearchTerm]        = useState('')
  const [selectedCategory,  setSelectedCategory]  = useState('all')
  const [expandedFAQ,       setExpandedFAQ]       = useState<string | null>(null)
  const [showTicketForm,    setShowTicketForm]     = useState(false)
  const [submitting,        setSubmitting]         = useState(false)
  const [toast,             setToast]              = useState<ToastState | null>(null)

  const [ticketForm, setTicketForm] = useState<SupportTicket>({
    subject: '', message: '', priority: 'medium', category: 'general',
  })

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  // ── Filtro de FAQ ───────────────────────────────────────────────────────────

  const filteredFAQ = FAQ_DATA.filter(item => {
    const q = searchTerm.toLowerCase()
    const matchesSearch = !q
      || item.question.toLowerCase().includes(q)
      || item.answer.toLowerCase().includes(q)
      || item.tags.some(t => t.toLowerCase().includes(q))
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // ── Copiar resposta ─────────────────────────────────────────────────────────

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setToast({ type: 'success', message: 'Resposta copiada para a área de transferência.' })
  }

  // ── Submeter ticket — guarda no Supabase ────────────────────────────────────

  const handleTicketSubmit = async () => {
    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) {
      setToast({ type: 'error', message: 'Por favor, preencha o assunto e a mensagem.' })
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id:    user?.id ?? null,
          user_email: user?.email ?? null,
          subject:    ticketForm.subject.trim(),
          message:    ticketForm.message.trim(),
          priority:   ticketForm.priority,
          category:   ticketForm.category,
          status:     'open',
          created_at: new Date().toISOString(),
        })

      // Se a tabela não existir ainda (erro 42P01), fallback para mailto
      if (error && error.code === '42P01') {
        const mailto = `mailto:suporte@zomar.com?subject=${encodeURIComponent(ticketForm.subject)}&body=${encodeURIComponent(ticketForm.message)}`
        window.open(mailto)
        setToast({ type: 'success', message: 'A redirecionar para o seu cliente de e-mail...' })
      } else if (error) {
        throw error
      } else {
        setToast({ type: 'success', message: 'Chamado criado com sucesso! Receberá uma resposta em breve.' })
      }

      setShowTicketForm(false)
      setTicketForm({ subject: '', message: '', priority: 'medium', category: 'general' })
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'Erro ao criar chamado. Tente novamente.' })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen ${dk('bg-black', 'bg-gray-50')}`}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-emerald-500/95 text-black border-emerald-400'
            : 'bg-red-500/95 text-white border-red-400'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle size={16} />
            : <AlertCircle size={16} />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className={`p-2.5 rounded-xl transition-all ${dk('bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white', 'bg-gray-100 hover:bg-gray-200 text-gray-600')}`}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="text-center flex-1">
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border mb-4 ${dk('bg-emerald-500/10 border-emerald-500/20', 'bg-emerald-100 border-emerald-200')}`}>
              <HelpCircle className={dk('text-emerald-400', 'text-emerald-600')} size={20} />
              <span className={`font-bold ${dk('text-emerald-400', 'text-emerald-600')}`}>Centro de Ajuda ZOMAR</span>
            </div>
            <h1 className={`text-4xl font-black tracking-tight ${dk('text-white', 'text-gray-900')}`}>
              Como podemos ajudar?
            </h1>
            <p className={`text-base mt-2 ${dk('text-gray-400', 'text-gray-600')}`}>
              Encontre respostas rápidas ou entre em contacto connosco
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto w-full">
          <div className="relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${dk('text-gray-500', 'text-gray-400')}`} size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar artigos de ajuda..."
              className={`w-full pl-12 pr-4 py-4 text-base rounded-2xl border-2 outline-none transition-all ${
                dk(
                  'bg-[#121212] border-white/10 text-white placeholder-gray-500 focus:border-emerald-500/50',
                  'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-500'
                )
              }`}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => setShowTicketForm(true)}
            className={`group p-6 rounded-2xl border text-left transition-all hover:scale-[1.02] ${dk('bg-[#121212] border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5', 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 shadow-sm')}`}
          >
            <div className={`p-3 rounded-xl inline-flex mb-4 ${dk('bg-blue-500/10', 'bg-blue-100')}`}>
              <MessageCircle className={dk('text-blue-400', 'text-blue-600')} size={24} />
            </div>
            <h3 className={`font-bold text-lg mb-1 ${dk('text-white', 'text-gray-900')}`}>Abrir Chamado</h3>
            <p className={`text-sm ${dk('text-gray-400', 'text-gray-600')}`}>Precisa de ajuda personalizada? Abra um chamado de suporte</p>
          </button>

          <a
            href="mailto:suporte@zomar.com"
            className={`group p-6 rounded-2xl border text-left transition-all hover:scale-[1.02] ${dk('bg-[#121212] border-white/5 hover:border-green-500/30 hover:bg-green-500/5', 'bg-white border-gray-200 hover:border-green-300 hover:bg-green-50 shadow-sm')}`}
          >
            <div className={`p-3 rounded-xl inline-flex mb-4 ${dk('bg-green-500/10', 'bg-green-100')}`}>
              <Mail className={dk('text-green-400', 'text-green-600')} size={24} />
            </div>
            <h3 className={`font-bold text-lg mb-1 ${dk('text-white', 'text-gray-900')}`}>Email Direto</h3>
            <p className={`text-sm ${dk('text-gray-400', 'text-gray-600')}`}>zomarentregas@gmail.com — Resposta em até 4h</p>
          </a>

          <a
            href="https://wa.me/258842589799"
            target="_blank"
            rel="noopener noreferrer"
            className={`group p-6 rounded-2xl border text-left transition-all hover:scale-[1.02] ${dk('bg-[#121212] border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5', 'bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 shadow-sm')}`}
          >
            <div className={`p-3 rounded-xl inline-flex mb-4 ${dk('bg-emerald-500/10', 'bg-emerald-100')}`}>
              <Phone className={dk('text-emerald-400', 'text-emerald-600')} size={24} />
            </div>
            <h3 className={`font-bold text-lg mb-1 ${dk('text-white', 'text-gray-900')}`}>WhatsApp</h3>
            <p className={`text-sm ${dk('text-gray-400', 'text-gray-600')}`}>(+258) 84 258 9799 — Atendimento imediato</p>
          </a>
        </div>

        {/* Categories */}
        <div className={`rounded-2xl border p-5 ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200 shadow-sm')}`}>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => {
              const count = cat.id === 'all'
                ? FAQ_DATA.length
                : FAQ_DATA.filter(f => f.category === cat.id).length
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                    selectedCategory === cat.id
                      ? dk('bg-emerald-500 text-black', 'bg-emerald-600 text-white')
                      : dk('bg-white/5 text-gray-400 hover:bg-white/10', 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                  }`}
                >
                  {cat.label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* FAQ */}
        <div className={`rounded-2xl border overflow-hidden ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200 shadow-sm')}`}>
          <div className={`p-6 border-b ${dk('border-white/5', 'border-gray-200')}`}>
            <div className="flex items-center gap-3">
              <BookOpen className={dk('text-emerald-400', 'text-emerald-600')} size={22} />
              <h2 className={`text-xl font-bold ${dk('text-white', 'text-gray-900')}`}>Perguntas Frequentes</h2>
              <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full ${dk('bg-emerald-500/20 text-emerald-400', 'bg-emerald-100 text-emerald-700')}`}>
                {filteredFAQ.length} artigo{filteredFAQ.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className={`divide-y ${dk('divide-white/5', 'divide-gray-100')}`}>
            {filteredFAQ.length === 0 ? (
              <div className="p-12 text-center">
                <Search className={`mx-auto mb-4 ${dk('text-gray-600', 'text-gray-300')}`} size={40} />
                <h3 className={`text-lg font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Nenhum resultado</h3>
                <p className={`text-sm ${dk('text-gray-400', 'text-gray-600')}`}>Tente outros termos ou navegue pelas categorias</p>
              </div>
            ) : (
              filteredFAQ.map(faq => (
                <div key={faq.id} className={`transition-colors ${dk('hover:bg-white/5', 'hover:bg-gray-50')}`}>
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                    className="w-full p-6 text-left flex items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-base ${dk('text-white', 'text-gray-900')}`}>{faq.question}</h3>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <Star className="text-yellow-400" size={13} />
                          <span className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>{faq.helpful} acharam útil</span>
                        </div>
                        <div className="flex gap-1.5">
                          {faq.tags.slice(0, 2).map((tag, i) => (
                            <span key={i} className={`px-2 py-0.5 text-xs rounded-full ${dk('bg-white/8 text-gray-400', 'bg-gray-100 text-gray-600')}`}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {expandedFAQ === faq.id
                      ? <ChevronDown className={dk('text-emerald-400', 'text-emerald-600')} size={18} />
                      : <ChevronRight className={dk('text-gray-500', 'text-gray-400')} size={18} />
                    }
                  </button>

                  {expandedFAQ === faq.id && (
                    <div className={`px-6 pb-6 border-t ${dk('border-white/5', 'border-gray-100')}`}>
                      <div className={`p-4 rounded-xl mt-4 ${dk('bg-white/5', 'bg-gray-50')}`}>
                        <div className="flex gap-3">
                          <Info className={`flex-shrink-0 mt-0.5 ${dk('text-emerald-400', 'text-emerald-600')}`} size={15} />
                          <div className="flex-1 space-y-1">
                            {faq.answer.split('\n').map((line, i) => {
                              const parts = line.split(/\*\*(.*?)\*\*/g)
                              return (
                                <p key={i} className={`text-sm ${dk('text-gray-300', 'text-gray-700')} whitespace-pre-wrap`}>
                                  {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
                                </p>
                              )
                            })}
                          </div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(faq.answer)}
                          className={`mt-3 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-all ${dk('bg-white/8 border-white/15 text-gray-400 hover:bg-white/15', 'bg-gray-200 border-gray-300 text-gray-600 hover:bg-gray-300')}`}
                        >
                          <Copy size={12} /> Copiar resposta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* CTA */}
        <div className={`rounded-2xl border p-8 text-center ${dk('bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-emerald-500/20', 'bg-gradient-to-br from-emerald-50 to-blue-50 border-emerald-200')}`}>
          <Lightbulb className={`mx-auto mb-4 ${dk('text-emerald-400', 'text-emerald-600')}`} size={40} />
          <h3 className={`text-xl font-bold mb-2 ${dk('text-white', 'text-gray-900')}`}>Não encontrou o que procurava?</h3>
          <p className={`mb-6 ${dk('text-gray-300', 'text-gray-700')}`}>A nossa equipa está pronta para ajudar</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowTicketForm(true)}
              className={`px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 ${dk('bg-emerald-500 text-black hover:bg-emerald-400', 'bg-emerald-600 text-white hover:bg-emerald-700')}`}
            >
              Falar com Especialista
            </button>
            <a
              href="https://wa.me/258842589799"
              target="_blank"
              rel="noopener noreferrer"
              className={`px-8 py-3 rounded-xl font-bold border transition-all hover:scale-105 ${dk('border-white/20 text-white hover:bg-white/5', 'border-gray-300 text-gray-700 hover:bg-gray-100')}`}
            >
              WhatsApp Imediato
            </a>
          </div>
        </div>

        {/* Horários */}
        <div className={`rounded-2xl border p-8 ${dk('bg-[#121212] border-white/5', 'bg-white border-gray-200 shadow-sm')}`}>
          <div className="flex items-center gap-3 mb-6">
            <Clock className={dk('text-emerald-400', 'text-emerald-600')} size={22} />
            <h3 className={`font-bold text-xl ${dk('text-white', 'text-gray-900')}`}>Horários de Atendimento</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: Zap,          title: 'Chat / WhatsApp', lines: ['Seg–Sex: 8h às 22h', 'Sáb: 9h às 18h'], note: 'Respostas em minutos' },
              { icon: Mail,         title: 'Email',           lines: ['24/7 — resposta em até 4h', '(em horário comercial)'], note: 'Suporte detalhado' },
              { icon: AlertCircle,  title: 'Emergências',     lines: ['24/7 para problemas', 'com entregas em andamento'], note: 'Resposta imediata' },
            ].map(({ icon: Icon, title, lines, note }) => (
              <div key={title} className={`p-4 rounded-xl ${dk('bg-white/5', 'bg-gray-50')}`}>
                <h4 className={`font-semibold mb-2 flex items-center gap-2 ${dk('text-emerald-400', 'text-emerald-600')}`}>
                  <Icon size={16} /> {title}
                </h4>
                {lines.map((l, i) => (
                  <p key={i} className={`text-sm ${dk('text-gray-300', 'text-gray-700')}`}>{l}</p>
                ))}
                <p className={`text-xs mt-1 ${dk('text-gray-500', 'text-gray-500')}`}>{note}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modal Ticket */}
      {showTicketForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${dk('bg-[#121212] border-white/10', 'bg-white border-gray-200')}`}>
            <div className={`p-6 border-b ${dk('border-white/5', 'border-gray-200')}`}>
              <h2 className={`text-xl font-bold ${dk('text-white', 'text-gray-900')}`}>Abrir Chamado de Suporte</h2>
            </div>
            <div className="p-6 space-y-4">

              <div>
                <label className={`block text-sm font-medium mb-2 ${dk('text-gray-300', 'text-gray-700')}`}>Assunto *</label>
                <input
                  type="text"
                  value={ticketForm.subject}
                  onChange={e => setTicketForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="Descreva brevemente o problema"
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${dk('bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-emerald-500/50', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-400')}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dk('text-gray-300', 'text-gray-700')}`}>Categoria</label>
                  <select
                    value={ticketForm.category}
                    onChange={e => setTicketForm(p => ({ ...p, category: e.target.value }))}
                    className={`w-full px-4 py-3 rounded-xl border outline-none ${dk('bg-white/5 border-white/10 text-white', 'bg-gray-50 border-gray-200 text-gray-900')}`}
                  >
                    <option value="general">Geral</option>
                    <option value="entregas">Entregas</option>
                    <option value="planos">Planos</option>
                    <option value="pagamento">Pagamento</option>
                    <option value="seguranca">Segurança</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${dk('text-gray-300', 'text-gray-700')}`}>Prioridade</label>
                  <select
                    value={ticketForm.priority}
                    onChange={e => setTicketForm(p => ({ ...p, priority: e.target.value as SupportTicket['priority'] }))}
                    className={`w-full px-4 py-3 rounded-xl border outline-none ${dk('bg-white/5 border-white/10 text-white', 'bg-gray-50 border-gray-200 text-gray-900')}`}
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${dk('text-gray-300', 'text-gray-700')}`}>Mensagem *</label>
                <textarea
                  value={ticketForm.message}
                  onChange={e => setTicketForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Descreva o problema com detalhes..."
                  rows={5}
                  className={`w-full px-4 py-3 rounded-xl border outline-none resize-none transition-all ${dk('bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-emerald-500/50', 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-400')}`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleTicketSubmit}
                  disabled={submitting}
                  className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    submitting
                      ? 'opacity-50 cursor-not-allowed bg-emerald-500 text-black'
                      : dk('bg-emerald-500 hover:bg-emerald-400 text-black', 'bg-emerald-600 hover:bg-emerald-700 text-white')
                  }`}
                >
                  {submitting ? <><Loader2 size={16} className="animate-spin" />A enviar...</> : 'Enviar Chamado'}
                </button>
                <button
                  onClick={() => setShowTicketForm(false)}
                  disabled={submitting}
                  className={`flex-1 py-3 rounded-xl font-bold border transition-all ${dk('border-white/10 text-gray-300 hover:bg-white/5', 'border-gray-200 text-gray-700 hover:bg-gray-100')}`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}