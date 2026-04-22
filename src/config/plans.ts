// src/config/plans.ts
// ═══════════════════════════════════════════════════════════════
// FONTE ÚNICA DE VERDADE — Planos ZOMAR
// ═══════════════════════════════════════════════════════════════

export interface Plan {
  id:               string
  name:             string
  description:      string
  price:            number          // MZN/mês
  max_deliveries:   number          // 999_999 = ilimitado
  coverage:         number          // cobertura máxima em MZN
  color:            'blue' | 'emerald' | 'purple'
  badge?:           string
  popular?:         boolean
  features:         string[]
  // Stripe — preencher após criar os produtos no Stripe Dashboard
  // Stripe Dashboard → Products → Add product → Add price (recurring/monthly)
  stripe_price_id:  string | null   // ex: 'price_1QxxxBASIC'  — null = Stripe não configurado
}

export const PLANS: Plan[] = [
  {
    id:              'basic',
    name:            'Básico',
    description:     'Para empreendedores iniciantes',
    price:           750,
    max_deliveries:  30,
    coverage:        30_000,
    color:           'blue',
    stripe_price_id: null, // TODO: substituir por 'price_xxx' após criar no Stripe
    features: [
      '30 entregas por mês',
      'Entregas extra: 28 MZN cada',
      'Suporte por e-mail em 24h',
      'Rastreamento básico',
      'Cobertura até 30 000 MZN',
      'Relatórios mensais',
    ],
  },
  {
    id:              'professional',
    name:            'Profissional',
    description:     'Para negócios em crescimento',
    price:           2_200,
    max_deliveries:  100,
    coverage:        100_000,
    color:           'emerald',
    popular:         true,
    badge:           'POPULAR',
    stripe_price_id: null, // TODO: substituir por 'price_xxx' após criar no Stripe
    features: [
      '100 entregas por mês',
      'Entregas extra: 22 MZN cada',
      'Suporte prioritário em 12h',
      'Rastreamento em tempo real',
      'Cobertura até 100 000 MZN',
      'Relatórios semanais detalhados',
      'API de integração básica',
    ],
  },
  {
    id:              'enterprise',
    name:            'Empresarial',
    description:     'Para grandes volumes e equipas',
    price:           3_800,
    max_deliveries:  999_999,
    coverage:        500_000,
    color:           'purple',
    badge:           'RECOMENDADO',
    stripe_price_id: null, // TODO: substituir por 'price_xxx' após criar no Stripe
    features: [
      'Entregas ilimitadas',
      'Suporte 24/7 dedicado',
      'Rastreamento avançado',
      'Cobertura até 500 000 MZN',
      'Relatórios personalizados',
      'API completa',
      'Gestor de conta dedicado',
    ],
  },
]

/** Stripe está configurado se pelo menos um plano tem price_id */
export const stripeEnabled = (): boolean =>
  PLANS.some(p => p.stripe_price_id !== null)

/** Mapa rápido: plan_id → plano completo */
export const PLAN_MAP: Record<string, Plan> = Object.fromEntries(
  PLANS.map(p => [p.id, p])
)

/** Mapa rápido: plan_id → cobertura em MZN */
export const PLAN_COVERAGE: Record<string, number> = Object.fromEntries(
  PLANS.map(p => [p.id, p.coverage])
)

/** Formata valor em Metical moçambicano */
export const formatMZN = (value: number): string =>
  new Intl.NumberFormat('pt-MZ', {
    style:                 'currency',
    currency:              'MZN',
    minimumFractionDigits: 0,
  }).format(value)