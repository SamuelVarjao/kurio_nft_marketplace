/**
 * Política de cache, retries e chaves de consulta.
 *
 * - Dados públicos (catálogo/detalhe): staleTime 30 s; reconciliados por
 *   eventos `nft.updated` e por invalidação após reconexão do socket.
 * - Dados privados: sempre sob o prefixo ['private', userId] — isolamento por
 *   usuário e limpeza total em logout/troca de sessão (`removeQueries`).
 * - Retries: só para falhas transitórias (rede/timeout/5xx/429), 2 tentativas
 *   com backoff exponencial. 4xx nunca é repetido. Mutations não repetem
 *   automaticamente (o pedido usa idempotência explícita).
 */
import { QueryClient } from '@tanstack/react-query'
import type { CatalogQuery } from '@/contracts'
import { ApiError } from './api/errors'

export function shouldRetry(failureCount: number, error: unknown) {
  if (!(error instanceof ApiError)) return failureCount < 1
  if (error.kind === 'canceled') return false
  return error.retryable && failureCount < 2
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4_000),
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}

export const qk = {
  catalog: (q: CatalogQuery) => ['catalog', q] as const,
  catalogAll: ['catalog'] as const,
  featured: ['featured'] as const,
  nft: (id: string) => ['nft', id] as const,
  nftAll: ['nft'] as const,
  related: (id: string) => ['related', id] as const,
  /** carrinho: do usuário ou do visitante — nunca compartilhado */
  cart: (userId: string | null) => ['cart', userId ? `user:${userId}` : 'guest'] as const,
  cartAll: ['cart'] as const,
  private: (userId: string) => ['private', userId] as const,
  privateAll: ['private'] as const,
  favorites: (userId: string) => ['private', userId, 'favorites'] as const,
  profile: (userId: string) => ['private', userId, 'profile'] as const,
  wallets: (userId: string) => ['private', userId, 'wallets'] as const,
  walletConnection: (userId: string) => ['private', userId, 'wallet-connection'] as const,
  order: (userId: string, id: string) => ['private', userId, 'order', id] as const,
  orders: (userId: string) => ['private', userId, 'order'] as const,
}
