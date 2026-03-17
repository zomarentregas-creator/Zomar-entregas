// src/pages/admin/AdminActivityLog.tsx
import React, { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/Admin/Adminlayout'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle, Clock, X, Shield,
  UserCheck, UserX, ShieldAlert, Edit2, Package,
  Activity, Filter, ChevronDown, Eye,
} from 'lucide-react'

/* ── CSS fix ── */
const OPTION_FIX_CSS = `
  .adml-select-dark  option { background-color:#1a1a1a !important; color:#f0f0f0 !important; }
  .adml-select-light option { background-color:#ffffff !important; color:#111111 !important; }
`

/* ─── Tipos ──────────────────────────────────────────────────────────────────── */
interface LogEntry {
  id:          string
  user_id:     string | null
  actor_id:    string | null
  action:      string
  entity_type: string | null
  entity_id:   string | null
  metadata:    Record<string, any>
  ip_address:  string | null
  created_at:  string
  // enriquecido
  user_name?:  string
  actor_name?: string
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
const PAGE_SIZE = 20

const ACTION_CFG: Record<string, {
  label:   string
  icon:    React.ReactNode
  color:   (d: boolean) => string
  bg:      (d: boolean) => string
}> = {
  status_changed:          { label: 'Estado alterado',     icon: <Shield size={13}/>,    color: d => d ? 'text-orange-400'  : 'text-orange-600',  bg: d => d ? 'bg-orange-500/10'  : 'bg-orange-50'  },
  role_changed:            { label: 'Papel alterado',      icon: <Edit2 size={13}/>,     color: d => d ? 'text-blue-400'    : 'text-blue-600',    bg: d => d ? 'bg-blue-500/10'    : 'bg-blue-50'    },
  trust_score_changed:     { label: 'Confiança alterada',  icon: <Activity size={13}/>,  color: d => d ? 'text-purple-400'  : 'text-purple-600',  bg: d => d ? 'bg-purple-500/10'  : 'bg-purple-50'  },
  profile_updated:         { label: 'Perfil actualizado',  icon: <Edit2 size={13}/>,     color: d => d ? 'text-gray-400'    : 'text-gray-500',    bg: d => d ? 'bg-white/5'        : 'bg-gray-50'    },
  delivery_status_changed: { label: 'Entrega actualizada', icon: <Package size={13}/>,   color: d => d ? 'text-emerald-400' : 'text-emerald-600', bg: d => d ? 'bg-emerald-500/10' : 'bg-emerald-50' },
  suspension:              { label: 'Conta suspensa',      icon: <ShieldAlert size={13}/>,color: d => d ? 'text-red-400'    : 'text-red-600',     bg: d => d ? 'bg-red-500/10'     : 'bg-red-50'     },
  login:                   { label: 'Login',               icon: <UserCheck size={13}/>, color: d => d ? 'text-emerald-400' : 'text-emerald-600', bg: d => d ? 'bg-emerald-500/10' : 'bg-emerald-50' },
  broadcast_sent:          { label: 'Broadcast enviado',   icon: <Activity size={13}/>,  color: d => d ? 'text-blue-400'    : 'text-blue-600',    bg: d => d ? 'bg-blue-500/10'    : 'bg-blue-50'    },
}

const fallbackAction = (action: string) => ({
  label:  action.replace(/_/g, ' '),
  icon:   <Clock size={13}/>,
  color:  (d: boolean) => d ? 'text-gray-400' : 'text-gray-500',
  bg:     (d: boolean) => d ? 'bg-white/5'    : 'bg-gray-50',
})

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('pt-MZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const fmtRelative = (s: string) => {
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora mesmo'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

/* ─── Componente ─────────────────────────────────────────────────────────────── */
export default function AdminActivityLog() {
  const { isDark } = useTheme()

  const [logs,        setLogs]        = useState<LogEntry[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [visible,     setVisible]     = useState(false)
  const [page,        setPage]        = useState(0)
  const [search,      setSearch]      = useState('')
  const [actionFilter,setActionFilter]= useState('all')
  const [toast,       setToast]       = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [selected,    setSelected]    = useState<LogEntry | null>(null)

  /* ── CSS fix ── */
  useEffect(() => {
    const id = 'adml-fix'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id; s.textContent = OPTION_FIX_CSS
      document.head.appendChild(s)
    }
  }, [])

  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t) }, [])

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('activity_logs')
        .select('*', { count: 'exact' })

      if (actionFilter !== 'all') q = q.eq('action', actionFilter)

      const { data: rawLogs, count, error } = await q
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error

      const logs = rawLogs || []

      /* Enriquecer com nomes dos perfis */
      const allIds = [...new Set([
        ...logs.map(l => l.user_id).filter(Boolean),
        ...logs.map(l => l.actor_id).filter(Boolean),
      ])]

      let nameMap: Record<string, string> = {}
      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', allIds)
        if (profiles) {
          profiles.forEach(p => {
            nameMap[p.user_id] = p.full_name || p.email || p.user_id.slice(0, 8)
          })
        }
      }

      let enriched: LogEntry[] = logs.map(l => ({
        ...l,
        user_name:  l.user_id  ? nameMap[l.user_id]  : undefined,
        actor_name: l.actor_id ? nameMap[l.actor_id] : undefined,
      }))

      /* Filtro de search client-side */
      if (search.trim()) {
        const q = search.toLowerCase()
        enriched = enriched.filter(l =>
          (l.user_name  || '').toLowerCase().includes(q) ||
          (l.actor_name || '').toLowerCase().includes(q) ||
          (l.action     || '').toLowerCase().includes(q) ||
          (l.entity_id  || '').toLowerCase().includes(q)
        )
      }

      setLogs(enriched)
      setTotal(count || 0)
    } catch (e: any) {
      showToast(e.message || 'Erro ao carregar logs.', 'err')
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, actionFilter])
  useEffect(() => {
    const ch = supabase.channel('adm-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  /* ── Classes ── */
  const selectDarkCls = isDark ? 'adml-select-dark' : 'adml-select-light'
  const inputCls = `px-4 py-2.5 rounded-lg text-sm border outline-none transition-all ${
    isDark
      ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-orange-500/60'
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-orange-400 shadow-sm'
  }`
  const selectCls = `px-3 py-2.5 rounded-lg text-sm border outline-none appearance-none cursor-pointer transition-all ${selectDarkCls} ${
    isDark
      ? 'bg-[#1a1a1a] border-white/10 text-white focus:border-orange-500/60'
      : 'bg-white border-gray-200 text-gray-900 focus:border-orange-400 shadow-sm'
  }`
  const card = `rounded-xl border transition-all duration-200 ${
    isDark ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-gray-200 shadow-sm'
  }`
  const totalPages = Math.ceil(total / PAGE_SIZE)

  /* ── Render ── */
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
            {toast.type === 'ok' ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
            {toast.msg}
          </div>
        )}

        {/* Cabeçalho */}
        <div className={`flex items-center justify-between transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Registo de Actividade</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Audit log de todas as acções na plataforma
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/>
            Actualizar
          </button>
        </div>

        {/* Filtros */}
        <div className={`${card} p-4`}>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pesquisar por utilizador, acção ou ID…"
                className={`${inputCls} w-full pl-9`}
              />
              {search && (
                <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <X size={13}/>
                </button>
              )}
            </div>
            <div className="relative">
              <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className={selectCls}>
                <option value="all">Todas as acções</option>
                <option value="status_changed">Estado alterado</option>
                <option value="role_changed">Papel alterado</option>
                <option value="trust_score_changed">Confiança alterada</option>
                <option value="delivery_status_changed">Entrega actualizada</option>
                <option value="suspension">Suspensão</option>
                <option value="broadcast_sent">Broadcast enviado</option>
                <option value="login">Login</option>
              </select>
              <ChevronDown size={13} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/>
            </div>
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {total} registo{total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Timeline de logs */}
        <div className="space-y-2">
          {loading && !logs.length ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className={`${card} h-16 animate-pulse`}/>
            ))
          ) : !logs.length ? (
            <div className={`${card} py-14 text-center`}>
              <Activity size={32} className={`mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}/>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Nenhum registo encontrado
              </p>
            </div>
          ) : logs.map((log, i) => {
            const cfg = ACTION_CFG[log.action] || fallbackAction(log.action)
            return (
              <div key={log.id}
                style={{ transitionDelay: `${i * 15}ms` }}
                className={`${card} px-5 py-3.5 flex items-center gap-4 cursor-pointer transition-all duration-200 hover:border-orange-500/20 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
                onClick={() => setSelected(log)}
              >
                {/* Ícone da acção */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg(isDark)}`}>
                  <span className={cfg.color(isDark)}>{cfg.icon}</span>
                </div>

                {/* Conteúdo principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {cfg.label}
                    </span>
                    {log.user_name && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-white/8 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                        {log.user_name}
                      </span>
                    )}
                    {log.actor_name && log.actor_id !== log.user_id && (
                      <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        por <span className="text-orange-400">{log.actor_name}</span>
                      </span>
                    )}
                  </div>

                  {/* Metadata resumida */}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {log.metadata.old_status && log.metadata.new_status
                        ? `${log.metadata.old_status} → ${log.metadata.new_status}`
                        : log.metadata.old_trust !== undefined
                          ? `confiança: ${Number(log.metadata.old_trust).toFixed(1)} → ${Number(log.metadata.new_trust).toFixed(1)}`
                          : log.entity_id
                            ? `ID: ${String(log.entity_id).slice(0, 8).toUpperCase()}`
                            : ''}
                    </p>
                  )}
                </div>

                {/* Data + IP */}
                <div className="flex-shrink-0 text-right">
                  <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {fmtRelative(log.created_at)}
                  </p>
                  {log.ip_address && (
                    <p className={`text-[10px] mt-0.5 font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {log.ip_address}
                    </p>
                  )}
                </div>

                <Eye size={13} className={isDark ? 'text-gray-700' : 'text-gray-300'}/>
              </div>
            )
          })}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Página {page + 1} de {totalPages} · {total} registos
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

        {/* ── Modal: Detalhe do log ── */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`w-full max-w-md rounded-2xl border p-6 ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200 shadow-2xl'}`}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  {(() => {
                    const cfg = ACTION_CFG[selected.action] || fallbackAction(selected.action)
                    return (
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.bg(isDark)}`}>
                        <span className={cfg.color(isDark)}>{cfg.icon}</span>
                      </div>
                    )
                  })()}
                  <div>
                    <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {(ACTION_CFG[selected.action] || fallbackAction(selected.action)).label}
                    </h2>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {fmtDate(selected.created_at)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={16}/>
                </button>
              </div>

              <div className="space-y-0">
                {[
                  ['Utilizador afectado', selected.user_name  || selected.user_id  || '—'],
                  ['Executado por',       selected.actor_name || selected.actor_id || 'Sistema'],
                  ['Tipo de entidade',    selected.entity_type || '—'],
                  ['ID do registo',       selected.entity_id   ? selected.entity_id.slice(0, 8).toUpperCase() : '—'],
                  ['Endereço IP',         selected.ip_address || '—'],
                ].map(([label, value]) => (
                  <div key={label} className={`flex justify-between py-2.5 border-b text-sm ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{label}</span>
                    <span className={`font-medium text-right max-w-[200px] truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Metadata completa */}
              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <div className="mt-4">
                  <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Dados da acção
                  </p>
                  <div className={`rounded-lg p-3 text-xs font-mono overflow-x-auto ${isDark ? 'bg-black/40 text-gray-300' : 'bg-gray-50 text-gray-700 border border-gray-100'}`}>
                    {Object.entries(selected.metadata).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className={isDark ? 'text-orange-400' : 'text-orange-600'}>{k}:</span>
                        <span>{String(v ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setSelected(null)}
                className={`w-full mt-5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}