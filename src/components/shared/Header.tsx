// src/components/layout/Header.tsx
/**
 * ============================================================================
 * HEADER — Notificações reais + dropdowns com click-outside
 * ============================================================================
 * @version 5.0
 * - Notificações buscadas do Supabase (número real)
 * - Realtime: novo badge actualiza sem refresh
 * - Dropdowns fecham ao clicar fora (useClickOutside)
 * - Busca funcional (filtra navegação e redireciona)
 */

import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Package, Bell, User, LogOut, Menu, X, Search, Sun, Moon,
  ChevronDown, Zap, DollarSign, Activity, Check, Trash2
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

// ─── Hook: fechar dropdown ao clicar fora ────────────────────────────────────

function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  handler: () => void
) {
  useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      handler()
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler])
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DBNotification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  delivery_id: string | null
  created_at: string
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // ── UI state ────────────────────────────────────────────────────────────────
  const [mobileMenuOpen, setMobileMenuOpen]     = useState(false)
  const [searchOpen, setSearchOpen]             = useState(false)
  const [userMenuOpen, setUserMenuOpen]         = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isDarkMode, setIsDarkMode]             = useState(true)
  const [searchQuery, setSearchQuery]           = useState('')

  // ── Notificações reais ──────────────────────────────────────────────────────
  const [notifications, setNotifications]       = useState<DBNotification[]>([])
  const [notifsLoading, setNotifsLoading]       = useState(false)

  // ── Refs para click-outside ──────────────────────────────────────────────────
  const userMenuRef    = useRef<HTMLDivElement>(null!)
  const notifMenuRef   = useRef<HTMLDivElement>(null!)
  const searchRef      = useRef<HTMLDivElement>(null!)

  useClickOutside(userMenuRef,  () => setUserMenuOpen(false))
  useClickOutside(notifMenuRef, () => setNotificationsOpen(false))
  useClickOutside(searchRef,    () => setSearchOpen(false))

  // ── Tema ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('app_theme')
    setIsDarkMode(saved !== 'light')
  }, [])

  const toggleTheme = () => {
    setIsDarkMode(p => {
      localStorage.setItem('app_theme', p ? 'light' : 'dark')
      return !p
    })
  }

  // ── Carregar notificações ────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return
    try {
      setNotifsLoading(true)
      const { data } = await supabase
        .from('notifications')
        .select('id, title, message, type, read, delivery_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setNotifications(data || [])
    } finally {
      setNotifsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // ── Realtime: nova notificação entra no topo ─────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`header-notifs-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as DBNotification, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev =>
          prev.map(n => n.id === payload.new.id ? payload.new as DBNotification : n)
        )
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => prev.filter(n => n.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // ── Acções nas notificações ──────────────────────────────────────────────────
  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllAsRead = async () => {
    if (!user?.id) return
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const deleteNotif = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handleNotifClick = async (notif: DBNotification) => {
    if (!notif.read) await markAsRead(notif.id)
    if (notif.delivery_id) {
      navigate(`/delivery/${notif.delivery_id}`)
      setNotificationsOpen(false)
    }
  }

  // ── Número real de não lidas ─────────────────────────────────────────────────
  const unreadCount = notifications.filter(n => !n.read).length

  // ── Sign out ──────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    setUserMenuOpen(false)
    await signOut()
    navigate('/login')
  }

  // ── Navegação dinâmica por role ───────────────────────────────────────────────
  const navigation = user?.role === 'entrepreneur' ? [
    { name: 'Dashboard',    href: '/entrepreneur/dashboard',    icon: '📊', description: 'Visão geral' },
    { name: 'Ativas',       href: '/entrepreneur/active',       icon: '🚚', description: 'Em andamento' },
    { name: 'Nova Entrega', href: '/entrepreneur/new-delivery', icon: '➕', description: 'Criar' },
    { name: 'Histórico',    href: '/entrepreneur/history',      icon: '📋', description: 'Concluídas' },
    { name: 'Plano',        href: '/entrepreneur/subscription', icon: '⭐', description: 'Assinatura' },
  ] : [
    { name: 'Dashboard',       href: '/deliverer/dashboard',  icon: '📊', description: 'Visão geral' },
    { name: 'Disponíveis',     href: '/deliverer/available',  icon: '📦', description: 'Aceitar' },
    { name: 'Minhas Entregas', href: '/deliverer/active',     icon: '🚚', description: 'Em andamento' },
    { name: 'Ganhos',          href: '/deliverer/earnings',   icon: '💰', description: 'Rendimentos' },
  ]

  // ── Busca: filtra items de navegação ─────────────────────────────────────────
  const searchResults = searchQuery.trim().length > 1
    ? navigation.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  // ── Ícone de notificação por tipo ─────────────────────────────────────────────
  const notifIcon = (type: string) => {
    const map: Record<string, JSX.Element> = {
      delivery:    <Package size={14} className="text-emerald-400" />,
      payment:     <DollarSign size={14} className="text-green-400" />,
      system:      <Bell size={14} className="text-blue-400" />,
      achievement: <Zap size={14} className="text-yellow-400" />,
    }
    return map[type] ?? <Bell size={14} className="text-gray-400" />
  }

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur-lg transition-colors duration-300 ${
      dk('bg-[#121212]/95 border-white/5', 'bg-white/95 border-gray-200')
    }`}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* ── Logo ── */}
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl hover:bg-white/5 transition-colors">
              {mobileMenuOpen
                ? <X className={dk('text-gray-300', 'text-gray-700')} size={20} />
                : <Menu className={dk('text-gray-300', 'text-gray-700')} size={20} />}
            </button>

            <Link to="/" className="flex items-center gap-3 group">
              <div className={`p-2.5 rounded-xl transition-all duration-300 group-hover:scale-105 ${
                dk('bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30',
                   'bg-gradient-to-br from-emerald-100 to-emerald-50 border border-emerald-200')
              }`}>
                <Package className={dk('text-emerald-400', 'text-emerald-600')} size={22} />
              </div>
              <div className="hidden sm:block">
                <span className={`text-xl font-black italic tracking-tighter ${dk('text-white', 'text-gray-900')}`}>
                  ZOMAR
                </span>
                <p className={`text-xs mt-0.5 ${dk('text-emerald-400/70', 'text-emerald-600')}`}>
                  {user?.role === 'entrepreneur' ? 'Empreendedor' : 'Entregador'}
                </p>
              </div>
            </Link>
          </div>

          {/* ── Navegação Desktop ── */}
          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link key={item.name} to={item.href}
                  className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all ${
                    isActive
                      ? dk('bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                           'bg-emerald-100 text-emerald-700 border border-emerald-200')
                      : dk('text-gray-400 hover:text-white hover:bg-white/5',
                           'text-gray-600 hover:text-gray-900 hover:bg-gray-100')
                  }`}>
                  <span className="text-sm">{item.icon}</span>
                  <div className="text-left">
                    <span className="text-sm font-medium">{item.name}</span>
                    <p className={`text-xs ${
                      isActive
                        ? dk('text-emerald-400/70', 'text-emerald-600')
                        : dk('text-gray-500', 'text-gray-500')
                    }`}>{item.description}</p>
                  </div>
                </Link>
              )
            })}
          </nav>

          {/* ── Acções direita ── */}
          <div className="flex items-center gap-2">

            {/* Busca Desktop */}
            <div ref={searchRef} className="hidden lg:block relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${dk('text-gray-400', 'text-gray-500')}`} size={18} />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                className={`pl-10 pr-4 py-2 w-56 rounded-xl border text-sm transition-all ${
                  dk('bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-emerald-500/50 focus:w-72',
                     'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-emerald-400 focus:w-72')
                } focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}
              />
              {/* Dropdown de resultados da busca */}
              {searchOpen && searchQuery.trim().length > 1 && (
                <div className={`absolute top-full mt-2 w-72 rounded-xl shadow-2xl border z-50 overflow-hidden ${
                  dk('bg-[#1a1a1a] border-white/10', 'bg-white border-gray-200')
                }`}>
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className={`text-sm ${dk('text-gray-400', 'text-gray-500')}`}>Nenhum resultado para "{searchQuery}"</p>
                    </div>
                  ) : (
                    searchResults.map(item => (
                      <button key={item.href} onClick={() => { navigate(item.href); setSearchQuery(''); setSearchOpen(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                          dk('hover:bg-white/5 text-left', 'hover:bg-gray-50 text-left')
                        }`}>
                        <span className="text-lg">{item.icon}</span>
                        <div>
                          <p className={`text-sm font-medium ${dk('text-white', 'text-gray-900')}`}>{item.name}</p>
                          <p className={`text-xs ${dk('text-gray-400', 'text-gray-500')}`}>{item.description}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Busca Mobile */}
            <button onClick={() => setSearchOpen(true)}
              className="lg:hidden p-2.5 rounded-xl hover:bg-white/5 transition-colors">
              <Search className={dk('text-gray-300', 'text-gray-600')} size={20} />
            </button>

            {/* Tema */}
            <button onClick={toggleTheme}
              className={`p-2.5 rounded-xl border ${
                dk('border-white/10 bg-white/5 hover:bg-white/10', 'border-gray-300 bg-gray-100 hover:bg-gray-200')
              } transition-colors`}>
              {isDarkMode
                ? <Sun className="text-yellow-400" size={18} />
                : <Moon className="text-gray-700" size={18} />}
            </button>

            {/* ── Notificações ── */}
            <div ref={notifMenuRef} className="relative">
              <button
                onClick={() => setNotificationsOpen(p => !p)}
                className={`p-2.5 rounded-xl border relative ${
                  dk('border-white/10 bg-white/5 hover:bg-white/10', 'border-gray-300 bg-gray-100 hover:bg-gray-200')
                } transition-colors`}>
                <Bell className={dk('text-gray-300', 'text-gray-700')} size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#121212]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className={`absolute right-0 mt-2 w-80 rounded-xl shadow-2xl border z-50 ${
                  dk('bg-[#1a1a1a] border-white/10', 'bg-white border-gray-200')
                }`}>
                  {/* Header do painel */}
                  <div className={`p-4 border-b ${dk('border-white/5', 'border-gray-200')}`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`font-bold ${dk('text-white', 'text-gray-900')}`}>Notificações</h3>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {unreadCount > 0 && (
                          <button onClick={markAllAsRead} title="Marcar todas como lidas"
                            className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition-colors">
                            <Check size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lista */}
                  <div className="max-h-80 overflow-y-auto">
                    {notifsLoading ? (
                      <div className="p-6 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-500/20 border-t-emerald-500 mx-auto" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-6 text-center">
                        <Bell className={`mx-auto mb-2 ${dk('text-gray-600', 'text-gray-300')}`} size={28} />
                        <p className={`text-sm ${dk('text-gray-400', 'text-gray-500')}`}>Sem notificações</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div key={notif.id} onClick={() => handleNotifClick(notif)}
                          className={`p-4 border-b cursor-pointer transition-colors group ${
                            notif.read
                              ? dk('border-white/5 hover:bg-white/5', 'border-gray-100 hover:bg-gray-50')
                              : dk('border-emerald-500/10 bg-emerald-500/5 hover:bg-emerald-500/10', 'border-emerald-100 bg-emerald-50 hover:bg-emerald-100')
                          }`}>
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
                              notif.read ? dk('bg-white/5', 'bg-gray-100') : dk('bg-emerald-500/10', 'bg-emerald-100')
                            }`}>
                              {notifIcon(notif.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-medium leading-tight ${
                                  notif.read ? dk('text-gray-300', 'text-gray-700') : dk('text-white', 'text-gray-900')
                                }`}>{notif.title}</p>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {!notif.read && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
                                  <button onClick={e => deleteNotif(e, notif.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-400 text-gray-500">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              <p className={`text-xs mt-1 line-clamp-2 ${
                                dk('text-gray-400', 'text-gray-500')
                              }`}>{notif.message}</p>
                              <p className={`text-xs mt-1.5 ${dk('text-gray-600', 'text-gray-400')}`}>
                                {new Date(notif.created_at).toLocaleString('pt-MZ', {
                                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Rodapé */}
                  <div className={`p-3 border-t ${dk('border-white/5', 'border-gray-200')}`}>
                    <button
                      onClick={() => {
                        navigate(user?.role === 'entrepreneur'
                          ? '/entrepreneur/notifications'
                          : '/deliverer/notifications')
                        setNotificationsOpen(false)
                      }}
                      className={`w-full text-center text-sm font-medium py-2 rounded-lg transition-colors ${
                        dk('text-emerald-400 hover:bg-emerald-500/10', 'text-emerald-600 hover:bg-emerald-50')
                      }`}>
                      Ver todas as notificações →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Menu do Utilizador ── */}
            {user ? (
              <div ref={userMenuRef} className="relative">
                <button onClick={() => setUserMenuOpen(p => !p)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                    userMenuOpen
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : dk('border-white/10 bg-white/5 hover:border-emerald-500/30',
                           'border-gray-300 bg-gray-100 hover:border-emerald-300')
                  }`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
                    {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>
                      {user.full_name || user.email?.split('@')[0]}
                    </p>
                    <p className={`text-xs flex items-center gap-1 ${dk('text-emerald-400', 'text-emerald-600')}`}>
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      {user.role === 'entrepreneur' ? 'Empreendedor' : 'Entregador'}
                    </p>
                  </div>
                  <ChevronDown className={`hidden md:block transition-transform ${userMenuOpen ? 'rotate-180' : ''} ${dk('text-gray-400', 'text-gray-600')}`} size={16} />
                </button>

                {userMenuOpen && (
                  <div className={`absolute right-0 mt-2 w-64 rounded-xl shadow-2xl border z-50 ${
                    dk('bg-[#1a1a1a] border-white/10', 'bg-white border-gray-200')
                  }`}>
                    {/* Info utilizador */}
                    <div className={`p-4 border-b ${dk('border-white/5', 'border-gray-200')}`}>
                      <p className={`font-bold ${dk('text-white', 'text-gray-900')}`}>{user.full_name}</p>
                      <p className={`text-sm mt-0.5 ${dk('text-gray-400', 'text-gray-600')}`}>{user.email}</p>
                    </div>

                    <div className="py-2">
                      <Link to="/profile" onClick={() => setUserMenuOpen(false)}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                          dk('text-gray-300 hover:bg-white/5', 'text-gray-700 hover:bg-gray-100')
                        }`}>
                        <User size={16} /> Meu Perfil
                      </Link>

                      {user.role === 'entrepreneur' && (
                        <Link to="/entrepreneur/subscription" onClick={() => setUserMenuOpen(false)}
                          className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                            dk('text-gray-300 hover:bg-white/5', 'text-gray-700 hover:bg-gray-100')
                          }`}>
                          <Activity size={16} /> Meu Plano
                        </Link>
                      )}

                      {user.role === 'deliverer' && (
                        <Link to="/deliverer/earnings" onClick={() => setUserMenuOpen(false)}
                          className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                            dk('text-gray-300 hover:bg-white/5', 'text-gray-700 hover:bg-gray-100')
                          }`}>
                          <DollarSign size={16} /> Meus Ganhos
                        </Link>
                      )}

                      <Link to={user.role === 'entrepreneur' ? '/entrepreneur/settings' : '/deliverer/settings'}
                        onClick={() => setUserMenuOpen(false)}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                          dk('text-gray-300 hover:bg-white/5', 'text-gray-700 hover:bg-gray-100')
                        }`}>
                        <Zap size={16} /> Configurações
                      </Link>
                    </div>

                    <div className={`border-t py-2 ${dk('border-white/5', 'border-gray-200')}`}>
                      <button onClick={handleSignOut}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                          dk('text-red-400 hover:bg-red-500/10', 'text-red-600 hover:bg-red-50')
                        }`}>
                        <LogOut size={16} /> Sair
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className={`px-4 py-2.5 text-sm font-medium rounded-xl border ${
                  dk('border-white/10 text-gray-300 hover:bg-white/5 hover:text-white',
                     'border-gray-300 text-gray-700 hover:bg-gray-100')
                } transition-colors`}>Entrar</Link>
                <Link to="/register" className={`px-4 py-2.5 text-sm font-medium rounded-xl ${
                  dk('bg-emerald-500 hover:bg-emerald-400 text-black',
                     'bg-emerald-600 hover:bg-emerald-500 text-white')
                } transition-colors`}>Cadastrar</Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Menu Mobile ── */}
        {mobileMenuOpen && (
          <div className={`md:hidden py-4 border-t ${dk('border-white/5', 'border-gray-200')}`}>
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link key={item.name} to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                      isActive
                        ? dk('bg-emerald-500/10 text-emerald-400', 'bg-emerald-100 text-emerald-700')
                        : dk('text-gray-300 hover:text-white hover:bg-white/5', 'text-gray-700 hover:text-gray-900 hover:bg-gray-100')
                    }`}>
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <span className="text-sm font-medium">{item.name}</span>
                      <p className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>{item.description}</p>
                    </div>
                  </Link>
                )
              })}
            </div>

            {user && (
              <div className={`mt-4 pt-4 border-t ${dk('border-white/5', 'border-gray-200')}`}>
                <div className={`px-3 py-3 rounded-xl mb-2 ${dk('bg-white/5', 'bg-gray-100')}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
                      {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${dk('text-white', 'text-gray-900')}`}>{user.full_name}</p>
                      <p className={`text-xs ${dk('text-emerald-400', 'text-emerald-600')}`}>{user.email}</p>
                    </div>
                  </div>
                </div>
                <button onClick={handleSignOut}
                  className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-2 ${
                    dk('text-red-400 hover:bg-red-500/10', 'text-red-600 hover:bg-red-50')
                  }`}>
                  <LogOut size={16} />
                  <span className="text-sm font-medium">Sair</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal Busca Mobile ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSearchOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className={`relative p-4 ${dk('bg-[#1a1a1a]', 'bg-white')}`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <Search className={dk('text-gray-400', 'text-gray-500')} size={20} />
              <input type="text" placeholder="Buscar páginas..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`flex-1 py-3 bg-transparent border-0 focus:outline-none text-lg ${dk('text-white', 'text-gray-900')}`}
                autoFocus />
              <button onClick={() => { setSearchOpen(false); setSearchQuery('') }} className="p-2">
                <X className={dk('text-gray-400', 'text-gray-500')} size={20} />
              </button>
            </div>
            {searchQuery.trim().length > 1 && (
              <div className="space-y-1">
                {searchResults.length === 0 ? (
                  <p className={`text-sm p-3 ${dk('text-gray-400', 'text-gray-500')}`}>Nenhum resultado</p>
                ) : searchResults.map(item => (
                  <button key={item.href}
                    onClick={() => { navigate(item.href); setSearchOpen(false); setSearchQuery('') }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                      dk('hover:bg-white/5', 'hover:bg-gray-50')
                    }`}>
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className={`font-medium ${dk('text-white', 'text-gray-900')}`}>{item.name}</p>
                      <p className={`text-xs ${dk('text-gray-400', 'text-gray-500')}`}>{item.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}