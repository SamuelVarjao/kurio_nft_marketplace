import { http, HttpResponse } from 'msw'
import {
  API_BASE,
  NETWORKS,
  type AddCartItemRequest,
  type MergeCartRequest,
  type Network,
  type QuoteRequest,
  type UpdateCartItemRequest,
} from '@/contracts'
import { db } from '../db/store'
import { apiError, authenticate, optionalAuth, readJson, withConditions } from '../lib/http'
import {
  buildQuote,
  computeCart,
  evaluateCoupon,
  findEdition,
  getOrCreateCart,
  maxQuantityFor,
  mergeCarts,
  quoteResponse,
  touch,
} from '../domain/commerce'

export const CART_HEADER = 'x-cart-id'

/** Resolve o carrinho da requisição: do usuário (token) ou do visitante (X-Cart-Id). */
function resolveCart(request: Request) {
  const auth = optionalAuth(request)
  if (auth instanceof Response) return auth
  return getOrCreateCart(request.headers.get(CART_HEADER), auth?.user.id ?? null)
}

function network(request: Request): Network {
  const n = new URL(request.url).searchParams.get('network') as Network
  return NETWORKS.some((x) => x.id === n) ? n : 'ethereum'
}

export const cartHandlers = [
  http.get(
    `${API_BASE}/cart`,
    withConditions('cart', ({ request }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      return HttpResponse.json(computeCart(cart, network(request)))
    }),
  ),

  http.post(
    `${API_BASE}/cart/items`,
    withConditions('cart', async ({ request }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      const body = await readJson<AddCartItemRequest>(request)
      if (!body || !Number.isInteger(body.quantity) || body.quantity < 1)
        return apiError(422, 'VALIDATION_FAILED', 'Quantidade inválida.', { fields: { quantity: 'Informe um número inteiro maior que zero' } })
      const nft = db.nfts[body.nftId]
      if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
      const edition = findEdition(nft, body.editionId)
      if (!edition) return apiError(404, 'NOT_FOUND', 'Edição não encontrada.')
      const existing = cart.lines.find((l) => l.nftId === nft.id && l.editionId === edition.id)
      const desired = (existing?.quantity ?? 0) + body.quantity
      const max = maxQuantityFor(edition)
      if (max === 0) return apiError(409, 'AVAILABILITY_CONFLICT', `A edição ${edition.label} está esgotada.`, { details: { available: 0 } })
      if (desired > max)
        return apiError(409, 'AVAILABILITY_CONFLICT', `Limite de ${max} unidade(s) para a edição ${edition.label}.`, {
          details: { available: edition.available, maxQuantity: max, inCart: existing?.quantity ?? 0 },
        })
      if (existing) {
        existing.quantity = desired
        existing.priceWhenAdded = edition.price
      } else
        cart.lines.push({ nftId: nft.id, editionId: edition.id, quantity: body.quantity, priceWhenAdded: edition.price, addedAt: Date.now() })
      touch(cart)
      return HttpResponse.json(computeCart(cart, network(request)), { status: 201 })
    }),
  ),

  http.patch(
    `${API_BASE}/cart/items/:lineId`,
    withConditions('cart', async ({ request, params }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      const [nftId, editionId] = decodeURIComponent(String(params.lineId)).split('|')
      const line = cart.lines.find((l) => l.nftId === nftId && l.editionId === editionId)
      if (!line) return apiError(404, 'NOT_FOUND', 'Item não está no carrinho.')
      const body = await readJson<UpdateCartItemRequest>(request)
      if (!body || !Number.isInteger(body.quantity) || body.quantity < 1)
        return apiError(422, 'VALIDATION_FAILED', 'Quantidade inválida.', { fields: { quantity: 'Informe um número inteiro maior que zero' } })
      const nft = db.nfts[nftId]
      const edition = nft && findEdition(nft, editionId)
      if (!edition) return apiError(404, 'NOT_FOUND', 'Edição não encontrada.')
      const max = maxQuantityFor(edition)
      // reduzir sempre é permitido (resolve "insufficient"); aumentar respeita o limite
      if (body.quantity > line.quantity && body.quantity > max)
        return apiError(409, 'AVAILABILITY_CONFLICT', `Limite de ${max} unidade(s) para a edição ${edition.label}.`, {
          details: { available: edition.available, maxQuantity: max },
        })
      line.quantity = body.quantity
      touch(cart)
      return HttpResponse.json(computeCart(cart, network(request)))
    }),
  ),

  http.delete(
    `${API_BASE}/cart/items/:lineId`,
    withConditions('cart', ({ request, params }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      const [nftId, editionId] = decodeURIComponent(String(params.lineId)).split('|')
      const before = cart.lines.length
      cart.lines = cart.lines.filter((l) => !(l.nftId === nftId && l.editionId === editionId))
      if (cart.lines.length === before) return apiError(404, 'NOT_FOUND', 'Item não está no carrinho.')
      touch(cart)
      return HttpResponse.json(computeCart(cart, network(request)))
    }),
  ),

  /** Usuário reconhece alterações de preço — o preço atual vira a referência. */
  http.post(
    `${API_BASE}/cart/acknowledge`,
    withConditions('cart', ({ request }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      for (const l of cart.lines) {
        const ed = db.nfts[l.nftId] && findEdition(db.nfts[l.nftId], l.editionId)
        if (ed) l.priceWhenAdded = ed.price
      }
      touch(cart)
      return HttpResponse.json(computeCart(cart, network(request)))
    }),
  ),

  http.put(
    `${API_BASE}/cart/coupon`,
    withConditions('cart', async ({ request }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      const body = await readJson<{ code: string }>(request)
      const code = body?.code?.trim() ?? ''
      if (!code) return apiError(422, 'VALIDATION_FAILED', 'Informe um código.', { fields: { code: 'Informe um código promocional' } })
      const coupon = evaluateCoupon(code)
      if (coupon.status !== 'applied') {
        cart.couponFeedback = coupon
        touch(cart)
        return apiError(422, coupon.status === 'expired' ? 'COUPON_EXPIRED' : 'COUPON_INVALID', coupon.description, {
          fields: { code: coupon.description },
        })
      }
      cart.couponCode = coupon.code
      cart.couponFeedback = null
      touch(cart)
      return HttpResponse.json(computeCart(cart, network(request)))
    }),
  ),

  http.delete(
    `${API_BASE}/cart/coupon`,
    withConditions('cart', ({ request }) => {
      const cart = resolveCart(request)
      if (cart instanceof Response) return cart
      cart.couponCode = null
      cart.couponFeedback = null
      touch(cart)
      return HttpResponse.json(computeCart(cart, network(request)))
    }),
  ),

  http.post(
    `${API_BASE}/cart/merge`,
    withConditions('cart', async ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const body = await readJson<MergeCartRequest>(request)
      if (!body?.guestCartId) return apiError(422, 'VALIDATION_FAILED', 'guestCartId é obrigatório.')
      const cart = mergeCarts(body.guestCartId, auth.user.id)
      return HttpResponse.json(computeCart(cart))
    }),
  ),

  http.post(
    `${API_BASE}/quotes`,
    withConditions('quote', async ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const body = await readJson<QuoteRequest>(request)
      const nw: Network = NETWORKS.some((n) => n.id === body?.network) ? body!.network : 'ethereum'
      const cart = getOrCreateCart(null, auth.user.id)
      if (cart.lines.length === 0) return apiError(422, 'VALIDATION_FAILED', 'Seu carrinho está vazio.')
      return HttpResponse.json(quoteResponse(buildQuote(cart, auth.user.id, nw)), { status: 201 })
    }),
  ),
]
