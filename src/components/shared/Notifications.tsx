// src/components/shared/Notifications.tsx
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Bell, CheckCircle, Package, AlertCircle, Info,
  Zap, RefreshCw, Loader2, X, Check, Trash2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../hooks/useNotifications'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
  id:          string
  title:       string
  message:     string
  type:        string   // 'delivery' | 'alert' | 'system' | 'warning' | 'payment'
  read:        boolean
  delivery_id: string | null
  created_at:  string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<string, {
  icon:  React.ReactNode
  color: (d: boolean) => string
  bg:    (d: boolean) => string
}> = {
  delivery: { icon: <Package size={15}/>,      color: d => d ? 'text-blue-400'    : 'text-blue-600',    bg: d => d ? 'bg-blue-500/15'    : 'bg-blue-50'    },
  alert:    { icon: <AlertCircle size={15}/>,  color: d => d ? 'text-red-400'     : 'text-red-600',     bg: d => d ? 'bg-red-500/15'     : 'bg-red-50'     },
  system:   { icon: <Info size={15}/>,         color: d => d ? 'text-gray-400'    : 'text-gray-500',    bg: d => d ? 'bg-white/8'        : 'bg-gray-100'   },
  warning:  { icon: <AlertCircle size={15}/>,  color: d => d ? 'text-yellow-400'  : 'text-yellow-600',  bg: d => d ? 'bg-yellow-500/15'  : 'bg-yellow-50'  },
  payment:  { icon: <Zap size={15}/>,          color: d => d ? 'text-emerald-400' : 'text-emerald-600', bg: d => d ? 'bg-emerald-500/15' : 'bg-emerald-50' },
  info:     { icon: <Info size={15}/>,         color: d => d ? 'text-blue-400'    : 'text-blue-600',    bg: d => d ? 'bg-blue-500/15'    : 'bg-blue-50'    },
}

const fallbackCfg = (d: boolean) => ({
  icon:  <Bell size={15}/>,
  color: d ? 'text-gray-400' : 'text-gray-500',
  bg:    d ? 'bg-white/8'    : 'bg-gray-100',
})

