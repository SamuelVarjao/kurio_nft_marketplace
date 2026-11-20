/**
 * Cenários determinísticos e condições de rede.
 *
 * Seleção (ordem de precedência):
 *   1. `?scenario=<id>` na URL (persistido para os próximos carregamentos)
 *   2. localStorage `kurio:mock-scenario`
 *   3. `VITE_MOCK_SCENARIO` (build)
 *   4. `default`
 *
 * Em runtime: `window.__KURIO_MOCKS__.setScenario(id)` (console ou Playwright).
 */
export type RouteKey =
  | 'auth'
  | 'catalog'
  | 'nft'
  | 'favorites'
  | 'cart'
  | 'quote'
  | 'orders'
  | 'profile'
  | 'wallets'

export interface ScenarioConfig {
  id: string
  label: string
  description: string
  /** latência base por requisição (ms). min=max → fixa */
  latency: { min: number; max: number }
  /** latências alternadas longa/curta no catálogo → respostas fora de ordem */
  outOfOrder?: boolean
  catalogEmpty?: boolean
  offline?: boolean
  /** força status HTTP em rotas específicas; `times` = só as N primeiras */
  httpError?: { routes: RouteKey[]; status: 401 | 403 | 404 | 429 | 500 | 502 | 503; times?: number }
  sessionTtlMs: number
  favoritesFail?: boolean
  priceChangeOnCheckout?: boolean
  soldOutOnCheckout?: boolean
  /** primeira criação de pedido responde depois do timeout do cliente */
  orderTimeout?: boolean
  paymentOutcome: 'confirmed' | 'rejected'
  walletRejects?: boolean
  orderResolveMs: number
}

const BASE: Omit<ScenarioConfig, 'id' | 'label' | 'description'> = {
  latency: { min: 120, max: 380 },
  sessionTtlMs: 30 * 60_000,
  paymentOutcome: 'confirmed',
  orderResolveMs: 4_000,
}

const define = (c: Partial<ScenarioConfig> & Pick<ScenarioConfig, 'id' | 'label' | 'description'>): ScenarioConfig => ({
  ...BASE,
  ...c,
})

export const SCENARIOS: ScenarioConfig[] = [
  define({ id: 'default', label: 'Padrão', description: 'Sucesso com latência realista (120–380 ms).' }),
  define({ id: 'fast', label: 'Instantâneo', description: 'Sem latência (usado em testes e regressão visual).', latency: { min: 0, max: 0 }, orderResolveMs: 1_500 }),
  define({ id: 'empty', label: 'Catálogo vazio', description: 'A busca nunca encontra resultados.', catalogEmpty: true }),
  define({ id: 'slow', label: 'Rede lenta', description: 'Latência fixa de 2,5 s — exibe skeletons.', latency: { min: 2_500, max: 2_500 } }),
  define({ id: 'variable-latency', label: 'Latência variável', description: 'Respostas do catálogo chegam fora de ordem (1,6 s / 150 ms alternados).', latency: { min: 80, max: 1_200 }, outOfOrder: true }),
  define({ id: 'offline', label: 'Sem conexão', description: 'Toda requisição falha com erro de rede; o socket não conecta.', offline: true }),
  define({ id: 'server-error', label: 'Erro 500 transitório', description: 'Catálogo e detalhe respondem 500 nas 3 primeiras tentativas e depois se recuperam.', httpError: { routes: ['catalog', 'nft'], status: 500, times: 3 } }),
  define({ id: 'unavailable', label: 'Serviço indisponível', description: 'Catálogo responde 503 sempre.', httpError: { routes: ['catalog'], status: 503 } }),
  define({ id: 'forbidden', label: 'Acesso negado', description: 'Perfil e carteiras respondem 403.', httpError: { routes: ['profile', 'wallets'], status: 403 } }),
  define({ id: 'session-expired', label: 'Sessão curta', description: 'A sessão expira 45 s após o login.', sessionTtlMs: 45_000 }),
  define({ id: 'favorites-fail', label: 'Favoritos falham', description: 'Incluir/remover favorito responde 500 (testa rollback otimista).', favoritesFail: true }),
  define({ id: 'price-change', label: 'Preço muda no checkout', description: '3 s após a cotação, o preço do primeiro item sobe 0.10 ETH (via nft.updated).', priceChangeOnCheckout: true }),
  define({ id: 'sold-out', label: 'Esgota no checkout', description: '3 s após a cotação, a edição do primeiro item esgota (via nft.updated).', soldOutOnCheckout: true }),
  define({ id: 'order-timeout', label: 'Timeout no pedido', description: 'O pedido é criado, mas a primeira resposta chega após o timeout do cliente; o reenvio com a mesma chave recupera o mesmo pedido.', orderTimeout: true }),
  define({ id: 'payment-declined', label: 'Pagamento recusado', description: 'Pedidos terminam recusados.', paymentOutcome: 'rejected' }),
  define({ id: 'wallet-rejects', label: 'Carteira recusa', description: 'A carteira recusa a solicitação de conexão.', walletRejects: true }),
]

