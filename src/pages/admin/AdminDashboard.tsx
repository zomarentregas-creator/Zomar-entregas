// src/pages/admin/AdminDashboard.tsx
// ─── VERSÃO COM ApiKeyManager EMBUTIDO ───────────────────────────────────────
// Substituir o ficheiro existente por este.
// O ApiKeyManager está embutido como componente interno — não precisas do
// ficheiro separado ApiKeyManager.tsx a não ser que o queiras noutros sítios.

import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/Admin/Adminlayout'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  Users, Package, TrendingUp, AlertCircle,
  CheckCircle, Clock, ArrowUpRight, ArrowDownRight,
  RefreshCw, Loader2, MapPin, ShieldAlert,
  XCircle, Eye,
  Key, Copy, Plus, Trash2, Code,
  Lock, Shield, X,
} from 'lucide-react'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface DashStats {
  totalUsers: number; prevUsers: number
  activeDeliveries: number; prevActiveDeliveries: number
  monthRevenue: number; prevMonthRevenue: number
  openProblems: number; prevProblems: number
}

interface SecurityAlert {
  id: string; type: string; label: string; detail: string
  userId: string; userName: string; severity: 'high' | 'medium' | 'low'
}

interface RecentDelivery {
  id: string; item_type?: string; origin_address?: string
  destination_address?: string; current_status: string
  estimated_value?: number; created_at: string
}

interface ApiKey {
  id: string; name: string; key_prefix: string; key_masked: string
  key_full?: string; permissions: string[]
  rate_limit: number; status: 'active' | 'revoked'
  created_at: string; last_used_at: string | null; expires_at: string | null
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

const pctChange = (curr: number, prev: number) => {
  if (prev === 0) return { val: curr > 0 ? '+100%' : '—', up: curr >= 0 }
  const d = ((curr - prev) / prev) * 100
  return { val: `${d >= 0 ? '+' : ''}${d.toFixed(0)}%`, up: d >= 0 }
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  completed:   { label: 'Concluída',    cls: 'bg-emerald-500/10 text-emerald-400' },
  in_progress: { label: 'Em Andamento', cls: 'bg-blue-500/10 text-blue-400' },
  accepted:    { label: 'Aceite',       cls: 'bg-yellow-500/10 text-yellow-400' },
  picked_up:   { label: 'Recolhido',    cls: 'bg-purple-500/10 text-purple-400' },
  cancelled:   { label: 'Cancelada',    cls: 'bg-gray-500/10 text-gray-400' },
  problem:     { label: 'Problema',     cls: 'bg-red-500/10 text-red-400' },
}

const ACTIVE_STATUSES = ['accepted', 'in_progress', 'in_transit', 'picked_up']

const PERMISSION_OPTIONS = [
  { id: 'deliveries:read',    label: 'Ler Entregas',          color: 'blue' },
  { id: 'deliveries:write',   label: 'Criar/Editar Entregas', color: 'emerald' },
  { id: 'users:read',         label: 'Ler Utilizadores',      color: 'purple' },
  { id: 'subscriptions:read', label: 'Ler Subscrições',       color: 'yellow' },
  { id: 'notifications:send', label: 'Enviar Notificações',   color: 'orange' },
]

const SYSTEM_CHECKS = [
  { label: 'API',           status: 'ok'   as const, detail: 'Operacional' },
  { label: 'Base de Dados', status: 'ok'   as const, detail: 'Operacional' },
  { label: 'Notificações',  status: 'warn' as const, detail: 'Latência'    },
  { label: 'Pagamentos',    status: 'ok'   as const, detail: 'Monitorando' },
]

const COLOR_MAP: Record<string, string> = {
  blue:    'bg-blue-500/10 text-blue-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  purple:  'bg-purple-500/10 text-purple-400',
  red:     'bg-red-500/10 text-red-400',
}

// Gera chave criptograficamente segura usando Web Crypto API
function genKey(): string {
  const bytes = new Uint8Array(30)
  crypto.getRandomValues(bytes)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return 'zomar_sk_' + Array.from(bytes, b => chars[b % chars.length]).join('')
}

// Hash SHA-256 real via Web Crypto API (não reversível)
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── API KEY MANAGER ──────────────────────────────────────────────────────────

function ApiKeyManager({ isDark }: { isDark: boolean }) {
  const { user } = useAuth()
  const [open, setOpen]           = useState(false)
  const [keys, setKeys]           = useState<ApiKey[]>([])
  const [loading, setLoading]     = useState(false)
  const [creating, setCreating]   = useState(false)
  const [revoking, setRevoking]   = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [newKeyVal, setNewKeyVal] = useState<string | null>(null)
  const [copiedId, setCopiedId]   = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm]           = useState({
    name: '', permissions: ['deliveries:read'] as string[],
    rate_limit: 1000, expires_days: '',
  })

