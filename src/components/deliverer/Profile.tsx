/**
 * ============================================================================
 * USER PROFILE — ZOMAR
 * ============================================================================
 * @version 4.0 — com AvatarUpload integrado
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  User, Mail, Phone, MapPin, Calendar, Shield,
  Edit, Save, X, Star, Package, TrendingUp,
  LogOut, AlertCircle, CheckCircle, Camera,
  Lock, Eye, EyeOff, ChevronRight, HelpCircle,
  DollarSign, Clock, Bell, Users2,
  Upload, Trash2, Loader2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */
interface UserProfile {
  user_id: string
  full_name: string
  phone: string | null
  address: string | null
  role: 'entrepreneur' | 'deliverer'
  trust_score: number
  status: 'ativo' | 'inativo' | 'suspenso' | string | null
  document_verified: boolean | null
  suspension_reason: string | null
  created_at: string
  avatar_url?: string | null
}

interface Stats {
  totalDeliveries: number
  completedDeliveries: number
  cancelledDeliveries: number
  pendingDeliveries: number
  rating: number
  memberSince: string
  earnings: number
  avgDeliveryValue: number
  totalSpent: number
  avgOrderValue: number
  activeDeliveries: number
  uniqueDeliverers: number
  planName: string | null
  planUsage: number
  planLimit: number
  planStatus: string | null
}