export const SCENARIO_STORAGE_KEY = 'kurio:mock-scenario'

export function findScenario(id: string | null | undefined): ScenarioConfig | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

function initialScenario(): ScenarioConfig {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('scenario')
    if (fromUrl && findScenario(fromUrl)) {
      localStorage.setItem(SCENARIO_STORAGE_KEY, fromUrl)
      return findScenario(fromUrl)!
    }
    const stored = localStorage.getItem(SCENARIO_STORAGE_KEY)
    if (stored && findScenario(stored)) return findScenario(stored)!
  } catch {
    /* ignore */
  }
  return findScenario(import.meta.env.VITE_MOCK_SCENARIO) ?? SCENARIOS[0]
}

let current = initialScenario()
const listeners = new Set<(s: ScenarioConfig) => void>()

export function getScenario() {
  return current
}

export function setScenario(id: string) {
  const next = findScenario(id)
  if (!next) throw new Error(`Cenário desconhecido: ${id}`)
  current = next
  errorCounters.clear()
  try {
    localStorage.setItem(SCENARIO_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(current))
}

export function onScenarioChange(listener: (s: ScenarioConfig) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/* --------------------------------------------------- falhas sob demanda */

/** contador de erros já servidos por rota (para `times`) */
export const errorCounters = new Map<RouteKey, number>()

/** falhas pontuais injetadas via controle (`failNext`). */
const queued: { route: RouteKey; status: number | 'network'; remaining: number }[] = []

export function failNext(route: RouteKey, status: number | 'network' = 500, times = 1) {
  queued.push({ route, status, remaining: times })
}

export function takeQueuedFailure(route: RouteKey): number | 'network' | null {
  const item = queued.find((q) => q.route === route && q.remaining > 0)
  if (!item) return null
  item.remaining -= 1
  if (item.remaining === 0) queued.splice(queued.indexOf(item), 1)
  return item.status
}

export function clearQueuedFailures() {
  queued.length = 0
  errorCounters.clear()
}

/* ------------------------------------------------------ latência */

let requestCounter = 0
let catalogCounter = 0

/** Latência determinística: PRNG linear sobre o contador de requisições. */
export function nextLatency(route: RouteKey): number {
  const { latency, outOfOrder } = current
  if (outOfOrder && route === 'catalog') {
    catalogCounter += 1
    // 1ª, 3ª, 5ª... lentas; 2ª, 4ª... rápidas → a anterior chega depois
    return catalogCounter % 2 === 1 ? 1_600 : 150
  }
  requestCounter += 1
  if (latency.max <= latency.min) return latency.min
  const t = ((requestCounter * 2654435761) >>> 0) / 4294967296
  return Math.round(latency.min + t * (latency.max - latency.min))
}

export function resetCounters() {
  requestCounter = 0
  catalogCounter = 0
  clearQueuedFailures()
}
