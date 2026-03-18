// src/pages/admin/AdminUsers.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom'
import AdminLayout from '../../components/Admin/Adminlayout'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import {
  Search, Filter, Edit2, Trash2, ChevronDown, MoreVertical,
  CheckCircle, AlertCircle, Clock, Users, RefreshCw, Loader2,
  X, ChevronLeft, ChevronRight, UserCheck, UserX, ShieldAlert,
  Star, Shield, FileCheck, Store, Truck, ShieldCheck,
} from 'lucide-react'

/* ── CSS ── */
const OPTION_FIX_CSS = `
  .adm-select-dark option  { background-color:#1a1a1a !important; color:#f0f0f0 !important; }
  .adm-select-light option { background-color:#ffffff !important; color:#111111 !important; }
  .adm-range { accent-color:#f97316; height:3px; width:100%; cursor:pointer; }
  .adm-range:disabled { opacity:.4; cursor:not-allowed; }
`

interface Subscription {
  plan_name: string
  current_usage: number
  max_deliveries: number
  status: string
}

interface Profile {
  id: string
  user_id: string
  full_name?: string
  email?: string
  role?: string
  status?: string
  phone?: string
  trust_score?: number
  document_verified?: boolean
  subscription?: Subscription | null
  suspension_reason?: string | null
  created_at: string
}

interface EditForm {
  status: string
  role: string
  trust_score: number
  document_verified: boolean
  suspension_reason: string
}

