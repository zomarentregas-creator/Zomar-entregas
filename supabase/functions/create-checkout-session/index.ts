// supabase/functions/create-checkout-session/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders as cors, preflight } from '../_shared/http.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre
  const corsHeaders = cors(req)

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion:  '2024-06-20',
      httpClient:  Stripe.createFetchHttpClient(),
    })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token em falta' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')      ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { priceId, planId, planName } = await req.json()

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'priceId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Só aceita preços do próprio catálogo: sem isto, qualquer utilizador podia
    // escolher qualquer price_ da conta Stripe. Configure ALLOWED_PRICE_IDS com os IDs dos planos.
    const allowed = (Deno.env.get('ALLOWED_PRICE_IDS') ?? '').split(',').map((v: string) => v.trim()).filter(Boolean)
    if (allowed.length === 0) {
      console.warn('[checkout] ALLOWED_PRICE_IDS não definido: qualquer price_ é aceite')
    } else if (!allowed.includes(String(priceId))) {
      return new Response(
        JSON.stringify({ error: 'Plano inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (typeof priceId !== 'string' || !priceId.startsWith('price_')) {
      return new Response(
        JSON.stringify({ error: 'Price ID inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // FIX: usar user_id (FK do auth.users) em vez de id (PK do profiles)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    let customerId: string

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email:    user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // FIX: actualizar por user_id
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id)
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items:           [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          supabase_user_id: user.id,
          plan_id:          planId   ?? '',
          plan_name:        planName ?? '',
        },
      },
      success_url:           `${appUrl}/entrepreneur/subscription?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url:            `${appUrl}/entrepreneur/subscription?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
        plan_id:          planId   ?? '',
        plan_name:        planName ?? '',
      },
      allow_promotion_codes: true,
    })

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('Erro create-checkout-session:', err)
    return new Response(
      JSON.stringify({ error: 'Não foi possível concluir o pedido. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})