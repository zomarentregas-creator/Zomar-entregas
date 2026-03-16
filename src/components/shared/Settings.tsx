// src/components/entrepreneur/Settings.tsx (ou src/pages/Settings.tsx)
/**
 * ============================================================================
 * SETTINGS — Totalmente funcional
 * ============================================================================
 * @version 5.0
 * - upsert correcto (sem double-fetch)
 * - tema aplicado imediatamente e persistido
 * - modo compacto aplica classe no body
 * - todas as toggles ligadas ao Supabase
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  Bell, Lock, Eye, Globe, Moon, Sun, Smartphone,
  Mail, MessageSquare, Volume2, Shield, CheckCircle,
  AlertCircle, Save, RefreshCw, Settings as SettingsIcon
} from 'lucide-react'

interface UserSettings {
  email_notifications: boolean
  push_notifications: boolean
  sms_notifications: boolean
  notification_sound: boolean
  profile_public: boolean
  show_online_status: boolean
  share_location: boolean
  theme: 'dark' | 'light' | 'auto'
  compact_mode: boolean
  allow_messages: boolean
  allow_calls: boolean
}

const DEFAULTS: UserSettings = {
  email_notifications: true,
  push_notifications: true,
  sms_notifications: false,
  notification_sound: true,
  profile_public: true,
  show_online_status: true,
  share_location: true,
  theme: 'dark',
  compact_mode: false,
  allow_messages: true,
  allow_calls: true,
}

// ── Aplica tema no documento ──────────────────────────────────────────────────
const applyTheme = (theme: 'dark' | 'light' | 'auto'): boolean => {
  let dark: boolean
  if (theme === 'auto') {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  } else {
    dark = theme === 'dark'
  }
  localStorage.setItem('app_theme', theme)
  // Se o projecto usar classe 'dark' no <html>
  document.documentElement.classList.toggle('dark', dark)
  return dark
}

// ── Aplica modo compacto no body ──────────────────────────────────────────────
const applyCompact = (compact: boolean) => {
  document.body.classList.toggle('compact-mode', compact)
}

export default function Settings() {
  const { user } = useAuth()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS)
  // Guarda os valores originais para poder "restaurar"
  const [original, setOriginal] = useState<UserSettings>(DEFAULTS)

  // ── Carregar ──────────────────────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const { data, error: e } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()           // ← não lança erro se não existir

      if (e) throw e

      if (data) {
        const loaded: UserSettings = {
          email_notifications: data.email_notifications ?? DEFAULTS.email_notifications,
          push_notifications:  data.push_notifications  ?? DEFAULTS.push_notifications,
          sms_notifications:   data.sms_notifications   ?? DEFAULTS.sms_notifications,
          notification_sound:  data.notification_sound  ?? DEFAULTS.notification_sound,
          profile_public:      data.profile_public      ?? DEFAULTS.profile_public,
          show_online_status:  data.show_online_status  ?? DEFAULTS.show_online_status,
          share_location:      data.share_location      ?? DEFAULTS.share_location,
          theme:               data.theme               ?? DEFAULTS.theme,
          compact_mode:        data.compact_mode        ?? DEFAULTS.compact_mode,
          allow_messages:      data.allow_messages      ?? DEFAULTS.allow_messages,
          allow_calls:         data.allow_calls         ?? DEFAULTS.allow_calls,
        }
        setSettings(loaded)
        setOriginal(loaded)
        const dark = applyTheme(loaded.theme)
        setIsDarkMode(dark)
        applyCompact(loaded.compact_mode)
      }
    } catch (err: any) {
      console.error('Erro ao carregar configurações:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadSettings() }, [loadSettings])

  // ── Guardar ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true); setError(null); setSuccess(false)
    try {
      const { error: e } = await supabase
        .from('user_settings')
        .upsert(
          { user_id: user.id, ...settings, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
      if (e) throw e

      setOriginal(settings)
      const dark = applyTheme(settings.theme)
      setIsDarkMode(dark)
      applyCompact(settings.compact_mode)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Erro ao guardar configurações')
    } finally {
      setSaving(false)
    }
  }

  // ── Restaurar (volta ao que estava na DB) ─────────────────────────────────
  const handleRestore = () => {
    setSettings(original)
    const dark = applyTheme(original.theme)
    setIsDarkMode(dark)
    applyCompact(original.compact_mode)
  }

  const handleToggle = (key: keyof UserSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleThemeChange = (theme: 'dark' | 'light' | 'auto') => {
    setSettings(prev => ({ ...prev, theme }))
    const dark = applyTheme(theme)
    setIsDarkMode(dark)
  }

  const dk = (dark: string, light: string) => isDarkMode ? dark : light

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 mx-auto" />
        <p className="mt-4 text-gray-400">A carregar configurações...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-xl ${dk('bg-emerald-500/10', 'bg-emerald-100')}`}>
          <SettingsIcon className={dk('text-emerald-400', 'text-emerald-600')} size={24} />
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>Configurações</h1>
          <p className={`text-sm mt-0.5 ${dk('text-gray-400', 'text-gray-600')}`}>Personalize a sua experiência no ZOMAR</p>
        </div>
      </div>

      {/* Feedback */}
      {success && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle className="text-emerald-400" size={20} />
          <span className="text-emerald-300">Configurações guardadas com sucesso!</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl flex items-center gap-3 bg-red-500/10 border border-red-500/20">
          <AlertCircle className="text-red-400" size={20} />
          <span className="text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* ── Notificações ── */}
      <Section icon={Bell} iconBg={dk('bg-emerald-500/10', 'bg-emerald-100')}
        iconColor={dk('text-emerald-400', 'text-emerald-600')}
        title="Notificações" subtitle="Gira como recebe notificações" isDarkMode={isDarkMode}>
        <Toggle icon={Mail}         label="Notificações por E-mail"  desc="Actualizações importantes por e-mail"              checked={settings.email_notifications} onChange={() => handleToggle('email_notifications')} isDarkMode={isDarkMode} />
        <Toggle icon={Smartphone}   label="Notificações Push"        desc="Notificações no seu dispositivo"                  checked={settings.push_notifications}  onChange={() => handleToggle('push_notifications')}  isDarkMode={isDarkMode} />
        <Toggle icon={MessageSquare} label="Notificações por SMS"    desc="SMS para eventos importantes"                     checked={settings.sms_notifications}   onChange={() => handleToggle('sms_notifications')}   isDarkMode={isDarkMode} />
        <Toggle icon={Volume2}      label="Som de Notificação"       desc="Reproduzir som ao receber notificações"           checked={settings.notification_sound}  onChange={() => handleToggle('notification_sound')}  isDarkMode={isDarkMode} />
      </Section>

      {/* ── Privacidade ── */}
      <Section icon={Shield} iconBg={dk('bg-blue-500/10', 'bg-blue-100')}
        iconColor={dk('text-blue-400', 'text-blue-600')}
        title="Privacidade" subtitle="Controle a sua visibilidade" isDarkMode={isDarkMode}>
        <Toggle icon={Eye}    label="Perfil Público"           desc="Permitir que outros utilizadores vejam o seu perfil"            checked={settings.profile_public}     onChange={() => handleToggle('profile_public')}     isDarkMode={isDarkMode} />
        <Toggle icon={Globe}  label="Mostrar Status Online"    desc="Exibir quando está online"                                      checked={settings.show_online_status} onChange={() => handleToggle('show_online_status')} isDarkMode={isDarkMode} />
        <Toggle icon={Lock}   label="Partilhar Localização"    desc="Permitir partilha de localização durante as entregas"           checked={settings.share_location}     onChange={() => handleToggle('share_location')}     isDarkMode={isDarkMode} />
      </Section>

      {/* ── Aparência ── */}
      <Section icon={isDarkMode ? Moon : Sun}
        iconBg={dk('bg-purple-500/10', 'bg-purple-100')}
        iconColor={dk('text-purple-400', 'text-purple-600')}
        title="Aparência" subtitle="Personalize o aspecto do sistema" isDarkMode={isDarkMode}>

        <div>
          <label className={`block text-sm font-medium mb-3 ${dk('text-gray-300', 'text-gray-700')}`}>Tema</label>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'dark',  label: 'Escuro', icon: Moon },
              { value: 'light', label: 'Claro',  icon: Sun  },
              { value: 'auto',  label: 'Auto',   icon: RefreshCw },
            ] as const).map(t => (
              <button key={t.value} onClick={() => handleThemeChange(t.value)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  settings.theme === t.value
                    ? dk('border-emerald-500 bg-emerald-500/10', 'border-emerald-500 bg-emerald-50')
                    : dk('border-white/10 bg-white/5 hover:border-white/20', 'border-gray-200 bg-gray-50 hover:border-gray-300')
                }`}>
                <t.icon className={`mx-auto mb-2 ${
                  settings.theme === t.value
                    ? dk('text-emerald-400', 'text-emerald-600')
                    : dk('text-gray-400', 'text-gray-600')
                }`} size={22} />
                <p className={`text-sm font-medium ${
                  settings.theme === t.value
                    ? dk('text-emerald-400', 'text-emerald-600')
                    : dk('text-gray-400', 'text-gray-600')
                }`}>{t.label}</p>
              </button>
            ))}
          </div>
        </div>

        <Toggle icon={Smartphone} label="Modo Compacto"
          desc="Interface mais compacta com menos espaçamento"
          checked={settings.compact_mode}
          onChange={() => {
            const next = !settings.compact_mode
            setSettings(p => ({ ...p, compact_mode: next }))
            applyCompact(next)
          }}
          isDarkMode={isDarkMode} />
      </Section>

      {/* ── Comunicação ── */}
      <Section icon={MessageSquare} iconBg={dk('bg-yellow-500/10', 'bg-yellow-100')}
        iconColor={dk('text-yellow-400', 'text-yellow-600')}
        title="Comunicação" subtitle="Preferências de comunicação" isDarkMode={isDarkMode}>
        <Toggle icon={MessageSquare} label="Permitir Mensagens" desc="Receber mensagens de outros utilizadores"           checked={settings.allow_messages} onChange={() => handleToggle('allow_messages')} isDarkMode={isDarkMode} />
        <Toggle icon={Smartphone}    label="Permitir Chamadas"  desc="Receber chamadas relacionadas a entregas"           checked={settings.allow_calls}    onChange={() => handleToggle('allow_calls')}    isDarkMode={isDarkMode} />
      </Section>

      {/* ── Acções fixas no fundo ── */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 flex gap-3 p-4 border-t backdrop-blur-lg ${
        dk('bg-[#121212]/90 border-white/5', 'bg-white/90 border-gray-200')
      }`}>
        <div className="max-w-4xl mx-auto w-full flex gap-3">
          <button onClick={handleRestore} disabled={saving}
            className={`flex-1 py-3 px-6 rounded-xl font-medium transition-all ${
              dk('bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10',
                 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200')
            }`}>
            Restaurar
          </button>
          <button onClick={handleSave} disabled={saving}
            className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              saving
                ? dk('bg-gray-700 cursor-not-allowed text-gray-400', 'bg-gray-300 cursor-not-allowed text-gray-500')
                : dk('bg-emerald-500 hover:bg-emerald-400 text-black', 'bg-emerald-600 hover:bg-emerald-700 text-white')
            }`}>
            {saving
              ? <><div className="animate-spin rounded-full h-5 w-5 border-2 border-black/20 border-t-black" />A guardar...</>
              : <><Save size={18} />Guardar Alterações</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

interface SectionProps {
  icon: any; iconBg: string; iconColor: string
  title: string; subtitle: string; isDarkMode: boolean
  children: React.ReactNode
}

function Section({ icon: Icon, iconBg, iconColor, title, subtitle, isDarkMode, children }: SectionProps) {
  return (
    <div className={`rounded-2xl border p-6 ${isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon className={iconColor} size={22} />
        </div>
        <div>
          <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{subtitle}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

interface ToggleProps {
  icon: any; label: string; desc: string
  checked: boolean; onChange: () => void; isDarkMode: boolean
}

function Toggle({ icon: Icon, label, desc, checked, onChange, isDarkMode }: ToggleProps) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
      isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'
    }`} onClick={onChange}>
      <div className="flex items-start gap-3 flex-1 pointer-events-none">
        <Icon className={`mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} size={18} />
        <div>
          <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{label}</p>
          <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{desc}</p>
        </div>
      </div>
      {/* Toggle visual */}
      <div className={`relative inline-flex items-center flex-shrink-0 ml-4 w-11 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-emerald-500' : isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
      }`}>
        <span className={`inline-block w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </div>
    </div>
  )
}