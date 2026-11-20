/**
 * Regras de negócio simuladas: catálogo, carrinho, cupom, cotação e pedidos.
 * Toda mudança de preço/disponibilidade passa por `mutateNft`, que incrementa
 * a versão e emite `nft.updated` — REST e eventos ficam sempre coerentes.
 */
import type {
  CartLine,
  CartLineStatus,
  CartResponse,
  CouponState,
  Edition,
  Network,
  NftDetail,
  NftSummary,
  Order,
  QuoteLine,
  QuoteResponse,
} from '@/contracts'
import { addEth, compareEth, mulEth, percentEth, subEth } from '@/lib/eth'
import { db, nextId, now, persist, type CartRecord, type OrderRecord, type QuoteRecord } from '../db/store'
import { COUPONS, NETWORK_FEES } from '../db/fixtures'
import { stableHash, stableStringify } from '../lib/random'
import { emitNftUpdated, emitOrderUpdated } from '../realtime'
import { getScenario } from '../scenarios'

/* ---------------------------------------------------------------- NFTs */

export function toSummary(n: NftDetail): NftSummary {
  return {
    id: n.id,
    slug: n.slug,
    name: n.name,
    tokenId: n.tokenId,
    image: n.image,
    price: n.price,
    previousPrice: n.previousPrice,
    category: n.category,
    network: n.network,
    rarity: n.rarity,
    listedAt: n.listedAt,
    trendingScore: n.trendingScore,
    isNew: n.isNew,
    soldOut: n.soldOut,
    version: n.version,
  }
}

export function findNft(idOrSlug: string): NftDetail | undefined {
  return db.nfts[idOrSlug] ?? Object.values(db.nfts).find((n) => n.slug === idOrSlug)
}

export function findEdition(nft: NftDetail, editionId: string): Edition | undefined {
  return nft.editions.find((e) => e.id === editionId)
}

/** Aplica uma mudança no NFT, incrementa a versão, persiste e emite evento. */
export function mutateNft(nftId: string, change: (nft: NftDetail) => void) {
  const nft = db.nfts[nftId]
  if (!nft) throw new Error(`NFT inexistente: ${nftId}`)
  change(nft)
  const def = nft.editions.find((e) => e.id === nft.defaultEditionId)
  if (def) nft.price = def.price
  nft.soldOut = nft.editions.every((e) => e.available === 0)
  nft.version += 1
  persist()
  return emitNftUpdated(nft)
}

/* ------------------------------------------------------------- carrinho */

export function getOrCreateCart(id: string | null, ownerUserId: string | null): CartRecord {
  if (ownerUserId) {
    const existing = db.userCart[ownerUserId]
    if (existing && db.carts[existing]) return db.carts[existing]
    const cart = newCart(ownerUserId)
    db.userCart[ownerUserId] = cart.id
    return cart
  }
  if (id && db.carts[id] && db.carts[id].ownerUserId === null) return db.carts[id]
  return newCart(null)
}

function newCart(ownerUserId: string | null): CartRecord {
  const cart: CartRecord = {
    id: nextId('cart'),
    ownerUserId,
    lines: [],
    couponCode: null,
    couponFeedback: null,
    version: 1,
    updatedAt: now(),
  }
  db.carts[cart.id] = cart
  persist()
  return cart
}

export function touch(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = now()
  persist()
}

export function maxQuantityFor(edition: Edition) {
  return edition.available === null ? edition.maxPerOrder : Math.min(edition.maxPerOrder, edition.available)
}

export function evaluateCoupon(code: string): CouponState {
  const normalized = code.trim().toUpperCase()
  const c = COUPONS[normalized]
  if (!c) return { code: normalized, status: 'invalid', description: 'Código promocional inválido.', discountBps: 0 }
  if (Date.parse(c.expiresAt) <= now())
    return { code: normalized, status: 'expired', description: 'Este código promocional expirou.', discountBps: 0 }
  return { code: normalized, status: 'applied', description: c.description, discountBps: c.bps }
}

function lineStatus(quantity: number, edition: Edition | undefined, priceWhenAdded: string): CartLineStatus {
  if (!edition || edition.available === 0) return 'unavailable'
  if (edition.available !== null && quantity > edition.available) return 'insufficient'
  if (compareEth(edition.price, priceWhenAdded) !== 0) return 'price_changed'
  return 'ok'
}

