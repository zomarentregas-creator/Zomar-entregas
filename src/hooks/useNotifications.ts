// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface AppNotification {
  id:          string
  title:       string
  message:     string
  type:        string
  read:        boolean
  delivery_id: string | null
  created_at:  string
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading,       setLoading]       = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, message, type, read, delivery_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifications(data || [])
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [userId])

  useEffect(() => { load() }, [load])

  // Realtime — INSERT, UPDATE, DELETE
  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel(`notifs-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setNotifications(prev => [payload.new as AppNotification, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setNotifications(prev =>
          prev.map(n => n.id === payload.new.id ? payload.new as AppNotification : n)
        )
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setNotifications(prev => prev.filter(n => n.id !== (payload.old as any).id))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllAsRead = async () => {
    if (!userId) return
    await supabase.from('notifications').update({ read: true })
      .eq('user_id', userId).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const deleteNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead, deleteNotif, reload: load }
}