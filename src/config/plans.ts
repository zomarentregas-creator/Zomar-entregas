/**
 * ============================================================================
 * PLANOS ZOMAR — Fonte única de verdade
 * ============================================================================
 * Todos os componentes devem importar daqui.
 * Moeda: Metical moçambicano (MZN)
 */

export interface Plan {
    id: string
    name: string
    description: string
    price: number           // em MZN
    max_deliveries: number  // 999999 = ilimitado
    coverage: number        // cobertura máxima em MZN
    color: 'blue' | 'emerald' | 'purple'
    badge?: string
    popular?: boolean
    features: string[]
  }
  
  export const PLANS: Plan[] = [
    {
      id: 'plan_basic',
      name: 'Básico',
      description: 'Para empreendedores iniciantes',
      price: 850,
      max_deliveries: 20,
      coverage: 20_000,
      color: 'blue',
      features: [
        'Até 20 entregas por mês',
        'Suporte por e-mail em 24h',
        'Rastreamento básico',
        'Cobertura até 20 000 MZN',
        'Relatórios mensais',
      ],
    },
    {
      id: 'plan_professional',
      name: 'Profissional',
      description: 'Para negócios em crescimento',
      price: 2_800,
      max_deliveries: 100,
      coverage: 80_000,
      color: 'emerald',
      popular: true,
      badge: 'POPULAR',
      features: [
        'Até 100 entregas por mês',
        'Suporte prioritário em 12h',
        'Rastreamento em tempo real',
        'Cobertura até 80 000 MZN',
        'Relatórios semanais detalhados',
        'API de integração básica',
      ],
    },
    {
      id: 'plan_enterprise',
      name: 'Empresarial',
      description: 'Para grandes volumes e equipas',
      price: 4_500,
      max_deliveries: 999_999,
      coverage: 400_000,
      color: 'purple',
      badge: 'RECOMENDADO',
      features: [
        'Entregas ilimitadas',
        'Suporte 24/7 dedicado',
        'Rastreamento avançado',
        'Cobertura até 400 000 MZN',
        'Relatórios personalizados',
        'API completa',
      ],
    },
  ]
  
  /** Mapa rápido: plan_id → cobertura em MZN */
  export const PLAN_COVERAGE: Record<string, number> = Object.fromEntries(
    PLANS.map(p => [p.id, p.coverage])
  )
  
  /** Mapa rápido: plan_id → plano completo */
  export const PLAN_MAP: Record<string, Plan> = Object.fromEntries(
    PLANS.map(p => [p.id, p])
  )
  
  /** Formata valor em Metical moçambicano */
  export const formatMZN = (value: number): string =>
    value.toLocaleString('pt-MZ', {
      style: 'currency',
      currency: 'MZN',
      minimumFractionDigits: 2,
    })