export function computeCart(cart: CartRecord, network: Network = 'ethereum'): CartResponse {
  const lines: CartLine[] = cart.lines.flatMap((l) => {
    const nft = db.nfts[l.nftId]
    if (!nft) return []
    const edition = findEdition(nft, l.editionId)
    const unitPrice = edition?.price ?? l.priceWhenAdded
    return [
      {
        id: `${l.nftId}|${l.editionId}`,
        nftId: l.nftId,
        editionId: l.editionId,
        editionLabel: edition?.label ?? '—',
        name: nft.name,
        tokenId: nft.tokenId,
        image: nft.image,
        quantity: l.quantity,
        unitPrice,
        priceWhenAdded: l.priceWhenAdded,
        lineTotal: mulEth(unitPrice, l.quantity),
        available: edition?.available ?? 0,
        maxQuantity: edition ? maxQuantityFor(edition) : 0,
        status: lineStatus(l.quantity, edition, l.priceWhenAdded),
        nftVersion: nft.version,
      },
    ]
  })
  const coupon = cart.couponCode ? evaluateCoupon(cart.couponCode) : cart.couponFeedback
  const billable = lines.filter((l) => l.status !== 'unavailable')
  const subtotal = addEth('0', ...billable.map((l) => l.lineTotal))
  const discount = coupon?.status === 'applied' ? percentEth(subtotal, coupon.discountBps) : '0'
  const networkFee = billable.length ? NETWORK_FEES[network] : '0'
  return {
    id: cart.id,
    owner: cart.ownerUserId ? 'user' : 'guest',
    lines,
    coupon,
    summary: {
      subtotal,
      discount,
      networkFee,
      network,
      total: addEth(subEth(subtotal, discount), networkFee),
      feeIsEstimate: true,
    },
    itemCount: lines.reduce((acc, l) => acc + l.quantity, 0),
    hasIssues: lines.some((l) => l.status !== 'ok'),
    updatedAt: new Date(cart.updatedAt).toISOString(),
    version: cart.version,
  }
}

/** Mescla o carrinho do visitante no carrinho do usuário (respeitando limites). */
export function mergeCarts(guestCartId: string, userId: string) {
  const guest = db.carts[guestCartId]
  const target = getOrCreateCart(null, userId)
  if (!guest || guest.ownerUserId !== null || guest.id === target.id) return target
  for (const gl of guest.lines) {
    const nft = db.nfts[gl.nftId]
    const edition = nft && findEdition(nft, gl.editionId)
    if (!edition) continue
    const existing = target.lines.find((l) => l.nftId === gl.nftId && l.editionId === gl.editionId)
    const cap = Math.max(1, maxQuantityFor(edition))
    if (existing) existing.quantity = Math.min(cap, existing.quantity + gl.quantity)
    else target.lines.push({ ...gl, quantity: Math.min(cap, gl.quantity) })
  }
  if (!target.couponCode && guest.couponCode) target.couponCode = guest.couponCode
  delete db.carts[guest.id]
  touch(target)
  return target
}

/* --------------------------------------------------------------- cotação */

let checkoutMutationScheduled = false
export function resetCheckoutMutation() {
  checkoutMutationScheduled = false
}

export function buildQuote(cart: CartRecord, userId: string, network: Network): QuoteRecord {
  const computed = computeCart(cart, network)
  const lines: QuoteLine[] = computed.lines
    .filter((l) => l.status !== 'unavailable')
    .map((l) => ({
      lineId: l.id,
      nftId: l.nftId,
      editionId: l.editionId,
      editionLabel: l.editionLabel,
      name: l.name,
      tokenId: l.tokenId,
      image: l.image,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    }))
  const coupon = computed.coupon?.status === 'applied' ? computed.coupon : null
  const fingerprint = stableHash(
    stableStringify({
      lines: lines.map((l) => [l.lineId, l.quantity, l.unitPrice]),
      coupon: coupon ? [coupon.code, coupon.discountBps] : null,
      fee: computed.summary.networkFee,
      network,
    }),
  )
  const quote: QuoteRecord = {
    id: nextId('quo'),
    fingerprint,
    lines,
    coupon,
    subtotal: computed.summary.subtotal,
    discount: computed.summary.discount,
    networkFee: computed.summary.networkFee,
    total: computed.summary.total,
    network,
    createdAt: new Date(now()).toISOString(),
    expiresAt: new Date(now() + 10 * 60_000).toISOString(),
    blockers: computed.lines
      .filter((l) => l.status === 'insufficient')
      .map((l) => ({
        lineId: l.id,
        reason: l.status,
        message: `${l.name} (${l.editionLabel}): apenas ${l.available} disponível(is).`,
      })),
    excluded: computed.lines
      .filter((l) => l.status === 'unavailable')
      .map((l) => ({ lineId: l.id, name: l.name, editionLabel: l.editionLabel, message: 'Edição esgotada — mantida no carrinho, fora deste pedido.' })),
    userId,
    cartId: cart.id,
  }
  db.quotes[quote.id] = quote
  persist()
  scheduleCheckoutMutation(cart)
  return quote
}

