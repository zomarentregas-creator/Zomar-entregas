// supabase/functions/withdraw/index.ts

// FIX: import em falta — createClient não estava importado
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MPESA_BASE           = 'https://api.sandbox.vm.co.mz' // trocar para produção depois
const SERVICE_PROVIDER_CODE = Deno.env.get('MPESA_SERVICE_PROVIDER_CODE') ?? ''
const API_KEY               = Deno.env.get('MPESA_API_KEY')               ?? ''
const PUBLIC_KEY            = Deno.env.get('MPESA_PUBLIC_KEY')             ?? ''

// FIX: headers CORS em falta — bloqueava chamadas do browser
const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function getAccessToken(): Promise<string> {
  const auth = btoa(`${API_KEY}:${PUBLIC_KEY}`)
  const res  = await fetch(
    `${MPESA_BASE}/ipg/v1x/auth/oauth/v1/generate?grant_type=client_credentials`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/json',
      },
    }
  )
  if (!res.ok) {
    throw new Error(`M-Pesa auth falhou: ${res.status}`)
  }
  const data = await res.json()
  if (!data.access_token) {
    throw new Error('Token M-Pesa não recebido')
  }
  return data.access_token
}

serve(async (req) => {
  // FIX: responder ao preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validar autenticação do utilizador
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

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Body JSON inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { amount, method, phoneNumber, bankData } = body

  // Garantir que o user_id vem do token autenticado, não do body (segurança)
  const userId = user.id

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return new Response(
      JSON.stringify({ error: 'Valor inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!method) {
    return new Response(
      JSON.stringify({ error: 'Método de pagamento obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (method === 'm-pesa' && !phoneNumber) {
    return new Response(
      JSON.stringify({ error: 'Número de telefone obrigatório para M-Pesa' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (method === 'bank_transfer' && !bankData) {
    return new Response(
      JSON.stringify({ error: 'Dados bancários obrigatórios para transferência' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const FEE       = 10
  const netAmount = Math.floor(amount - FEE)

  if (netAmount <= 0) {
    return new Response(
      JSON.stringify({ error: `Valor mínimo de levantamento: ${FEE + 1} MZN` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let status: string   = 'pending'
  let errorMsg: string | null = null

  // ── Processar M-Pesa ───────────────────────────────────────────────────────
  if (method === 'm-pesa') {
    try {
      const token = await getAccessToken()

      const payoutRes = await fetch(`${MPESA_BASE}/ipg/v1x/b2cPayment/`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
          'Origin':        Deno.env.get('APP_URL') ?? 'http://localhost:5173',
        },
        body: JSON.stringify({
          input_TransactionReference: `WD_${Date.now()}`,
          input_CustomerMSISDN:       phoneNumber.replace('+258', '').replace(/\s/g, ''),
          input_Amount:               netAmount.toString(),
          input_ThirdPartyReference:  `user_${userId}`,
          input_ServiceProviderCode:  SERVICE_PROVIDER_CODE,
        }),
      })

      const payoutData = await payoutRes.json()

      if (payoutRes.ok && payoutData.output_ResponseCode === 'INS-0') {
        status = 'completed'
      } else {
        throw new Error(
          payoutData.output_ResponseDesc ??
          payoutData.ErrorMessage        ??
          'Falha no payout M-Pesa'
        )
      }
    } catch (err) {
      errorMsg = (err as Error).message
      console.error('[withdraw] M-Pesa error:', errorMsg)
      // status permanece 'pending' para revisão manual
    }
  }
  // Para e-mola, mkesh, bank_transfer: fica pending (processamento manual)

  // ── Guardar no Supabase ────────────────────────────────────────────────────
  // FIX: createClient estava a ser chamado sem import — agora está importado no topo
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')              ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { error: dbError } = await supabaseAdmin.from('withdrawals').insert({
    user_id:        userId,
    amount,
    net_amount:     netAmount,
    fee:            FEE,
    payment_method: method,
    phone_number:   method !== 'bank_transfer' ? phoneNumber : null,
    bank_data:      method === 'bank_transfer'  ? JSON.stringify(bankData) : null,
    status,
    requested_at:   new Date().toISOString(),
    error_message:  errorMsg,
  })

  if (dbError) {
    console.error('[withdraw] DB insert error:', dbError)
    return new Response(
      JSON.stringify({ error: 'Falha ao registar o levantamento' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true, status, net_amount: netAmount }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})