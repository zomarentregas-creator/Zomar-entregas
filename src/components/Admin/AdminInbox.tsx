// Sino do admin: notificações reais (pedidos de plano, levantamentos, problemas) com contador.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface N { id: string; title: string; message: string; type: string; read: boolean; created_at: string }

const target = (t: string) => (t === 'payment' ? '/admin/subscriptions' : t.startsWith('withdrawal') ? '/admin/withdrawals' : '/admin/deliveries')

export default function AdminInbox({ isDark }: { isDark: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<N[]>([])
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const uid = user?.id

  const load = useCallback(async () => {
    if (!uid) return
    const { data } = await supabase.from('notifications')
      .select('id, title, message, type, read, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(15)
    setItems((data ?? []) as N[])
  }, [uid])

  useEffect(() => {
    if (!uid) return
    void load()
    const ch = supabase.channel('admin-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => { void load() })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [uid, load])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])

  const unread = items.filter(i => !i.read).length
  const go = async (n: N) => {
    setOpen(false)
    if (!n.read) { await supabase.from('notifications').update({ read: true }).eq('id', n.id); void load() }
    navigate(target(n.type))
  }
  const markAll = async () => {
    if (!uid || !unread) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false)
    void load()
  }

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen(o => !o)} aria-label={unread ? `Notificações: ${unread} por ler` : 'Notificações'} aria-expanded={open}
        className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}>
        <Bell size={17} aria-hidden />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div role="menu" className={`absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border shadow-xl z-50 overflow-hidden ${isDark ? 'bg-[#0d1318] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
            <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Notificações</span>
            <button onClick={markAll} disabled={!unread} className="text-xs text-emerald-500 disabled:opacity-40">Marcar como lidas</button>
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 && <p className={`px-4 py-6 text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Sem notificações.</p>}
            {items.map(n => (
              <button key={n.id} role="menuitem" onClick={() => void go(n)}
                className={`w-full text-left px-4 py-3 border-b last:border-0 ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'}`}>
                <p className={`text-sm ${n.read ? 'font-normal' : 'font-bold'} ${isDark ? 'text-white' : 'text-gray-900'}`}>{n.title}</p>
                <p className={`text-xs mt-0.5 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{n.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