/** Cenários "price-change" / "sold-out": muda o 1º item 3 s após a cotação. */
function scheduleCheckoutMutation(cart: CartRecord) {
  const scenario = getScenario()
  if (checkoutMutationScheduled || (!scenario.priceChangeOnCheckout && !scenario.soldOutOnCheckout)) return
  const first = cart.lines[0]
  if (!first) return
  checkoutMutationScheduled = true
  setTimeout(() => {
    mutateNft(first.nftId, (nft) => {
      const ed = findEdition(nft, first.editionId)
      if (!ed) return
      if (scenario.priceChangeOnCheckout) ed.price = addEth(ed.price, '0.10')
      if (scenario.soldOutOnCheckout) ed.available = 0
    })
  }, 3_000)
}

/* --------------------------------------------------------------- pedidos */

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function txHashFor(orderId: string) {
  let h = ''
  for (let i = 0; h.length < 64; i++) h += stableHash(`${orderId}:${i}`)
  return `0x${h.slice(0, 64)}`
}

export function reserve(order: OrderRecord) {
  for (const r of order.reservations) {
    mutateNft(r.nftId, (nft) => {
      const ed = findEdition(nft, r.editionId)
      if (ed && ed.available !== null) ed.available = Math.max(0, ed.available - r.quantity)
    })
  }
}

function release(order: OrderRecord) {
  for (const r of order.reservations) {
    mutateNft(r.nftId, (nft) => {
      const ed = findEdition(nft, r.editionId)
      if (ed && ed.available !== null) ed.available += r.quantity
    })
  }
}

export function resolveOrder(orderId: string) {
  const order = db.orders[orderId]
  if (!order || order.status !== 'pending') return order
  timers.delete(orderId)
  const ts = new Date(now()).toISOString()
  if (order.outcome === 'confirmed') {
    order.status = 'confirmed'
    order.transactionHash = txHashFor(order.id)
    order.explorerUrl = `https://etherscan.io/tx/${order.transactionHash}`
    // remove do carrinho apenas os itens e quantidades comprados
    const cart = db.carts[order.cartId]
    if (cart) {
      for (const line of order.receipt.lines) {
        const cl = cart.lines.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
        if (cl) cl.quantity -= line.quantity
      }
      cart.lines = cart.lines.filter((l) => l.quantity > 0)
      if (cart.lines.length === 0) {
        cart.couponCode = null
        cart.couponFeedback = null
      }
      touch(cart)
    }
  } else {
    order.status = 'rejected'
    order.failureReason = 'Pagamento recusado pela carteira. Nenhum valor foi debitado.'
    release(order)
  }
  order.version += 1
  order.updatedAt = ts
  persist()
  emitOrderUpdated(publicOrder(order))
  return order
}

export function scheduleResolution(order: OrderRecord) {
  if (order.status !== 'pending' || timers.has(order.id)) return
  const wait = Math.max(0, order.resolveAt - now())
  timers.set(
    order.id,
    setTimeout(() => resolveOrder(order.id), wait),
  )
}

/** Retoma timers de pedidos pendentes após recarregar a página. */
export function resumePendingOrders() {
  for (const o of Object.values(db.orders)) if (o.status === 'pending') scheduleResolution(o)
}

export function clearOrderTimers() {
  timers.forEach((t) => clearTimeout(t))
  timers.clear()
}

export function publicOrder(o: OrderRecord): Order {
  return {
    id: o.id,
    userId: o.userId,
    status: o.status,
    transactionHash: o.transactionHash,
    explorerUrl: o.explorerUrl,
    failureReason: o.failureReason,
    receipt: o.receipt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    version: o.version,
  }
}

export function quoteResponse(q: QuoteRecord): QuoteResponse {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId, cartId, ...rest } = q
  return rest
}
