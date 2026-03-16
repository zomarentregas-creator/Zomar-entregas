// src/lib/e2payments.ts
// ─────────────────────────────────────────────────────────────────────────────
// Serviço de integração e2Payments (Explicador Inc.)
// Documentação: https://e2payments.explicador.co.mz/docs/api
//
// COMO USAR:
//   1. Regista-te em: https://e2payments.explicador.co.mz
//   2. Vai a Admin → Credentials e copia o client_id e client_secret
//   3. Vai a Admin → M-Pesa (ou e-Mola) e copia o wallet_id da tua carteira
//   4. Coloca as chaves no ficheiro .env do projecto:
//        VITE_E2PAY_CLIENT_ID=xxxx
//        VITE_E2PAY_CLIENT_SECRET=xxxx
//        VITE_E2PAY_MPESA_WALLET_ID=xxxx
//        VITE_E2PAY_EMOLA_WALLET_ID=xxxx
//        VITE_E2PAY_MKESH_WALLET_ID=xxxx
//        VITE_E2PAY_ENV=sandbox   (ou 'production')
//
// NOTA: Em produção, NUNCA expõe as credenciais no frontend.
//       Move as chamadas à API para uma Supabase Edge Function.
//       Este ficheiro é adequado para testes/sandbox.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://e2payments.explicador.co.mz/v1'

// ─── Configuração ─────────────────────────────────────────────────────────────

interface E2PayConfig {
  clientId:       string
  clientSecret:   string
  mpesaWalletId?: string
  emolaWalletId?: string
  mkeshWalletId?: string
  environment:    'sandbox' | 'production'
}

// Lê do .env (Vite) — substitui por valores reais após registo
const CONFIG: E2PayConfig = {
  clientId:       import.meta.env.VITE_E2PAY_CLIENT_ID       || 'SANDBOX_CLIENT_ID',
  clientSecret:   import.meta.env.VITE_E2PAY_CLIENT_SECRET   || 'SANDBOX_CLIENT_SECRET',
  mpesaWalletId:  import.meta.env.VITE_E2PAY_MPESA_WALLET_ID || '',
  emolaWalletId:  import.meta.env.VITE_E2PAY_EMOLA_WALLET_ID || '',
  mkeshWalletId:  import.meta.env.VITE_E2PAY_MKESH_WALLET_ID || '',
  environment:    (import.meta.env.VITE_E2PAY_ENV as 'sandbox' | 'production') || 'sandbox',
}

// ─── Tipos de resposta ────────────────────────────────────────────────────────

export type PaymentProvider = 'mpesa' | 'emola' | 'mkesh'

export interface PaymentRequest {
  phone:     string   // 9 dígitos sem DDI: 84xxxxxxx | 86xxxxxxx | 87xxxxxxx
  amount:    number   // MZN — mínimo 1, máximo 1.250.000
  reference: string   // Referência interna (ex: 'SUB-xxxx')
  provider?: PaymentProvider  // auto-detectado pelo número se omitido
}

export interface PaymentResult {
  success:   boolean
  reference: string
  provider:  PaymentProvider
  message:   string
  transactionId?: string
  raw?:       any
}

export interface PaymentStatus {
  transactionId: string
  status:        'pending' | 'completed' | 'failed' | 'cancelled'
  amount:        number
  phone:         string
  reference:     string
  createdAt:     string
}

// ─── Detecção automática de operador ─────────────────────────────────────────
// M-Pesa (Vodacom): 84xxx, 85xxx
// e-Mola (Movitel): 86xxx, 87xxx
// M-Kesh (BIM):     83xxx (menos comum)

export function detectProvider(phone: string): PaymentProvider | null {
  const clean = phone.replace(/\s|\+258|^0/, '').replace(/^258/, '')
  if (!clean || clean.length !== 9) return null
  const prefix = parseInt(clean.slice(0, 2))
  if (prefix === 84 || prefix === 85) return 'mpesa'
  if (prefix === 86 || prefix === 87) return 'emola'
  if (prefix === 83)                  return 'mkesh'
  return null
}

export function formatPhone(phone: string): string {
  return phone.replace(/\s|\+258|^0/, '').replace(/^258/, '').slice(0, 9)
}

