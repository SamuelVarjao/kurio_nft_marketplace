/**
 * API de controle da camada de mocks — `window.__KURIO_MOCKS__`.
 *
 * É o gatilho usado pelo Playwright (via `page.evaluate`) e pelo console do
 * navegador para disparar eventos e falhas SEM passar pela UI da
 * aplicação: as mudanças acontecem no "servidor" simulado e chegam ao app
 * pelas mesmas vias de produção (REST via MSW e eventos via socket.io-client).
 */
import type { EditionKind } from '@/contracts'
import { db, now, persist, resetDb } from './db/store'
import { clearOrderTimers, findEdition, mutateNft, resetCheckoutMutation, resolveOrder } from './domain/commerce'
import { resetOrderTimeout } from './handlers/orders'
import { realtimeControl } from './realtime'
import {
  failNext,
  getScenario,
  resetCounters,
  SCENARIOS,
  setScenario,
  type RouteKey,
} from './scenarios'

function editionOf(nftId: string, kind: EditionKind) {
  const nft = db.nfts[nftId]
  if (!nft) throw new Error(`NFT inexistente: ${nftId}`)
  const ed = nft.editions.find((e) => e.kind === kind)
  if (!ed) throw new Error(`Edição inexistente: ${kind}`)
  return ed
}

export const mockControl = {
  scenarios: () => SCENARIOS.map(({ id, label, description }) => ({ id, label, description })),
  scenario: () => getScenario().id,
  setScenario(id: string) {
    setScenario(id)
    resetCheckoutMutation()
    resetOrderTimeout()
  },
  /** restaura integralmente o cenário conhecido (fixtures + contadores) */
  reset() {
    clearOrderTimers()
    resetDb()
    resetCounters()
    resetCheckoutMutation()
    resetOrderTimeout()
  },
  /**
   * Reset completo para demonstração: restaura as fixtures, apaga sessão,
   * carrinho do visitante e tentativas de checkout guardados no navegador e
   * recarrega a página (o cenário escolhido é mantido).
   */
  resetAll() {
    mockControl.reset()
    try {
      for (const key of Object.keys(localStorage))
        if (key.startsWith('kurio:') && key !== 'kurio:mock-scenario') localStorage.removeItem(key)
      for (const key of Object.keys(sessionStorage)) if (key.startsWith('kurio:')) sessionStorage.removeItem(key)
    } catch {
      /* storage indisponível */
    }
    location.reload()
  },
  failNext(route: RouteKey, status: number | 'network' = 500, times = 1) {
    failNext(route, status, times)
  },
  nft: {
    setPrice(nftId: string, price: string, kind: EditionKind = '1/50') {
      const ed = editionOf(nftId, kind)
      return mutateNft(nftId, (nft) => {
        findEdition(nft, ed.id)!.price = price
      })
    },
    setAvailability(nftId: string, available: number | null, kind: EditionKind = '1/50') {
      const ed = editionOf(nftId, kind)
      return mutateNft(nftId, (nft) => {
        findEdition(nft, ed.id)!.available = available
      })
    },
    get: (nftId: string) => structuredClone(db.nfts[nftId]),
  },
  socket: {
    disconnect: (blockMs = 0) => realtimeControl.disconnectAll(blockMs),
    block: (value: boolean) => realtimeControl.setBlocked(value),
    replayLast: () => realtimeControl.replayLast(),
    emitStale: (nftId: string, price?: string) => realtimeControl.emitStale(nftId, price),
    emitForeignOrder: (userId: string) => realtimeControl.emitForeignOrder(userId),
    connections: () => realtimeControl.connections(),
    history: () => realtimeControl.history(),
  },
  session: {
    /** expira todas as sessões ativas (próxima chamada autenticada → 401 SESSION_EXPIRED) */
    expireAll() {
      for (const s of Object.values(db.sessions)) s.expiresAt = now() - 1
      persist()
    },
  },
  orders: {
    list: () => Object.values(db.orders).map((o) => ({ id: o.id, status: o.status, userId: o.userId, key: o.idempotencyKey })),
    resolve: (orderId: string) => resolveOrder(orderId)?.status,
    count: () => Object.keys(db.orders).length,
  },
  cart: {
    raw: () => structuredClone(db.carts),
  },
}

export type MockControl = typeof mockControl

declare global {
  interface Window {
    __KURIO_MOCKS__?: MockControl
  }
}

export function installControl() {
  window.__KURIO_MOCKS__ = mockControl
}