/* ─────────────────────────────────────────────────────────────────────────────
   CSS
───────────────────────────────────────────────────────────────────────────── */
function buildCSS(dark: boolean): string {
  return `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;900&family=Barlow+Condensed:wght@600;700;900&display=swap');

  :root {
    --bg:      ${dark ? '#0a0a0a'               : '#f0f2f5'};
    --surface: ${dark ? '#111111'               : '#ffffff'};
    --surface2:${dark ? '#181818'               : '#f6f7f9'};
    --surface3:${dark ? '#1f1f1f'               : '#ececef'};
    --border:  ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'};
    --border2: ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.13)'};
    --em:      #10b981;
    --em2:     #34d399;
    --em3:     #059669;
    --emglow:  ${dark ? 'rgba(16,185,129,.15)'  : 'rgba(16,185,129,.10)'};
    --emglow2: ${dark ? 'rgba(16,185,129,.08)'  : 'rgba(16,185,129,.06)'};
    --red:     #ef4444;
    --redglow: ${dark ? 'rgba(239,68,68,.12)'   : 'rgba(239,68,68,.08)'};
    --yellow:  #f59e0b;
    --text:    ${dark ? '#f0f0f0'               : '#111111'};
    --text2:   ${dark ? '#a0a0a0'               : '#555555'};
    --text3:   ${dark ? '#606060'               : '#9a9a9a'};
    --font:    'Barlow', sans-serif;
    --fontC:   'Barlow Condensed', sans-serif;
    --r:       12px;
    --rl:      16px;
  }

  .dp * { box-sizing:border-box; font-family:var(--font); }
  .dp { background:var(--bg); min-height:100vh; color:var(--text); padding:18px; transition:background .25s,color .25s; }
  .dp ::-webkit-scrollbar { width:4px; }
  .dp ::-webkit-scrollbar-thumb { background:var(--border2); border-radius:2px; }

  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes slideIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
  @keyframes fadeIn  { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }

  /* ── TOP BAR ── */
  .dp-bar {
    display:flex; align-items:center; justify-content:space-between;
    background:var(--surface); border:1px solid var(--border);
    border-radius:var(--rl); padding:10px 20px; margin-bottom:18px; gap:16px;
  }
  .dp-brand { font-family:var(--fontC); font-weight:900; font-size:20px; letter-spacing:-.3px; color:var(--text); white-space:nowrap; }
  .dp-brand em { color:var(--em); font-style:normal; }
  .dp-tabs { display:flex; gap:3px; flex:1; justify-content:center; }
  .dp-tab {
    padding:6px 15px; border-radius:8px; font-size:13px; font-weight:600;
    color:var(--text2); background:transparent; border:none; cursor:pointer; transition:.15s; white-space:nowrap;
  }
  .dp-tab:hover { color:var(--text); background:var(--surface2); }
  .dp-tab.active { background:var(--emglow); color:var(--em2); border:1px solid rgba(16,185,129,.25); }
  .dp-bar-right { display:flex; align-items:center; gap:10px; }

  /* ── AVATAR TOP BAR (mini) ── */
  .dp-avatar-xs {
    width:36px; height:36px; border-radius:50%; overflow:hidden;
    background:linear-gradient(135deg,var(--em3),var(--em));
    display:flex; align-items:center; justify-content:center;
    font-weight:900; font-size:14px; color:#fff;
    border:2px solid rgba(16,185,129,.4); flex-shrink:0; cursor:pointer;
    transition:border-color .2s;
  }
  .dp-avatar-xs:hover { border-color:rgba(16,185,129,.8); }
  .dp-avatar-xs img { width:100%; height:100%; object-fit:cover; }

  /* ── HERO ── */
  .dp-hero {
    background:var(--surface); border:1px solid var(--border);
    border-radius:var(--rl); padding:22px 24px;
    display:grid; grid-template-columns:auto 1fr auto;
    gap:22px; align-items:center; margin-bottom:18px;
    position:relative; overflow:hidden;
  }
  .dp-hero::before {
    content:''; position:absolute; inset:0;
    background:radial-gradient(ellipse at 80% 50%, var(--emglow2) 0%, transparent 65%);
    pointer-events:none;
  }

  /* ── AVATAR HERO (grande, com upload) ── */
  .dp-avatar-wrap { position:relative; flex-shrink:0; }
  .dp-avatar {
    width:80px; height:80px; border-radius:var(--r);
    background:linear-gradient(135deg,var(--em3),var(--em));
    display:flex; align-items:center; justify-content:center;
    font-family:var(--fontC); font-weight:900; font-size:32px; color:#fff;
    position:relative; overflow:hidden; cursor:pointer;
    box-shadow:0 0 24px rgba(16,185,129,.25);
    border:3px solid rgba(16,185,129,.35);
    transition:border-color .2s;
  }
  .dp-avatar:hover { border-color:rgba(16,185,129,.75); }
  .dp-avatar img { width:100%; height:100%; object-fit:cover; border-radius:calc(var(--r) - 2px); }
  .dp-avatar-overlay {
    position:absolute; inset:0; border-radius:calc(var(--r) - 3px);
    background:rgba(0,0,0,.58); display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:3px;
    opacity:0; transition:opacity .18s;
  }
  .dp-avatar:hover .dp-avatar-overlay { opacity:1; }
  .dp-avatar-overlay span { font-size:9px; color:#fff; font-weight:700; letter-spacing:.4px; text-transform:uppercase; }

  /* ── BOTÃO CÂMARA (badge no canto) ── */
  .dp-cam-btn {
    position:absolute; bottom:-4px; right:-4px;
    width:26px; height:26px; border-radius:50%;
    background:linear-gradient(135deg,var(--em3),var(--em));
    display:flex; align-items:center; justify-content:center;
    border:2px solid var(--bg); cursor:pointer;
    transition:transform .15s, box-shadow .15s;
    box-shadow:0 2px 8px rgba(16,185,129,.4);
  }
  .dp-cam-btn:hover { transform:scale(1.12); box-shadow:0 4px 12px rgba(16,185,129,.55); }

  /* ── MODAL DE UPLOAD ── */
  .dp-modal-bg {
    position:fixed; inset:0; z-index:999;
    background:rgba(0,0,0,.72); backdrop-filter:blur(4px);
    display:flex; align-items:center; justify-content:center; padding:16px;
    animation:fadeIn .18s;
  }
  .dp-modal {
    background:var(--surface); border:1px solid var(--border2);
    border-radius:20px; width:100%; max-width:360px;
    overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.5);
    animation:fadeIn .2s;
  }
  .dp-modal-head {
    display:flex; align-items:center; justify-content:space-between;
    padding:16px 20px; border-bottom:1px solid var(--border);
    background:var(--surface2);
  }
  .dp-modal-title { font-family:var(--fontC); font-weight:700; font-size:15px; color:var(--text); }
  .dp-modal-body { padding:20px; }
  .dp-drop-zone {
    border:2px dashed var(--border2); border-radius:14px;
    padding:24px 16px; text-align:center; cursor:pointer;
    transition:border-color .2s, background .2s;
  }
  .dp-drop-zone:hover, .dp-drop-zone.drag { border-color:var(--em); background:var(--emglow2); }
  .dp-drop-zone p { font-size:12px; color:var(--text3); margin:6px 0 0; }
  .dp-preview-wrap { display:flex; flex-direction:column; align-items:center; gap:10px; margin-bottom:16px; }
  .dp-preview-circle {
    width:120px; height:120px; border-radius:50%; overflow:hidden;
    border:3px solid rgba(16,185,129,.4);
    box-shadow:0 0 20px rgba(16,185,129,.2);
  }
  .dp-preview-circle img { width:100%; height:100%; object-fit:cover; }
  .dp-modal-footer { display:flex; gap:10px; padding:0 20px 20px; }

  /* ── REST OF STYLES (unchanged) ── */
  .dp-status-pill {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 9px; border-radius:5px; font-size:10px; font-weight:700;
    letter-spacing:.6px; text-transform:uppercase; margin-bottom:6px;
  }
  .dp-status-pill.ent { background:rgba(139,92,246,.15); color:#a78bfa; border:1px solid rgba(139,92,246,.3); }
  .dp-status-pill.del { background:var(--emglow); color:var(--em2); border:1px solid rgba(16,185,129,.3); }
  .dp-hero-name { font-family:var(--fontC); font-weight:900; font-size:26px; letter-spacing:-.3px; margin:0 0 3px; line-height:1.1; }
  .dp-hero-email { color:var(--text2); font-size:13px; display:flex; align-items:center; gap:5px; margin-bottom:12px; }
  .dp-chips { display:flex; gap:8px; flex-wrap:wrap; }
  .dp-chip { display:flex; align-items:center; gap:5px; background:var(--surface2); border:1px solid var(--border); padding:4px 10px; border-radius:6px; font-size:12px; }
  .dp-chip strong { color:var(--text); font-weight:700; }
  .dp-chip span { color:var(--text3); }
  .dp-hero-btns { display:flex; flex-direction:column; gap:8px; }
  .dp-grid { display:grid; grid-template-columns:1fr 1fr 290px; gap:16px; align-items:start; }
  @media(max-width:960px) { .dp-grid { grid-template-columns:1fr; } }
  .dp-col3 { display:flex; flex-direction:column; gap:16px; }
  .dp-panel { background:var(--surface); border:1px solid var(--border); border-radius:var(--rl); padding:20px; }
  .dp-ptitle { font-family:var(--fontC); font-weight:700; font-size:11px; letter-spacing:1.8px; text-transform:uppercase; color:var(--text3); margin-bottom:16px; display:flex; align-items:center; gap:7px; }
  .dp-ptitle svg { color:var(--em); }
  .dp-divider { border:none; border-top:1px solid var(--border); margin:18px 0; }
  .dp-fgrid { display:grid; grid-template-columns:1fr 1fr; gap:0 14px; }
  .dp-fgrid .full { grid-column:1/-1; }
  .dp-field { margin-bottom:13px; }
  .dp-label { font-size:10px; font-weight:700; color:var(--text3); margin-bottom:5px; letter-spacing:.7px; text-transform:uppercase; display:block; }
  .dp-wrap { position:relative; }
  .dp-ico { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--text3); pointer-events:none; }
  .dp-input { width:100%; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:9px 12px 9px 34px; color:var(--text); font-size:13px; outline:none; transition:.15s; }
  .dp-input.ni { padding-left:12px; }
  .dp-input:focus { border-color:rgba(16,185,129,.5); background:var(--surface3); }
  .dp-input:disabled { opacity:.4; cursor:not-allowed; }
  .dp-input::placeholder { color:var(--text3); }
  .dp-eye { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text3); cursor:pointer; padding:0; line-height:0; }
  .dp-eye:hover { color:var(--text2); }
  .dp-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; border:none; transition:.15s; white-space:nowrap; }
  .dp-btn:disabled { opacity:.5; cursor:not-allowed; }
  .dp-btn-primary { background:linear-gradient(135deg,var(--em3),var(--em)); color:#fff; box-shadow:0 4px 14px rgba(16,185,129,.2); }
  .dp-btn-primary:hover:not(:disabled) { filter:brightness(1.1); }
  .dp-btn-ghost { background:var(--surface2); color:var(--text2); border:1px solid var(--border2); }
  .dp-btn-ghost:hover:not(:disabled) { background:var(--surface3); color:var(--text); }
  .dp-btn-danger { background:var(--redglow); color:#f87171; border:1px solid rgba(239,68,68,.25); }
  .dp-btn-danger:hover:not(:disabled) { background:rgba(239,68,68,.18); }
  .dp-btn-sm { padding:6px 12px; font-size:12px; }
  .dp-btn-full { width:100%; }
  .dp-kpi-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
  .dp-kpi { background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:12px; }
  .dp-kpi.em { background:var(--emglow2); border-color:rgba(16,185,129,.2); }
  .dp-kpi-val { font-family:var(--fontC); font-weight:900; font-size:24px; color:var(--text); line-height:1; margin-bottom:3px; }
  .dp-kpi.em .dp-kpi-val { color:var(--em2); }
  .dp-kpi-lbl { font-size:10px; color:var(--text3); letter-spacing:.5px; text-transform:uppercase; }
  .dp-srow { display:flex; align-items:center; justify-content:space-between; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:9px 12px; margin-bottom:6px; }
  .dp-srow-l { display:flex; align-items:center; gap:7px; font-size:12px; color:var(--text2); }
  .dp-srow-v { font-size:13px; font-weight:700; color:var(--text); }
  .dp-srow-v.g { color:var(--em2); }
  .dp-srow-v.y { color:var(--yellow); }
  .dp-srow-v.r { color:#f87171; }
  .dp-prog { height:4px; background:var(--surface3); border-radius:2px; margin-top:8px; overflow:hidden; }
  .dp-prog-fill { height:100%; background:linear-gradient(90deg,var(--em3),var(--em)); border-radius:2px; transition:width .4s; }
  .dp-alert { display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:14px; animation:slideIn .2s; }
  .dp-alert-e { background:var(--redglow); border:1px solid rgba(239,68,68,.25); color:#fca5a5; }
  .dp-alert-s { background:var(--emglow2); border:1px solid rgba(16,185,129,.25); color:var(--em2); }
  .dp-nrow { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border); }
  .dp-nrow:last-child { border-bottom:none; padding-bottom:0; }
  .dp-nrow-l { display:flex; align-items:center; gap:8px; }
  .dp-nrow-label { font-size:13px; color:var(--text2); }
  .dp-toggle { position:relative; width:40px; height:22px; cursor:pointer; flex-shrink:0; display:inline-block; }
  .dp-toggle input { display:none; }
  .dp-toggle-track { position:absolute; inset:0; background:var(--surface3); border:1px solid var(--border2); border-radius:11px; transition:.2s; }
  .dp-toggle input:checked ~ .dp-toggle-track { background:var(--emglow); border-color:rgba(16,185,129,.4); }
  .dp-toggle-knob { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:var(--text3); transition:.2s; }
  .dp-toggle input:checked ~ .dp-toggle-track .dp-toggle-knob { left:20px; background:var(--em); }
  .dp-danger { background:var(--redglow); border:1px solid rgba(239,68,68,.2); border-radius:var(--rl); padding:18px; }
  .dp-danger-title { font-family:var(--fontC); font-weight:700; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#f87171; margin-bottom:12px; }
  .dp-danger-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:10px; }
  .dp-danger-row:last-child { margin-bottom:0; }
  .dp-danger-desc { font-size:12px; color:var(--text2); line-height:1.4; }
  .dp-cfgbtn { display:flex; align-items:center; gap:10px; width:100%; padding:10px 8px; border-radius:8px; font-size:13px; color:var(--text2); background:transparent; border:none; cursor:pointer; transition:.15s; text-align:left; justify-content:space-between; }
  .dp-cfgbtn:hover { background:var(--surface2); color:var(--text); }
  .dp-cfgbtn-l { display:flex; align-items:center; gap:10px; }
  .dp-strength-label { font-size:10px; color:var(--text3); margin-top:3px; }
  .dp-mismatch { font-size:11px; color:var(--red); margin-top:4px; }
  .dp-hint { font-size:11px; color:var(--text3); margin-top:4px; }
  .dp-banner { display:flex; align-items:flex-start; gap:10px; padding:12px 16px; border-radius:10px; margin-bottom:16px; animation:slideIn .25s; }
  .dp-banner-sus { background:rgba(239,68,68,.10); border:1px solid rgba(239,68,68,.25); color:#fca5a5; }
  .dp-banner-ina { background:rgba(96,96,96,.12); border:1px solid rgba(96,96,96,.25); color:var(--text2); }
  .dp-banner-icon { flex-shrink:0; margin-top:1px; }
  .dp-banner-title { font-weight:700; font-size:13px; margin-bottom:3px; }
  .dp-banner-body { font-size:12px; opacity:.85; }
  .dp-trust-bar { height:6px; background:var(--surface3); border-radius:3px; overflow:hidden; margin-top:8px; }
  .dp-trust-fill { height:100%; border-radius:3px; transition:width .5s ease; }
  `
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
}

