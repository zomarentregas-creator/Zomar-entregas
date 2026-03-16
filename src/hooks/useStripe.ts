// src/hooks/useStripe.ts
// Hook React para interagir com as Edge Functions do Stripe

import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface UseStripeReturn {
  redirectToCheckout: (priceId: string, planId: string, planName: string) => Promise<void>
  redirectToPortal: () => Promise<void>
  loading: boolean
  error: string | null
}

export function useStripe(): UseStripeReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // ── Chamada genérica às Edge Functions ───────────────────────────────────
  const callEdgeFunction = async (functionName: string, body?: object) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sessão expirada. Por favor, faça login novamente.')

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY

    const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey':        anonKey,
      },
      body: JSON.stringify(body ?? {}),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Erro HTTP ${res.status}`)
    return data
  }

  // ── Checkout Stripe ───────────────────────────────────────────────────────
  /**
   * Redireciona para o Checkout do Stripe com trial de 7 dias.
   * @param priceId  - ID do Price no Stripe (price_xxx)
   * @param planId   - ID interno do plano  (plan_basic, plan_professional…)
   * @param planName - Nome legível          (Básico, Profissional…)
   */
  const redirectToCheckout = async (
    priceId:  string,
    planId:   string,
    planName: string
  ): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      if (!priceId.startsWith('price_')) {
        throw new Error(
          `Price ID inválido: "${priceId}". ` +
          'Use o ID de preço (price_xxx) da secção "Pricing" do produto no Stripe Dashboard.'
        )
      }

      const { url } = await callEdgeFunction('create-checkout-session', {
        priceId,
        planId,
        planName,
      })

      if (!url) throw new Error('URL de checkout não recebida.')
      window.location.href = url

    } catch (err: any) {
      const msg = err.message || 'Erro ao iniciar o pagamento. Tente novamente.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // ── Customer Portal ───────────────────────────────────────────────────────
  /**
   * Redireciona para o Customer Portal do Stripe.
   * Permite gerir cartão, ver facturas ou cancelar a assinatura.
   *
   * Pré-requisito: configurar o portal em
   * Stripe Dashboard → Billing → Customer Portal → Activate.
   */
  const redirectToPortal = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      const { url } = await callEdgeFunction('create-portal-session')

      if (!url) throw new Error('URL do portal não recebida.')
      window.location.href = url

    } catch (err: any) {
      const msg = err.message || 'Erro ao abrir o portal. Tente novamente.'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { redirectToCheckout, redirectToPortal, loading, error }
}