const fmtRelative = (s: string) => {
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora mesmo'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const days = Math.floor(h / 24)
  if (days < 7) return `há ${days}d`
  return new Date(s).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Notifications() {
  const { user } = useAuth()
  const location  = useLocation()
  const isDeliverer = location.pathname.startsWith('/deliverer')
  const themeKey  = isDeliverer ? 'deliverer_theme' : 'entrepreneur_theme'

  const [isDarkMode, setIsDarkMode] = useState(() =>
    localStorage.getItem(themeKey) !== 'light'
  )
  useEffect(() => {
    const h = () => setIsDarkMode(localStorage.getItem(themeKey) !== 'light')
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [themeKey])

  const { notifications, loading, unreadCount, markAsRead: hookMarkAsRead,
          markAllAsRead: hookMarkAllRead, deleteNotif, reload } = useNotifications(user?.id)
  const [filter,   setFilter]  = useState<'all' | 'unread'>('all')
  const [clearing, setClearing] = useState(false)
  const [toast,    setToast]    = useState<string | null>(null)

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Dados e realtime geridos pelo useNotifications hook

  // ── Acções delegadas ao hook ──────────────────────────────────────────────
  const markRead = (id: string) => hookMarkAsRead(id)

  const markAllRead = async () => {
    await hookMarkAllRead()
    showToast('Todas marcadas como lidas')
  }

  const deleteOne = (id: string) => deleteNotif(id)

  const clearAll = async () => {
    if (!user?.id) return
    setClearing(true)
    try {
      await supabase.from('notifications').delete().eq('user_id', user.id)
      await reload()
      showToast('Notificações limpas')
    } catch { } finally { setClearing(false) }
  }

  // ── Filtro ─────────────────────────────────────────────────────────────────
  const visible = filter === 'unread' ? notifications.filter(n => !n.read) : notifications

  // ── Classes ────────────────────────────────────────────────────────────────
  const card = `rounded-2xl border ${dk('bg-[#1a1a1a] border-white/8', 'bg-white border-gray-200 shadow-sm')}`

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl border text-sm font-medium shadow-lg ${
          dk('bg-emerald-900/90 border-emerald-500/30 text-emerald-300', 'bg-emerald-50 border-emerald-200 text-emerald-700')
        }`}>
          {toast}
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>Notificações</h2>
          <p className={`text-sm mt-0.5 ${dk('text-gray-500', 'text-gray-400')}`}>
            {unreadCount > 0
              ? <span className="text-orange-400 font-semibold">{unreadCount} não lida{unreadCount !== 1 ? 's' : ''}</span>
              : 'Tudo a dia'}
          </p>
        </div>
        <button onClick={reload}
          className={`p-2.5 rounded-xl ${dk('bg-white/5 hover:bg-white/10 text-gray-400', 'bg-gray-100 hover:bg-gray-200 text-gray-500')}`}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      {/* Filtros + acções */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Tabs lidas/não lidas */}
        <div className={`flex gap-1 p-1 rounded-xl ${dk('bg-white/5', 'bg-gray-100')}`}>
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f
                  ? dk('bg-white/15 text-white', 'bg-white text-gray-900 shadow-sm')
                  : dk('text-gray-500', 'text-gray-500')
              }`}>
              {f === 'all' ? `Todas (${notifications.length})` : `Não lidas (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* Acções */}
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              dk('bg-white/5 hover:bg-white/10 text-gray-300', 'bg-gray-100 hover:bg-gray-200 text-gray-600')
            }`}>
            <Check size={12}/> Marcar todas como lidas
          </button>
        )}
        {notifications.length > 0 && (
          <button onClick={clearAll} disabled={clearing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ml-auto ${
              dk('bg-red-500/10 hover:bg-red-500/20 text-red-400', 'bg-red-50 hover:bg-red-100 text-red-600')
            }`}>
            <Trash2 size={12}/> {clearing ? 'A limpar…' : 'Limpar tudo'}
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-12 text-center">
          <Loader2 size={24} className={`animate-spin mx-auto ${dk('text-gray-500', 'text-gray-400')}`}/>
        </div>
      ) : visible.length === 0 ? (
        <div className={`${card} py-16 text-center`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${dk('bg-white/5', 'bg-gray-50')}`}>
            <Bell size={24} className={dk('text-gray-600', 'text-gray-300')}/>
          </div>
          <p className={`font-semibold ${dk('text-gray-300', 'text-gray-700')}`}>
            {filter === 'unread' ? 'Nenhuma notificação não lida' : 'Sem notificações'}
          </p>
          <p className={`text-sm mt-1 ${dk('text-gray-500', 'text-gray-400')}`}>
            Estás a par de tudo 👍
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((n, i) => {
            const cfg = TYPE_CFG[n.type] || { icon: <Bell size={15}/>, color: () => '', bg: () => '' }
            const typedCfg = 'color' in cfg && typeof cfg.color === 'function' ? cfg : {
              icon: cfg.icon,
              color: (_: boolean) => dk('text-gray-400', 'text-gray-500'),
              bg:    (_: boolean) => dk('bg-white/8', 'bg-gray-100'),
            }
            return (
              <div key={n.id}
                style={{ animationDelay: `${i * 20}ms` }}
                className={`${card} group px-4 py-3 flex items-start gap-3 transition-all hover:border-orange-500/20 ${
                  !n.read ? dk('border-orange-500/15', 'border-orange-200') : ''
                }`}>

                {/* Ícone */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${typedCfg.bg(isDarkMode)}`}>
                  <span className={typedCfg.color(isDarkMode)}>{typedCfg.icon}</span>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 mt-0.5"/>
                      )}
                      <p className={`text-sm font-semibold leading-snug truncate ${dk('text-white', 'text-gray-900')}`}>
                        {n.title}
                      </p>
                    </div>
                    {/* Acções — visíveis em hover */}
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <button
                          onClick={e => { e.stopPropagation(); markRead(n.id) }}
                          title="Marcar como lida"
                          className={`p-1.5 rounded-lg transition-colors ${dk('hover:bg-white/10 text-gray-400 hover:text-emerald-400', 'hover:bg-gray-100 text-gray-400 hover:text-emerald-600')}`}>
                          <Check size={12}/>
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); deleteOne(n.id) }}
                        title="Remover"
                        className={`p-1.5 rounded-lg transition-colors ${dk('hover:bg-red-500/15 text-gray-500 hover:text-red-400', 'hover:bg-red-50 text-gray-400 hover:text-red-500')}`}>
                        <X size={12}/>
                      </button>
                    </div>
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${dk('text-gray-400', 'text-gray-600')}`}>
                    {n.message}
                  </p>
                  <p className={`text-[10px] mt-1.5 ${dk('text-gray-600', 'text-gray-400')}`}>
                    {fmtRelative(n.created_at)}
                  </p>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}