export function validatePhone(phone: string): { valid: boolean; provider: PaymentProvider | null; message: string } {
  const clean = formatPhone(phone)
  if (clean.length !== 9) return { valid: false, provider: null, message: 'O número deve ter 9 dígitos.' }
  const provider = detectProvider(clean)
  if (!provider) return { valid: false, provider: null, message: 'Número não reconhecido (M-Pesa: 84/85, e-Mola: 86/87, M-Kesh: 83).' }
  return { valid: true, provider, message: `Número ${provider.toUpperCase()} válido.` }
}

// ─── Token de acesso ─────────────────────────────────────────────────────────

let cachedToken:   string | null = null
let tokenExpiry:   number        = 0

async function getAccessToken(): Promise<string> {
  // Reutilizar token se ainda válido (margem de 60s)
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      client_id:     CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
      grant_type:    'client_credentials',
    }),
  })

  if (!res.ok) throw new Error(`Autenticação e2Payments falhou: ${res.status}`)

  const data = await res.json()
  cachedToken = data.access_token
  // Tokens expiram tipicamente em 3600s
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000
  return cachedToken!
}

// ─── Cabeçalhos autenticados ──────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  return {
    'Authorization': `Bearer ${token}`,
    'Accept':        'application/json',
    'Content-Type':  'application/json',
  }
}

// ─── SANDBOX: simular resposta sem chamada real ───────────────────────────────
// Quando VITE_E2PAY_ENV=sandbox, as chamadas são simuladas localmente.
// Não precisas de credenciais reais — útil para testar o fluxo de UI.

function sandboxResponse(req: PaymentRequest, provider: PaymentProvider): PaymentResult {
  const isSandbox = CONFIG.environment === 'sandbox'
  const ref = `${provider.toUpperCase().slice(0, 3)}-SANDBOX-${Date.now()}`

  // Simula falha para números que terminam em 000 (para testar error handling)
  const shouldFail = req.phone.endsWith('000')

  if (isSandbox) {
    console.info(`[e2Payments SANDBOX] ${provider.toUpperCase()} C2B:`, {
      phone: req.phone, amount: req.amount, reference: req.reference,
    })
  }

  if (shouldFail) {
    return {
      success:   false,
      reference: req.reference,
      provider,
      message:   'Saldo insuficiente (simulação de erro sandbox).',
    }
  }

  return {
    success:       true,
    reference:     req.reference,
    provider,
    message:       `Pagamento ${provider.toUpperCase()} processado com sucesso (sandbox).`,
    transactionId: ref,
  }
}

// ─── M-Pesa C2B ──────────────────────────────────────────────────────────────

export async function mpesaC2B(req: PaymentRequest): Promise<PaymentResult> {
  if (!CONFIG.mpesaWalletId) throw new Error('VITE_E2PAY_MPESA_WALLET_ID não configurado.')
  if (CONFIG.environment === 'sandbox') {
    await new Promise(r => setTimeout(r, 1200)) // simular latência
    return sandboxResponse(req, 'mpesa')
  }

  try {
    const headers = await authHeaders()
    const res = await fetch(`${BASE_URL}/c2b/mpesa-payment/${CONFIG.mpesaWalletId}`, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        client_id: CONFIG.clientId,
        amount:    String(req.amount),
        phone:     formatPhone(req.phone),
        reference: req.reference,
      }),
    })
    const data = await res.json()
    return {
      success:       !!data?.status || res.ok,
      reference:     req.reference,
      provider:      'mpesa',
      message:       data?.message || (res.ok ? 'Pagamento iniciado.' : 'Erro no pagamento.'),
      transactionId: data?.transaction_id,
      raw:           data,
    }
  } catch (e: any) {
    return { success: false, reference: req.reference, provider: 'mpesa', message: e.message || 'Erro de rede.' }
  }
}

// ─── e-Mola C2B ──────────────────────────────────────────────────────────────

export async function emolaC2B(req: PaymentRequest): Promise<PaymentResult> {
  if (!CONFIG.emolaWalletId) throw new Error('VITE_E2PAY_EMOLA_WALLET_ID não configurado.')
  if (CONFIG.environment === 'sandbox') {
    await new Promise(r => setTimeout(r, 1200))
    return sandboxResponse(req, 'emola')
  }

  try {
    const headers = await authHeaders()
    const res = await fetch(`${BASE_URL}/c2b/emola-payment/${CONFIG.emolaWalletId}`, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        client_id: CONFIG.clientId,
        amount:    String(req.amount),
        phone:     formatPhone(req.phone),
        reference: req.reference,
      }),
    })
    const data = await res.json()
    return {
      success:       !!data?.status || res.ok,
      reference:     req.reference,
      provider:      'emola',
      message:       data?.message || (res.ok ? 'Pagamento iniciado.' : 'Erro no pagamento.'),
      transactionId: data?.transaction_id,
      raw:           data,
    }
  } catch (e: any) {
    return { success: false, reference: req.reference, provider: 'emola', message: e.message || 'Erro de rede.' }
  }
}

