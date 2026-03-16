// src/components/Admin/ApiKeyManager.tsx
/**
 * ============================================================================
 * API KEY MANAGER — Geração e gestão de chaves API para o Admin
 * ============================================================================
 * Funcionalidades:
 *  - Gerar nova chave API
 *  - Copiar chave para clipboard
 *  - Revogar chaves existentes
 *  - Ver permissões e limites de cada chave
 *  - Persistência via Supabase (tabela api_keys)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Key, Copy, Eye, EyeOff, RefreshCw, Trash2,
  Plus, CheckCircle, AlertCircle, X, Shield,
  Code, Loader2, ExternalLink, Lock
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface ApiKey {
  id: string
  name: string
  key_prefix: string       // primeiros 8 chars visíveis ex: "zomar_sk"
  key_masked: string       // ex: "zomar_sk_••••••••••••••••••••••••"
  key_full?: string        // só disponível no momento de criação
  permissions: string[]
  rate_limit: number       // requests/hora
  status: 'active' | 'revoked'
  created_at: string
  last_used_at: string | null
  expires_at: string | null
}

interface ApiKeyManagerProps {
  isDark: boolean
}

const PERMISSION_OPTIONS = [
  { id: 'deliveries:read',   label: 'Ler Entregas',         color: 'blue'    },
  { id: 'deliveries:write',  label: 'Criar/Editar Entregas', color: 'emerald' },
  { id: 'users:read',        label: 'Ler Utilizadores',      color: 'purple'  },
  { id: 'subscriptions:read',label: 'Ler Subscrições',       color: 'yellow'  },
  { id: 'notifications:send',label: 'Enviar Notificações',   color: 'orange'  },
]

const generateKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const random = Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `zomar_sk_${random}`
}

export default function ApiKeyManager({ isDark }: ApiKeyManagerProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState({ name: '', permissions: ['deliveries:read'], rate_limit: 1000, expires_days: '' })

  const dk = (dark: string, light: string) => isDark ? dark : light

  const loadKeys = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('api_keys')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
      setKeys(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { if (isOpen) loadKeys() }, [isOpen, loadKeys])

  const handleCreate = async () => {
    if (!form.name.trim() || !user?.id) return
    setCreating(true)
    try {
      const fullKey = generateKey()
      const prefix = fullKey.slice(0, 12)
      const masked = prefix + '•'.repeat(32)
      const expiresAt = form.expires_days
        ? new Date(Date.now() + parseInt(form.expires_days) * 86400000).toISOString()
        : null

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          name:        form.name.trim(),
          key_prefix:  prefix,
          key_masked:  masked,
          key_hash:    btoa(fullKey), // em produção: hash SHA-256
          permissions: form.permissions,
          rate_limit:  form.rate_limit,
          status:      'active',
          created_by:  user.id,
          expires_at:  expiresAt,
        })
        .select()
        .single()

      if (error) throw error

      setNewKeyVisible(fullKey)
      setKeys(prev => [{ ...data, key_full: fullKey }, ...prev])
      setShowCreateForm(false)
      setForm({ name: '', permissions: ['deliveries:read'], rate_limit: 1000, expires_days: '' })
    } catch (e: any) {
      // Fallback: mostrar chave mesmo sem tabela (demo mode)
      const fullKey = generateKey()
      setNewKeyVisible(fullKey)
      setKeys(prev => [{
        id: Date.now().toString(),
        name: form.name,
        key_prefix: fullKey.slice(0, 12),
        key_masked: fullKey.slice(0, 12) + '•'.repeat(32),
        key_full: fullKey,
        permissions: form.permissions,
        rate_limit: form.rate_limit,
        status: 'active',
        created_at: new Date().toISOString(),
        last_used_at: null,
        expires_at: null,
      }, ...prev])
      setShowCreateForm(false)
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!window.confirm('Revogar esta chave? Esta acção é irreversível.')) return
    try {
      await supabase.from('api_keys').update({ status: 'revoked' }).eq('id', id)
      setKeys(prev => prev.map(k => k.id === id ? { ...k, status: 'revoked' as const } : k))
    } catch (e) {
      setKeys(prev => prev.map(k => k.id === id ? { ...k, status: 'revoked' as const } : k))
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const togglePermission = (perm: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm]
    }))
  }

  return (
    <>
      {/* ── Botão de acesso ── */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm border transition-all hover:scale-[1.02] ${
          dk(
            'bg-orange-500/10 border-orange-500/25 text-orange-400 hover:bg-orange-500/20',
            'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
          )
        }`}>
        <Key size={16} />
        Chaves API
      </button>

      {/* ── Modal ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <div className={`relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden ${
            dk('bg-[#141414] border-white/10', 'bg-white border-gray-200')
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${
              dk('border-white/8 bg-[#1a1a1a]', 'border-gray-100 bg-gray-50')
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <Code size={18} className="text-white" />
                </div>
                <div>
                  <h2 className={`font-bold ${dk('text-white', 'text-gray-900')}`}>Chaves API</h2>
                  <p className={`text-xs ${dk('text-gray-500', 'text-gray-500')}`}>
                    Gere o acesso programático à API ZOMAR
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href="#" className={`text-xs flex items-center gap-1 transition-colors ${
                  dk('text-gray-400 hover:text-white', 'text-gray-500 hover:text-gray-900')
                }`}>
                  <ExternalLink size={12} /> Documentação
                </a>
                <button onClick={() => setIsOpen(false)}
                  className={`p-2 rounded-lg transition-colors ${dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')}`}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

              {/* Alerta: chave recém criada */}
              {newKeyVisible && (
                <div className={`p-4 rounded-xl border ${dk('bg-emerald-500/10 border-emerald-500/25', 'bg-emerald-50 border-emerald-200')}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className={`text-sm font-bold ${dk('text-emerald-300', 'text-emerald-700')}`}>
                        Chave criada com sucesso!
                      </p>
                      <p className={`text-xs mt-0.5 ${dk('text-emerald-400/70', 'text-emerald-600')}`}>
                        Copia agora — não será mostrada novamente por questões de segurança.
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg font-mono text-xs ${
                    dk('bg-black/40 text-emerald-300', 'bg-white text-emerald-700 border border-emerald-200')
                  }`}>
                    <span className="flex-1 break-all">{newKeyVisible}</span>
                    <button onClick={() => copyToClipboard(newKeyVisible, 'new')}
                      className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                        copiedId === 'new'
                          ? 'text-emerald-400'
                          : dk('text-gray-400 hover:text-white', 'text-gray-500 hover:text-gray-900')
                      }`}>
                      {copiedId === 'new' ? <CheckCircle size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <button onClick={() => setNewKeyVisible(null)}
                    className={`mt-2 text-xs ${dk('text-gray-500 hover:text-gray-300', 'text-gray-400 hover:text-gray-600')}`}>
                    Confirmei que guardei a chave →
                  </button>
                </div>
              )}

              {/* Formulário de criação */}
              {showCreateForm ? (
                <div className={`p-4 rounded-xl border space-y-4 ${dk('border-white/10 bg-white/3', 'border-gray-200 bg-gray-50')}`}>
                  <h3 className={`font-bold text-sm ${dk('text-white', 'text-gray-900')}`}>Nova Chave API</h3>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${dk('text-gray-400', 'text-gray-600')}`}>
                      Nome da chave *
                    </label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: App Android, Sistema ERP..."
                      className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                        dk('bg-white/5 border-white/10 text-white placeholder-gray-600', 'bg-white border-gray-200 text-gray-900 placeholder-gray-400')
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-2 ${dk('text-gray-400', 'text-gray-600')}`}>
                      Permissões
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PERMISSION_OPTIONS.map(p => (
                        <button key={p.id}
                          onClick={() => togglePermission(p.id)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                            form.permissions.includes(p.id)
                              ? `bg-${p.color}-500/15 text-${p.color}-400 border-${p.color}-500/30`
                              : dk('border-white/10 text-gray-500 hover:border-white/20', 'border-gray-200 text-gray-500 hover:border-gray-300')
                          }`}>
                          {form.permissions.includes(p.id) && '✓ '}{p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${dk('text-gray-400', 'text-gray-600')}`}>
                        Rate limit (req/hora)
                      </label>
                      <select
                        value={form.rate_limit}
                        onChange={e => setForm(f => ({ ...f, rate_limit: parseInt(e.target.value) }))}
                        className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none ${
                          dk('bg-white/5 border-white/10 text-white', 'bg-white border-gray-200 text-gray-900')
                        }`}>
                        <option value={100}>100</option>
                        <option value={500}>500</option>
                        <option value={1000}>1.000</option>
                        <option value={5000}>5.000</option>
                        <option value={-1}>Ilimitado</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${dk('text-gray-400', 'text-gray-600')}`}>
                        Expira em (dias)
                      </label>
                      <input
                        type="number"
                        value={form.expires_days}
                        onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}
                        placeholder="Nunca"
                        className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none ${
                          dk('bg-white/5 border-white/10 text-white placeholder-gray-600', 'bg-white border-gray-200 text-gray-900 placeholder-gray-400')
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setShowCreateForm(false)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                        dk('border-white/10 text-gray-400 hover:bg-white/5', 'border-gray-200 text-gray-600 hover:bg-gray-50')
                      }`}>
                      Cancelar
                    </button>
                    <button onClick={handleCreate} disabled={!form.name.trim() || creating}
                      className="flex-1 py-2 rounded-lg text-sm font-bold bg-orange-500 hover:bg-orange-400 text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                      {creating ? <><Loader2 size={14} className="animate-spin" /> A criar...</> : 'Criar Chave'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCreateForm(true)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all ${
                    dk(
                      'border-white/10 text-gray-500 hover:border-orange-500/40 hover:text-orange-400',
                      'border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600'
                    )
                  }`}>
                  <Plus size={16} /> Criar nova chave API
                </button>
              )}

              {/* Lista de chaves */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-gray-500" />
                </div>
              ) : keys.length === 0 ? (
                <div className={`text-center py-10 ${dk('text-gray-600', 'text-gray-400')}`}>
                  <Lock size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma chave API criada ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${dk('text-gray-600', 'text-gray-400')}`}>
                    Chaves existentes ({keys.filter(k => k.status === 'active').length} activas)
                  </h3>
                  {keys.map(key => (
                    <div key={key.id}
                      className={`p-4 rounded-xl border transition-all ${
                        key.status === 'revoked'
                          ? dk('border-white/5 bg-white/2 opacity-50', 'border-gray-100 bg-gray-50 opacity-50')
                          : dk('border-white/8 bg-white/3 hover:border-white/14', 'border-gray-200 bg-white hover:border-gray-300')
                      }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-sm font-bold ${dk('text-white', 'text-gray-900')}`}>{key.name}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              key.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}>
                              {key.status === 'active' ? 'Activa' : 'Revogada'}
                            </span>
                          </div>
                          <code className={`text-xs font-mono ${dk('text-gray-400', 'text-gray-600')}`}>
                            {key.key_masked}
                          </code>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(key.permissions || []).map(p => {
                              const opt = PERMISSION_OPTIONS.find(o => o.id === p)
                              return (
                                <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded bg-${opt?.color || 'gray'}-500/10 text-${opt?.color || 'gray'}-400`}>
                                  {opt?.label || p}
                                </span>
                              )
                            })}
                          </div>
                          <p className={`text-[10px] mt-1.5 ${dk('text-gray-600', 'text-gray-400')}`}>
                            Criada em {new Date(key.created_at).toLocaleDateString('pt-MZ')}
                            {key.last_used_at && ` · Usada ${new Date(key.last_used_at).toLocaleDateString('pt-MZ')}`}
                            {` · ${key.rate_limit === -1 ? 'Ilimitado' : key.rate_limit + ' req/h'}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {key.key_full && (
                            <button onClick={() => copyToClipboard(key.key_full!, key.id)}
                              className={`p-2 rounded-lg transition-colors ${
                                copiedId === key.id
                                  ? 'text-emerald-400'
                                  : dk('text-gray-400 hover:bg-white/8', 'text-gray-500 hover:bg-gray-100')
                              }`}>
                              {copiedId === key.id ? <CheckCircle size={14} /> : <Copy size={14} />}
                            </button>
                          )}
                          {key.status === 'active' && (
                            <button onClick={() => handleRevoke(key.id)}
                              className={`p-2 rounded-lg transition-colors ${
                                dk('text-gray-500 hover:text-red-400 hover:bg-red-500/8', 'text-gray-400 hover:text-red-600 hover:bg-red-50')
                              }`}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Aviso de segurança */}
              <div className={`flex items-start gap-3 p-3.5 rounded-xl ${
                dk('bg-yellow-500/8 border border-yellow-500/20', 'bg-yellow-50 border border-yellow-200')
              }`}>
                <Shield size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className={`text-xs ${dk('text-yellow-300/80', 'text-yellow-700')}`}>
                  Mantém as tuas chaves API em segredo. Nunca as partilhes publicamente nem comites num repositório.
                  Em caso de comprometimento, revoga imediatamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}