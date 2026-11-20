import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateOrderRequest, Network, Order, QuoteResponse, WalletConnectRequest } from '@/contracts'
import { api } from '@/lib/api/endpoints'
import { ApiError, toApiError } from '@/lib/api/errors'
import { qk } from '@/lib/query'
import { useSession } from '@/features/auth/session-store'
import { realtimeBus } from '@/features/realtime/events'
import { useRealtimeStatus } from '@/features/realtime/RealtimeProvider'
import { attemptStore, newIdempotencyKey } from './attempt'

/**
 * Cotação do checkout. É recalculada quando a rede ou o carrinho mudam e
 * quando chega `nft.updated` de um item cotado. Se o conteúdo mudar depois
 * que o usuário viu a cotação, `changed` fica true e a confirmação é
 * bloqueada até ele aceitar explicitamente a nova cotação.
 */
export function useCheckoutQuote(network: Network, cartVersion: number | undefined) {
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [accepted, setAccepted] = useState<QuoteResponse | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)
  const quoteRef = useRef<QuoteResponse | null>(null)
  quoteRef.current = quote

  /** `autoAccept`: mudanças causadas pelo próprio usuário (cupom, quantidade, rede) */
  const refresh = useCallback(async (autoAccept = false) => {
    const mine = ++seq.current
    setLoading(true)
    try {
      const q = await api.quotes.create(network)
      if (mine !== seq.current) return q // resposta obsoleta: descarta
      setQuote(q)
      setError(null)
      setAccepted((prev) => (autoAccept || !prev ? q : prev)) // a primeira cotação é a referência
      return q
    } catch (e) {
      if (mine === seq.current) setError(toApiError(e))
      throw e
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [network])

  useEffect(() => {
    if (cartVersion === undefined) return
    refresh(true).catch(() => undefined)
  }, [refresh, cartVersion])

  // evento em tempo real de um item cotado → nova cotação
  useEffect(
    () =>
      realtimeBus.onNft((event) => {
        if (quoteRef.current?.lines.some((l) => l.nftId === event.resource.id)) refresh().catch(() => undefined)
      }),
    [refresh],
  )

  const changed = Boolean(quote && accepted && quote.fingerprint !== accepted.fingerprint)
  return {
    quote,
    accepted,
    changed,
    error,
    loading,
    refresh,
    accept: () => setAccepted(quote),
    /** usado quando o servidor rejeita com QUOTE_CHANGED e devolve a nova cotação */
    replace: (q: QuoteResponse) => setQuote(q),
  }
}

export function useWalletConnection() {
  const { user } = useSession()
  const qc = useQueryClient()
  const key = qk.walletConnection(user?.id ?? 'anon')
  const active = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.walletConnections.active({ signal }),
    enabled: Boolean(user),
  })
  const connect = useMutation({
    mutationFn: (body: WalletConnectRequest) => api.walletConnections.connect(body),
    onSuccess: (c) => qc.setQueryData(key, c),
  })
  const disconnect = useMutation({
    mutationFn: (id: string) => api.walletConnections.disconnect(id),
    onSuccess: () => qc.setQueryData(key, null),
  })
  return { active, connect, disconnect }
}

const RETRYABLE = (e: ApiError) => e.kind === 'timeout' || e.kind === 'network' || e.status >= 500

/**
 * Criação idempotente do pedido. A chave nasce na primeira tentativa e é
 * reutilizada em retries automáticos (timeout/rede/5xx), cliques repetidos e
 * após refresh. Só uma nova revisão (corpo diferente) gera chave nova.
 */
export function usePlaceOrder() {
  const { user } = useSession()
  const qc = useQueryClient()
  const inFlight = useRef<Promise<Order> | null>(null)
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'retrying'>('idle')

  const place = useCallback(
    (body: CreateOrderRequest): Promise<Order> => {
      if (!user) return Promise.reject(new Error('Sessão necessária'))
      if (inFlight.current) return inFlight.current // clique repetido → mesma promessa
      const existing = attemptStore.get(user.id)
      const sameBody = existing && JSON.stringify(existing.body) === JSON.stringify(body)
      const attempt = sameBody ? existing! : { key: newIdempotencyKey(), body, orderId: null, createdAt: Date.now() }
      attemptStore.set(user.id, attempt)

      const run = async () => {
        setPhase('submitting')
        for (let i = 0; ; i++) {
          try {
            const order = await api.orders.create(attempt.body, attempt.key)
            attemptStore.set(user.id, { ...attempt, orderId: order.id })
            qc.setQueryData(qk.order(user.id, order.id), order)
            return order
          } catch (e) {
            const err = toApiError(e)
            if (RETRYABLE(err) && i < 3) {
              setPhase('retrying')
              await new Promise((r) => setTimeout(r, 600 * 2 ** i))
              continue
            }
            // erros de negócio encerram a tentativa (próxima revisão gera nova chave)
            if (!RETRYABLE(err)) attemptStore.clear(user.id)
            throw err
          }
        }
      }
      inFlight.current = run().finally(() => {
        inFlight.current = null
        setPhase('idle')
      })
      return inFlight.current
    },
    [qc, user],
  )

  return { place, phase, busy: phase !== 'idle' }
}

/** Pedido com fallback de polling enquanto o socket estiver fora. */
export function useOrder(orderId: string | null) {
  const { user } = useSession()
  const status = useRealtimeStatus()
  return useQuery({
    queryKey: qk.order(user?.id ?? 'anon', orderId ?? 'none'),
    queryFn: ({ signal }) => api.orders.get(orderId!, { signal }),
    enabled: Boolean(user && orderId),
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? (status === 'connected' ? 15_000 : 3_000) : false),
  })
}
