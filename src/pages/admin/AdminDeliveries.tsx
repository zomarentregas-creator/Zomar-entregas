// src/pages/admin/AdminDeliveries.tsx
import React, { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/Admin/Adminlayout'
import { useTheme } from '../../contexts/ThemeContext'
import { supabase } from '../../lib/supabase'
import {
  Search, Filter, Eye, Clock, CheckCircle, AlertCircle,
  ChevronDown, MapPin, Package, RefreshCw, Loader2, X,
  ChevronLeft, ChevronRight, Edit3, Trash2,
} from 'lucide-react'

/* ── CSS: fix para <option> no dark mode do SO ── */
const OPTION_FIX_CSS = `
  .adm-del-select-dark  option { background-color:#1a1a1a !important; color:#f0f0f0 !important; }
  .adm-del-select-light option { background-color:#ffffff !important; color:#111111 !important; }
`

/* ─────────────────────────────────────────────────────────────────────────────
   NOTA: A tabela `deliveries` usa `current_status` (não `status`).
   Os valores são: accepted, in_progress, picked_up, completed, problem, cancelled
   (schema real verificado — alinhado com MyDeliveries.tsx)
───────────────────────────────────────────────────────────────────────────── */

interface Delivery {
  id: string
  entrepreneur_id?: string
  deliverer_id?: string
  item_type?: string
  origin_address?: string
  destination_address?: string
  current_status: string
  estimated_value?: number
  notes?: string
  created_at: string
  updated_at?: string
  completed_at?: string
  delivered_at?: string
  picked_up_at?: string
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  accepted:    { label: 'Aceite',       cls: 'bg-yellow-500/10 text-yellow-400',  icon: <Clock size={13}/>        },
  in_progress: { label: 'Em Andamento', cls: 'bg-blue-500/10 text-blue-400',      icon: <Clock size={13}/>        },
  picked_up:   { label: 'Recolhido',    cls: 'bg-purple-500/10 text-purple-400',  icon: <Package size={13}/>      },
  completed:   { label: 'Concluída',    cls: 'bg-emerald-500/10 text-emerald-400',icon: <CheckCircle size={13}/>  },
  problem:     { label: 'Problema',     cls: 'bg-red-500/10 text-red-400',        icon: <AlertCircle size={13}/> },
  cancelled:   { label: 'Cancelada',    cls: 'bg-gray-500/10 text-gray-400',      icon: <X size={13}/>           },
}

const PAGE_SIZE = 10

const fmtMZN  = (v: number) =>
  new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', minimumFractionDigits: 2 }).format(v)

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-MZ') : '—'

export default function AdminDeliveries() {
  const { isDark } = useTheme()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(0)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('all')
  const [visible, setVisible]       = useState(false)
  const [selected, setSelected]     = useState<Delivery | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [saving, setSaving]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [toast, setToast]           = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  /* ── injectar CSS uma vez ── */
  useEffect(() => {
    const id = 'admin-del-fix'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent = OPTION_FIX_CSS
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
      let q = supabase.from('deliveries').select('*', { count: 'exact' })
      if (statusFilter !== 'all') q = q.eq('current_status', statusFilter)
      if (search) q = q.or(`item_type.ilike.%${search}%,origin_address.ilike.%${search}%,destination_address.ilike.%${search}%,id.ilike.%${search}%`)
      const { data, count, error } = await q
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      setDeliveries(data || [])
      setTotal(count || 0)
    } catch { showToast('Erro ao carregar entregas.', 'err') }
    finally { setLoading(false) }
  }, [search, statusFilter, page])

  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search, statusFilter])
  useEffect(() => {
    const ch = supabase.channel('adm-del')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  /* ── Actualizar status ── */
  const handleUpdateStatus = async () => {
    if (!selected || !editStatus) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        current_status: editStatus,
        updated_at: new Date().toISOString(),
      }
      // Preencher timestamps automáticos
      if (editStatus === 'picked_up'  && !selected.picked_up_at) payload.picked_up_at = new Date().toISOString()
      if (editStatus === 'completed'  && !selected.delivered_at) payload.delivered_at  = new Date().toISOString()
      if (editStatus === 'completed'  && !selected.completed_at) payload.completed_at  = new Date().toISOString()

      const { error } = await supabase.from('deliveries').update(payload).eq('id', selected.id)
      if (error) throw error
      showToast('Status actualizado com sucesso.')
      setSelected(null)
      load()
    } catch (err: any) {
      showToast(err.message || 'Erro ao actualizar.', 'err')
    }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('deliveries').delete().eq('id', id)
      if (error) throw error
      showToast('Entrega removida.')
      setDeleteTarget(null)
      load()
    } catch { showToast('Erro ao remover.', 'err') }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  /* ── Classes ── */
  const selectDarkCls = isDark ? 'adm-del-select-dark' : 'adm-del-select-light'
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
  const modalCard = `w-full max-w-md rounded-2xl border p-6 ${
    isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200 shadow-2xl'
  }`

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
          <h1 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Gestão de Entregas</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Monitorize e faça a gestão de todas as entregas da plataforma</p>
        </div>

        {/* Filtros */}
        <div className={`${card} p-4 space-y-3`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} size={15}/>
              <input type="text" placeholder="Pesquisar por tipo de item, origem, destino ou ID…"
                value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9`}/>
              {search && (
                <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <X size={14}/>
                </button>
              )}
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={e => setStatus(e.target.value)} className={selectCls}>
                <option value="all">Todos os Estados</option>
                <option value="accepted">Aceite</option>
                <option value="in_progress">Em Andamento</option>
                <option value="picked_up">Recolhido</option>
                <option value="completed">Concluída</option>
                <option value="problem">Problema</option>
                <option value="cancelled">Cancelada</option>
              </select>
              <ChevronDown size={15} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={13} className="text-orange-400"/>
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{total} entrega(s)</span>
              {loading && <Loader2 size={13} className="animate-spin text-gray-400"/>}
            </div>
            <button onClick={load} disabled={loading}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''}/> Actualizar
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {loading && !deliveries.length ? (
            [...Array(4)].map((_, i) => <div key={i} className={`${card} h-20 animate-pulse`}/>)
          ) : !deliveries.length ? (
            <div className={`${card} p-12 text-center`}>
              <Package size={32} className={`mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}/>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Nenhuma entrega encontrada</p>
            </div>
          ) : deliveries.map((d, i) => {
            const sc = STATUS_CFG[d.current_status] || { label: d.current_status, cls: 'bg-gray-500/10 text-gray-400', icon: <AlertCircle size={13}/> }
            return (
              <div key={d.id} style={{ transitionDelay: `${i * 30}ms` }}
                className={`${card} p-4 hover:border-orange-500/20 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
                  {/* ID + Status */}
                  <div>
                    <p className={`text-[11px] uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>ID</p>
                    <p className={`font-bold text-sm mb-2 font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      #{d.id.slice(0, 8).toUpperCase()}
                    </p>
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${sc.cls}`}>
                      {sc.icon}{sc.label}
                    </div>
                  </div>
                  {/* Tipo de item */}
                  <div>
                    <p className={`text-[11px] uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Item</p>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {d.item_type || 'N/D'}
                    </p>
                    {d.notes && (
                      <p className={`text-xs mt-0.5 truncate max-w-[160px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{d.notes}</p>
                    )}
                  </div>
                  {/* Rota */}
                  <div>
                    <p className={`text-[11px] uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Rota</p>
                    <div className="flex items-start gap-1.5">
                      <MapPin size={13} className="text-emerald-400 flex-shrink-0 mt-0.5"/>
                      <div className="text-xs">
                        <p className={`truncate max-w-[140px] ${isDark ? 'text-white' : 'text-gray-800'}`}>{d.origin_address || '—'}</p>
                        <p className="text-emerald-400 my-0.5">↓</p>
                        <p className={`truncate max-w-[140px] ${isDark ? 'text-white' : 'text-gray-800'}`}>{d.destination_address || '—'}</p>
                      </div>
                    </div>
                  </div>
                  {/* Data */}
                  <div>
                    <p className={`text-[11px] uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Data</p>
                    <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{fmtDate(d.created_at)}</p>
                    {d.delivered_at && (
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Entregue: {fmtDate(d.delivered_at)}
                      </p>
                    )}
                  </div>
                  {/* Valor + Acções */}
                  <div className="flex items-center justify-between lg:justify-end lg:gap-3">
                    <div>
                      <p className={`text-[11px] uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Valor</p>
                      <p className="text-lg font-bold text-emerald-400">{fmtMZN(Number(d.estimated_value) || 0)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setSelected(d); setEditStatus(d.current_status) }}
                        className={`p-2 rounded-lg transition-all hover:scale-110 active:scale-95 ${isDark ? 'hover:bg-orange-500/10 text-orange-400' : 'hover:bg-orange-50 text-orange-500'}`}>
                        <Eye size={15}/>
                      </button>
                      <button onClick={() => setDeleteTarget(d.id)}
                        className={`p-2 rounded-lg transition-all hover:scale-110 active:scale-95 ${isDark ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-500'}`}>
                        <Trash2 size={15}/>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
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

        {/* ── Modal: Detalhes / Editar status ── */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={modalCard}>
              <div className="flex items-center justify-between mb-5">
                <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Detalhes da Entrega</h3>
                <button onClick={() => setSelected(null)} className={`p-1 rounded-lg ${isDark ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                  <X size={18}/>
                </button>
              </div>

              {/* Campos informativos */}
              <div className="mb-5 space-y-0">
                {([
                  ['ID',           () => `#${selected.id.slice(0,8).toUpperCase()}`],
                  ['Item',         () => selected.item_type        || 'N/D'],
                  ['Origem',       () => selected.origin_address   || 'N/D'],
                  ['Destino',      () => selected.destination_address || 'N/D'],
                  ['Valor',        () => fmtMZN(Number(selected.estimated_value) || 0)],
                  ['Criado em',    () => fmtDate(selected.created_at)],
                  ['Recolhido em', () => fmtDate(selected.picked_up_at)],
                  ['Entregue em',  () => fmtDate(selected.delivered_at)],
                  ['Notas',        () => selected.notes || '—'],
                ] as [string, () => string][]).map(([label, fn]) => (
                  <div key={label} className={`flex justify-between text-sm py-2 border-b last:border-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{label}</span>
                    <span className={`font-medium text-right max-w-[200px] truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{fn()}</span>
                  </div>
                ))}
              </div>

              {/* Alterar status */}
              <div className="mb-5">
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Alterar Status
                </label>
                <div className="relative">
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={modalSelectCls}>
                    <option value="accepted">Aceite</option>
                    <option value="in_progress">Em Andamento</option>
                    <option value="picked_up">Recolhido</option>
                    <option value="completed">Concluída</option>
                    <option value="problem">Problema</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                  <ChevronDown size={15} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/>
                </div>
                {editStatus !== selected.current_status && (
                  <p className={`text-xs mt-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                    ⚠ Alterar status manualmente pode afectar o fluxo da entrega.
                    {(editStatus === 'picked_up' || editStatus === 'completed') && ' Os timestamps serão preenchidos automaticamente.'}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setSelected(null)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  Cancelar
                </button>
                <button onClick={handleUpdateStatus} disabled={saving || editStatus === selected.current_status}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-orange-500 hover:bg-orange-400 text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  {saving ? <Loader2 size={14} className="animate-spin"/> : <Edit3 size={14}/>} Guardar
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
              <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Confirmar remoção</h3>
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
      </div>
    </AdminLayout>
  )
}