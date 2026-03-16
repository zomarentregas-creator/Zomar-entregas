// supabase/functions/stripe-webhook/index.ts
/**
 * ============================================================================
 * EDGE FUNCTION — stripe-webhook  (versão final, produção)
 * ============================================================================
 *
 * Variáveis de ambiente necessárias:
 *   STRIPE_SECRET_KEY         sk_test_xxx  ou  sk_live_xxx
 *   STRIPE_WEBHOOK_SECRET     whsec_xxx
 *   SUPABASE_SERVICE_ROLE_KEY (disponível automaticamente)
 *
 * Eventos a activar no Stripe Dashboard:
 *   checkout.session.completed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   customer.subscription.trial_will_end
 *   invoice.payment_succeeded
 *   invoice.payment_failed
 */

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')              ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const STATUS_MAP: Record<string, string> = {
  trialing:           'trialing',
  active:             'active',
  past_due:           'past_due',
  canceled:           'canceled',
  unpaid:             'past_due',
  incomplete:         'pending',
  incomplete_expired: 'expired',
  paused:             'canceled',
}

const MAX_DELIVERIES: Record<string, number> = {
  plan_basic:        20,
  plan_professional: 100,
  plan_enterprise:   999999,
}

async function syncSubscription(
  userId: string,
  sub: Stripe.Subscription,
  extraMeta?: Stripe.Metadata | null
) {
  const meta     = { ...sub.metadata, ...(extraMeta ?? {}) }
  const item     = sub.items.data[0]
  const planId   = meta?.plan_id   ?? item?.price?.id ?? 'unknown'
  const planName = meta?.plan_name ?? 'Plano'
  const price    = item?.price?.unit_amount ? item.price.unit_amount / 100 : 0

  const { error } = await supabaseAdmin.from('subscriptions').upsert({
    user_id:                userId,
    stripe_subscription_id: sub.id,
    stripe_customer_id:     sub.customer as string,
    stripe_price_id:        item?.price?.id ?? null,
    plan_id:                planId,
    plan_name:              planName,
    price,
    status:                 STATUS_MAP[sub.status] ?? sub.status,
    max_deliveries:         MAX_DELIVERIES[planId] ?? 999999,
    start_date:             new Date(sub.start_date * 1000).toISOString(),
    end_date:               sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
    trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    renewal_date:           new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end:   sub.cancel_at_period_end,
  }, { onConflict: 'user_id' })

  if (error) { console.error('[syncSubscription]', error); throw error }

  await supabaseAdmin
    .from('profiles')
    .update({ stripe_customer_id: sub.customer as string })
    .eq('id', userId)

  console.log(`[webhook] synced: user=${userId} plan=${planId} status=${sub.status}`)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const signature     = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature)     return new Response('Assinatura em falta', { status: 400 })
  if (!webhookSecret) return new Response('Webhook não configurado', { status: 500 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[webhook] Assinatura inválida:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  console.log(`[webhook] ${event.type} | ${event.id}`)

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription' || !session.subscription) break
        const userId = session.metadata?.supabase_user_id
        if (!userId) { console.warn('[webhook] sem supabase_user_id'); break }

        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        if (!sub.metadata?.supabase_user_id) {
          await stripe.subscriptions.update(sub.id, {
            metadata: {
              supabase_user_id: userId,
              plan_id:          session.metadata?.plan_id   ?? '',
              plan_name:        session.metadata?.plan_name ?? '',
            },
          })
        }
        await syncSubscription(userId, sub, session.metadata)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id
        if (!userId) { console.warn(`[webhook] ${event.type} sem supabase_user_id`); break }
        await syncSubscription(userId, sub)
        break
      }

      case 'customer.subscription.trial_will_end': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id
        if (!userId) break
        await supabaseAdmin
          .from('subscriptions')
          .update({ trial_ending_soon: true })
          .eq('stripe_subscription_id', sub.id)
        await supabaseAdmin.from('notifications').insert({
          user_id: userId,
          title:   '⏳ Trial a terminar em breve',
          message: 'O seu período de teste termina em 3 dias. Adicione um método de pagamento para continuar.',
          type:    'trial_ending',
          read:    false,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.supabase_user_id
        if (!userId) break
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status:               'canceled',
            cancel_at_period_end: true,
            end_date:             new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break
        const sub    = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = sub.metadata?.supabase_user_id
        if (!userId) break

        await supabaseAdmin
          .from('subscriptions')
          .update({
            status:        'active',
            current_usage: 0,
            renewal_date:  new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)

        await supabaseAdmin.from('invoices').upsert({
          user_id:                userId,
          stripe_invoice_id:      invoice.id,
          stripe_subscription_id: invoice.subscription as string,
          amount_paid:            (invoice.amount_paid ?? 0) / 100,
          currency:               (invoice.currency ?? 'mzn').toUpperCase(),
          status:                 invoice.status ?? 'paid',
          invoice_pdf:            invoice.invoice_pdf ?? null,
          period_start:           new Date(invoice.period_start * 1000).toISOString(),
          period_end:             new Date(invoice.period_end   * 1000).toISOString(),
          created_at:             new Date().toISOString(),
        }, { onConflict: 'stripe_invoice_id' })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break
        const sub    = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const userId = sub.metadata?.supabase_user_id
        if (!userId) break

        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', invoice.subscription as string)

        await supabaseAdmin.from('notifications').insert({
          user_id: userId,
          title:   '⚠️ Pagamento não processado',
          message: 'O pagamento da sua assinatura ZOMAR falhou. Por favor, actualize os seus dados de pagamento.',
          type:    'payment_failed',
          read:    false,
        })
        break
      }

      default:
        console.log(`[webhook] Evento ignorado: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error(`[webhook] Erro no evento ${event.type}:`, err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})