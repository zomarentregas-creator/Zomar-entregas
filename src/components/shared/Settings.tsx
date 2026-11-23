// src/components/shared/Settings.tsx
/**
 * DEFINIÇÕES — só opções que têm efeito real na app.
 * - Aparência e acessibilidade: aplicam-se de imediato (atributos data-* no <html>),
 *   ficam guardadas no dispositivo e sincronizam com a conta.
 * - Notificações: gravadas em `notification_settings` (o servidor respeita-as).
 * - Entregas (empresário): endereço e item predefinidos que pré-preenchem "Nova entrega".
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Accessibility, Bell, BookOpen, CheckCircle, Moon, Monitor, Package, RotateCcw, Shield, Sun, AlertCircle, User,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  A11Y_DEFAULTS, loadLocalA11y, loadLocalCompact, loadThemeMode, pushRemoteSettings, fetchRemoteSettings,
  saveLocalPrefs, setThemeMode, themeKey, type A11yPrefs, type Role, type TextScale, type ThemeMode,
} from '../../lib/preferences'

interface Notif { new_delivery: boolean; status_update: boolean; payment_alert: boolean; system_news: boolean }
const NOTIF_DEFAULTS: Notif = { new_delivery: true, status_update: true, payment_alert: true, system_news: false }

const SCALE_OPTIONS: { v: TextScale; label: string }[] = [
  { v: 100, label: 'Normal' }, { v: 115, label: 'Grande' }, { v: 130, label: 'Maior' }, { v: 150, label: 'Máximo' },
]

export default function Settings() {
  const { user } = useAuth()
  const role: Role = user?.role === 'deliverer' ? 'deliverer' : 'entrepreneur'
  const base = `/${role}`

  const [a11y, setA11y] = useState<A11yPrefs>(loadLocalA11y)
  const [compact, setCompact] = useState<boolean>(loadLocalCompact)
  const [mode, setMode] = useState<ThemeMode>(() => loadThemeMode() ?? (localStorage.getItem(themeKey(role)) === 'light' ? 'light' : 'dark'))
  const [notif, setNotif] = useState<Notif>(NOTIF_DEFAULTS)
  const [origin, setOrigin] = useState('')
  const [itemType, setItemType] = useState('')
  const [status, setStatus] = useState<{ kind: 'ok' | 'warn' | 'err'; msg: string } | null>(null)
  const [isDark, setIsDark] = useState(() => localStorage.getItem(themeKey(role)) !== 'light')
  const timer = useRef<number | undefined>(undefined)

  const flash = useCallback((kind: 'ok' | 'warn' | 'err', msg: string) => {
    setStatus({ kind, msg })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus(null), 3500)
  }, [])

  // Acompanha o tema do layout
  useEffect(() => {
    const h = (e: StorageEvent) => { if (e.key === themeKey(role)) setIsDark(e.newValue !== 'light') }
    window.addEventListener('storage', h)
    return () => window.removeEventListener('storage', h)
  }, [role])

  // Carrega notificações e predefinições da conta
  useEffect(() => {
    if (!user?.id) return
    let off = false
    ;(async () => {
      const [n, r] = await Promise.all([
        supabase.from('notification_settings').select('new_delivery,status_update,payment_alert,system_news').eq('user_id', user.id).maybeSingle(),
        fetchRemoteSettings(user.id),
      ])
      if (off) return
      if (n.data) setNotif({ ...NOTIF_DEFAULTS, ...n.data })
      if (r) { setOrigin(r.default_origin_address ?? ''); setItemType(r.default_item_type ?? '') }
    })()
    return () => { off = true; window.clearTimeout(timer.current) }
  }, [user?.id])

  const persistLook = async (nextA11y: A11yPrefs, nextCompact: boolean, nextMode: ThemeMode) => {
    saveLocalPrefs(nextA11y, nextCompact)
    if (!user?.id) return
    const r = await pushRemoteSettings(user.id, { theme: nextMode, compact_mode: nextCompact }, { accessibility: nextA11y })
    if (!r.basicOk) flash('warn', 'Guardado neste dispositivo (sem ligação à conta).')
    else if (!r.extraOk) flash('warn', 'Guardado neste dispositivo. A sincronização entre dispositivos ainda não está activa.')
    else flash('ok', 'Preferência guardada.')
  }

  const setA11yKey = <K extends keyof A11yPrefs>(k: K, v: A11yPrefs[K]) => {
    const next = { ...a11y, [k]: v }
    setA11y(next); void persistLook(next, compact, mode)
  }
  const changeMode = (m: ThemeMode) => {
    setMode(m); setThemeMode(role, m); void persistLook(a11y, compact, m)
  }
  const changeCompact = (c: boolean) => { setCompact(c); void persistLook(a11y, c, mode) }
  const resetLook = () => {
    setA11y(A11Y_DEFAULTS); setCompact(false); setMode('dark'); setThemeMode(role, 'dark')
    void persistLook(A11Y_DEFAULTS, false, 'dark')
  }

  const changeNotif = async (k: keyof Notif, v: boolean) => {
    if (!user?.id) return
    const prev = notif
    setNotif({ ...notif, [k]: v })
    const { error } = await supabase.from('notification_settings')
      .upsert({ user_id: user.id, [k]: v, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) { setNotif(prev); flash('err', 'Não foi possível guardar. Tente novamente.') } else flash('ok', 'Preferência guardada.')
  }

  const saveDefaults = async () => {
    if (!user?.id) return
    const r = await pushRemoteSettings(user.id, {}, {
      default_origin_address: origin.trim().slice(0, 200) || null,
      default_item_type: itemType.trim().slice(0, 80) || null,
    })
    flash(r.extraOk ? 'ok' : 'err', r.extraOk ? 'Predefinições guardadas.' : 'Ainda não é possível guardar predefinições (actualização da conta pendente).')
  }

  const dk = (d: string, l: string) => (isDark ? d : l)

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <header>
        <h1 className={`text-2xl font-bold ${dk('text-white', 'text-gray-900')}`}>Definições</h1>
        <p className={`text-sm mt-1 ${dk('text-gray-400', 'text-gray-600')}`}>
          As alterações aplicam-se logo e ficam guardadas na sua conta.
        </p>
      </header>

      <div role="status" aria-live="polite" className="min-h-[2.75rem]">
        {status && (
          <div className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm border ${
            status.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
            : status.kind === 'warn' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
            : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
            {status.kind === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{status.msg}
          </div>
        )}
      </div>

      <Card icon={Moon} title="Aparência" sub="Tema e densidade do ecrã" dark={isDark}>
        <Radio label="Tema" dark={isDark} value={mode} onChange={v => changeMode(v as ThemeMode)}
          options={[{ v: 'dark', label: 'Escuro', icon: Moon }, { v: 'light', label: 'Claro', icon: Sun }, { v: 'auto', label: 'Automático', icon: Monitor }]} />
        <p className={`text-xs ${dk('text-gray-400', 'text-gray-600')}`}>Automático segue o tema do telemóvel ou computador.</p>
        <Switch label="Modo compacto" desc="Menos espaçamento: mais informação visível no ecrã." checked={compact} onChange={changeCompact} dark={isDark} />
      </Card>

      <Card icon={Accessibility} title="Acessibilidade" sub="Ajuste a app às suas necessidades" dark={isDark}>
        <Radio label="Tamanho do texto" dark={isDark} value={String(a11y.textScale)} onChange={v => setA11yKey('textScale', Number(v) as TextScale)}
          options={SCALE_OPTIONS.map(o => ({ v: String(o.v), label: o.label }))} />
        <Switch label="Alto contraste" desc="Texto e bordas mais fortes para ler melhor, sobretudo ao sol." checked={a11y.contrast === 'high'} onChange={c => setA11yKey('contrast', c ? 'high' : 'normal')} dark={isDark} />
        <Switch label="Reduzir animações" desc="Remove movimentos e transições. Útil se tem sensibilidade ao movimento." checked={a11y.motion === 'reduce'} onChange={c => setA11yKey('motion', c ? 'reduce' : 'system')} dark={isDark} />
        <Switch label="Letra de leitura fácil" desc="Tipo de letra mais espaçado e com formas bem distintas." checked={a11y.readableFont} onChange={c => setA11yKey('readableFont', c)} dark={isDark} />
        <Switch label="Destaque forte do foco" desc="Contorno amarelo bem visível ao navegar com o teclado." checked={a11y.strongFocus} onChange={c => setA11yKey('strongFocus', c)} dark={isDark} />
        <Switch label="Botões maiores" desc="Áreas de toque maiores, mais fáceis de acertar com o dedo." checked={a11y.bigTargets} onChange={c => setA11yKey('bigTargets', c)} dark={isDark} />
        <button type="button" onClick={resetLook}
          className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border ${dk('border-white/15 text-gray-200 hover:bg-white/5', 'border-gray-300 text-gray-700 hover:bg-gray-100')}`}>
          <RotateCcw size={14} /> Repor aparência e acessibilidade
        </button>
      </Card>

      <Card icon={Bell} title="Notificações" sub="O que quer receber dentro da app" dark={isDark}>
        {role === 'deliverer' && (
          <Switch label="Novas entregas disponíveis" desc="Aviso quando um empresário publica uma entrega." checked={notif.new_delivery} onChange={v => changeNotif('new_delivery', v)} dark={isDark} />
        )}
        <Switch label="Estado das entregas" desc="Aceite, recolhida, concluída. Cancelamentos e problemas chegam sempre." checked={notif.status_update} onChange={v => changeNotif('status_update', v)} dark={isDark} />
        <Switch label="Pagamentos e subscrição" desc="Recibos e fim do período de teste. Falhas de pagamento chegam sempre." checked={notif.payment_alert} onChange={v => changeNotif('payment_alert', v)} dark={isDark} />
        <Switch label="Novidades da ZOMAR" desc="Anúncios e novas funcionalidades." checked={notif.system_news} onChange={v => changeNotif('system_news', v)} dark={isDark} />
      </Card>

      {role === 'entrepreneur' && (
        <Card icon={Package} title="Predefinições de entrega" sub="Pré-preenchem o formulário “Nova entrega”" dark={isDark}>
          <Field label="Endereço de recolha habitual" dark={isDark} value={origin} onChange={setOrigin} max={200} placeholder="Ex.: Av. 24 de Julho, 1200, Maputo" />
          <Field label="Tipo de item habitual" dark={isDark} value={itemType} onChange={setItemType} max={80} placeholder="Ex.: Encomenda de roupa" />
          <button type="button" onClick={saveDefaults}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm ${dk('bg-emerald-500 text-black hover:bg-emerald-400', 'bg-emerald-600 text-white hover:bg-emerald-700')}`}>
            Guardar predefinições
          </button>
        </Card>
      )}

      <Card icon={Shield} title="Conta e ajuda" sub="Perfil, guia e suporte" dark={isDark}>
        <div className="grid sm:grid-cols-2 gap-3">
          <LinkTile to={`${base}/profile`} icon={User} label="Perfil e palavra-passe" dark={isDark} />
          <LinkTile to={`${base}/help`} icon={BookOpen} label="Central de ajuda" dark={isDark} />
        </div>
      </Card>
    </div>
  )
}

// ── Componentes ──────────────────────────────────────────────────────────────
function Card({ icon: Icon, title, sub, dark, children }: { icon: LucideIcon; title: string; sub: string; dark: boolean; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border p-5 space-y-4 ${dark ? 'bg-[#121212] border-white/10' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}><Icon size={20} aria-hidden /></div>
        <div>
          <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
          <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{sub}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Switch({ label, desc, checked, onChange, dark }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; dark: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 p-3 rounded-xl border ${dark ? 'border-white/5' : 'border-gray-200'}`}>
      <div className="min-w-0">
        <p className={`font-medium text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>{label}</p>
        <p className={`text-xs mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-600'}`}>{desc}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${checked ? 'bg-emerald-500' : dark ? 'bg-gray-600' : 'bg-gray-400'}`}>
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

function Radio({ label, options, value, onChange, dark }: {
  label: string; options: { v: string; label: string; icon?: LucideIcon }[]; value: string; onChange: (v: string) => void; dark: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className={`text-sm font-medium mb-2 ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{label}</p>
      <div className={`grid gap-2 ${options.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        {options.map(o => {
          const on = value === o.v
          return (
            <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.v)}
              className={`py-3 px-2 rounded-xl border-2 text-sm font-medium flex flex-col items-center gap-1 transition-colors ${
                on ? 'border-emerald-500 bg-emerald-500/10 ' + (dark ? 'text-emerald-300' : 'text-emerald-800')
                   : (dark ? 'border-white/10 text-gray-300 hover:border-white/25' : 'border-gray-200 text-gray-700 hover:border-gray-400')}`}>
              {o.icon && <o.icon size={18} aria-hidden />}{o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, max, placeholder, dark }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder: string; dark: boolean }) {
  return (
    <label className="block">
      <span className={`text-sm font-medium ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{label}</span>
      <input value={value} maxLength={max} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className={`mt-1.5 w-full px-3 py-2.5 rounded-xl border text-sm ${dark ? 'bg-black/30 border-white/15 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`} />
    </label>
  )
}

function LinkTile({ to, icon: Icon, label, dark }: { to: string; icon: LucideIcon; label: string; dark: boolean }) {
  return (
    <Link to={to} className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium ${dark ? 'border-white/10 text-gray-200 hover:bg-white/5' : 'border-gray-200 text-gray-800 hover:bg-gray-50'}`}>
      <Icon size={16} aria-hidden /> {label}
    </Link>
  )
}
