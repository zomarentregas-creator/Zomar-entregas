// src/config/payments.ts
// Pagamentos manuais (sem cartão): o cliente paga por carteira móvel/transferência,
// envia o comprovativo por WhatsApp e a equipa activa o plano no painel de admin.

export const WHATSAPP_NUMBER = '258842589799'
export const WHATSAPP_DISPLAY = '+258 84 258 9799'

/**
 * Contas ZOMAR que recebem pagamentos. Preencher quando estiverem definidas, ex.:
 *   { label: 'M-Pesa (Vodacom)', value: '+258 84 ... ....' }
 * Se ficar vazio, a app pede ao cliente que solicite os dados por WhatsApp.
 */
export const PAYMENT_ACCOUNTS: { label: string; value: string }[] = [
  { label: 'e-Mola (Movitel)', value: '+258 87 881 9635' },
]

export const whatsappLink = (text: string): string =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
