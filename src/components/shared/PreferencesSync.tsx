// Monta-se nos layouts: aplica preferências guardadas, sincroniza entre dispositivos
// e acompanha o tema do sistema quando o modo é "Automático".
import { useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  applyA11y, fetchRemoteSettings, loadLocalA11y, loadLocalCompact, loadThemeMode,
  sanitizeA11y, saveLocalPrefs, setThemeMode, themeKey, systemPrefersDark, type Role,
} from '../../lib/preferences'

export default function PreferencesSync({ role }: { role: Role }) {
  const { user } = useAuth()
  const uid = user?.id

  useEffect(() => {
    applyA11y(loadLocalA11y(), loadLocalCompact())
  }, [])

  // Traz as preferências do servidor (outro dispositivo) quando ainda não há escolha local.
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    ;(async () => {
      const remote = await fetchRemoteSettings(uid)
      if (cancelled || !remote) return
      const hasLocal = !!localStorage.getItem('zomar-a11y')
      const raw = remote.accessibility as Record<string, unknown> | undefined
      if (!hasLocal && raw && Object.keys(raw).length) {
        saveLocalPrefs(sanitizeA11y(raw), remote.compact_mode === true)
      }
      if (!loadThemeMode() && (remote.theme === 'auto')) setThemeMode(role, 'auto')
    })()
    return () => { cancelled = true }
  }, [uid, role])

  // Modo automático: segue o sistema.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      if (loadThemeMode() !== 'auto') return
      const want = systemPrefersDark() ? 'dark' : 'light'
      if (localStorage.getItem(themeKey(role)) !== want) setThemeMode(role, 'auto')
    }
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [role])

  return null
}