  const dk = (d: string, l: string) => isDark ? d : l

  // ── Carregar chaves da DB ─────────────────────────────────────────
  const loadKeys = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id,name,key_prefix,key_masked,permissions,rate_limit,status,created_at,last_used_at,expires_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setKeys(data || [])
    } catch (e: any) {
      console.error('Erro ao carregar chaves API:', e.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { if (open) loadKeys() }, [open, loadKeys])

  // Fecha com ESC
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const handleClose = () => {
    setOpen(false)
    setShowForm(false)
    setNewKeyVal(null)
    setFormError(null)
    setForm({ name: '', permissions: ['deliveries:read'], rate_limit: 1000, expires_days: '' })
  }

  // ── Criar chave ───────────────────────────────────────────────────
  const handleCreate = async () => {
    setFormError(null)
    if (!form.name.trim())            { setFormError('O nome é obrigatório.'); return }
    if (form.permissions.length === 0){ setFormError('Selecciona pelo menos uma permissão.'); return }
    if (!user?.id) return

    setCreating(true)
    try {
      const full    = genKey()
      const hash    = await sha256(full)               // hash SHA-256 irreversível
      const prefix  = full.slice(0, 12)                // "zomar_sk_XXX" visível
      const masked  = prefix + '•'.repeat(28)          // versão mascarada para exibição
      const expires = form.expires_days
        ? new Date(Date.now() + parseInt(form.expires_days) * 86_400_000).toISOString()
        : null

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          name:        form.name.trim(),
          key_prefix:  prefix,
          key_masked:  masked,
          key_hash:    hash,            // só o hash vai para a DB — nunca a chave completa
          permissions: form.permissions,
          rate_limit:  form.rate_limit,
          status:      'active',
          created_by:  user.id,
          expires_at:  expires,
        })
        .select('id,name,key_prefix,key_masked,permissions,rate_limit,status,created_at,last_used_at,expires_at')
        .single()

      if (error) throw error

      // Mostra a chave completa UMA VEZ — depois só o prefix+mask fica acessível
      setNewKeyVal(full)
      setKeys(prev => [data, ...prev])
      setShowForm(false)
      setForm({ name: '', permissions: ['deliveries:read'], rate_limit: 1000, expires_days: '' })
    } catch (e: any) {
      setFormError(e.message || 'Erro ao criar chave. Tenta novamente.')
    } finally {
      setCreating(false)
    }
  }

  // ── Revogar chave ─────────────────────────────────────────────────
  const handleRevoke = async (id: string, name: string) => {
    if (!window.confirm(`Revogar a chave "${name}"?\n\nEsta acção é irreversível — qualquer sistema que a utilize deixará de funcionar imediatamente.`)) return
    setRevoking(id)
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ status: 'revoked' })
        .eq('id', id)
        .eq('created_by', user?.id) // RLS extra no cliente
      if (error) throw error
      setKeys(prev => prev.map(k => k.id === id ? { ...k, status: 'revoked' as const } : k))
    } catch (e: any) {
      alert('Erro ao revogar: ' + e.message)
    } finally {
      setRevoking(null)
    }
  }

  // ── Copiar para clipboard ─────────────────────────────────────────
  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      // fallback para browsers sem permissão de clipboard
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2500)
    }
  }

  const togglePerm = (perm: string) =>
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }))

  const activeCount = keys.filter(k => k.status === 'active').length

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      {/* Botão de acesso */}
      <button
        onClick={() => setOpen(true)}
        title="Gerir chaves de acesso à API ZOMAR"
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold text-xs border transition-all hover:scale-[1.02] active:scale-[0.98] ${
          isDark
            ? 'bg-orange-500/10 border-orange-500/25 text-orange-400 hover:bg-orange-500/20'
            : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
        }`}
      >
        <Key size={14} />
        Chaves API
        {activeCount > 0 && (
          <span className="bg-orange-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* Modal via Portal — fora do stacking context do AdminLayout */}
      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gestão de Chaves API"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        >
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Painel */}
          <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col ${
            isDark ? 'bg-[#141414] border-white/10' : 'bg-white border-gray-200'
          }`} style={{ maxHeight: '85vh' }}>

            {/* ── Cabeçalho ── */}
            <div className={`flex items-center justify-between px-6 py-4 border-b flex-shrink-0 ${
              isDark ? 'border-white/8 bg-[#1a1a1a]' : 'border-gray-100 bg-gray-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Code size={17} className="text-white" />
                </div>
                <div>
                  <h2 className={`font-bold text-base ${dk('text-white', 'text-gray-900')}`}>
                    Chaves API
                  </h2>
                  <p className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>
                    {activeCount} activa{activeCount !== 1 ? 's' : ''} · Acesso programático à API ZOMAR
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                title="Fechar (ESC)"
                className={`p-2 rounded-lg transition-colors ${dk('text-gray-400 hover:bg-white/8 hover:text-white', 'text-gray-500 hover:bg-gray-100 hover:text-gray-900')}`}
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Corpo (scroll interno) ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'thin' }}>

              {/* Aviso: chave recém-criada — mostrada UMA VEZ */}
              {newKeyVal && (
                <div className={`p-4 rounded-xl border ${dk('bg-emerald-500/8 border-emerald-500/25', 'bg-emerald-50 border-emerald-200')}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className={`text-sm font-bold ${dk('text-emerald-300', 'text-emerald-700')}`}>
                        Chave criada com sucesso!
                      </p>
                      <p className={`text-xs mt-0.5 ${dk('text-emerald-400/80', 'text-emerald-600')}`}>
                        Copia agora — por segurança, não voltará a ser mostrada.
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-3 rounded-lg font-mono text-xs break-all ${
                    dk('bg-black/50 text-emerald-300 border border-emerald-500/20', 'bg-white text-emerald-700 border border-emerald-200')
                  }`}>
                    <span className="flex-1 select-all">{newKeyVal}</span>
                    <button
                      onClick={() => copy(newKeyVal, 'new')}
                      title="Copiar chave"
                      className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                        copiedId === 'new' ? 'text-emerald-400' : dk('text-gray-400 hover:text-white', 'text-gray-500 hover:text-gray-800')
                      }`}
                    >
                      {copiedId === 'new' ? <CheckCircle size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={() => setNewKeyVal(null)}
                    className={`mt-3 text-xs font-medium flex items-center gap-1 transition-colors ${dk('text-gray-500 hover:text-gray-300', 'text-gray-400 hover:text-gray-600')}`}
                  >
                    <CheckCircle size={11} /> Guardei a chave em segurança
                  </button>
                </div>
              )}

              {/* Formulário de criação */}
              {showForm ? (
                <div className={`p-5 rounded-xl border space-y-4 ${dk('border-white/10 bg-white/3', 'border-gray-200 bg-gray-50')}`}>
                  <h3 className={`font-bold text-sm ${dk('text-white', 'text-gray-900')}`}>Nova Chave API</h3>

                  {/* Nome */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${dk('text-gray-400', 'text-gray-600')}`}>
                      Nome <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormError(null) }}
                      onKeyDown={e => e.key === 'Enter' && handleCreate()}
                      placeholder="Ex: App Mobile, Integração ERP, CI/CD..."
                      maxLength={80}
                      className={`w-full px-3 py-2.5 rounded-lg text-sm border focus:outline-none focus:ring-2 transition-all ${
                        dk(
                          'bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-orange-500/50 focus:ring-orange-500/10',
                          'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:ring-orange-400/10'
                        )
                      }`}
                    />
                  </div>

                  {/* Permissões */}
                  <div>
                    <label className={`block text-xs font-semibold mb-2 ${dk('text-gray-400', 'text-gray-600')}`}>
                      Permissões <span className="text-red-400">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PERMISSION_OPTIONS.map(p => {
                        const active = form.permissions.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { togglePerm(p.id); setFormError(null) }}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                              active
                                ? `bg-${p.color}-500/15 text-${p.color}-400 border-${p.color}-500/30`
                                : dk('border-white/10 text-gray-500 hover:border-white/25 hover:text-gray-300', 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700')
                            }`}
                          >
                            {active && '✓ '}{p.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Rate limit + Expiração */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${dk('text-gray-400', 'text-gray-600')}`}>
                        Rate limit (req/hora)
                      </label>
                      <select
                        value={form.rate_limit}
                        onChange={e => setForm(f => ({ ...f, rate_limit: parseInt(e.target.value) }))}
                        className={`w-full px-3 py-2.5 rounded-lg text-sm border focus:outline-none ${
                          dk('bg-white/5 border-white/10 text-white', 'bg-white border-gray-200 text-gray-900')
                        }`}
                      >
                        <option value={100}>100 req/h</option>
                        <option value={500}>500 req/h</option>
                        <option value={1000}>1.000 req/h</option>
                        <option value={5000}>5.000 req/h</option>
                        <option value={-1}>Ilimitado</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${dk('text-gray-400', 'text-gray-600')}`}>
                        Expira em (dias)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={form.expires_days}
                        onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}
                        placeholder="Sem expiração"
                        className={`w-full px-3 py-2.5 rounded-lg text-sm border focus:outline-none ${
                          dk('bg-white/5 border-white/10 text-white placeholder-gray-600', 'bg-white border-gray-200 text-gray-900 placeholder-gray-400')
                        }`}
                      />
                    </div>
                  </div>

                  {/* Erro de formulário */}
                  {formError && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                      <AlertCircle size={12} className="flex-shrink-0" />
                      {formError}
                    </div>
                  )}

                  {/* Acções */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setFormError(null) }}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        dk('border-white/10 text-gray-400 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')
                      }`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!form.name.trim() || creating}
                      className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-orange-500 hover:bg-orange-400 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {creating
                        ? <><Loader2 size={13} className="animate-spin" /> A criar…</>
                        : <><Key size={13} /> Criar Chave</>
                      }
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setShowForm(true); setNewKeyVal(null) }}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all ${
                    dk(
                      'border-white/10 text-gray-500 hover:border-orange-500/50 hover:text-orange-400 hover:bg-orange-500/5',
                      'border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/50'
                    )
                  }`}
                >
                  <Plus size={15} /> Criar nova chave API
                </button>
              )}

              {/* ── Lista de chaves ── */}
              {loading ? (
                <div className="flex items-center justify-center py-10 gap-3">
                  <Loader2 size={18} className="animate-spin text-gray-500" />
                  <span className={`text-sm ${dk('text-gray-500', 'text-gray-400')}`}>A carregar…</span>
                </div>
              ) : keys.length === 0 && !showForm ? (
                <div className={`text-center py-10 ${dk('text-gray-600', 'text-gray-400')}`}>
                  <Lock size={28} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">Nenhuma chave criada ainda</p>
                  <p className="text-xs mt-1 opacity-60">Cria a primeira chave para integrar sistemas externos</p>
                </div>
              ) : keys.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold uppercase tracking-wider ${dk('text-gray-600', 'text-gray-400')}`}>
                      Chaves existentes
                    </p>
                    <button
                      onClick={loadKeys}
                      title="Recarregar lista"
                      className={`p-1.5 rounded-lg transition-colors ${dk('text-gray-500 hover:bg-white/5', 'text-gray-400 hover:bg-gray-100')}`}
                    >
                      <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {keys.map(key => {
                    const isExpired = key.expires_at && new Date(key.expires_at) < new Date()
                    const isRevoked = key.status === 'revoked'
                    const isInactive = isRevoked || !!isExpired
                    return (
                      <div
                        key={key.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isInactive
                            ? dk('border-white/4 bg-white/1 opacity-45', 'border-gray-100 bg-gray-50/60 opacity-45')
                            : dk('border-white/8 bg-white/3 hover:border-white/15', 'border-gray-200 bg-white hover:border-gray-300 shadow-sm')
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Nome + badge */}
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>{key.name}</p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                isExpired  ? 'bg-yellow-500/15 text-yellow-400' :
                                isRevoked  ? 'bg-red-500/15 text-red-400'       :
                                             'bg-emerald-500/15 text-emerald-400'
                              }`}>
                                {isExpired ? 'Expirada' : isRevoked ? 'Revogada' : 'Activa'}
                              </span>
                            </div>

                            {/* Chave mascarada */}
                            <code className={`text-[11px] font-mono tracking-wide ${dk('text-gray-400', 'text-gray-500')}`}>
                              {key.key_masked}
                            </code>

                            {/* Permissões */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(key.permissions || []).map(p => {
                                const opt = PERMISSION_OPTIONS.find(o => o.id === p)
                                return (
                                  <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded font-medium bg-${opt?.color || 'gray'}-500/10 text-${opt?.color || 'gray'}-400`}>
                                    {opt?.label || p}
                                  </span>
                                )
                              })}
                            </div>

                            {/* Meta */}
                            <p className={`text-[10px] mt-2 ${dk('text-gray-600', 'text-gray-400')}`}>
                              Criada {new Date(key.created_at).toLocaleDateString('pt-MZ', { day:'2-digit', month:'short', year:'numeric' })}
                              {key.last_used_at && ` · Usada ${new Date(key.last_used_at).toLocaleDateString('pt-MZ')}`}
                              {` · ${key.rate_limit === -1 ? 'Sem limite' : key.rate_limit.toLocaleString() + ' req/h'}`}
                              {key.expires_at && ` · Expira ${new Date(key.expires_at).toLocaleDateString('pt-MZ')}`}
                            </p>
                          </div>

                          {/* Acções */}
                          {!isInactive && (
                            <button
                              onClick={() => handleRevoke(key.id, key.name)}
                              disabled={revoking === key.id}
                              title="Revogar chave"
                              className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                                dk('text-gray-500 hover:text-red-400 hover:bg-red-500/8', 'text-gray-400 hover:text-red-600 hover:bg-red-50')
                              }`}
                            >
                              {revoking === key.id
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} />
                              }
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {/* Aviso de segurança */}
              <div className={`flex items-start gap-3 p-3.5 rounded-xl ${
                dk('bg-yellow-500/6 border border-yellow-500/20', 'bg-yellow-50 border border-yellow-200')
              }`}>
                <Shield size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className={`text-xs leading-relaxed ${dk('text-yellow-300/80', 'text-yellow-700')}`}>
                  Mantém as chaves em segredo. Nunca as partilhes em repositórios públicos ou logs.
                  Em caso de comprometimento, revoga imediatamente e cria uma nova.
                </p>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [visible,    setVisible]    = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [stats,      setStats]      = useState<DashStats | null>(null)
  const [deliveries, setDeliveries] = useState<RecentDelivery[]>([])
  const [alerts,     setAlerts]     = useState<SecurityAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const now            = new Date()
      const startMonth     = new Date(now.getFullYear(), now.getMonth(),     1).toISOString()
      const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const endLastMonth   = new Date(now.getFullYear(), now.getMonth(),     0, 23, 59, 59).toISOString()

      const [
        { count: totalUsers },
        { count: prevUsers },
        { data: activeDel },
        { data: prevActiveDel },
        { data: revData },
        { data: prevRevData },
        { data: problems },
        { data: prevProblems },
        { data: recent },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).lt('created_at', startMonth),
        supabase.from('deliveries').select('id').in('current_status', ACTIVE_STATUSES).gte('created_at', startMonth),
        supabase.from('deliveries').select('id').in('current_status', ACTIVE_STATUSES).gte('created_at', startLastMonth).lte('created_at', endLastMonth),
        supabase.from('deliveries').select('estimated_value').eq('current_status', 'completed').gte('created_at', startMonth),
        supabase.from('deliveries').select('estimated_value').eq('current_status', 'completed').gte('created_at', startLastMonth).lte('created_at', endLastMonth),
        supabase.from('deliveries').select('id').eq('current_status', 'problem'),
        supabase.from('deliveries').select('id').eq('current_status', 'problem').lt('created_at', startMonth),
        supabase.from('deliveries').select('id,item_type,origin_address,destination_address,current_status,estimated_value,created_at').order('created_at', { ascending: false }).limit(6),
      ])

      setStats({
        totalUsers:           totalUsers               || 0,
        prevUsers:            prevUsers                || 0,
        activeDeliveries:     (activeDel     || []).length,
        prevActiveDeliveries: (prevActiveDel || []).length,
        monthRevenue:         (revData     || []).reduce((s, d) => s + (Number(d.estimated_value) || 0), 0),
        prevMonthRevenue:     (prevRevData || []).reduce((s, d) => s + (Number(d.estimated_value) || 0), 0),
        openProblems:         (problems     || []).length,
        prevProblems:         (prevProblems || []).length,
      })
      setDeliveries(recent || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('dash-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles'   }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try {
      const found: SecurityAlert[] = []
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: recentDels } = await supabase.from('deliveries').select('deliverer_id, current_status').gte('created_at', since7d).not('deliverer_id', 'is', null)
      if (recentDels) {
        const byDel: Record<string, { total: number; cancelled: number }> = {}
        recentDels.forEach(d => {
          if (!d.deliverer_id) return
          if (!byDel[d.deliverer_id]) byDel[d.deliverer_id] = { total: 0, cancelled: 0 }
          byDel[d.deliverer_id].total++
          if (d.current_status === 'cancelled') byDel[d.deliverer_id].cancelled++
        })
        const suspicious = Object.entries(byDel).filter(([,v]) => v.total >= 3 && v.cancelled/v.total >= 0.4).map(([id]) => id)
        if (suspicious.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', suspicious)
          profiles?.forEach(p => {
            const v = byDel[p.user_id]
            found.push({ id:`cancel-${p.user_id}`, type:'high_cancel_rate', label:'Taxa de cancelamento elevada', detail:`${v.cancelled}/${v.total} entregas canceladas (7 dias)`, userId:p.user_id, userName:p.full_name||p.email||p.user_id.slice(0,8), severity:'high' })
          })
        }
      }

      const { data: lowTrust } = await supabase.from('profiles').select('user_id, full_name, email, trust_score').eq('role','deliverer').eq('status','ativo').lt('trust_score', 3.0)
      lowTrust?.forEach(p => found.push({ id:`lowtrust-${p.user_id}`, type:'low_trust', label:'Confiança crítica', detail:`Trust score: ${Number(p.trust_score).toFixed(1)}/10`, userId:p.user_id, userName:p.full_name||p.email||p.user_id.slice(0,8), severity:'medium' }))

      found.sort((a,b) => a.severity==='high' ? -1 : b.severity==='high' ? 1 : 0)
      setAlerts(found)
    } catch (e) { console.error(e) }
    finally { setAlertsLoading(false) }
  }, [])

  useEffect(() => { loadAlerts() }, [loadAlerts])

  const card = `rounded-xl border transition-all duration-200 ${isDark ? 'bg-[#1a1a1a] border-white/5 hover:border-white/10' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'}`

  const STATS_CFG = stats ? [
    { label:'Total de Utilizadores', icon:Users,       color:'blue',    ...pctChange(stats.totalUsers,stats.prevUsers),               value:stats.totalUsers.toLocaleString(),       invertColor:false },
    { label:'Entregas Activas',       icon:Package,     color:'emerald', ...pctChange(stats.activeDeliveries,stats.prevActiveDeliveries), value:stats.activeDeliveries.toLocaleString(), invertColor:false },
    { label:'Receita do Mês',         icon:TrendingUp,  color:'purple',  ...pctChange(stats.monthRevenue,stats.prevMonthRevenue),        value:fmtMZN(stats.monthRevenue),              invertColor:false },
    { label:'Problemas Abertos',      icon:AlertCircle, color:'red',     ...pctChange(stats.openProblems,stats.prevProblems),            value:stats.openProblems.toLocaleString(),     invertColor:true  },
  ] : []

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className={`flex items-center justify-between transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <div>
            <h1 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Painel Administrativo</h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Visão geral da plataforma ZOMAR</p>
          </div>
          {/* ── BOTÕES DE ACÇÃO ── */}
          <div className="flex items-center gap-2">
            <ApiKeyManager isDark={isDark} />
            <button onClick={load} disabled={loading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/> Atualizar
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        {loading && !stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_,i) => <div key={i} className={`${card} h-32 animate-pulse`}/>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS_CFG.map((s,i) => {
              const Icon = s.icon
              const isPositive = s.invertColor ? !s.up : s.up
              return (
                <div key={s.label} style={{ transitionDelay:`${i*55}ms` }}
                  className={`${card} p-5 transition-all duration-300 ${visible?'opacity-100 translate-y-0':'opacity-0 translate-y-4'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2 rounded-lg ${COLOR_MAP[s.color]}`}><Icon size={18}/></div>
                    {s.val !== '—' && (
                      <span className={`flex items-center gap-0.5 text-xs font-semibold ${isPositive?'text-emerald-400':'text-red-400'}`}>
                        {isPositive?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>}{s.val}
                      </span>
                    )}
                  </div>
                  <p className={`text-2xl font-bold mb-0.5 ${isDark?'text-white':'text-gray-900'}`}>{s.value}</p>
                  <p className={`text-xs ${isDark?'text-gray-500':'text-gray-500'}`}>{s.label}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Recentes + Status ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          <div className={`${card} lg:col-span-2 p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`font-bold ${isDark?'text-white':'text-gray-900'}`}>Entregas Recentes</h2>
              <button onClick={() => navigate('/admin/deliveries')} className="text-xs text-orange-400 hover:text-orange-300 font-medium">Ver todas →</button>
            </div>
            {loading && !deliveries.length ? (
              <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className={`h-14 rounded-lg animate-pulse ${isDark?'bg-white/5':'bg-gray-100'}`}/>)}</div>
            ) : deliveries.length === 0 ? (
              <div className={`py-10 text-center ${isDark?'text-gray-600':'text-gray-400'}`}>
                <Package size={28} className="mx-auto mb-2 opacity-50"/>
                <p className="text-sm">Nenhuma entrega ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deliveries.map((d,i) => {
                  const sc = STATUS_MAP[d.current_status] || { label:d.current_status, cls:'bg-gray-500/10 text-gray-400' }
                  return (
                    <div key={d.id} style={{ transitionDelay:`${i*40+200}ms` }}
                      onClick={() => navigate('/admin/deliveries')}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 ${visible?'opacity-100 translate-x-0':'opacity-0 -translate-x-2'} ${isDark?'hover:bg-white/5 bg-white/2':'hover:bg-gray-50 bg-gray-50/50'}`}>
                      <div>
                        <p className={`text-sm font-medium ${isDark?'text-white':'text-gray-900'}`}>
                          #{d.id.slice(0,8).toUpperCase()}
                          {d.item_type && <span className={`ml-2 font-normal text-xs ${isDark?'text-gray-400':'text-gray-500'}`}>· {d.item_type}</span>}
                        </p>
                        {(d.origin_address||d.destination_address) && (
                          <span className={`text-xs flex items-center gap-1 mt-0.5 ${isDark?'text-gray-500':'text-gray-400'}`}>
                            <MapPin size={10}/>
                            <span className="truncate max-w-[120px]">{d.origin_address||'—'}</span>
                            {' → '}
                            <span className="truncate max-w-[120px]">{d.destination_address||'—'}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${sc.cls}`}>{sc.label}</span>
                        {d.estimated_value != null && <p className="text-sm font-bold text-emerald-400">{fmtMZN(Number(d.estimated_value))}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className={`${card} p-5`}>
            <h2 className={`font-bold mb-4 ${isDark?'text-white':'text-gray-900'}`}>Status do Sistema</h2>
            <div className="space-y-3">
              {SYSTEM_CHECKS.map(({ label, status, detail }) => {
                const dotCls  = status==='ok' ? 'bg-emerald-400' : 'bg-yellow-400'
                const textCls = status==='ok' ? 'text-emerald-400' : 'text-yellow-400'
                const Icon    = status==='ok' ? CheckCircle : Clock
                return (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Icon size={15} className={textCls}/><span className={`text-sm ${isDark?'text-gray-300':'text-gray-700'}`}>{label}</span></div>
                    <div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${dotCls} ${status==='ok'?'animate-pulse':''}`}/><span className={`text-xs font-medium ${textCls}`}>{detail}</span></div>
                  </div>
                )
              })}
              <div className={`pt-3 mt-1 border-t ${isDark?'border-white/5':'border-gray-100'}`}>
                <div className="flex justify-between mb-1.5"><p className={`text-xs ${isDark?'text-gray-500':'text-gray-500'}`}>Uptime (30 dias)</p><p className="text-xs font-bold text-emerald-400">99.2%</p></div>
                <div className={`h-1.5 rounded-full overflow-hidden ${isDark?'bg-white/8':'bg-gray-100'}`}>
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000" style={{ width: visible ? '99.2%' : '0%' }}/>
                </div>
              </div>
            </div>
            {stats && (
              <div className={`mt-4 pt-4 border-t space-y-1 ${isDark?'border-white/5':'border-gray-100'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDark?'text-gray-600':'text-gray-400'}`}>Atalhos</p>
                {[
                  { label:`${stats.activeDeliveries} entrega(s) em curso`, path:'/admin/deliveries' },
                  { label:`${stats.openProblems} problema(s) aberto(s)`,  path:'/admin/deliveries' },
                  { label:`${stats.totalUsers} utilizadores`,              path:'/admin/users' },
                  { label:'Ver subscrições',                               path:'/admin/subscriptions' },
                ].map(({ label, path }) => (
                  <button key={label} onClick={() => navigate(path)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors ${isDark?'text-gray-400 hover:bg-white/5 hover:text-white':'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                    → {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Alertas ── */}
        {(alertsLoading || alerts.length > 0) && (
          <div className={`${card} overflow-hidden`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark?'border-white/5':'border-gray-100'}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark?'bg-red-500/15':'bg-red-50'}`}><ShieldAlert size={15} className="text-red-400"/></div>
                <div>
                  <h2 className={`font-bold text-sm ${isDark?'text-white':'text-gray-900'}`}>Alertas de Segurança</h2>
                  {!alertsLoading && <p className={`text-[10px] ${isDark?'text-gray-500':'text-gray-400'}`}>{alerts.length} anomalia(s) detectada(s)</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={loadAlerts} disabled={alertsLoading}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ${isDark?'hover:bg-white/5 text-gray-400':'hover:bg-gray-100 text-gray-500'}`}>
                  <RefreshCw size={11} className={alertsLoading?'animate-spin':''}/> Actualizar
                </button>
                <button onClick={() => navigate('/admin/activity-log')} className="text-xs text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1">
                  <Eye size={12}/> Ver logs →
                </button>
              </div>
            </div>
            <div className={`divide-y ${isDark?'divide-white/3':'divide-gray-50'}`}>
              {alertsLoading
                ? [...Array(2)].map((_,i) => <div key={i} className={`h-14 animate-pulse mx-5 my-3 rounded-lg ${isDark?'bg-white/5':'bg-gray-100'}`}/>)
                : alerts.map(alert => {
                  const sev = {
                    high:   { dot:'bg-red-400',    text:isDark?'text-red-400':'text-red-600',       bg:isDark?'bg-red-500/10':'bg-red-50'    },
                    medium: { dot:'bg-yellow-400',  text:isDark?'text-yellow-400':'text-yellow-600', bg:isDark?'bg-yellow-500/10':'bg-yellow-50' },
                    low:    { dot:'bg-gray-400',    text:isDark?'text-gray-400':'text-gray-500',     bg:isDark?'bg-white/5':'bg-gray-50'      },
                  }[alert.severity]
                  return (
                    <div key={alert.id} className={`px-5 py-3.5 flex items-center gap-4 transition-colors ${isDark?'hover:bg-white/2':'hover:bg-gray-50/60'}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${sev.bg}`}>
                        <XCircle size={14} className={sev.text}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${isDark?'text-white':'text-gray-900'}`}>{alert.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sev.bg} ${sev.text}`}>
                            {alert.severity==='high'?'Alta':alert.severity==='medium'?'Média':'Baixa'}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 truncate ${isDark?'text-gray-400':'text-gray-500'}`}>
                          <span className="font-medium text-orange-400">{alert.userName}</span> · {alert.detail}
                        </p>
                      </div>
                      <button onClick={() => navigate('/admin/users')}
                        className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium ${isDark?'bg-white/8 hover:bg-white/15 text-gray-300':'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                        Ver conta
                      </button>
                    </div>
                  )
                })
              }
            </div>
          </div>
        )}

        {loading && stats && (
          <div className="flex items-center justify-center gap-2 py-1">
            <Loader2 size={12} className="animate-spin text-gray-500"/><span className="text-xs text-gray-500">A actualizar…</span>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}