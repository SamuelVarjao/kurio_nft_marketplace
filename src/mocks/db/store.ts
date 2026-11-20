/**
 * Banco simulado — estado único e consistente para catálogo, sessões,
 * carrinhos, favoritos, carteiras, cotações e pedidos. REST e Socket.IO leem
 * e escrevem aqui, então toda mudança aparece nas duas vias.
 *
 * Persistido em localStorage para sobreviver a refresh. `resetDb()` restaura
 * integralmente o cenário conhecido (fixtures).
 */
import type {
  CouponState,
  NftDetail,
  Order,
  QuoteResponse,
  User,
  Wallet,
  WalletConnection,
} from '@/contracts'
import { buildCatalog, FIXTURE_USERS, FIXTURE_WALLETS } from './fixtures'

export const DB_STORAGE_KEY = 'kurio:mock-db:v1'
const DB_SCHEMA = 3

export interface UserRecord extends User {
  salt: string
  passwordHash: string
}

export interface SessionRecord {
  token: string
  userId: string
  createdAt: number
  expiresAt: number
}

export interface CartLineRecord {
  nftId: string
  editionId: string
  quantity: number
  priceWhenAdded: string
  addedAt: number
}

export interface CartRecord {
  id: string
  ownerUserId: string | null
  lines: CartLineRecord[]
  couponCode: string | null
  /** último status de cupom avaliado (para exibir inválido/expirado) */
  couponFeedback: CouponState | null
  version: number
  updatedAt: number
}

export interface QuoteRecord extends QuoteResponse {
  userId: string
  cartId: string
}

export interface OrderRecord extends Order {
  cartId: string
  idempotencyKey: string
  resolveAt: number
  outcome: 'confirmed' | 'rejected'
  /** reservas (editionId → quantidade) liberadas se recusado */
  reservations: { nftId: string; editionId: string; quantity: number }[]
}

export interface DbShape {
  schema: number
  nfts: Record<string, NftDetail>
  nftOrder: string[]
  users: Record<string, UserRecord>
  sessions: Record<string, SessionRecord>
  carts: Record<string, CartRecord>
  userCart: Record<string, string>
  favorites: Record<string, string[]>
  wallets: Record<string, { primary: Wallet | null; secondary: Wallet | null; secondarySameAsPrimary: boolean }>
  walletConnections: Record<string, WalletConnection & { userId: string; active: boolean }>
  quotes: Record<string, QuoteRecord>
  orders: Record<string, OrderRecord>
  idempotency: Record<string, { fingerprint: string; orderId: string }>
  seq: number
}

function seed(): DbShape {
  const catalog = buildCatalog()
  const users: Record<string, UserRecord> = {}
  for (const u of FIXTURE_USERS) users[u.id] = { ...u }
  return {
    schema: DB_SCHEMA,
    nfts: Object.fromEntries(catalog.map((n) => [n.id, n])),
    nftOrder: catalog.map((n) => n.id),
    users,
    sessions: {},
    carts: {},
    userCart: {},
    favorites: { 'usr-ana': ['nft-042', 'nft-552'], 'usr-bruno': [] },
    wallets: structuredClone(FIXTURE_WALLETS),
    walletConnections: {},
    quotes: {},
    orders: {},
    idempotency: {},
    seq: 1000,
  }
}

function load(): DbShape {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbShape
      if (parsed.schema === DB_SCHEMA) return parsed
    }
  } catch {
    /* storage indisponível → começa do seed */
  }
  return seed()
}

export let db: DbShape = load()

export function persist() {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* quota/indisponível: segue em memória */
  }
}

export function resetDb() {
  db = seed()
  persist()
}

export function nextId(prefix: string) {
  db.seq += 1
  return `${prefix}-${db.seq.toString(36)}`
}

export function now() {
  return Date.now()
}

export function publicUser(u: UserRecord): User {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { salt, passwordHash, ...user } = u
  return user
}
