import { delay, http, HttpResponse } from 'msw'
import { API_BASE, type CreateOrderRequest, type WalletConnectRequest, type WalletConnection } from '@/contracts'
import { buyerSchema, zodFieldErrors } from '@/contracts/schemas'
import { db, nextId, now, persist, type OrderRecord } from '../db/store'
import { apiError, authenticate, readJson, withConditions } from '../lib/http'
import { stableHash, stableStringify } from '../lib/random'
import { getScenario } from '../scenarios'
import {
  buildQuote,
  getOrCreateCart,
  publicOrder,
  quoteResponse,
  reserve,
  resolveOrder,
  scheduleResolution,
} from '../domain/commerce'

/** Tempo que a 1ª resposta de criação leva no cenário "order-timeout" (> timeout do cliente). */
export const ORDER_TIMEOUT_DELAY_MS = 12_000
let timeoutServed = false
export function resetOrderTimeout() {
  timeoutServed = false
}

export const orderHandlers = [
  /* ------------------------------------------- conexão de carteira (simulada) */
  http.post(
    `${API_BASE}/wallet-connections`,
    withConditions('wallets', async ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const body = await readJson<WalletConnectRequest>(request)
      const wallets = db.wallets[auth.user.id]
      const slot = body?.slot ?? 'primary'
      const wallet = slot === 'secondary' && wallets?.secondarySameAsPrimary ? wallets.primary : wallets?.[slot]
      if (!wallet)
        return apiError(422, 'VALIDATION_FAILED', 'Cadastre esta carteira antes de conectá-la.', {
          fields: { slot: 'Carteira não cadastrada' },
        })
      if (getScenario().walletRejects)
        return apiError(409, 'WALLET_REJECTED', 'A solicitação de conexão foi recusada na carteira.')
      for (const c of Object.values(db.walletConnections)) if (c.userId === auth.user.id) c.active = false
      const connection: WalletConnection = {
        id: nextId('wcn'),
        slot,
        provider: body?.provider ?? wallet.provider,
        network: body?.network ?? wallet.network,
        address: wallet.address,
        connectedAt: new Date(now()).toISOString(),
      }
      db.walletConnections[connection.id] = { ...connection, userId: auth.user.id, active: true }
      persist()
      return HttpResponse.json(connection, { status: 201 })
    }),
  ),

  http.get(
    `${API_BASE}/wallet-connections/active`,
    withConditions('wallets', ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const active = Object.values(db.walletConnections).find((c) => c.userId === auth.user.id && c.active)
      if (!active) return HttpResponse.json(null)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userId, active: _a, ...conn } = active
      return HttpResponse.json(conn)
    }),
  ),

  http.delete(
    `${API_BASE}/wallet-connections/:id`,
    withConditions('wallets', ({ request, params }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const c = db.walletConnections[String(params.id)]
      if (!c || c.userId !== auth.user.id) return apiError(404, 'NOT_FOUND', 'Conexão não encontrada.')
      c.active = false
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* ---------------------------------------------------------------- pedidos */
  http.post(
    `${API_BASE}/orders`,
    withConditions('orders', async ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const key = request.headers.get('idempotency-key')
      if (!key || key.length < 8)
        return apiError(400, 'VALIDATION_FAILED', 'Cabeçalho Idempotency-Key é obrigatório.')
      const body = await readJson<CreateOrderRequest>(request)
      if (!body) return apiError(400, 'VALIDATION_FAILED', 'Corpo inválido.')
      const fingerprint = stableHash(stableStringify(body))
      const scopedKey = `${auth.user.id}:${key}`

      // 1) mesma tentativa → mesmo pedido; conteúdo diferente → conflito
      const prior = db.idempotency[scopedKey]
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        const order = db.orders[prior.orderId]
        if (now() >= order.resolveAt) resolveOrder(order.id)
        return HttpResponse.json(publicOrder(db.orders[prior.orderId]), { status: 200 })
      }

      // 2) validação do comprador
      const buyer = buyerSchema.safeParse(body.buyer)
      if (!buyer.success)
        return apiError(422, 'VALIDATION_FAILED', 'Revise os dados do colecionador.', {
          fields: Object.fromEntries(Object.entries(zodFieldErrors(buyer.error)).map(([k, v]) => [`buyer.${k}`, v])),
        })

      // 3) carteira conectada
      const conn = db.walletConnections[body.walletConnectionId]
      if (!conn || conn.userId !== auth.user.id || !conn.active)
        return apiError(409, 'WALLET_REJECTED', 'A carteira foi desconectada. Conecte-a novamente para concluir.')

      // 4) revalida cotação: preço, disponibilidade, cupom e taxa
      const quote = db.quotes[body.quoteId]
      if (!quote || quote.userId !== auth.user.id) return apiError(404, 'NOT_FOUND', 'Cotação não encontrada.')
      const cart = getOrCreateCart(null, auth.user.id)
      const fresh = buildQuote(cart, auth.user.id, quote.network)
      const expired = Date.parse(quote.expiresAt) <= now()
      if (expired || fresh.fingerprint !== quote.fingerprint || body.quoteFingerprint !== quote.fingerprint)
        return apiError(409, 'QUOTE_CHANGED', 'Preço, disponibilidade ou taxas mudaram. Revise a nova cotação.', {
          details: { quote: quoteResponse(fresh), previousQuoteId: quote.id },
        })
      if (fresh.blockers.length || fresh.lines.length === 0)
        return apiError(409, 'AVAILABILITY_CONFLICT', fresh.blockers[0]?.message ?? 'Nenhum item disponível para compra.', {
          details: { quote: quoteResponse(fresh) },
        })

      // 5) cria pedido pendente e reserva as edições
      const ts = new Date(now()).toISOString()
      const scenario = getScenario()
      const order: OrderRecord = {
        id: nextId('ord'),
        userId: auth.user.id,
        status: 'pending',
        transactionHash: null,
        explorerUrl: null,
        failureReason: null,
        receipt: {
          lines: fresh.lines,
          subtotal: fresh.subtotal,
          discount: fresh.discount,
          networkFee: fresh.networkFee,
          total: fresh.total,
          coupon: fresh.coupon,
          network: fresh.network,
          wallet: { provider: conn.provider, address: conn.address, slot: conn.slot },
        },
        createdAt: ts,
        updatedAt: ts,
        version: 1,
        cartId: cart.id,
        idempotencyKey: key,
        resolveAt: now() + scenario.orderResolveMs,
        outcome: scenario.paymentOutcome,
        reservations: fresh.lines.map((l) => ({ nftId: l.nftId, editionId: l.editionId, quantity: l.quantity })),
      }
      db.orders[order.id] = order
      db.idempotency[scopedKey] = { fingerprint, orderId: order.id }
      persist()
      reserve(order)
      scheduleResolution(order)

      // 6) cenário: pedido criado, mas a resposta só chega depois do timeout do cliente
      if (scenario.orderTimeout && !timeoutServed) {
        timeoutServed = true
        await delay(ORDER_TIMEOUT_DELAY_MS)
      }
      return HttpResponse.json(publicOrder(db.orders[order.id]), { status: 201 })
    }),
  ),

  http.get(
    `${API_BASE}/orders/:id`,
    withConditions('orders', ({ request, params }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const order = db.orders[String(params.id)]
      if (!order) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
      if (order.userId !== auth.user.id) return apiError(403, 'FORBIDDEN', 'Este pedido pertence a outra conta.')
      if (order.status === 'pending' && now() >= order.resolveAt) resolveOrder(order.id)
      return HttpResponse.json(publicOrder(db.orders[order.id]))
    }),
  ),

  http.get(
    `${API_BASE}/orders`,
    withConditions('orders', ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const status = new URL(request.url).searchParams.get('status')
      const items = Object.values(db.orders)
        .filter((o) => o.userId === auth.user.id && (!status || o.status === status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(publicOrder)
      return HttpResponse.json({ items })
    }),
  ),
]
