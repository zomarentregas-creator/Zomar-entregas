// src/pages/admin/AdminSubscriptions.tsx
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import ReactDOM from 'react-dom'
import AdminLayout from '../components/Admin/Adminlayout'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import {
  Search, ChevronDown, MoreVertical, RefreshCw,
  CheckCircle, AlertCircle, Clock, XCircle,
  ChevronLeft, ChevronRight, CreditCard, Users,
  TrendingUp, Package, Edit2, Ban, RotateCcw,
  Calendar, DollarSign, X, Save,
} from 'lucide-react'

/* ── CSS fix <option> dark mode ── */
const OPTION_FIX_CSS = `
  .adms-select-dark  option { background-color:#1a1a1a !important; color:#f0f0f0 !important; }
  .adms-select-light option { background-color:#ffffff !important; color:#111111 !important; }
`

/* ─── Tipos ─────────────────────────────────────────────────────────────────── */
interface Subscription {
  id: string
  user_id: string
  plan_id?: string
  plan_name: string
  price: number
  status: 'active' | 'cancelled' | 'expired' | 'pending' | 'none' | string
  max_deliveries: number
  current_usage: number
  start_date: string | null
  end_date: string | null
  renewal_date: string | null
  created_at: string
  // enriquecido
  user_name?: string
  user_email?: string
}

interface EditForm {
  status: string
  plan_name: string
  price: number
  max_deliveries: number
  current_usage: number
  end_date: string
  renewal_date: string
}

interface DashStats {
  total: number
  active: number
  cancelled: number
  expired: number
  mrr: number
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const PAGE_SIZE = 15

const STATUS_CFG: Record<string, {
  icon: React.ReactNode
  label: string
  textCls: (d: boolean) => string
  bgCls:   (d: boolean) => string
}> = {
  active:    {
    icon:    <CheckCircle size={13}/>,
    label:   'Activo',
    textCls: d => d ? 'text-emerald-400'  : 'text-emerald-600',
    bgCls:   d => d ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200',
  },
  cancelled: {
    icon:    <XCircle size={13}/>,
    label:   'Cancelado',
    textCls: d => d ? 'text-red-400'      : 'text-red-600',
    bgCls:   d => d ? 'bg-red-500/10 border-red-500/20'         : 'bg-red-50 border-red-200',
  },
  expired:   {
    icon:    <AlertCircle size={13}/>,
    label:   'Expirado',
    textCls: d => d ? 'text-yellow-400'   : 'text-yellow-600',
    bgCls:   d => d ? 'bg-yellow-500/10 border-yellow-500/20'   : 'bg-yellow-50 border-yellow-200',
  },
  pending:   {
    icon:    <Clock size={13}/>,
    label:   'Pendente',
    textCls: d => d ? 'text-gray-400'     : 'text-gray-500',
    bgCls:   d => d ? 'bg-gray-500/10 border-gray-500/20'       : 'bg-gray-50 border-gray-200',
  },
  none:      {
    icon:    <XCircle size={13}/>,
    label:   'Sem plano',
    textCls: d => d ? 'text-gray-600'     : 'text-gray-400',
    bgCls:   d => d ? 'bg-white/5 border-white/10'              : 'bg-gray-50 border-gray-200',
  },
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const fmtMZN = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 0 }).format(v)

