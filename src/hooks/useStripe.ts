// src/hooks/useStripe.ts
// ═══════════════════════════════════════════════════════════════
// Hook para pagamentos via Stripe (cartão internacional)
// Requer Edge Functions no Supabase:
//   supabase/functions/create-checkout-session/index.ts
//   supabase/functions/create-portal-session/index.ts
//   supabase/functions/stripe-webhook/index.ts
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export interface UseStripeReturn {
  redirectToCheckout: (priceId: string, planId: string, planName: string) => Promise<void>
  redirectToPortal:   () => Promise<void>
  loading:            boolean
  error:              string | null
  clearError:         () => void
}

export function useStripe(): UseStripeReturn {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // ── Chamada autenticada às Edge Functions ─────────────────────────────────
  const callEdge = async (fn: string, body?: object) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sessão expirada. Por favor faz login novamente.')

    const url    = import.meta.env.VITE_SUPABASE_URL
    const anon   = import.meta.env.VITE_SUPABASE_ANON_KEY

    const res  = await fetch(`${url}/functions/v1/${fn}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey':        anon,
      },
      body: JSON.stringify(body ?? {}),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Erro HTTP ${res.status}`)
    return data
  }

  // ── Iniciar checkout (cartão) ─────────────────────────────────────────────
  // Cria uma sessão Stripe Checkout e redireciona para a página de pagamento.
  // Após pagamento bem-sucedido, o webhook activa automaticamente a subscrição.
  const redirectToCheckout = async (
    priceId:  string,
    planId:   string,
    planName: string,
  ): Promise<void> => {
    setLoading(true); setError(null)
    try {
      if (!priceId?.startsWith('price_')) throw new Error(
        `Price ID inválido: "${priceId}". Cria o produto no Stripe Dashboard e copia o ID (price_xxx).`
      )
      const { url } = await callEdge('create-checkout-session', { priceId, planId, planName })
      if (!url) throw new Error('URL de checkout não recebida.')
      window.location.href = url
    } catch (e: any) {
      setError(e.message || 'Erro ao iniciar pagamento.')
      throw e
    } finally {
      setLoading(false)
    }
  }

  // ── Abrir portal do cliente (gerir cartão, facturas, cancelar) ────────────
  const redirectToPortal = async (): Promise<void> => {
    setLoading(true); setError(null)
    try {
      const { url } = await callEdge('create-portal-session')
      if (!url) throw new Error('URL do portal não recebida.')
      window.location.href = url
    } catch (e: any) {
      setError(e.message || 'Erro ao abrir portal.')
      throw e
    } finally {
      setLoading(false)
    }
  }

  return {
    redirectToCheckout,
    redirectToPortal,
    loading,
    error,
    clearError: () => setError(null),
  }
}