/**
 * Aplicação idempotente de eventos em tempo real ao cache do TanStack Query.
 *
 * Regras:
 * - `eventId` já visto → descartado (duplicata).
 * - `version` <= maior versão conhecida do recurso (via evento OU via REST) →
 *   descartado (evento antigo nunca regride estado mais recente).
 * - `order.updated` de outro usuário → descartado (isolamento de sessão).
 * - Pedidos confirmados/recusados são terminais.
 */
import type { QueryClient } from '@tanstack/react-query'
import type {
  CartResponse,
  CatalogResponse,
  FeaturedResponse,
  NftDetail,
  NftSummary,
  NftUpdatedEvent,
  Order,
  OrderUpdatedEvent,
  RealtimeEvent,
} from '@/contracts'
import { compareEth, formatEth } from '@/lib/eth'
import { notify } from '@/lib/announce'
import { qk } from '@/lib/query'

const MAX_SEEN = 500
const seen = new Set<string>()
const versions = new Map<string, number>()

type BusListener<E> = (event: E) => void
const bus = {
  nft: new Set<BusListener<NftUpdatedEvent>>(),
  order: new Set<BusListener<OrderUpdatedEvent>>(),
}

export const realtimeBus = {
  onNft(l: BusListener<NftUpdatedEvent>) {
    bus.nft.add(l)
    return () => {
      bus.nft.delete(l)
    }
  },
  onOrder(l: BusListener<OrderUpdatedEvent>) {
    bus.order.add(l)
    return () => {
      bus.order.delete(l)
    }
  },
}

export const realtimeStats = { applied: 0, duplicates: 0, stale: 0, foreign: 0 }

function remember(eventId: string) {
  seen.add(eventId)
  if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value as string)
}

/** Decide se o evento deve ser aplicado; `cachedVersion` vem do REST. */
export function shouldApply(event: RealtimeEvent, cachedVersion = 0): boolean {
  if (seen.has(event.eventId)) {
    realtimeStats.duplicates += 1
    return false
  }
  remember(event.eventId)
  const key = `${event.resource.type}:${event.resource.id}`
  const known = Math.max(versions.get(key) ?? 0, cachedVersion)
  if (event.version <= known) {
    realtimeStats.stale += 1
    return false
  }
  versions.set(key, event.version)
  return true
}

/** Esquece versões de pedidos (troca de usuário); NFTs são públicos. */
export function resetPrivateRealtimeMemory() {
  for (const key of [...versions.keys()]) if (key.startsWith('order:')) versions.delete(key)
}

function patchSummary<T extends NftSummary>(item: T, e: NftUpdatedEvent): T {
  if (item.id !== e.resource.id || item.version >= e.version) return item
  return { ...item, price: e.data.price, previousPrice: e.data.previousPrice, soldOut: e.data.soldOut, version: e.version }
}

export function applyNftUpdated(qc: QueryClient, e: NftUpdatedEvent) {
  const id = e.resource.id
  const detail = qc.getQueryData<NftDetail>(qk.nft(id))
  if (!shouldApply(e, detail?.version ?? 0)) return false
  realtimeStats.applied += 1

  if (detail) {
    qc.setQueryData<NftDetail>(qk.nft(id), {
      ...detail,
      ...patchSummary(detail, e),
      editions: detail.editions.map((ed) => {
        const next = e.data.editions.find((x) => x.id === ed.id)
        return next ? { ...ed, price: next.price, available: next.available } : ed
      }),
    })
  }
  qc.setQueriesData<CatalogResponse>({ queryKey: qk.catalogAll }, (old) =>
    old ? { ...old, items: old.items.map((i) => patchSummary(i, e)) } : old,
  )
  qc.setQueriesData<{ items: NftSummary[] }>({ queryKey: ['related'] }, (old) =>
    old ? { ...old, items: old.items.map((i) => patchSummary(i, e)) } : old,
  )
  qc.setQueryData<FeaturedResponse>(qk.featured, (old) =>
    old ? { hero: old.hero.map((i) => patchSummary(i, e)), spotlight: patchSummary(old.spotlight, e) } : old,
  )

  // carrinho: o servidor recalcula status/linhas; avisamos o usuário do que mudou
  for (const [key, cart] of qc.getQueriesData<CartResponse>({ queryKey: qk.cartAll })) {
    const lines = cart?.lines.filter((l) => l.nftId === id) ?? []
    if (!lines.length) continue
    for (const line of lines) {
      const next = e.data.editions.find((x) => x.id === line.editionId)
      if (!next) continue
      if (next.available === 0 && line.available !== 0)
        notify('warning', 'Item do carrinho esgotou', `${line.name} (${line.editionLabel}) foi marcado como indisponível.`)
      else if (compareEth(next.price, line.unitPrice) !== 0)
        notify('warning', 'Preço atualizado no carrinho', `${line.name}: ${formatEth(line.unitPrice)} → ${formatEth(next.price)}.`)
      else if (next.available !== null && next.available < line.quantity)
        notify('warning', 'Disponibilidade reduzida', `${line.name}: restam ${next.available} unidade(s).`)
    }
    void qc.invalidateQueries({ queryKey: key })
  }

  bus.nft.forEach((l) => l(e))
  return true
}

export function applyOrderUpdated(qc: QueryClient, e: OrderUpdatedEvent, currentUserId: string | null) {
  if (!currentUserId || e.userId !== currentUserId) {
    realtimeStats.foreign += 1
    return false
  }
  const key = qk.order(currentUserId, e.resource.id)
  const cached = qc.getQueryData<Order>(key)
  if (!shouldApply(e, cached?.version ?? 0)) return false
  if (cached && cached.status !== 'pending') return false // terminal
  realtimeStats.applied += 1
  if (cached) {
    qc.setQueryData<Order>(key, {
      ...cached,
      status: e.data.status,
      transactionHash: e.data.transactionHash,
      failureReason: e.data.failureReason,
      version: e.version,
    })
  }
  // garante explorerUrl/recibo completos a partir do REST
  void qc.invalidateQueries({ queryKey: key })
  if (e.data.status !== 'pending') void qc.invalidateQueries({ queryKey: qk.cartAll })
  bus.order.forEach((l) => l(e))
  return true
}