/* ─────────────────────────────────────────────────────────────────────────────
   INLINE AVATAR UPLOAD HOOK
───────────────────────────────────────────────────────────────────────────── */
function useAvatarUpload(userId: string | undefined) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging]   = useState(false)
  const [showModal, setShowModal] = useState(false)

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = e => { setPreview(e.target?.result as string); setShowModal(true) }
    reader.readAsDataURL(file)
  }

  const cropToBlob = (src: string): Promise<Blob> =>
    new Promise((res, rej) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = c.height = 400
        const ctx = c.getContext('2d')!
        const s = Math.min(img.width, img.height)
        ctx.beginPath(); ctx.arc(200, 200, 200, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 400, 400)
        c.toBlob(b => b ? res(b) : rej(), 'image/jpeg', 0.92)
      }
      img.onerror = rej; img.src = src
    })

  const upload = async (): Promise<string | null> => {
    if (!preview || !userId) return null
    setUploading(true)
    try {
      const blob     = await cropToBlob(preview)
      const fileName = `${userId}/avatar_${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      await supabase.from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      return publicUrl
    } catch {
      // fallback demo: devolve o preview base64
      return preview
    } finally {
      setUploading(false)
    }
  }

  const removeAvatar = async () => {
    if (!userId) return
    await supabase.from('profiles')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
  }

  return {
    fileInputRef, preview, uploading, dragging, showModal,
    setDragging, setShowModal, setPreview,
    processFile, upload, removeAvatar,
    open: () => fileInputRef.current?.click(),
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const isEntrepreneur = location.pathname.startsWith('/entrepreneur')
  const themeKey = isEntrepreneur ? 'entrepreneur_theme' : 'deliverer_theme'
  const [isDark, setIsDark] = useState(() => localStorage.getItem(themeKey) !== 'light')

  useEffect(() => {
    const handle = (e: StorageEvent) => { if (e.key === themeKey) setIsDark(e.newValue !== 'light') }
    window.addEventListener('storage', handle)
    return () => window.removeEventListener('storage', handle)
  }, [themeKey])

  const [profile,    setProfile]    = useState<UserProfile | null>(null)
  const [stats,      setStats]      = useState<Stats>({
    totalDeliveries: 0, completedDeliveries: 0, cancelledDeliveries: 0,
    pendingDeliveries: 0, rating: 5.0, memberSince: '—',
    earnings: 0, avgDeliveryValue: 0,
    totalSpent: 0, avgOrderValue: 0, activeDeliveries: 0, uniqueDeliverers: 0,
    planName: null, planUsage: 0, planLimit: 0, planStatus: null,
  })
  const [loading,    setLoading]    = useState(true)
  const [editing,    setEditing]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState<string | null>(null)
  const [activeTab,  setActiveTab]  = useState<'Perfil' | 'Estatísticas' | 'Segurança' | 'Preferências'>('Perfil')
  const [avatarUrl,  setAvatarUrl]  = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone,    setPhone]    = useState('')
  const [address,  setAddress]  = useState('')
  const [notif, setNotif] = useState({ newDelivery: true, statusUpdate: true, paymentAlert: true, systemNews: false })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState({ curr: false, next: false, conf: false })

  const av = useAvatarUpload(user?.id)

  useEffect(() => { if (!success) return; const t = setTimeout(() => setSuccess(null), 4000); return () => clearTimeout(t) }, [success])
  useEffect(() => { if (!error)   return; const t = setTimeout(() => setError(null), 6000);   return () => clearTimeout(t) }, [error])

  const loadProfile = useCallback(async () => {
    if (!user) { navigate('/login'); return }
    try {
      setLoading(true); setError(null)
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Perfil não encontrado.')
      const norm = { ...data, status: data.status ?? 'ativo', trust_score: data.trust_score ?? 5.0 }
      setProfile(norm)
      setFullName(norm.full_name || '')
      setPhone(norm.phone || '')
      setAddress(norm.address || '')
      setAvatarUrl(norm.avatar_url || null)
      await loadStats(user.id, norm.trust_score, norm.created_at, norm.role)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar perfil.')
    } finally { setLoading(false) }
  }, [user, navigate])

  const loadStats = async (userId: string, trustScore: number, createdAt: string, role: 'entrepreneur' | 'deliverer') => {
    try {
      const memberSince = new Date(createdAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      if (role === 'deliverer') {
        const { data } = await supabase.from('deliveries').select('estimated_value, current_status').eq('deliverer_id', userId)
        const all = data || []
        const completed = all.filter(d => d.current_status === 'completed')
        const cancelled = all.filter(d => d.current_status === 'cancelled')
        const pending   = all.filter(d => ['accepted','in_progress','picked_up','in_transit'].includes(d.current_status))
        const earnings  = completed.reduce((s, d) => s + (d.estimated_value || 0) * 0.8, 0)
        setStats(p => ({ ...p, totalDeliveries: all.length, completedDeliveries: completed.length, cancelledDeliveries: cancelled.length, pendingDeliveries: pending.length, rating: trustScore, earnings, avgDeliveryValue: completed.length ? earnings / completed.length : 0, memberSince }))
      } else {
        const [{ data: delData }, { data: subData }] = await Promise.all([
          supabase.from('deliveries').select('estimated_value, current_status, deliverer_id').eq('entrepreneur_id', userId),
          supabase.from('subscriptions').select('plan_name, current_usage, max_deliveries, status').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ])
        const all       = delData || []
        const completed = all.filter(d => d.current_status === 'completed')
        const cancelled = all.filter(d => d.current_status === 'cancelled')
        const active    = all.filter(d => ['accepted','in_progress','picked_up','in_transit'].includes(d.current_status))
        const totalSpent = all.reduce((s, d) => s + (d.estimated_value || 0), 0)
        setStats(p => ({ ...p, totalDeliveries: all.length, completedDeliveries: completed.length, cancelledDeliveries: cancelled.length, pendingDeliveries: active.length, activeDeliveries: active.length, rating: trustScore, totalSpent, avgOrderValue: all.length ? totalSpent / all.length : 0, uniqueDeliverers: new Set(all.map(d => d.deliverer_id).filter(Boolean)).size, planName: subData?.plan_name ?? null, planUsage: subData?.current_usage ?? 0, planLimit: subData?.max_deliveries ?? 0, planStatus: subData?.status ?? null, memberSince }))
      }
    } catch { /* silent */ }
  }

  useEffect(() => { loadProfile() }, [loadProfile])

  /* ── Confirmar upload de avatar ── */
  const handleAvatarConfirm = async () => {
    const url = await av.upload()
    if (url) {
      setAvatarUrl(url)
      setSuccess('Foto de perfil actualizada!')
    }
    av.setShowModal(false)
    av.setPreview(null)
  }

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Remover foto de perfil?')) return
    await av.removeAvatar()
    setAvatarUrl(null)
    setSuccess('Foto removida.')
  }

  const handleSave = async () => {
    if (!fullName.trim()) { setError('Nome completo é obrigatório.'); return }
    setSaving(true); setError(null)
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName.trim(), phone: phone || null, address: address || null, updated_at: new Date().toISOString() }).eq('user_id', user!.id)
      if (error) throw error
      setSuccess('Perfil actualizado!')
      setEditing(false)
      loadProfile()
    } catch (err: any) { setError(err.message || 'Erro ao salvar.') } finally { setSaving(false) }
  }

  const handleCancelEdit = () => { setEditing(false); setFullName(profile?.full_name || ''); setPhone(profile?.phone || ''); setAddress(profile?.address || '') }

  const pwStrength      = pwForm.next.length < 1 ? 0 : pwForm.next.length < 8 ? 25 : pwForm.next.length < 12 ? 60 : 100
  const pwStrengthColor = pwStrength < 30 ? 'var(--red)' : pwStrength < 70 ? 'var(--yellow)' : 'var(--em)'
  const pwStrengthLabel = pwStrength < 30 ? 'Senha fraca' : pwStrength < 70 ? 'Senha moderada' : 'Senha forte'

  const handleChangePassword = async () => {
    const { current, next, confirm } = pwForm
    if (!current || !next || !confirm) { setError('Preencha todos os campos.'); return }
    if (next.length < 8) { setError('Mínimo 8 caracteres.'); return }
    if (next === current) { setError('Nova senha deve ser diferente.'); return }
    if (next !== confirm) { setError('Senhas não coincidem.'); return }
    setSaving(true); setError(null)
    try {
      const { error: sErr } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: current })
      if (sErr) throw new Error('Senha actual incorrecta.')
      const { error: uErr } = await supabase.auth.updateUser({ password: next })
      if (uErr) throw uErr
      setSuccess('Senha alterada!')
      setChangingPw(false)
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err: any) { setError(err.message) } finally { setSaving(false) }
  }

  const handleSaveNotif = async () => {
    if (!user) return; setSaving(true)
    try {
      const { error } = await supabase.from('notification_settings').upsert({ user_id: user.id, new_delivery: notif.newDelivery, status_update: notif.statusUpdate, payment_alert: notif.paymentAlert, system_news: notif.systemNews, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      if (error) throw error
      setSuccess('Preferências guardadas!')
    } catch (err: any) { setError(err.message) } finally { setSaving(false) }
  }

  const handleLogout = async () => { try { await signOut() } finally { navigate('/login') } }

  const initial        = (profile?.full_name || user?.email || '?').charAt(0).toUpperCase()
  const isDeliverer    = profile?.role === 'deliverer'
  const role           = isDeliverer ? 'deliverer' : 'entrepreneur'
  const completionRate = stats.totalDeliveries ? Math.round((stats.completedDeliveries / stats.totalDeliveries) * 100) : 0

  const notifRows = [
    { key: 'newDelivery'  as const, label: 'Novas entregas',         desc: 'Pedidos disponíveis próximos a você.',             icon: Package    },
    { key: 'statusUpdate' as const, label: 'Atualizações de status', desc: 'Alertas sobre mudanças nos pedidos em andamento.', icon: Bell       },
    { key: 'paymentAlert' as const, label: isDeliverer ? 'Alertas de pagamento' : 'Alertas de cobrança', desc: isDeliverer ? 'Notificações de pagamentos recebidos.' : 'Notificações sobre cobranças e renovações.', icon: DollarSign },
    { key: 'systemNews'   as const, label: 'Novidades do sistema',   desc: 'Actualizações e melhorias da plataforma.',          icon: Bell       },
  ]

  if (loading) return (
    <><style>{buildCSS(isDark)}</style>
    <div className="dp" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:48, height:48, margin:'0 auto 14px', border:'3px solid rgba(16,185,129,.15)', borderTopColor:'var(--em)', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
        <p style={{ color:'var(--text3)', fontSize:14 }}>Carregando perfil…</p>
      </div>
    </div></>
  )

  if (!profile) return (
    <><style>{buildCSS(isDark)}</style>
    <div className="dp" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div style={{ textAlign:'center' }}>
        <AlertCircle style={{ margin:'0 auto 12px', color:'#ef4444' }} size={40}/>
        <p style={{ fontSize:16, fontWeight:700 }}>Perfil não encontrado</p>
      </div>
    </div></>
  )

  /* ─────────────────── RENDER ─────────────────── */
  return (
    <>
      <style>{buildCSS(isDark)}</style>

      {/* INPUT OCULTO DE UPLOAD */}
      <input ref={av.fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
        style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) av.processFile(f) }}/>

      {/* ════ MODAL DE CONFIRMAÇÃO DE FOTO ════ */}
      {av.showModal && av.preview && (
        <div className="dp-modal-bg" onClick={e => { if (e.target === e.currentTarget) { av.setShowModal(false); av.setPreview(null) } }}>
          <div className="dp-modal">
            <div className="dp-modal-head">
              <span className="dp-modal-title">Confirmar foto de perfil</span>
              <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => { av.setShowModal(false); av.setPreview(null) }}>
                <X size={13}/>
              </button>
            </div>
            <div className="dp-modal-body">
              {/* Drop zone / preview */}
              <div
                className={`dp-drop-zone${av.dragging ? ' drag' : ''}`}
                onDragOver={e => { e.preventDefault(); av.setDragging(true) }}
                onDragLeave={() => av.setDragging(false)}
                onDrop={e => { e.preventDefault(); av.setDragging(false); const f = e.dataTransfer.files[0]; if (f) av.processFile(f) }}
                onClick={av.open}
                style={{ marginBottom: 16 }}
              >
                <div className="dp-preview-wrap">
                  <div className="dp-preview-circle">
                    <img src={av.preview} alt="preview"/>
                  </div>
                  <p>A foto será recortada em formato circular</p>
                  <p style={{ color:'var(--em)', fontWeight:600, fontSize:11, marginTop:4 }}>
                    Clica ou arrasta para trocar
                  </p>
                </div>
              </div>
            </div>
            <div className="dp-modal-footer">
              <button className="dp-btn dp-btn-ghost" style={{ flex:1 }}
                onClick={() => { av.setShowModal(false); av.setPreview(null) }}>
                Cancelar
              </button>
              <button className="dp-btn dp-btn-primary" style={{ flex:1 }}
                onClick={handleAvatarConfirm} disabled={av.uploading}>
                {av.uploading
                  ? <><span style={{ display:'inline-block', width:13, height:13, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }}/> A guardar…</>
                  : <><CheckCircle size={13}/> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dp">

        {/* ══ TOP BAR ══ */}
        <div className="dp-bar">
          <div className="dp-brand">ZO<em>MAR</em></div>
          <div className="dp-tabs">
            {(['Perfil','Estatísticas','Segurança','Preferências'] as const).map(t => (
              <button key={t} className={`dp-tab${activeTab===t?' active':''}`} onClick={() => setActiveTab(t)}>{t}</button>
            ))}
          </div>
          <div className="dp-bar-right">
            <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={handleLogout}>
              <LogOut size={13}/>Sair
            </button>
            {/* Avatar mini — clicável para abrir upload */}
            <div className="dp-avatar-xs" onClick={av.open} title="Alterar foto">
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar"/>
                : initial}
            </div>
          </div>
        </div>

        {/* ══ HERO ══ */}
        <div className="dp-hero">
          {/* Avatar grande com upload */}
          <div className="dp-avatar-wrap">
            <div className="dp-avatar" onClick={av.open} title="Alterar foto de perfil">
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar"/>
                : initial}
              <div className="dp-avatar-overlay">
                <Camera size={20} color="#fff"/>
                <span>Alterar</span>
              </div>
            </div>
            {/* Badge câmara */}
            <div className="dp-cam-btn" onClick={av.open} title="Alterar foto">
              <Camera size={12} color="#fff"/>
            </div>
          </div>

          <div>
            <div className={`dp-status-pill ${isDeliverer ? 'del' : 'ent'}`}>
              {isDeliverer ? 'Entregador' : 'Empreendedor'}
            </div>
            <h1 className="dp-hero-name">{profile.full_name || 'Utilizador'}</h1>
            <div className="dp-hero-email"><Mail size={13}/>{user?.email}</div>
            <div className="dp-chips">
              <div className="dp-chip"><Star size={12} style={{color:'#f59e0b'}}/><strong>{stats.rating.toFixed(1)}</strong><span>confiança</span></div>
              <div className="dp-chip"><Package size={12} style={{color:'var(--em)'}}/><strong>{stats.totalDeliveries}</strong><span>entregas</span></div>
              {isDeliverer
                ? <div className="dp-chip"><DollarSign size={12} style={{color:'var(--em2)'}}/><strong>MZN {stats.earnings.toFixed(0)}</strong><span>ganhos</span></div>
                : <div className="dp-chip"><Package size={12} style={{color:'#a78bfa'}}/><strong>{stats.pendingDeliveries}</strong><span>em andamento</span></div>}
              <div className="dp-chip"><Clock size={12} style={{color:'var(--text3)'}}/><span>desde {stats.memberSince}</span></div>
            </div>
            {/* Link rápido para remover foto */}
            {avatarUrl && (
              <button onClick={handleRemoveAvatar}
                style={{ marginTop:8, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text3)' }}>
                <Trash2 size={11}/> Remover foto
              </button>
            )}
          </div>

          <div className="dp-hero-btns">
            {!editing ? (
              <button className="dp-btn dp-btn-primary" onClick={() => setEditing(true)} disabled={profile.status === 'suspenso'}>
                <Edit size={14}/>Editar Perfil
              </button>
            ) : (
              <>
                <button className="dp-btn dp-btn-primary" onClick={handleSave} disabled={saving}><Save size={14}/>{saving?'Salvando…':'Salvar'}</button>
                <button className="dp-btn dp-btn-ghost"   onClick={handleCancelEdit} disabled={saving}><X size={14}/>Cancelar</button>
              </>
            )}
            {/* Botão secundário de alterar foto */}
            <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={av.open}>
              <Camera size={12}/> Alterar foto
            </button>
          </div>
        </div>

        {/* ══ ALERTAS ══ */}
        {error   && <div className="dp-alert dp-alert-e"><AlertCircle size={14}/>{error}</div>}
        {success && <div className="dp-alert dp-alert-s"><CheckCircle size={14}/>{success}</div>}

        {profile.status === 'suspenso' && (
          <div className="dp-banner dp-banner-sus">
            <div className="dp-banner-icon"><AlertCircle size={18} style={{color:'#f87171'}}/></div>
            <div>
              <div className="dp-banner-title">Conta Suspensa</div>
              <div className="dp-banner-body">
                A sua conta foi suspensa pelo administrador.
                {profile.suspension_reason && <> Motivo: <strong>{profile.suspension_reason}</strong>.</>}
                {' '}Para reactivar, contacte o suporte.
              </div>
            </div>
          </div>
        )}
        {profile.status === 'inativo' && (
          <div className="dp-banner dp-banner-ina">
            <div className="dp-banner-icon"><Clock size={18} style={{color:'var(--text3)'}}/></div>
            <div><div className="dp-banner-title">Conta Inativa</div><div className="dp-banner-body">Contacte o suporte para reactivar.</div></div>
          </div>
        )}

        {/* ══════════ TAB: PERFIL ══════════ */}
        {activeTab === 'Perfil' && (
          <div className="dp-grid">
            <div className="dp-panel">
              <div className="dp-ptitle"><User size={13}/>Informações Pessoais</div>
              <div className="dp-fgrid">
                <div className="dp-field">
                  <label className="dp-label">Nome Completo</label>
                  <div className="dp-wrap"><User className="dp-ico" size={13}/>
                    <input className="dp-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} disabled={!editing} placeholder="Seu nome completo"/>
                  </div>
                </div>
                <div className="dp-field">
                  <label className="dp-label">Telefone</label>
                  <div className="dp-wrap"><Phone className="dp-ico" size={13}/>
                    <input className="dp-input" type="tel" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} disabled={!editing} placeholder="(11) 99999-9999"/>
                  </div>
                </div>
                <div className="dp-field full">
                  <label className="dp-label">Endereço</label>
                  <div className="dp-wrap"><MapPin className="dp-ico" size={13}/>
                    <input className="dp-input" type="text" value={address} onChange={e => setAddress(e.target.value)} disabled={!editing} placeholder="Rua, número, bairro, cidade"/>
                  </div>
                </div>
              </div>
              <hr className="dp-divider"/>
              <div className="dp-field">
                <label className="dp-label">E-mail</label>
                <div className="dp-wrap"><Mail className="dp-ico" size={13}/>
                  <input className="dp-input" type="email" value={user?.email || ''} disabled/>
                </div>
                <div className="dp-hint">O e-mail não pode ser alterado aqui.</div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text2)', marginTop:4}}>
                <Calendar size={14} style={{color:'var(--text3)'}}/>
                {new Date(profile.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}
              </div>
            </div>

            <div className="dp-panel">
              <div className="dp-ptitle"><Shield size={13}/>Conta</div>
              <div className="dp-srow">
                <div className="dp-srow-l"><Shield size={13} style={{color: profile.status==='suspenso'?'#f87171':profile.status==='inativo'?'var(--text3)':'var(--em)'}}/>Estado</div>
                <div className="dp-srow-v" style={{color: profile.status==='suspenso'?'#f87171':profile.status==='inativo'?'var(--text3)':'var(--em2)'}}>
                  {profile.status==='suspenso'?'⛔ Suspensa':profile.status==='inativo'?'⏸ Inativa':'✓ Ativa'}
                </div>
              </div>
              <div className="dp-srow">
                <div className="dp-srow-l"><CheckCircle size={13} style={{color:'var(--em)'}}/>E-mail verificado</div>
                <div className="dp-srow-v g">Sim</div>
              </div>
              <div className="dp-srow">
                <div className="dp-srow-l"><Shield size={13} style={{color: profile.document_verified?'var(--em)':'var(--yellow)'}}/>Documento</div>
                <div className="dp-srow-v" style={{color: profile.document_verified?'var(--em2)':'var(--yellow)'}}>
                  {profile.document_verified ? '✓ Verificado' : '⏳ Pendente'}
                </div>
              </div>
              <div className="dp-srow">
                <div className="dp-srow-l"><Package size={13} style={{color:'var(--em)'}}/>Tipo de conta</div>
                <div className="dp-srow-v" style={{color: isDeliverer?'var(--em2)':'#a78bfa'}}>{isDeliverer?'Entregador':'Empreendedor'}</div>
              </div>
              <div style={{marginTop:14}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                  <span style={{fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.7px', fontWeight:700}}>Confiança</span>
                  <span style={{fontFamily:'var(--fontC)', fontWeight:900, fontSize:18, color:(profile.trust_score??5)>=7?'var(--em2)':(profile.trust_score??5)>=4?'var(--yellow)':'#f87171'}}>
                    {(profile.trust_score??5).toFixed(1)}<span style={{fontSize:11, fontWeight:400, color:'var(--text3)'}}>/10</span>
                  </span>
                </div>
                <div className="dp-trust-bar">
                  <div className="dp-trust-fill" style={{ width:`${((profile.trust_score??5)/10)*100}%`, background:(profile.trust_score??5)>=7?'linear-gradient(90deg,var(--em3),var(--em2))':(profile.trust_score??5)>=4?'var(--yellow)':'var(--red)' }}/>
                </div>
              </div>
              <hr className="dp-divider"/>
              {!isDeliverer && stats.planName && (
                <div style={{background:'rgba(139,92,246,.08)', border:'1px solid rgba(139,92,246,.2)', borderRadius:10, padding:'12px 14px', marginBottom:16}}>
                  <div style={{fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'#a78bfa', marginBottom:6}}>Plano Activo</div>
                  <div style={{fontFamily:'var(--fontC)', fontWeight:900, fontSize:16, color:'#a78bfa'}}>{stats.planName}</div>
                  <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>{stats.planUsage} / {stats.planLimit||'∞'} entregas</div>
                </div>
              )}
              <div className="dp-danger">
                <div className="dp-danger-title">⚠ Zona de Perigo</div>
                <div className="dp-danger-row">
                  <div className="dp-danger-desc">Terminar sessão em todos os dispositivos</div>
                  <button className="dp-btn dp-btn-danger dp-btn-sm" onClick={handleLogout}><LogOut size={12}/>Sair</button>
                </div>
              </div>
            </div>

            <div className="dp-col3">
              <div className="dp-panel">
                <div className="dp-ptitle"><TrendingUp size={13}/>Resumo</div>
                {isDeliverer ? (
                  <>
                    <div className="dp-kpi-grid">
                      <div className="dp-kpi em"><div className="dp-kpi-val">{stats.totalDeliveries}</div><div className="dp-kpi-lbl">Total</div></div>
                      <div className="dp-kpi"><div className="dp-kpi-val" style={{color:'var(--em2)'}}>{stats.completedDeliveries}</div><div className="dp-kpi-lbl">Concluídas</div></div>
                      <div className="dp-kpi"><div className="dp-kpi-val" style={{color:'var(--yellow)'}}>{stats.rating.toFixed(1)}</div><div className="dp-kpi-lbl">Confiança</div></div>
                      <div className="dp-kpi em"><div className="dp-kpi-val">{completionRate}%</div><div className="dp-kpi-lbl">Taxa</div></div>
                    </div>
                    <div className="dp-prog"><div className="dp-prog-fill" style={{width:`${completionRate}%`}}/></div>
                    <div className="dp-srow" style={{marginTop:8}}><div className="dp-srow-l"><AlertCircle size={13} style={{color:'var(--red)'}}/>Cancelamentos</div><div className="dp-srow-v r">{stats.cancelledDeliveries}</div></div>
                    <div className="dp-srow"><div className="dp-srow-l"><Clock size={13} style={{color:'var(--yellow)'}}/>Em andamento</div><div className="dp-srow-v y">{stats.pendingDeliveries}</div></div>
                  </>
                ) : (
                  <>
                    <div className="dp-kpi-grid">
                      <div className="dp-kpi em"><div className="dp-kpi-val">{stats.totalDeliveries}</div><div className="dp-kpi-lbl">Criadas</div></div>
                      <div className="dp-kpi"><div className="dp-kpi-val" style={{color:'var(--em2)'}}>{stats.completedDeliveries}</div><div className="dp-kpi-lbl">Concluídas</div></div>
                      <div className="dp-kpi"><div className="dp-kpi-val" style={{color:'#a78bfa'}}>{stats.pendingDeliveries}</div><div className="dp-kpi-lbl">Em curso</div></div>
                      <div className="dp-kpi em"><div className="dp-kpi-val">{completionRate}%</div><div className="dp-kpi-lbl">Taxa</div></div>
                    </div>
                    <div className="dp-prog"><div className="dp-prog-fill" style={{width:`${completionRate}%`}}/></div>
                    <div className="dp-srow" style={{marginTop:8}}><div className="dp-srow-l"><DollarSign size={13} style={{color:'var(--em)'}}/>Total investido</div><div className="dp-srow-v g">MZN {stats.totalSpent.toFixed(0)}</div></div>
                    <div className="dp-srow"><div className="dp-srow-l"><Users2 size={13} style={{color:'var(--text3)'}}/>Entregadores</div><div className="dp-srow-v">{stats.uniqueDeliverers}</div></div>
                  </>
                )}
              </div>
              <div className="dp-panel">
                <div className="dp-ptitle"><HelpCircle size={13}/>Acesso Rápido</div>
                {[
                  { label:'Alterar foto',       icon:Camera,     action: av.open },
                  { label:'Alterar senha',       icon:Lock,       action:() => { setActiveTab('Segurança'); setChangingPw(true) } },
                  { label:'Ver estatísticas',    icon:TrendingUp, action:() => setActiveTab('Estatísticas') },
                  { label:'Preferências',        icon:Bell,       action:() => setActiveTab('Preferências') },
                  ...(!isDeliverer ? [{ label:'Gerir plano', icon:Star, action:() => navigate('/entrepreneur/subscription') }] : []),
                  { label:'Central de ajuda',    icon:HelpCircle, action:() => navigate(`/${role}/help`) },
                ].map(({ label, icon:Icon, action }) => (
                  <button key={label} className="dp-cfgbtn" onClick={action}>
                    <div className="dp-cfgbtn-l"><Icon size={14}/>{label}</div>
                    <ChevronRight size={13} style={{color:'var(--text3)'}}/>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ TAB: ESTATÍSTICAS ══════════ */}
        {activeTab === 'Estatísticas' && (
          isDeliverer ? (
            <div className="dp-grid">
              <div className="dp-panel" style={{gridColumn:'1/3'}}>
                <div className="dp-ptitle"><Package size={13}/>Actividade de Entregas</div>
                <div className="dp-kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                  <div className="dp-kpi em"><div className="dp-kpi-val">{stats.totalDeliveries}</div><div className="dp-kpi-lbl">Total</div></div>
                  <div className="dp-kpi"><div className="dp-kpi-val" style={{color:'var(--em2)'}}>{stats.completedDeliveries}</div><div className="dp-kpi-lbl">Concluídas</div></div>
                  <div className="dp-kpi"><div className="dp-kpi-val" style={{color:'var(--yellow)'}}>{stats.pendingDeliveries}</div><div className="dp-kpi-lbl">Em andamento</div></div>
                  <div className="dp-kpi"><div className="dp-kpi-val" style={{color:'var(--red)'}}>{stats.cancelledDeliveries}</div><div className="dp-kpi-lbl">Canceladas</div></div>
                </div>
                <div className="dp-srow" style={{marginTop:8}}><div className="dp-srow-l"><TrendingUp size={13} style={{color:'var(--em)'}}/>Taxa de conclusão</div><div className="dp-srow-v g">{completionRate}%</div></div>
                <div className="dp-prog"><div className="dp-prog-fill" style={{width:`${completionRate}%`}}/></div>
                <div className="dp-srow" style={{marginTop:8}}><div className="dp-srow-l"><DollarSign size={13} style={{color:'var(--em)'}}/>Ganhos totais</div><div className="dp-srow-v g">MZN {stats.earnings.toFixed(2)}</div></div>
                <div className="dp-srow"><div className="dp-srow-l"><DollarSign size={13} style={{color:'var(--text3)'}}/>Ganho médio</div><div className="dp-srow-v">MZN {stats.avgDeliveryValue.toFixed(2)}</div></div>
                <div className="dp-srow"><div className="dp-srow-l"><Star size={13} style={{color:'var(--yellow)'}}/>Confiança</div><div className="dp-srow-v y">{stats.rating.toFixed(1)} / 10</div></div>
                <div className="dp-srow"><div className="dp-srow-l"><Clock size={13} style={{color:'var(--text3)'}}/>Membro desde</div><div className="dp-srow-v">{stats.memberSince}</div></div>
              </div>
              <div className="dp-col3">
                <div className="dp-panel">
                  <div className="dp-ptitle"><Star size={13}/>Confiança</div>
                  <div style={{textAlign:'center', padding:'16px 0'}}>
                    <div style={{fontFamily:'var(--fontC)', fontWeight:900, fontSize:48, color:'var(--em2)', lineHeight:1}}>{stats.rating.toFixed(1)}</div>
                    <div style={{fontSize:11, color:'var(--text3)', marginTop:4, textTransform:'uppercase', letterSpacing:1}}>pontuação</div>
                  </div>
                  <div className="dp-prog"><div className="dp-prog-fill" style={{width:`${(stats.rating/10)*100}%`}}/></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="dp-grid">
              <div className="dp-panel" style={{gridColumn:'1/3'}}>
                <div className="dp-ptitle"><Package size={13}/>Actividade de Encomendas</div>
                <div className="dp-kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                  <div className="dp-kpi em"><div className="dp-kpi-val">{stats.totalDeliveries}</div><div className="dp-kpi-lbl">Criadas</div></div>
                  <div className="dp-kpi"><div className="dp-kpi-val" style={{color:'var(--em2)'}}>{stats.completedDeliveries}</div><div className="dp-kpi-lbl">Concluídas</div></div>
                  <div className="dp-kpi"><div className="dp-kpi-val" style={{color:'#a78bfa'}}>{stats.pendingDeliveries}</div><div className="dp-kpi-lbl">Em curso</div></div>
                  <div className="dp-kpi"><div className="dp-kpi-val" style={{color:'var(--red)'}}>{stats.cancelledDeliveries}</div><div className="dp-kpi-lbl">Canceladas</div></div>
                </div>
                <div className="dp-srow" style={{marginTop:8}}><div className="dp-srow-l"><TrendingUp size={13} style={{color:'var(--em)'}}/>Taxa de sucesso</div><div className="dp-srow-v g">{completionRate}%</div></div>
                <div className="dp-prog"><div className="dp-prog-fill" style={{width:`${completionRate}%`}}/></div>
                <div className="dp-srow" style={{marginTop:8}}><div className="dp-srow-l"><DollarSign size={13} style={{color:'var(--em)'}}/>Total investido</div><div className="dp-srow-v g">MZN {stats.totalSpent.toFixed(2)}</div></div>
                <div className="dp-srow"><div className="dp-srow-l"><DollarSign size={13} style={{color:'var(--text3)'}}/>Valor médio</div><div className="dp-srow-v">MZN {stats.avgOrderValue.toFixed(2)}</div></div>
                <div className="dp-srow"><div className="dp-srow-l"><Users2 size={13} style={{color:'var(--text3)'}}/>Entregadores</div><div className="dp-srow-v">{stats.uniqueDeliverers}</div></div>
                <div className="dp-srow"><div className="dp-srow-l"><Clock size={13} style={{color:'var(--text3)'}}/>Membro desde</div><div className="dp-srow-v">{stats.memberSince}</div></div>
              </div>
              <div className="dp-col3">
                <div className="dp-panel">
                  <div className="dp-ptitle"><Shield size={13}/>Plano</div>
                  {stats.planName ? (
                    <>
                      <div style={{textAlign:'center', padding:'10px 0 14px'}}>
                        <div style={{fontFamily:'var(--fontC)', fontWeight:900, fontSize:22, color:'#a78bfa'}}>{stats.planName}</div>
                        <div style={{fontSize:11, color:'var(--em2)', fontWeight:700, marginTop:4}}>✓ Activo</div>
                      </div>
                      <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>{stats.planUsage} / {stats.planLimit||'∞'} entregas</div>
                      <div className="dp-prog"><div className="dp-prog-fill" style={{ width: stats.planLimit > 0 ? `${Math.min((stats.planUsage/stats.planLimit)*100,100)}%` : '15%', background: stats.planLimit > 0 && stats.planUsage/stats.planLimit > 0.85 ? 'var(--red)' : 'linear-gradient(90deg,var(--em3),var(--em))' }}/></div>
                      <button className="dp-btn dp-btn-ghost dp-btn-full dp-btn-sm" style={{marginTop:12}} onClick={() => navigate('/entrepreneur/subscription')}><TrendingUp size={13}/>Gerir plano</button>
                    </>
                  ) : (
                    <div style={{textAlign:'center', padding:'12px 0'}}>
                      <div style={{fontSize:13, color:'var(--text3)', marginBottom:12}}>Sem plano activo</div>
                      <button className="dp-btn dp-btn-primary dp-btn-full dp-btn-sm" onClick={() => navigate('/entrepreneur/subscription')}><Star size={13}/>Ver planos</button>
                    </div>
                  )}
                </div>
                <div className="dp-panel">
                  <div className="dp-ptitle"><Star size={13}/>Confiança</div>
                  <div style={{textAlign:'center', padding:'10px 0 14px'}}>
                    <div style={{fontFamily:'var(--fontC)', fontWeight:900, fontSize:48, color:'var(--em2)', lineHeight:1}}>{stats.rating.toFixed(1)}</div>
                    <div style={{fontSize:11, color:'var(--text3)', marginTop:4, textTransform:'uppercase', letterSpacing:1}}>pontuação</div>
                  </div>
                  <div className="dp-prog"><div className="dp-prog-fill" style={{width:`${(stats.rating/10)*100}%`}}/></div>
                </div>
              </div>
            </div>
          )
        )}

        {/* ══════════ TAB: SEGURANÇA ══════════ */}
        {activeTab === 'Segurança' && (
          <div className="dp-grid">
            <div className="dp-panel" style={{gridColumn:'1/3'}}>
              <div className="dp-ptitle"><Shield size={13}/>Alterar Senha</div>
              {!changingPw ? (
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div>
                    <div style={{fontSize:13, color:'var(--text2)', marginBottom:3}}>Senha da conta</div>
                    <div style={{fontSize:11, color:'var(--text3)'}}>Recomendamos trocar a senha regularmente.</div>
                  </div>
                  <button className="dp-btn dp-btn-ghost" onClick={() => setChangingPw(true)}><Lock size={13}/>Alterar Senha</button>
                </div>
              ) : (
                <div style={{maxWidth:420}}>
                  {[
                    { key:'current', label:'Senha Atual', show:showPw.curr, toggle:() => setShowPw(p=>({...p,curr:!p.curr})), placeholder:'Senha atual', ac:'current-password' },
                    { key:'next',    label:'Nova Senha',  show:showPw.next, toggle:() => setShowPw(p=>({...p,next:!p.next})), placeholder:'Mínimo 8 caracteres', ac:'new-password' },
                    { key:'confirm', label:'Confirmar',   show:showPw.conf, toggle:() => setShowPw(p=>({...p,conf:!p.conf})), placeholder:'Repita a nova senha', ac:'new-password' },
                  ].map(f => (
                    <div key={f.key} className="dp-field">
                      <label className="dp-label">{f.label}</label>
                      <div className="dp-wrap">
                        <Lock className="dp-ico" size={13}/>
                        <input type={f.show?'text':'password'} className="dp-input" style={{paddingRight:36}}
                          value={(pwForm as any)[f.key]} onChange={e => setPwForm(p=>({...p,[f.key]:e.target.value}))}
                          placeholder={f.placeholder} autoComplete={f.ac}/>
                        <button className="dp-eye" onClick={f.toggle}>{f.show?<EyeOff size={13}/>:<Eye size={13}/>}</button>
                      </div>
                      {f.key==='next' && pwForm.next.length > 0 && (
                        <><div className="dp-prog" style={{marginTop:6}}><div className="dp-prog-fill" style={{width:`${pwStrength}%`,background:pwStrengthColor}}/></div><div className="dp-strength-label">{pwStrengthLabel}</div></>
                      )}
                      {f.key==='confirm' && pwForm.confirm && pwForm.next !== pwForm.confirm && <div className="dp-mismatch">As senhas não coincidem.</div>}
                    </div>
                  ))}
                  <div style={{display:'flex', gap:8}}>
                    <button className="dp-btn dp-btn-ghost" onClick={() => { setChangingPw(false); setPwForm({current:'',next:'',confirm:''}) }}>Cancelar</button>
                    <button className="dp-btn dp-btn-primary" onClick={handleChangePassword} disabled={saving}>{saving?'Confirmando…':'Confirmar'}</button>
                  </div>
                </div>
              )}
            </div>
            <div className="dp-col3">
              <div className="dp-panel">
                <div className="dp-ptitle"><Shield size={13}/>Status</div>
                <div className="dp-srow"><div className="dp-srow-l"><CheckCircle size={13} style={{color:'var(--em)'}}/>E-mail verificado</div><div className="dp-srow-v g">Sim</div></div>
                <div className="dp-srow"><div className="dp-srow-l"><Lock size={13} style={{color:'var(--text3)'}}/>2FA</div><div className="dp-srow-v" style={{color:'var(--text3)'}}>Em breve</div></div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ TAB: PREFERÊNCIAS ══════════ */}
        {activeTab === 'Preferências' && (
          <div className="dp-grid">
            <div className="dp-panel" style={{gridColumn:'1/3'}}>
              <div className="dp-ptitle"><Bell size={13}/>Notificações</div>
              {notifRows.map(({ key, label, desc, icon:Icon }) => (
                <div key={key} className="dp-nrow">
                  <div className="dp-nrow-l">
                    <Icon size={14} style={{color:'var(--em)'}}/>
                    <div>
                      <div className="dp-nrow-label">{label}</div>
                      <div style={{fontSize:11, color:'var(--text3)', marginTop:1}}>{desc}</div>
                    </div>
                  </div>
                  <label className="dp-toggle">
                    <input type="checkbox" checked={notif[key]} onChange={e => setNotif(p=>({...p,[key]:e.target.checked}))}/>
                    <div className="dp-toggle-track"><div className="dp-toggle-knob"/></div>
                  </label>
                </div>
              ))}
              <div style={{marginTop:18}}>
                <button className="dp-btn dp-btn-primary" onClick={handleSaveNotif} disabled={saving}>
                  <Save size={13}/>{saving ? 'Salvando…' : 'Salvar Preferências'}
                </button>
              </div>
            </div>
            <div className="dp-col3">
              <div className="dp-panel">
                <div className="dp-ptitle"><HelpCircle size={13}/>Suporte</div>
                <p style={{fontSize:13, color:'var(--text2)', marginBottom:14, lineHeight:1.6}}>
                  Tem dúvidas? A nossa equipa está disponível.
                </p>
                <button className="dp-btn dp-btn-ghost dp-btn-full" onClick={() => window.open('mailto:zomarentregas@gmail.com','_blank')}><Mail size={13}/>Enviar E-mail</button>
                <button className="dp-btn dp-btn-ghost dp-btn-full" style={{marginTop:8}} onClick={() => window.open('https://wa.me/258842589799','_blank')}><Phone size={13}/>WhatsApp</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}