// Utilitários de rastreio: etapas, link público e mensagem de partilha.
export interface TrackCheckpoint { status: string; description: string; at: string }

export interface TrackResult {
  found: boolean
  rate_limited?: boolean
  status?: string
  item_type?: string
  origin_area?: string
  destination_area?: string
  created_at?: string
  picked_up_at?: string | null
  delivered_at?: string | null
  scheduled_at?: string | null
  deliverer_first_name?: string | null
  checkpoints?: TrackCheckpoint[]
}

export interface TrackStep { key: string; label: string; hint: string; at: string | null; done: boolean; current: boolean }

const ORDER = ['created', 'accepted', 'in_progress', 'completed'] as const
const LABELS: Record<string, [string, string]> = {
  created:     ['Pedido criado',        'À espera de um entregador'],
  accepted:    ['Entregador atribuído', 'A caminho para recolher'],
  in_progress: ['Item recolhido',       'A caminho do destino'],
  completed:   ['Entregue',             'Entrega confirmada com código'],
}

/** Constrói as 4 etapas a partir do estado e dos checkpoints. */
export function buildSteps(status: string, cps: { status: string; at?: string; created_at?: string }[]): TrackStep[] {
  const at = (s: string) => {
    const hit = cps.find(c => c.status === s || (s === 'created' && c.status === 'scheduled'))
    return hit ? (hit.at ?? hit.created_at ?? null) : null
  }
  const idx = status === 'scheduled' ? 0 : ORDER.indexOf(status as typeof ORDER[number])
  // cancelado/problema: mostra até à última etapa com registo
  const reached = idx >= 0 ? idx : Math.max(0, ...ORDER.map((k, i) => (at(k) ? i : 0)))
  return ORDER.map((k, i) => ({
    key: k, label: LABELS[k][0], hint: LABELS[k][1], at: at(k),
    done: i < reached || (k === 'completed' && status === 'completed'),
    current: i === reached && status !== 'completed',
  }))
}

export const trackingUrl = (code: string) => `${window.location.origin}/rastreio/${encodeURIComponent(code)}`

export const trackingShareText = (item: string, code: string) =>
  `Olá! A sua encomenda (${item}) está a ser entregue pela ZOMAR. Acompanhe aqui: ${trackingUrl(code)}`

export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'agora mesmo'
  const m = Math.round(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.round(h / 24)} d`
}
