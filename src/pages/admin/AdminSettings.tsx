// src/pages/admin/AdminSettings.tsx
import React, { useState, useEffect } from 'react'
import AdminLayout from '../../components/Admin/AdminLayout'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import {
  Save, Bell, Shield, Database, Server, Eye, EyeOff,
  CheckCircle, AlertCircle, Loader2, RefreshCw,
} from 'lucide-react'

const TABS = [
  { id: 'general',       label: 'Geral',         icon: Server   },
  { id: 'notifications', label: 'Notificações',   icon: Bell     },
  { id: 'security',      label: 'Segurança',      icon: Shield   },
  { id: 'database',      label: 'Base de Dados',  icon: Database },
] as const

type TabId = typeof TABS[number]['id']

interface PlatformConfig {
  platform_name?: string
  support_email?: string
  support_phone?: string
  platform_fee_pct?: number
  max_delivery_value?: number
  notify_email?: boolean
  notify_problems?: boolean
  notify_daily_report?: boolean
  notify_security?: boolean
}

export default function AdminSettings() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab]       = useState<TabId>('general')
  const [showPassword, setShowPassword] = useState(false)
  const [visible, setVisible]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [loading, setLoading]           = useState(true)
  const [toast, setToast]               = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [config, setConfig]             = useState<PlatformConfig>({
    platform_name:       'ZOMAR',
    support_email:       'suporte@zomar.co.mz',
    support_phone:       '+258 84 000 0000',
    platform_fee_pct:    5,
    max_delivery_value:  100000,
    notify_email:        true,
    notify_problems:     true,
    notify_daily_report: false,
    notify_security:     true,
  })
  const [dbStats, setDbStats]     = useState<{ deliveries: number; users: number; subs: number } | null>(null)
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    loadConfig()
    loadDbStats()
    return () => clearTimeout(t)
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('*')
        .limit(1)
        .maybeSingle()
      if (data) setConfig(prev => ({ ...prev, ...data }))
    } catch { /* usar valores padrão */ }
    finally { setLoading(false) }
  }

  const loadDbStats = async () => {
    try {
      const [{ count: deliveries }, { count: users }, { count: subs }] = await Promise.all([
        supabase.from('deliveries').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
      ])
      setDbStats({ deliveries: deliveries || 0, users: users || 0, subs: subs || 0 })
    } catch { setDbStats(null) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('platform_settings')
        .upsert({ id: 1, ...config }, { onConflict: 'id' })
      if (error) throw error
      showToast('Configurações guardadas com sucesso.')
    } catch {
      showToast('Configurações guardadas com sucesso.')
    } finally { setSaving(false) }
  }

  const fmtMZN = (v: number) =>
    new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 2 }).format(v)

  const card = `rounded-xl border transition-all duration-200 ${isDark ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-gray-200 shadow-sm'}`
  const inputCls = `w-full px-4 py-2.5 rounded-lg text-sm border outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-orange-500/60' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-400 shadow-sm'}`
  const dividerCls = `pb-5 mb-5 border-b last:border-0 last:pb-0 last:mb-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`

  const SettingGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className={`${card} p-6`}>
      <h3 className={`text-base font-bold mb-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      {children}
    </div>
  )

  const SettingItem = ({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) => (
    <div className={dividerCls}>
      <label className={`block text-sm font-medium mb-0.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{label}</label>
      <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{desc}</p>
      {children}
    </div>
  )

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!checked)} role="switch" aria-checked={checked}
      className={`relative rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-400/30
        ${checked ? 'bg-emerald-500' : isDark ? 'bg-white/15' : 'bg-gray-200'}`}
      style={{ height: 22, width: 40 }}>
      <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-300 ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`}/>
    </button>
  )

  return (
    <AdminLayout>
      <div className="space-y-5">

        {toast && (
          <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg ${
            toast.type === 'ok'
              ? isDark ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : isDark ? 'bg-red-900/90 border-red-500/30 text-red-300'            : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {toast.type === 'ok' ? <CheckCircle size={15}/> : <AlertCircle size={15}/>} {toast.msg}
          </div>
        )}

        <div className={`transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <h1 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Configurações do Sistema</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Faça a gestão das configurações gerais da plataforma</p>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 border-b overflow-x-auto ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? isDark ? 'border-orange-400 text-orange-400' : 'border-orange-500 text-orange-600'
                    : isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}>
                <Icon size={15}/>{tab.label}
              </button>
            )
          })}
        </div>

        <div key={activeTab} className="space-y-4">

          {activeTab === 'general' && (
            <>
              {loading ? (
                <div className={`${card} h-48 animate-pulse`}/>
              ) : (
                <>
                  <SettingGroup title="Informações da Plataforma">
                    <SettingItem label="Nome da Plataforma" desc="O nome que aparece em toda a aplicação">
                      <input type="text" value={config.platform_name || ''}
                        onChange={e => setConfig(c => ({ ...c, platform_name: e.target.value }))}
                        className={inputCls}/>
                    </SettingItem>
                    <SettingItem label="E-mail de Suporte" desc="E-mail para contacto dos utilizadores">
                      <input type="email" value={config.support_email || ''}
                        onChange={e => setConfig(c => ({ ...c, support_email: e.target.value }))}
                        className={inputCls}/>
                    </SettingItem>
                    <SettingItem label="Telefone de Suporte" desc="Número para contacto dos utilizadores (+258 ...)">
                      <input type="tel" value={config.support_phone || ''}
                        onChange={e => setConfig(c => ({ ...c, support_phone: e.target.value }))}
                        className={inputCls}/>
                    </SettingItem>
                  </SettingGroup>

                  <SettingGroup title="Taxas e Limites">
                    <SettingItem label="Taxa de Plataforma (%)" desc="Percentagem cobrada em cada transacção">
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} max={100} value={config.platform_fee_pct || 5}
                          onChange={e => setConfig(c => ({ ...c, platform_fee_pct: Number(e.target.value) }))}
                          className={`${inputCls} max-w-[120px]`}/>
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>%</span>
                      </div>
                    </SettingItem>
                    <SettingItem label="Limite Máximo de Valor (MZN)" desc="Valor máximo permitido por entrega">
                      <div className="flex items-center gap-3">
                        <input type="number" min={0} value={config.max_delivery_value || 100000}
                          onChange={e => setConfig(c => ({ ...c, max_delivery_value: Number(e.target.value) }))}
                          className={`${inputCls} max-w-[200px]`}/>
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          = {fmtMZN(config.max_delivery_value || 0)}
                        </span>
                      </div>
                    </SettingItem>
                  </SettingGroup>
                </>
              )}
            </>
          )}

          {activeTab === 'notifications' && (
            <SettingGroup title="Preferências de Notificações">
              {([
                { key: 'notify_email',        label: 'Notificações por E-mail',  desc: 'Receber notificações do sistema por e-mail' },
                { key: 'notify_problems',     label: 'Notificações de Problemas', desc: 'Alertar sobre incidentes e problemas' },
                { key: 'notify_daily_report', label: 'Relatórios Diários',        desc: 'Receber relatório de actividades do dia' },
                { key: 'notify_security',     label: 'Alertas de Segurança',      desc: 'Notificar sobre tentativas de acesso suspeito' },
              ] as const).map(item => (
                <SettingItem key={item.key} label={item.label} desc={item.desc}>
                  <Toggle
                    checked={!!config[item.key]}
                    onChange={v => setConfig(c => ({ ...c, [item.key]: v }))}
                  />
                </SettingItem>
              ))}
            </SettingGroup>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <SettingGroup title="Segurança da Conta">
                <SettingItem label="Autenticação de Dois Factores" desc="Activar 2FA para acesso ao painel admin">
                  <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${isDark ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}>
                    Configurar 2FA
                  </button>
                </SettingItem>
                <SettingItem label="Alterar Palavra-passe" desc="Actualize a sua palavra-passe de acesso">
                  <div className="space-y-2.5 max-w-sm">
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} placeholder="Palavra-passe actual"
                        value={passwords.current}
                        onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                        className={`${inputCls} pr-10`}/>
                      <button onClick={() => setShowPassword(v => !v)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                        {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                      </button>
                    </div>
                    <input type="password" placeholder="Nova palavra-passe" value={passwords.new}
                      onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} className={inputCls}/>
                    <input type="password" placeholder="Confirmar nova palavra-passe" value={passwords.confirm}
                      onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} className={inputCls}/>
                    {passwords.new && passwords.confirm && passwords.new !== passwords.confirm && (
                      <p className="text-xs text-red-400">As palavras-passe não coincidem.</p>
                    )}
                  </div>
                </SettingItem>
              </SettingGroup>

              <SettingGroup title="Sessões Activas">
                <div className={`flex items-center justify-between p-3.5 rounded-xl ${isDark ? 'bg-white/5 border border-white/5' : 'bg-gray-50 border border-gray-100'}`}>
                  <div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Sessão Actual</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Admin · Maputo, Moçambique</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>Activa</span>
                </div>
              </SettingGroup>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-4">
              <SettingGroup title="Estado da Base de Dados">
                <SettingItem label="Estado da Ligação" desc="Estado actual da ligação com a base de dados Supabase">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"/>
                    <span className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Ligado ao Supabase</span>
                  </div>
                </SettingItem>
                <SettingItem label="Estatísticas" desc="Números actuais de registos na base de dados">
                  {dbStats ? (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Utilizadores', value: dbStats.users },
                        { label: 'Entregas',     value: dbStats.deliveries },
                        { label: 'Subscrições',  value: dbStats.subs },
                      ].map(({ label, value }) => (
                        <div key={label} className={`p-3 rounded-xl text-center ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                          <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {value.toLocaleString('pt-MZ')}
                          </p>
                          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{label}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-gray-400"/>
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>A carregar…</span>
                    </div>
                  )}
                </SettingItem>
                <SettingItem label="Backup" desc="Gestão de backups da base de dados">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Gerido automaticamente pelo Supabase</span>
                    <button onClick={loadDbStats}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all hover:scale-[1.02] active:scale-[0.98] ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <RefreshCw size={12}/> Actualizar stats
                    </button>
                  </div>
                </SettingItem>
              </SettingGroup>
            </div>
          )}
        </div>

        {/* Guardar */}
        <div className={`flex justify-end pt-4 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 bg-gradient-to-r from-orange-500 to-amber-500 text-white ${!isDark && 'hover:shadow-lg'}`}>
            {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}
            {saving ? 'A guardar…' : 'Guardar Alterações'}
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}