/* ─── Componente ──────────────────────────────────────────────────────────────── */
export default function AdminSubscriptions() {
  const { isDark } = useTheme()

  /* ── Estado ── */
  const [subs,         setSubs]         = useState<Subscription[]>([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [visible,      setVisible]      = useState(false)
  const [page,         setPage]         = useState(0)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stats,        setStats]        = useState<DashStats | null>(null)
  const [toast,        setToast]        = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  /* dropdown portal */
  const [dropdownId,  setDropdownId]  = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  /* modal de edição */
  const [editSub,  setEditSub]  = useState<Subscription | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    status: 'active', plan_name: '', price: 0,
    max_deliveries: 0, current_usage: 0,
    end_date: '', renewal_date: '',
  })
  const [saving, setSaving] = useState(false)

  /* ── CSS fix ── */
  useEffect(() => {
    const id = 'adms-fix'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id; s.textContent = OPTION_FIX_CSS
      document.head.appendChild(s)
    }
  }, [])

  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t) }, [])

  /* ── Toast ── */
  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      /* 1. Carregar empreendedores (com paginação + filtro de search) */
      let q = supabase
        .from('profiles')
        .select('user_id, full_name, email', { count: 'exact' })
        .eq('role', 'entrepreneur')

      if (search.trim()) {
        q = q.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`)
      }

      const { data: profileData, count, error } = await q
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error

      const profiles = profileData || []
      const userIds  = profiles.map(p => p.user_id).filter(Boolean)

      /* 2. Subscrições dos utilizadores desta página */
      let subMap: Record<string, Subscription> = {}
      if (userIds.length > 0) {
        let subQ = supabase
          .from('subscriptions')
          .select('*')
          .in('user_id', userIds)
        // 'none' não existe na BD — buscar tudo e filtrar depois
        if (statusFilter !== 'all' && statusFilter !== 'none') {
          subQ = subQ.eq('status', statusFilter)
        }
        const { data: subData } = await subQ.order('created_at', { ascending: false })
        if (subData) {
          subData.forEach(s => {
            if (!subMap[s.user_id]) subMap[s.user_id] = s
          })
        }
      }

      /* 3. Filtrar por estado */
      let rows: Subscription[] = profiles
        .filter(p => {
          if (statusFilter === 'all')  return true
          if (statusFilter === 'none') return !subMap[p.user_id]
          return !!subMap[p.user_id]
        })
        .map(p => {
          const sub = subMap[p.user_id]
          return sub
            ? { ...sub, user_name: p.full_name, user_email: p.email }
            : {
                id:             p.user_id,  // placeholder
                user_id:        p.user_id,
                plan_id:        undefined,
                plan_name:      '',
                price:          0,
                status:         'none',
                max_deliveries: 0,
                current_usage:  0,
                start_date:     null,
                end_date:       null,
                renewal_date:   null,
                created_at:     '',
                user_name:      p.full_name,
                user_email:     p.email,
              }
        })

      setSubs(rows)
      setTotal(
        statusFilter === 'all'
          ? count || 0
          : rows.length  // contagem já filtrada
      )

      /* 4. Stats globais — baseado em subscrições reais */
      const { data: allSubs } = await supabase
        .from('subscriptions')
        .select('status, price')
      if (allSubs) {
        const all = allSubs
        setStats({
          total:     all.length,
          active:    all.filter(s => s.status === 'active').length,
          cancelled: all.filter(s => s.status === 'cancelled').length,
          expired:   all.filter(s => s.status === 'expired').length,
          mrr:       all.filter(s => s.status === 'active').reduce((acc, s) => acc + (Number(s.price) || 0), 0),
        })
      }
    } catch (e: any) {
      showToast(e.message || 'Erro ao carregar subscrições.', 'err')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, statusFilter])
  useEffect(() => {
    const ch = supabase.channel('adm-subs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  /* ── Abrir dropdown com posição calculada ── */
  const menuRef = useRef<HTMLDivElement | null>(null)

  const openDropdown = (id: string) => {
    const el = btnRefs.current[id]
    if (el) {
      const r = el.getBoundingClientRect()
      // Posição provisória — o useLayoutEffect vai ajustar depois do render
      setDropdownPos({ top: r.bottom + 6, left: r.right })
    }
    setDropdownId(id)
  }

  // Após o portal renderizar, clampar o menu ao viewport
  useLayoutEffect(() => {
    if (!dropdownId || !dropdownPos || !menuRef.current) return
    const menu = menuRef.current
    const menuW = menu.offsetWidth
    const menuH = menu.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    const btnEl = btnRefs.current[dropdownId]
    if (!btnEl) return
    const r = btnEl.getBoundingClientRect()

    // Tentar abrir para a esquerda do botão; se sair, alinhar à direita
    let left = r.right - menuW
    if (left < 8) left = r.left  // fallback: alinhar à esquerda do botão
    if (left + menuW > vw - 8) left = vw - menuW - 8

    // Tentar abrir para baixo; se não couber, abrir para cima
    let top = r.bottom + 6
    if (top + menuH > vh - 8) top = r.top - menuH - 6

    setDropdownPos({ top, left })
  }, [dropdownId])

  const closeDropdown = () => { setDropdownId(null); setDropdownPos(null) }

  /* ── Acções rápidas ── */
  const quickAction = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      showToast(`Subscrição marcada como "${STATUS_CFG[newStatus]?.label ?? newStatus}".`)
      closeDropdown()
      load()
    } catch (e: any) {
      showToast(e.message || 'Erro ao actualizar.', 'err')
    }
  }

  const renewSub = async (sub: Subscription) => {
    try {
      const now      = new Date()
      const newEnd   = new Date(now); newEnd.setMonth(newEnd.getMonth() + 1)
      const newRenew = new Date(newEnd); newRenew.setDate(newRenew.getDate() - 3)
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status:        'active',
          current_usage: 0,
          start_date:    now.toISOString(),
          end_date:      newEnd.toISOString(),
          renewal_date:  newRenew.toISOString(),
        })
        .eq('id', sub.id)
      if (error) throw error
      showToast('Subscrição renovada com sucesso.')
      closeDropdown()
      load()
    } catch (e: any) {
      showToast(e.message || 'Erro ao renovar.', 'err')
    }
  }

  /* ── Guardar edição ── */
  const handleSave = async () => {
    if (!editSub) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status:        editForm.status,
          plan_name:     editForm.plan_name.trim(),
          price:         Number(editForm.price),
          max_deliveries: Number(editForm.max_deliveries),
          current_usage:  Number(editForm.current_usage),
          end_date:       editForm.end_date     || null,
          renewal_date:   editForm.renewal_date || null,
        })
        .eq('id', editSub.id)
      if (error) throw error
      showToast('Subscrição actualizada.')
      setEditSub(null)
      load()
    } catch (e: any) {
      showToast(e.message || 'Erro ao guardar.', 'err')
    } finally { setSaving(false) }
  }

  /* ── Classes reutilizáveis ── */
  const card = `rounded-xl border transition-all duration-200 ${
    isDark ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-gray-200 shadow-sm'
  }`
  const selectDarkCls = isDark ? 'adms-select-dark' : 'adms-select-light'
  const selectCls = `px-3 py-2 rounded-lg text-sm border outline-none appearance-none cursor-pointer transition-all ${selectDarkCls} ${
    isDark
      ? 'bg-[#1a1a1a] border-white/10 text-white focus:border-orange-500/60'
      : 'bg-white border-gray-200 text-gray-900 focus:border-orange-400 shadow-sm'
  }`
  const inputCls = `px-4 py-2.5 rounded-lg text-sm border outline-none transition-all ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-orange-500/60'
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-400 shadow-sm'
  }`
  const modalInputCls = `w-full px-4 py-2.5 rounded-lg text-sm border outline-none transition-all ${
    isDark
      ? 'bg-[#111] border-white/10 text-white placeholder-gray-600 focus:border-orange-500/60'
      : 'bg-white border-gray-200 text-gray-900 focus:border-orange-400 shadow-sm'
  }`
  const modalSelectCls = `w-full px-4 py-2.5 rounded-lg text-sm border outline-none appearance-none cursor-pointer transition-all ${selectDarkCls} ${
    isDark
      ? 'bg-[#111] border-white/10 text-white focus:border-orange-500/60'
      : 'bg-white border-gray-200 text-gray-900 focus:border-orange-400 shadow-sm'
  }`

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const headers    = ['Utilizador', 'Plano', 'Estado', 'Uso', 'Valor', 'Início', 'Renovação', 'Acções']

  /* ── KPI cards config ── */
  const kpis = stats ? [
    { label: 'Total',      value: stats.total,               color: 'text-gray-400',    icon: <CreditCard size={16}/>,  bg: isDark ? 'bg-white/5'          : 'bg-gray-50'         },
    { label: 'Activas',    value: stats.active,              color: 'text-emerald-400', icon: <CheckCircle size={16}/>, bg: isDark ? 'bg-emerald-500/10'   : 'bg-emerald-50'      },
    { label: 'Canceladas', value: stats.cancelled,           color: 'text-red-400',     icon: <XCircle size={16}/>,     bg: isDark ? 'bg-red-500/10'       : 'bg-red-50'          },
    { label: 'Expiradas',  value: stats.expired,             color: 'text-yellow-400',  icon: <AlertCircle size={16}/>, bg: isDark ? 'bg-yellow-500/10'    : 'bg-yellow-50'       },
    { label: 'MRR',        value: fmtMZN(stats.mrr), color: 'text-orange-400',  icon: <TrendingUp size={16}/>,  bg: isDark ? 'bg-orange-500/10'    : 'bg-orange-50'       },
  ] : []

  /* ──────────────────────────────────────────────────────────────────────────
     RENDER
  ────────────────────────────────────────────────────────────────────────── */
  return (
    <AdminLayout>
      <div className="space-y-5">

        {/* ── Toast ── */}
        {toast && (
          <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg transition-all ${
            toast.type === 'ok'
              ? isDark ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : isDark ? 'bg-red-900/90 border-red-500/30 text-red-300'             : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {toast.type === 'ok' ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
            {toast.msg}
          </div>
        )}

        {/* ── Cabeçalho ── */}
        <div className={`flex items-center justify-between transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Subscrições</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Gestão de planos activos e histórico
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>
            Actualizar
          </button>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {loading && !stats
            ? [...Array(5)].map((_, i) => <div key={i} className={`${card} h-20 animate-pulse`}/>)
            : kpis.map((k, i) => (
              <div key={k.label}
                style={{ transitionDelay: `${i * 40}ms` }}
                className={`${card} p-4 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className={`inline-flex p-2 rounded-lg mb-2 ${k.bg}`}>
                  <span className={k.color}>{k.icon}</span>
                </div>
                <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
                <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{k.label}</div>
              </div>
            ))
          }
        </div>

        {/* ── Filtros ── */}
        <div className={`${card} p-4`}>
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} size={15}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, e-mail ou plano…"
                className={`${inputCls} w-full pl-9`}
              />
              {search && (
                <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <X size={13}/>
                </button>
              )}
            </div>
            {/* Filtro estado */}
            <div className="relative">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
                <option value="all">Todos os estados</option>
                <option value="active">Activo</option>
                <option value="cancelled">Cancelado</option>
                <option value="expired">Expirado</option>
                <option value="pending">Pendente</option>
                <option value="none">Sem plano</option>
              </select>
              <ChevronDown size={13} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/>
            </div>
          </div>
        </div>

        {/* ── Tabela ── */}
        <div className={`${card} overflow-hidden transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className={`border-b text-left ${isDark ? 'border-white/5 bg-white/3' : 'border-gray-100 bg-gray-50'}`}>
                  {headers.map(h => (
                    <th key={h} className={`px-5 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !subs.length ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className={`border-b ${isDark ? 'border-white/3' : 'border-gray-50'}`}>
                      {headers.map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className={`h-4 rounded animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}/>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !subs.length ? (
                  <tr>
                    <td colSpan={headers.length} className="px-5 py-14 text-center">
                      <CreditCard size={32} className={`mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}/>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Nenhuma subscrição encontrada
                      </p>
                    </td>
                  </tr>
                ) : subs.map((s, i) => {
                  const sc  = STATUS_CFG[s.status] ?? STATUS_CFG.pending
                  const pct = s.max_deliveries > 0
                    ? Math.min(Math.round((s.current_usage / s.max_deliveries) * 100), 100) : 0
                  const nearLimit = s.max_deliveries > 0 && pct >= 85

                  return (
                    <tr key={s.id}
                      style={{ transitionDelay: `${i * 20}ms` }}
                      className={`border-b transition-all ${isDark ? 'border-white/3 hover:bg-white/3' : 'border-gray-50 hover:bg-gray-50/70'}`}>

                      {/* Utilizador */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {s.user_name || <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>N/D</span>}
                        </div>
                        {s.user_email && (
                          <div className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{s.user_email}</div>
                        )}
                      </td>

                      {/* Plano */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {s.status === 'none' ? (
                          <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            isDark ? 'bg-purple-500/15 text-purple-300 border-purple-500/20' : 'bg-purple-50 text-purple-700 border-purple-200'
                          }`}>
                            ✦ {s.plan_name || '—'}
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sc.bgCls(isDark)} ${sc.textCls(isDark)}`}>
                          {sc.icon} {sc.label}
                        </span>
                      </td>

                      {/* Uso */}
                      <td className="px-5 py-3.5">
                        {s.status === 'none' ? (
                          <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                        ) : (
                          <div className="min-w-[100px]">
                            <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              <span className="font-medium">{s.current_usage}</span>
                              <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>
                                / {s.max_deliveries === 0 ? '∞' : s.max_deliveries}
                              </span>
                            </div>
                            {s.max_deliveries > 0 && (
                              <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/8' : 'bg-gray-100'}`}>
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    background: nearLimit
                                      ? 'linear-gradient(90deg,#ef4444,#f87171)'
                                      : 'linear-gradient(90deg,#059669,#34d399)',
                                  }}
                                />
                              </div>
                            )}
                            {nearLimit && (
                              <div className="text-[10px] text-red-400 mt-0.5">⚠ {pct}% usado</div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Valor */}
                      <td className={`px-5 py-3.5 whitespace-nowrap text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {s.status === 'none' ? (
                          <span className={`text-xs font-normal ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                        ) : (
                          <>
                            {fmtMZN(Number(s.price) || 0)}
                            <div className={`text-[10px] font-normal ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>/mês</div>
                          </>
                        )}
                      </td>

                      {/* Início */}
                      <td className={`px-5 py-3.5 whitespace-nowrap text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {s.status === 'none' ? '—' : fmtDate(s.start_date)}
                      </td>

                      {/* Renovação */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {s.status === 'none' ? (
                          <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                        ) : (
                          <>
                            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {fmtDate(s.renewal_date)}
                            </div>
                            {s.end_date && (
                              <div className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                expira {fmtDate(s.end_date)}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Acções */}
                      <td className="px-5 py-3.5">
                        {s.status === 'none' ? (
                          <span className={`text-xs px-2 py-1 rounded-lg border ${isDark ? 'text-gray-600 border-white/5' : 'text-gray-400 border-gray-200'}`}>
                            sem plano
                          </span>
                        ) : (
                        <div className="flex items-center gap-1">
                          {/* Editar */}
                          <button
                            onClick={() => {
                              setEditSub(s)
                              setEditForm({
                                status:         s.status,
                                plan_name:      s.plan_name,
                                price:          Number(s.price) || 0,
                                max_deliveries: s.max_deliveries,
                                current_usage:  s.current_usage,
                                end_date:       s.end_date     ? s.end_date.slice(0, 10)     : '',
                                renewal_date:   s.renewal_date ? s.renewal_date.slice(0, 10) : '',
                              })
                            }}
                            className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95 ${isDark ? 'hover:bg-emerald-500/10 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600'}`}
                            title="Editar subscrição"
                          >
                            <Edit2 size={13}/>
                          </button>

                          {/* Dropdown 3 pontos — portal */}
                          <button
                            ref={el => { btnRefs.current[s.id] = el }}
                            onClick={() => dropdownId === s.id ? closeDropdown() : openDropdown(s.id)}
                            className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95 ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                            title="Mais acções"
                          >
                            <MoreVertical size={13}/>
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Paginação ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Página {page + 1} de {totalPages} · {total} subscrições
            </span>
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

        {/* ══════════════════════════════════════════════════════════════════════
            MODAL DE EDIÇÃO
        ══════════════════════════════════════════════════════════════════════ */}
        {editSub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-md rounded-2xl border p-6 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200 shadow-2xl'}`}>

              {/* Cabeçalho */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Editar Subscrição</h2>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {editSub.user_name || editSub.user_email || editSub.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <button onClick={() => setEditSub(null)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={16}/>
                </button>
              </div>

              <div className="space-y-4">

                {/* Estado */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Estado</label>
                  <div className="relative">
                    <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} className={modalSelectCls}>
                      <option value="active">Activo</option>
                      <option value="cancelled">Cancelado</option>
                      <option value="expired">Expirado</option>
                      <option value="pending">Pendente</option>
                    </select>
                    <ChevronDown size={13} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/>
                  </div>
                </div>

                {/* Nome do plano */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Nome do Plano</label>
                  <input
                    value={editForm.plan_name}
                    onChange={e => setEditForm(p => ({ ...p, plan_name: e.target.value }))}
                    className={modalInputCls}
                    placeholder="ex: Plano Profissional"
                  />
                </div>

                {/* Preço */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Valor Mensal (MZN)</label>
                  <input
                    type="number" min={0} step={0.01}
                    value={editForm.price}
                    onChange={e => setEditForm(p => ({ ...p, price: Number(e.target.value) }))}
                    className={modalInputCls}
                  />
                </div>

                {/* Limite de entregas */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Limite de Entregas <span className={`normal-case font-normal ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>(0 = ilimitado)</span>
                  </label>
                  <input
                    type="number" min={0}
                    value={editForm.max_deliveries}
                    onChange={e => setEditForm(p => ({ ...p, max_deliveries: Number(e.target.value) }))}
                    className={modalInputCls}
                  />
                </div>

                {/* Uso actual */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Uso Actual (entregas usadas)</label>
                  <input
                    type="number" min={0}
                    value={editForm.current_usage}
                    onChange={e => setEditForm(p => ({ ...p, current_usage: Number(e.target.value) }))}
                    className={modalInputCls}
                  />
                </div>

                {/* Datas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Data de Expiração</label>
                    <input
                      type="date"
                      value={editForm.end_date}
                      onChange={e => setEditForm(p => ({ ...p, end_date: e.target.value }))}
                      className={modalInputCls}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Data de Renovação</label>
                    <input
                      type="date"
                      value={editForm.renewal_date}
                      onChange={e => setEditForm(p => ({ ...p, renewal_date: e.target.value }))}
                      className={modalInputCls}
                    />
                  </div>
                </div>

              </div>

              {/* Botões */}
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditSub(null)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2">
                  <Save size={14}/>{saving ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            DROPDOWN PORTAL — renderizado no document.body, acima de tudo
        ══════════════════════════════════════════════════════════════════════ */}
        {dropdownId && dropdownPos && ReactDOM.createPortal(
          <>
            {/* Overlay transparente para fechar */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={closeDropdown}
            />
            {/* Menu */}
            <div
              ref={menuRef}
              style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999, minWidth: 210 }}
              className={`rounded-xl border shadow-2xl py-1.5 ${isDark ? 'bg-[#1e1e1e] border-white/15' : 'bg-white border-gray-200'}`}
            >
              {(() => {
                const sub = subs.find(x => x.id === dropdownId)
                if (!sub) return null
                const sc = STATUS_CFG[sub.status] ?? STATUS_CFG.pending
                return (
                  <>
                    {/* Cabeçalho */}
                    <div className={`px-3 py-2 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                      <p className={`text-[11px] font-bold truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        {sub.user_name || sub.user_email || 'Subscrição'}
                      </p>
                      <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${sc.textCls(isDark)}`}>
                        {sc.icon} {sc.label} · {sub.plan_name}
                      </p>
                    </div>

                    {/* Acções de estado */}
                    <div className="py-1">
                      <button
                        onClick={() => quickAction(sub.id, 'active')}
                        disabled={sub.status === 'active'}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-35 disabled:pointer-events-none ${
                          isDark ? 'hover:bg-emerald-500/15 text-emerald-400' : 'hover:bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        <CheckCircle size={13}/> Marcar como Activo
                        {sub.status === 'active' && <span className="ml-auto text-[10px] opacity-60">actual</span>}
                      </button>

                      <button
                        onClick={() => renewSub(sub)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${
                          isDark ? 'hover:bg-blue-500/15 text-blue-400' : 'hover:bg-blue-50 text-blue-600'
                        }`}
                      >
                        <RotateCcw size={13}/> Renovar (+1 mês)
                      </button>

                      <button
                        onClick={() => quickAction(sub.id, 'cancelled')}
                        disabled={sub.status === 'cancelled'}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-35 disabled:pointer-events-none ${
                          isDark ? 'hover:bg-red-500/15 text-red-400' : 'hover:bg-red-50 text-red-600'
                        }`}
                      >
                        <Ban size={13}/> Cancelar subscrição
                        {sub.status === 'cancelled' && <span className="ml-auto text-[10px] opacity-60">actual</span>}
                      </button>

                      <button
                        onClick={() => quickAction(sub.id, 'expired')}
                        disabled={sub.status === 'expired'}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors disabled:opacity-35 disabled:pointer-events-none ${
                          isDark ? 'hover:bg-yellow-500/15 text-yellow-400' : 'hover:bg-yellow-50 text-yellow-600'
                        }`}
                      >
                        <AlertCircle size={13}/> Marcar como Expirado
                        {sub.status === 'expired' && <span className="ml-auto text-[10px] opacity-60">actual</span>}
                      </button>
                    </div>

                    {/* Editar */}
                    <div className={`border-t pt-1 ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
                      <button
                        onClick={() => {
                          setEditSub(sub)
                          setEditForm({
                            status:         sub.status,
                            plan_name:      sub.plan_name,
                            price:          Number(sub.price) || 0,
                            max_deliveries: sub.max_deliveries,
                            current_usage:  sub.current_usage,
                            end_date:       sub.end_date     ? sub.end_date.slice(0, 10)     : '',
                            renewal_date:   sub.renewal_date ? sub.renewal_date.slice(0, 10) : '',
                          })
                          closeDropdown()
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${
                          isDark ? 'hover:bg-white/8 text-gray-300' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <Edit2 size={13}/> Editar detalhes completos
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