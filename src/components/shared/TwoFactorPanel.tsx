// src/components/shared/TwoFactorPanel.tsx
// Autenticação em dois passos (TOTP) com Supabase MFA: Google Authenticator, Authy, etc.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Factor { id: string; status: string; friendly_name?: string | null }

export default function TwoFactorPanel() {
  const [factor, setFactor] = useState<Factor | null>(null)
  const [loading, setLoading] = useState(true)
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (!error) setFactor((data?.totp ?? []).find(f => f.status === 'verified') ?? null)
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const start = async () => {
    setBusy(true); setMsg(null)
    // Remove tentativas anteriores não verificadas, senão o nome colide
    const { data: all } = await supabase.auth.mfa.listFactors()
    for (const f of (all?.all ?? []).filter(f => f.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'ZOMAR' })
    setBusy(false)
    if (error || !data) { setMsg({ ok: false, text: 'Não foi possível iniciar a configuração. O 2FA pode não estar activo no projecto.' }); return }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    setCode('')
  }

  const verify = async () => {
    if (!enroll || code.length !== 6) return
    setBusy(true); setMsg(null)
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enroll.id })
    if (chErr || !ch) { setBusy(false); setMsg({ ok: false, text: 'Falha ao validar. Tente de novo.' }); return }
    const { error } = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.id, code })
    setBusy(false)
    if (error) { setMsg({ ok: false, text: 'Código incorrecto. Confirme a hora do telemóvel e tente de novo.' }); return }
    setEnroll(null); setMsg({ ok: true, text: 'Autenticação em dois passos activada.' }); void load()
  }

  const disable = async () => {
    if (!factor || !window.confirm('Desactivar a autenticação em dois passos?')) return
    setBusy(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
    setBusy(false)
    if (error) { setMsg({ ok: false, text: 'Não foi possível desactivar. Pode ser preciso confirmar o código primeiro.' }); return }
    setFactor(null); setMsg({ ok: true, text: 'Autenticação em dois passos desactivada.' })
  }

  const cancel = async () => {
    if (enroll) await supabase.auth.mfa.unenroll({ factorId: enroll.id })
    setEnroll(null)
  }

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text3)' }}>A carregar…</div>

  return (
    <div>
      {msg && <div style={{ fontSize: 12, marginBottom: 10, color: msg.ok ? 'var(--em2)' : 'var(--red)' }}>{msg.text}</div>}

      {enroll ? (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>
            1. Abra a app autenticadora e leia o QR.<br />2. Escreva o código de 6 dígitos que ela mostra.
          </p>
          <img src={enroll.qr} alt="QR para configurar o 2FA" width={168} height={168}
            style={{ background: '#fff', padding: 8, borderRadius: 10, display: 'block', marginBottom: 8 }} />
          <p style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10, wordBreak: 'break-all' }}>Ou introduza a chave: <b>{enroll.secret}</b></p>
          <input className="dp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" style={{ letterSpacing: 6, textAlign: 'center', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={cancel} disabled={busy}>Cancelar</button>
            <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={verify} disabled={busy || code.length !== 6}>{busy ? 'A validar…' : 'Activar'}</button>
          </div>
        </div>
      ) : factor ? (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>Activo. Será pedido um código ao iniciar sessão.</p>
          <button className="dp-btn dp-btn-danger dp-btn-sm" onClick={disable} disabled={busy}>Desactivar</button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>Proteja a conta com um código temporário gerado no telemóvel.</p>
          <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={start} disabled={busy}>{busy ? 'A preparar…' : 'Configurar'}</button>
        </div>
      )}
    </div>
  )
}