// ─── M-Kesh C2B ──────────────────────────────────────────────────────────────

export async function mkeshC2B(req: PaymentRequest): Promise<PaymentResult> {
  if (!CONFIG.mkeshWalletId) throw new Error('VITE_E2PAY_MKESH_WALLET_ID não configurado.')
  if (CONFIG.environment === 'sandbox') {
    await new Promise(r => setTimeout(r, 1200))
    return sandboxResponse(req, 'mkesh')
  }

  try {
    const headers = await authHeaders()
    // M-Kesh usa endpoint similar ao e-Mola na API e2Payments
    const res = await fetch(`${BASE_URL}/c2b/mkesh-payment/${CONFIG.mkeshWalletId}`, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        client_id: CONFIG.clientId,
        amount:    String(req.amount),
        phone:     formatPhone(req.phone),
        reference: req.reference,
      }),
    })
    const data = await res.json()
    return {
      success:       !!data?.status || res.ok,
      reference:     req.reference,
      provider:      'mkesh',
      message:       data?.message || (res.ok ? 'Pagamento iniciado.' : 'Erro no pagamento.'),
      transactionId: data?.transaction_id,
      raw:           data,
    }
  } catch (e: any) {
    return { success: false, reference: req.reference, provider: 'mkesh', message: e.message || 'Erro de rede.' }
  }
}

// ─── Função principal — auto-detecção de operador ────────────────────────────

export async function processPayment(req: PaymentRequest): Promise<PaymentResult> {
  const provider = req.provider || detectProvider(req.phone)
  if (!provider) throw new Error('Número de telefone inválido ou operador não suportado.')

  switch (provider) {
    case 'mpesa': return mpesaC2B({ ...req, provider })
    case 'emola': return emolaC2B({ ...req, provider })
    case 'mkesh': return mkeshC2B({ ...req, provider })
  }
}

// ─── Verificar estado de transacção ──────────────────────────────────────────

export async function checkPaymentStatus(provider: PaymentProvider, transactionId: string): Promise<PaymentStatus | null> {
  if (CONFIG.environment === 'sandbox') {
    // Sandbox: simular estado 'completed' após 3s
    return {
      transactionId,
      status:    'completed',
      amount:    0,
      phone:     '',
      reference: '',
      createdAt: new Date().toISOString(),
    }
  }

  try {
    const headers  = await authHeaders()
    const endpoint = `${BASE_URL}/payments/${provider}/get/${transactionId}`
    const res      = await fetch(endpoint, { method: 'GET', headers })
    if (!res.ok) return null
    const data = await res.json()
    return {
      transactionId: data.transaction_id || transactionId,
      status:        data.status || 'pending',
      amount:        Number(data.amount) || 0,
      phone:         data.phone || '',
      reference:     data.reference || '',
      createdAt:     data.created_at || new Date().toISOString(),
    }
  } catch { return null }
}

// ─── Guardar transacção no Supabase ──────────────────────────────────────────
// Chama após processPayment bem-sucedido para ter histórico

import { supabase } from './supabase'

export async function recordPaymentTransaction(params: {
  userId:        string
  subscriptionId?: string
  provider:      PaymentProvider
  amount:        number
  phone:         string
  reference:     string
  transactionId: string
  status:        'pending' | 'completed' | 'failed'
}) {
  try {
    await supabase.from('payment_transactions').insert({
      user_id:         params.userId,
      subscription_id: params.subscriptionId || null,
      provider:        params.provider,
      amount:          params.amount,
      phone:           params.phone,
      reference:       params.reference,
      transaction_id:  params.transactionId,
      status:          params.status,
      created_at:      new Date().toISOString(),
    })
  } catch (e) {
    console.error('Erro ao registar transacção:', e)
    // Falha silenciosa — não bloquear o fluxo de pagamento
  }
}

// ─── Exportar configuração actual (útil para debug) ──────────────────────────

export const isSandbox = () => CONFIG.environment === 'sandbox'
export const e2payConfig = CONFIG