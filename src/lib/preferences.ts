// src/lib/preferences.ts
// Preferências de aparência e acessibilidade. Guardadas localmente (aplicam-se
// de imediato, mesmo offline) e sincronizadas com `user_settings` quando possível.
import { supabase } from './supabase'

export type TextScale = 100 | 115 | 130 | 150
export type ThemeMode = 'dark' | 'light' | 'auto'
export type Role = 'entrepreneur' | 'deliverer'

export interface A11yPrefs {
  textScale: TextScale
  contrast: 'normal' | 'high'
  motion: 'system' | 'reduce'
  readableFont: boolean
  strongFocus: boolean
  bigTargets: boolean
}

export const A11Y_DEFAULTS: A11yPrefs = {
  textScale: 100, contrast: 'normal', motion: 'system',
  readableFont: false, strongFocus: false, bigTargets: false,
}

const A11Y_KEY = 'zomar-a11y'
const COMPACT_KEY = 'zomar-compact'
const MODE_KEY = 'zomar-theme-mode'
export const PREFS_EVENT = 'zomar:prefs-changed'

const SCALES: TextScale[] = [100, 115, 130, 150]

export function sanitizeA11y(raw: unknown): A11yPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    textScale: SCALES.includes(r.textScale as TextScale) ? (r.textScale as TextScale) : 100,
    contrast: r.contrast === 'high' ? 'high' : 'normal',
    motion: r.motion === 'reduce' ? 'reduce' : 'system',
    readableFont: r.readableFont === true,
    strongFocus: r.strongFocus === true,
    bigTargets: r.bigTargets === true,
  }
}

export function loadLocalA11y(): A11yPrefs {
  try { return sanitizeA11y(JSON.parse(localStorage.getItem(A11Y_KEY) || '{}')) }
  catch { return A11Y_DEFAULTS }
}
export function loadLocalCompact(): boolean {
  try { return localStorage.getItem(COMPACT_KEY) === '1' } catch { return false }
}
export function loadThemeMode(): ThemeMode | null {
  try {
    const m = localStorage.getItem(MODE_KEY)
    return m === 'dark' || m === 'light' || m === 'auto' ? m : null
  } catch { return null }
}

/** Aplica as preferências ao <html> (atributos data-* lidos por zomar-a11y.css). */
export function applyA11y(p: A11yPrefs, compact: boolean) {
  const el = document.documentElement
  el.dataset.a11yText = String(p.textScale)
  el.dataset.a11yContrast = p.contrast
  el.dataset.a11yMotion = p.motion
  el.dataset.a11yFont = p.readableFont ? 'readable' : 'default'
  el.dataset.a11yFocus = p.strongFocus ? 'strong' : 'default'
  el.dataset.a11yTargets = p.bigTargets ? 'large' : 'default'
  el.dataset.compact = compact ? 'true' : 'false'
  el.style.setProperty('--zm-scale', String(p.textScale / 100))
  window.dispatchEvent(new Event(PREFS_EVENT))
}

export function applyLocalPrefs() {
  applyA11y(loadLocalA11y(), loadLocalCompact())
}

export function saveLocalPrefs(p: A11yPrefs, compact: boolean) {
  try {
    localStorage.setItem(A11Y_KEY, JSON.stringify(p))
    localStorage.setItem(COMPACT_KEY, compact ? '1' : '0')
  } catch { /* armazenamento indisponível */ }
  applyA11y(p, compact)
}

// ── Tema ────────────────────────────────────────────────────────────────────
export const themeKey = (role: Role) => (role === 'deliverer' ? 'deliverer_theme' : 'entrepreneur_theme')
export const systemPrefersDark = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches

/** Define o tema do papel actual e avisa o layout (mesmo separador). */
export function setThemeMode(role: Role, mode: ThemeMode) {
  const dark = mode === 'auto' ? systemPrefersDark() : mode === 'dark'
  const key = themeKey(role)
  const value = dark ? 'dark' : 'light'
  try {
    localStorage.setItem(MODE_KEY, mode)
    localStorage.setItem(key, value)
  } catch { /* ignore */ }
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
}

// ── Sincronização com a base de dados ───────────────────────────────────────
export interface RemoteSettings {
  theme?: ThemeMode
  compact_mode?: boolean
  accessibility?: unknown
  default_origin_address?: string | null
  default_item_type?: string | null
}

export async function fetchRemoteSettings(userId: string): Promise<RemoteSettings | null> {
  // Tenta com as colunas novas; se a migração ainda não existe, cai para as básicas.
  const full = await supabase.from('user_settings')
    .select('theme, compact_mode, accessibility, default_origin_address, default_item_type')
    .eq('user_id', userId).maybeSingle()
  if (!full.error) return (full.data as RemoteSettings | null) ?? null
  const basic = await supabase.from('user_settings')
    .select('theme, compact_mode').eq('user_id', userId).maybeSingle()
  return basic.error ? null : ((basic.data as RemoteSettings | null) ?? null)
}

/** Duas escritas separadas: as colunas básicas nunca dependem das novas. */
export async function pushRemoteSettings(
  userId: string,
  basic: { theme?: ThemeMode; compact_mode?: boolean },
  extra?: { accessibility?: A11yPrefs; default_origin_address?: string | null; default_item_type?: string | null },
): Promise<{ basicOk: boolean; extraOk: boolean }> {
  const now = new Date().toISOString()
  let basicOk = true, extraOk = true
  if (Object.keys(basic).length) {
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: userId, ...basic, updated_at: now }, { onConflict: 'user_id' })
    basicOk = !error
  }
  if (extra && Object.keys(extra).length) {
    const { error } = await supabase.from('user_settings')
      .upsert({ user_id: userId, ...extra, updated_at: now }, { onConflict: 'user_id' })
    extraOk = !error
  }
  return { basicOk, extraOk }
}