const STATUS_CFG: Record<string, { icon: React.ReactNode; textCls: (dark: boolean) => string; bgCls: (dark: boolean) => string; label: string }> = {
  ativo:    { icon: <CheckCircle size={12}/>, textCls: d => d ? 'text-emerald-400' : 'text-emerald-600', bgCls: d => d ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200', label: 'Ativo'    },
  inativo:  { icon: <Clock size={12}/>,       textCls: d => d ? 'text-gray-400'    : 'text-gray-500',   bgCls: d => d ? 'bg-white/5 border border-white/10'           : 'bg-gray-50 border border-gray-200',         label: 'Inativo'  },
  suspenso: { icon: <AlertCircle size={12}/>, textCls: d => d ? 'text-red-400'     : 'text-red-600',    bgCls: d => d ? 'bg-red-500/10 border border-red-500/20'      : 'bg-red-50 border border-red-200',           label: 'Suspenso' },
}

/* ── Configuração visual por role ── */
const ROLE_CFG = {
  admin: {
    label: 'Admin',
    icon: (size = 14) => <ShieldCheck size={size} />,
    emoji: '⚙️',
    textCls: (d: boolean) => d ? 'text-orange-400' : 'text-orange-600',
    bgCls:   (d: boolean) => d ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-200',
    avatarBg: 'from-orange-600 to-red-600',
    rowBg:   (d: boolean) => d ? 'bg-orange-500/3' : 'bg-orange-50/50',
    badge:   (d: boolean) => d
      ? 'bg-orange-500/15 border border-orange-500/30 text-orange-300'
      : 'bg-orange-100 border border-orange-300 text-orange-700',
  },
  entrepreneur: {
    label: 'Empreendedor',
    icon: (size = 14) => <Store size={size} />,
    emoji: '🏢',
    textCls: (d: boolean) => d ? 'text-blue-400' : 'text-blue-600',
    bgCls:   (d: boolean) => d ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200',
    avatarBg: 'from-blue-600 to-violet-600',
    rowBg:   (_d: boolean) => '',
    badge:   (d: boolean) => d
      ? 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
      : 'bg-blue-100 border border-blue-300 text-blue-700',
  },
  deliverer: {
    label: 'Entregador',
    icon: (size = 14) => <Truck size={size} />,
    emoji: '🚚',
    textCls: (d: boolean) => d ? 'text-emerald-400' : 'text-emerald-600',
    bgCls:   (d: boolean) => d ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200',
    avatarBg: 'from-emerald-600 to-teal-600',
    rowBg:   (_d: boolean) => '',
    badge:   (d: boolean) => d
      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
      : 'bg-emerald-100 border border-emerald-300 text-emerald-700',
  },
}

const getRoleCfg = (role?: string) => ROLE_CFG[role as keyof typeof ROLE_CFG] ?? ROLE_CFG.entrepreneur

const PAGE_SIZE = 15

export default function AdminUsers() {
  const { isDark } = useTheme()
  const [users, setUsers]         = useState<Profile[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [roleFilter, setRole]     = useState('all')
  const [statusFilter, setStatus] = useState('all')
  const [visible, setVisible]     = useState(false)
  const [editUser, setEditUser]   = useState<Profile | null>(null)
  const [editForm, setEditForm]   = useState<EditForm>({
    status: '', role: '', trust_score: 5.0, document_verified: false, suspension_reason: '',
  })
  const [saving, setSaving]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [dropdownId, setDropdownId]     = useState<string | null>(null)
  const [dropdownPos, setDropdownPos]   = useState<{ top: number; left: number } | null>(null)
  const dropdownBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [toast, setToast]         = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  /* ── Contadores por role para o header ── */
  const [counts, setCounts] = useState({ admin: 0, entrepreneur: 0, deliverer: 0 })

  useEffect(() => {
    const id = 'admin-users-fix'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id; s.textContent = OPTION_FIX_CSS
      document.head.appendChild(s)
    }
  }, [])

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // ── CORRECÇÃO PRINCIPAL: usar service role ou garantir que RLS permite admin ver todos ──
      // A query não filtra por user_id — retorna TODOS os perfis visíveis para o utilizador actual.
      // Se o Supabase tiver RLS restritivo, é necessário adicionar uma política:
      //   CREATE POLICY "admins_can_see_all" ON profiles FOR SELECT
      //   USING (auth.uid() IN (SELECT user_id FROM profiles WHERE role = 'admin'));
      let q = supabase
        .from('profiles')
        .select('*', { count: 'exact' })

      if (roleFilter   !== 'all') q = q.eq('role',   roleFilter)
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)

      const { data, count, error } = await q
        .order('role',       { ascending: true })   // admins primeiro (a→z: admin < deliverer < entrepreneur)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (error) throw error

      const profiles = data || []

      // Buscar subscrições dos empreendedores nesta página
      const entrepreneurIds = profiles
        .filter(p => p.role === 'entrepreneur')
        .map(p => p.user_id)
        .filter(Boolean)

      let subMap: Record<string, Subscription> = {}
      if (entrepreneurIds.length > 0) {
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('user_id, plan_name, current_usage, max_deliveries, status')
          .in('user_id', entrepreneurIds)
          .eq('status', 'active')
        if (subData) subData.forEach(s => { subMap[s.user_id] = s })
      }

      const enriched = profiles.map(p => ({ ...p, subscription: subMap[p.user_id] ?? null }))
      setUsers(enriched)
      setTotal(count || 0)

      // Buscar contagens totais por role (sem filtros de página)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('role')
      if (allProfiles) {
        const c = { admin: 0, entrepreneur: 0, deliverer: 0 }
        allProfiles.forEach(p => {
          if (p.role === 'admin')        c.admin++
          else if (p.role === 'entrepreneur') c.entrepreneur++
          else if (p.role === 'deliverer')    c.deliverer++
        })
        setCounts(c)
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar utilizadores.', 'err')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, statusFilter, page])

  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, roleFilter, statusFilter])
  useEffect(() => {
    const ch = supabase.channel('adm-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const handleUpdateUser = async () => {
    if (!editUser) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        status:            editForm.status,
        role:              editForm.role,
        trust_score:       Math.round(editForm.trust_score * 10) / 10,
        document_verified: editForm.document_verified,
        updated_at:        new Date().toISOString(),
        suspension_reason: editForm.status === 'suspenso'
          ? (editForm.suspension_reason.trim() || null)
          : null,
      }
      const { error } = await supabase.from('profiles').update(payload).eq('id', editUser.id)
      if (error) throw error
      showToast('Utilizador actualizado com sucesso.')
      setEditUser(null)
      load()
    } catch (err: any) {
      showToast(err.message || 'Erro ao actualizar.', 'err')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id)
      if (error) throw error
      showToast('Utilizador removido.')
      setDeleteTarget(null)
      load()
    } catch { showToast('Erro ao remover.', 'err') }
  }

  const quickStatusChange = async (userId: string, newStatus: string) => {
    try {
      const payload: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(newStatus !== 'suspenso' ? { suspension_reason: null } : {}),
      }
      const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
      if (error) throw error
      showToast(`Status alterado para "${newStatus}".`)
      setDropdownId(null); setDropdownPos(null)
      load()
    } catch { showToast('Erro ao alterar status.', 'err') }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const selectDarkCls = isDark ? 'adm-select-dark' : 'adm-select-light'
  const inputCls = `w-full px-4 py-2.5 rounded-lg text-sm border outline-none transition-all ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-orange-500/60'
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-400 shadow-sm'
  }`
  const selectCls = `w-full px-4 py-2.5 rounded-lg text-sm border outline-none appearance-none cursor-pointer transition-all ${selectDarkCls} ${
    isDark
      ? 'bg-[#1a1a1a] border-white/10 text-white focus:border-orange-500/60'
      : 'bg-white border-gray-200 text-gray-900 focus:border-orange-400 shadow-sm'
  }`
  const modalSelectCls = `w-full px-4 py-2.5 rounded-lg text-sm border outline-none appearance-none cursor-pointer transition-all ${selectDarkCls} ${
    isDark
      ? 'bg-[#111] border-white/10 text-white focus:border-orange-500/60'
      : 'bg-white border-gray-200 text-gray-900 focus:border-orange-400 shadow-sm'
  }`
  const card = `rounded-xl border transition-all duration-200 ${
    isDark ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-gray-200 shadow-sm'
  }`

  const trustColor = (score: number) =>
    score >= 7 ? 'text-emerald-400' : score >= 4 ? 'text-yellow-400' : 'text-red-400'

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ')
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].slice(0, 2).toUpperCase()
    }
    return (email?.[0] ?? '?').toUpperCase()
  }

  const headers = ['Utilizador', 'Contacto', 'Papel', 'Estado', 'Plano', 'Confiança', 'Registado', 'Acções']

  return (
    <AdminLayout>
      <div className="space-y-5">

        {/* Toast */}
        {toast && (
          <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg ${
            toast.type === 'ok'
              ? isDark ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : isDark ? 'bg-red-900/90 border-red-500/30 text-red-300'             : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {toast.type === 'ok' ? <CheckCircle size={15}/> : <AlertCircle size={15}/>} {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className={`transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <h1 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Gestão de Utilizadores</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Todos os utilizadores da plataforma ZOMAR</p>
        </div>

        {/* ── Cartões de contagem por role ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { role: 'admin',        count: counts.admin,        label: 'Admins',         filterVal: 'admin'        },
            { role: 'entrepreneur', count: counts.entrepreneur,  label: 'Empreendedores', filterVal: 'entrepreneur' },
            { role: 'deliverer',    count: counts.deliverer,     label: 'Entregadores',   filterVal: 'deliverer'    },
          ].map(({ role, count, label, filterVal }) => {
            const cfg = getRoleCfg(role)
            const active = roleFilter === filterVal
            return (
              <button
                key={role}
                onClick={() => setRole(active ? 'all' : filterVal)}
                className={`rounded-xl border p-4 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                  active
                    ? isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-300'
                    : isDark ? 'bg-[#1a1a1a] border-white/5 hover:border-white/10' : 'bg-white border-gray-200 shadow-sm hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`p-2 rounded-lg ${cfg.bgCls(isDark)}`}>
                    <span className={cfg.textCls(isDark)}>{cfg.icon(14)}</span>
                  </span>
                  {active && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>activo</span>}
                </div>
                <div className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{count}</div>
                <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</div>
              </button>
            )
          })}
        </div>

        {/* Filtros */}
        <div className={`${card} p-4 space-y-3`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} size={15}/>
              <input type="text" placeholder="Nome, e-mail ou telefone…" value={search}
                onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9`}/>
              {search && (
                <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <X size={14}/>
                </button>
              )}
            </div>
            <div className="relative">
              <select value={roleFilter} onChange={e => setRole(e.target.value)} className={selectCls}>
                <option value="all">Todos os Papéis</option>
                <option value="admin">Admins</option>
                <option value="entrepreneur">Empreendedores</option>
                <option value="deliverer">Entregadores</option>
              </select>
              <ChevronDown size={15} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/>
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={e => setStatus(e.target.value)} className={selectCls}>
                <option value="all">Todos os Estados</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="suspenso">Suspenso</option>
              </select>
              <ChevronDown size={15} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={13} className="text-orange-400"/>
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{total} utilizador(es) encontrado(s)</span>
              {loading && <Loader2 size={13} className="animate-spin text-gray-400"/>}
            </div>
            <button onClick={load} disabled={loading}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''}/> Actualizar
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className={`${card} overflow-hidden transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b text-left ${isDark ? 'border-white/5 bg-white/3' : 'border-gray-100 bg-gray-50'}`}>
                  {headers.map(h => (
                    <th key={h} className={`px-5 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !users.length ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className={`border-b ${isDark ? 'border-white/3' : 'border-gray-50'}`}>
                      {headers.map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className={`h-4 rounded animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}/>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !users.length ? (
                  <tr>
                    <td colSpan={headers.length} className="px-5 py-12 text-center">
                      <Users size={32} className={`mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}/>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Nenhum utilizador encontrado</p>
                    </td>
                  </tr>
                ) : users.map((u, i) => {
                  const sc  = STATUS_CFG[u.status || 'inativo'] || STATUS_CFG.inativo
                  const rc  = getRoleCfg(u.role)
                  const ts  = u.trust_score ?? 5.0
                  const ini = getInitials(u.full_name, u.email)
                  const isAdmin = u.role === 'admin'

                  return (
                    <tr
                      key={u.id}
                      style={{ transitionDelay: `${i * 20}ms` }}
                      className={`border-b transition-all ${
                        isDark ? 'border-white/3' : 'border-gray-50'
                      } ${
                        isAdmin
                          ? isDark ? 'bg-orange-500/5 hover:bg-orange-500/8' : 'bg-orange-50/60 hover:bg-orange-50'
                          : isDark ? 'hover:bg-white/3' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* ── Coluna: Utilizador (avatar + nome + email) ── */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {/* Avatar com cor por role */}
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${rc.avatarBg} flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-sm`}>
                            {ini}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm font-semibold whitespace-nowrap ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {u.full_name || 'Sem nome'}
                              </span>
                              {isAdmin && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-orange-100 text-orange-600 border border-orange-200'}`}>
                                  ADMIN
                                </span>
                              )}
                              {u.document_verified && (
                                <span title="Documento verificado" className="text-emerald-400">
                                  <FileCheck size={12}/>
                                </span>
                              )}
                            </div>
                            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              {u.email || 'sem email'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ── Coluna: Contacto ── */}
                      <td className={`px-5 py-3.5 text-sm whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {u.phone || <span className={isDark ? 'text-gray-600' : 'text-gray-300'}>—</span>}
                      </td>

                      {/* ── Coluna: Papel ── */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${rc.badge(isDark)}`}>
                          <span className={rc.textCls(isDark)}>{rc.icon(12)}</span>
                          {rc.label}
                        </span>
                      </td>

                      {/* ── Coluna: Estado ── */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bgCls(isDark)} ${sc.textCls(isDark)}`}>
                          {sc.icon} {sc.label}
                        </span>
                      </td>

                      {/* ── Coluna: Plano ── */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {u.role === 'entrepreneur' ? (
                          u.subscription ? (
                            <div>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${isDark ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                                ✦ {u.subscription.plan_name}
                              </span>
                              {u.subscription.max_deliveries > 0 && (
                                <div className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {u.subscription.current_usage}/{u.subscription.max_deliveries}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Sem plano</span>
                          )
                        ) : (
                          <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                        )}
                      </td>

                      {/* ── Coluna: Trust Score ── */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Star size={12} className={trustColor(ts)}/>
                          <span className={`text-xs font-bold ${trustColor(ts)}`}>{ts.toFixed(1)}</span>
                          <div className={`w-12 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                            <div
                              className={`h-full rounded-full ${ts >= 7 ? 'bg-emerald-400' : ts >= 4 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              style={{ width: `${(ts / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* ── Coluna: Data ── */}
                      <td className={`px-5 py-3.5 text-xs whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {new Date(u.created_at).toLocaleDateString('pt-MZ')}
                      </td>

                      {/* ── Coluna: Acções ── */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditUser(u)
                              setEditForm({
                                status:            u.status            || 'ativo',
                                role:              u.role              || 'entrepreneur',
                                trust_score:       u.trust_score       ?? 5.0,
                                document_verified: u.document_verified ?? false,
                                suspension_reason: u.suspension_reason ?? '',
                              })
                            }}
                            className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95 ${isDark ? 'hover:bg-emerald-500/10 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600'}`}>
                            <Edit2 size={13}/>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u.id)}
                            className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95 ${isDark ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-500'}`}>
                            <Trash2 size={13}/>
                          </button>
                          <button
                            ref={el => { dropdownBtnRefs.current[u.id] = el }}
                            onClick={() => {
                              if (dropdownId === u.id) {
                                setDropdownId(null); setDropdownPos(null)
                              } else {
                                const el = dropdownBtnRefs.current[u.id]
                                if (el) {
                                  const r = el.getBoundingClientRect()
                                  setDropdownPos({ top: r.bottom + 6, left: r.right - 176 })
                                }
                                setDropdownId(u.id)
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95 ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <MoreVertical size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Página {page + 1} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className={`p-2 rounded-lg disabled:opacity-40 ${isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                <ChevronLeft size={15}/>
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium ${p === page ? 'bg-orange-500 text-white' : isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
                    {p + 1}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className={`p-2 rounded-lg disabled:opacity-40 ${isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
                <ChevronRight size={15}/>
              </button>
            </div>
          </div>
        )}

        {/* ── Modal: Editar Utilizador ── */}
        {editUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-md rounded-2xl border p-6 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200 shadow-2xl'}`}>
              <div className="flex items-center gap-3 mb-5">
                {/* Avatar no modal */}
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getRoleCfg(editUser.role).avatarBg} flex items-center justify-center text-white text-sm font-black flex-shrink-0`}>
                  {getInitials(editUser.full_name, editUser.email)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {editUser.full_name || 'Sem nome'}
                    </h3>
                    {editUser.role === 'admin' && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>ADMIN</span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{editUser.email}</p>
                </div>
                <button onClick={() => setEditUser(null)} className={`p-1 rounded-lg ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={18}/>
                </button>
              </div>

              <div className="space-y-4 mb-5">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Tipo de Conta</label>
                  <div className="relative">
                    <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className={modalSelectCls}>
                      <option value="admin">⚙️ Admin</option>
                      <option value="entrepreneur">🏢 Empreendedor</option>
                      <option value="deliverer">🚚 Entregador</option>
                    </select>
                    <ChevronDown size={15} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/>
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Estado da Conta</label>
                  <div className="relative">
                    <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className={modalSelectCls}>
                      <option value="ativo">✓ Ativo</option>
                      <option value="inativo">⏸ Inativo</option>
                      <option value="suspenso">⛔ Suspenso</option>
                    </select>
                    <ChevronDown size={15} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/>
                  </div>
                </div>

                {editForm.status === 'suspenso' && (
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>Motivo da Suspensão</label>
                    <input type="text" placeholder="Ex: Violação dos termos de uso"
                      value={editForm.suspension_reason}
                      onChange={e => setEditForm(f => ({ ...f, suspension_reason: e.target.value }))}
                      className={`w-full px-4 py-2.5 rounded-lg text-sm border outline-none transition-all ${
                        isDark ? 'bg-white/5 border-orange-500/30 text-white placeholder-gray-500 focus:border-orange-500/60'
                               : 'bg-white border-orange-300 text-gray-900 placeholder-gray-400 focus:border-orange-400'
                      }`}
                    />
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Este motivo será mostrado ao utilizador.</p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Pontuação de Confiança</label>
                    <span className={`text-lg font-black ${editForm.trust_score >= 7 ? 'text-emerald-400' : editForm.trust_score >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {editForm.trust_score.toFixed(1)}<span className={`text-xs font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>/10</span>
                    </span>
                  </div>
                  <input type="range" min={0} max={10} step={0.1} className="adm-range"
                    value={editForm.trust_score}
                    onChange={e => setEditForm(f => ({ ...f, trust_score: parseFloat(e.target.value) }))}
                  />
                  <div className="flex justify-between mt-1">
                    {[0, 2, 4, 6, 8, 10].map(v => (
                      <span key={v} className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{v}</span>
                    ))}
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {editForm.trust_score >= 7 ? '✓ Excelente reputação' : editForm.trust_score >= 4 ? '⚠ Reputação moderada' : '✗ Reputação baixa'}
                  </p>
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Verificação de Documento</label>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className={editForm.document_verified ? 'text-emerald-400' : isDark ? 'text-gray-500' : 'text-gray-400'}/>
                      <div>
                        <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          {editForm.document_verified ? 'Documento verificado' : 'Documento pendente'}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {editForm.document_verified ? 'Identidade confirmada.' : 'Marcar após análise manual.'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditForm(f => ({ ...f, document_verified: !f.document_verified }))}
                      role="switch" aria-checked={editForm.document_verified}
                      style={{ height:22, width:40, position:'relative', borderRadius:11, flexShrink:0,
                        background: editForm.document_verified ? '#10b981' : isDark ? 'rgba(255,255,255,.15)' : '#d1d5db',
                        border:'none', cursor:'pointer', transition:'background .2s',
                      }}
                    >
                      <span style={{
                        position:'absolute', top:2, left:2, width:18, height:18,
                        background:'white', borderRadius:'50%', boxShadow:'0 1px 3px rgba(0,0,0,.2)',
                        transition:'transform .2s',
                        transform: editForm.document_verified ? 'translateX(18px)' : 'translateX(0)',
                      }}/>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setEditUser(null)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  Cancelar
                </button>
                <button onClick={handleUpdateUser} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-orange-500 hover:bg-orange-400 text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  {saving ? <Loader2 size={14} className="animate-spin"/> : <Edit2 size={14}/>} Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Confirmar remoção ── */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-sm rounded-2xl border p-6 text-center ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200 shadow-2xl'}`}>
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={20} className="text-red-400"/>
              </div>
              <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Remover utilizador?</h3>
              <p className={`text-sm mb-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Esta acção não pode ser desfeita.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteTarget(null)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  Cancelar
                </button>
                <button onClick={() => handleDelete(deleteTarget)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-400 text-white transition-colors">
                  Remover
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Dropdown portal ── */}
        {dropdownId && dropdownPos && ReactDOM.createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => { setDropdownId(null); setDropdownPos(null) }}/>
            <div style={{ position:'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex:9999, minWidth:176 }}
              className={`rounded-xl border shadow-2xl py-1.5 ${isDark ? 'bg-[#1e1e1e] border-white/15' : 'bg-white border-gray-200'}`}>
              {(() => {
                const u = users.find(x => x.id === dropdownId)
                if (!u) return null
                const rc = getRoleCfg(u.role)
                return (
                  <>
                    <div className={`px-3 py-2 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${rc.avatarBg} flex items-center justify-center text-white text-[10px] font-black`}>
                          {getInitials(u.full_name, u.email)}
                        </div>
                        <div>
                          <p className={`text-[11px] font-bold truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{u.full_name || 'Utilizador'}</p>
                          <p className={`text-[10px] truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{rc.label}</p>
                        </div>
                      </div>
                    </div>
                    <div className="py-1">
                      {[
                        { status: 'ativo',    label: 'Activar conta',    icon: <UserCheck size={13}/>,  cls: (d: boolean) => d ? 'hover:bg-emerald-500/15 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600' },
                        { status: 'suspenso', label: 'Suspender conta',  icon: <ShieldAlert size={13}/>, cls: (d: boolean) => d ? 'hover:bg-red-500/15 text-red-400'     : 'hover:bg-red-50 text-red-600'         },
                        { status: 'inativo',  label: 'Desactivar conta', icon: <UserX size={13}/>,       cls: (d: boolean) => d ? 'hover:bg-white/8 text-gray-400'        : 'hover:bg-gray-50 text-gray-600'       },
                      ].map(opt => (
                        <button key={opt.status}
                          onClick={() => quickStatusChange(u.id, opt.status)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${opt.cls(isDark)} ${u.status === opt.status ? 'opacity-40 pointer-events-none' : ''}`}>
                          {opt.icon} {opt.label}
                          {u.status === opt.status && <span className="ml-auto text-[10px] opacity-60">actual</span>}
                        </button>
                      ))}
                    </div>
                    <div className={`border-t pt-1 ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                      <button
                        onClick={() => {
                          setEditUser(u)
                          setEditForm({ status: u.status || 'ativo', role: u.role || 'entrepreneur', trust_score: u.trust_score ?? 5.0, document_verified: u.document_verified ?? false, suspension_reason: u.suspension_reason ?? '' })
                          setDropdownId(null); setDropdownPos(null)
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${isDark ? 'hover:bg-white/8 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}`}>
                        <Edit2 size={13}/> Editar perfil completo
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          </>,
          document.body
        )}
      </div>
    </AdminLayout>
  )
}