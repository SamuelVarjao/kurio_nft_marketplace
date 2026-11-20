/**
 * Contratos REST e de eventos do Kurio.
 *
 * Fonte única de verdade para app (transporte → estado → UI) e para a camada
 * de mocks (MSW). Valores monetários são `EthString` (string decimal).
 * Ver docs em ARCHITECTURE.md › "Contratos".
 */
import type { EthString } from '@/lib/eth'

export const API_BASE = '/api'

/* ------------------------------------------------------------------ errors */

export type ApiErrorCode =
  | 'VALIDATION_FAILED' // 400/422
  | 'INVALID_CREDENTIALS' // 401
  | 'SESSION_INVALID' // 401
  | 'SESSION_EXPIRED' // 401
  | 'FORBIDDEN' // 403
  | 'NOT_FOUND' // 404
  | 'CONFLICT' // 409 genérico (cadastro duplicado)
  | 'AVAILABILITY_CONFLICT' // 409 — edição esgotada/insuficiente
  | 'QUOTE_CHANGED' // 409 — cotação desatualizada
  | 'IDEMPOTENCY_CONFLICT' // 409 — mesma chave, conteúdo diferente
  | 'COUPON_INVALID' // 422
  | 'COUPON_EXPIRED' // 422
  | 'WALLET_REJECTED' // 409 — usuário recusou a conexão na carteira
  | 'TRANSIENT_FAILURE' // 503
  | 'INTERNAL' // 500

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** erros por campo (chave = nome do campo no payload) */
    fields?: Record<string, string>
    /** detalhes específicos do código (ex.: nova cotação em QUOTE_CHANGED) */
    details?: unknown
    retryable?: boolean
  }
}

/* --------------------------------------------------------------- catálogo */

export type Network = 'ethereum' | 'polygon' | 'solana'
export const NETWORKS: { id: Network; label: string }[] = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'solana', label: 'Solana' },
]

export type CategoryId =
  | 'arte-digital'
  | 'fotografia'
  | 'musica'
  | 'arte-3d'
  | 'colecionaveis'
  | 'generativa'
  | 'jogos'
  | 'assinaturas'
  | 'utilidade'

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'arte-digital', label: 'Arte digital' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'musica', label: 'Música' },
  { id: 'arte-3d', label: 'Arte 3D' },
  { id: 'colecionaveis', label: 'Colecionáveis' },
  { id: 'generativa', label: 'Generativa' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'utilidade', label: 'Utilidade' },
]

export type SortOption = 'recent' | 'price_asc' | 'price_desc' | 'name_asc'
export const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'recent', label: 'Listados recentemente' },
  { id: 'price_asc', label: 'Menor preço' },
  { id: 'price_desc', label: 'Maior preço' },
  { id: 'name_asc', label: 'Nome (A–Z)' },
]

export type CatalogTab = 'all' | 'new' | 'trending'

/** Nível de edição. Cada edição vendida equivale a um token (1 NFT). */
export type EditionKind = '1/1' | '1/10' | '1/50' | 'open'

export interface Edition {
  id: string // ex.: "nft-042:1/50"
  kind: EditionKind
  label: string // "1/50", "ABERTA"
  price: EthString
  /** cópias ainda disponíveis; `null` = edição aberta (sem teto de oferta) */
  available: number | null
  /** teto de oferta (1, 10, 50) ou null para aberta */
  supply: number | null
  maxPerOrder: number
}

export interface NftImage {
  /** caminho base sem sufixo; o cliente compõe srcset com -320/-640/-960.webp */
  src: string
  alt: string
  /** recorte para vistas de detalhe na galeria (zoom + foco em %) */
  crop?: { scale: number; x: number; y: number }
}

export interface NftSummary {
  id: string
  slug: string
  name: string
  tokenId: string // "#0042"
  image: NftImage
  price: EthString // preço da edição padrão
  previousPrice: EthString | null // preço riscado (promoção)
  category: CategoryId
  network: Network
  rarity: 'common' | 'rare' | 'legendary'
  listedAt: string // ISO
  trendingScore: number
  isNew: boolean
  /** soma das cópias disponíveis (null se houver edição aberta disponível) */
  soldOut: boolean
  version: number
}

export interface NftDetail extends NftSummary {
  description: string
  longDescription: string[]
  collection: { id: string; name: string }
  creator: { name: string; royaltyBps: number }
  attributes: string[]
  contractAddress: string
  gallery: NftImage[]
  editions: Edition[]
  defaultEditionId: string
  rating: { average: number; count: number }
}

export interface Facet<T extends string> {
  id: T
  label: string
  count: number
}

export interface CatalogQuery {
  q?: string
  categories?: CategoryId[]
  networks?: Network[]
  minPrice?: EthString
  maxPrice?: EthString
  sort?: SortOption
  tab?: CatalogTab
  page?: number
  pageSize?: number
}

export interface CatalogResponse {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    categories: Facet<CategoryId>[]
    networks: Facet<Network>[]
    priceRange: { min: EthString; max: EthString }
  }
  /** eco dos parâmetros efetivamente aplicados pela API */
  applied: Required<Pick<CatalogQuery, 'sort' | 'tab' | 'page' | 'pageSize'>> & CatalogQuery
}

export interface FeaturedResponse {
  hero: NftSummary[]
  spotlight: NftSummary
}

/* --------------------------------------------------------- sessão e conta */

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string | null
  ensName: string | null // sem o TLD
  ensTld: '.eth'
  walletNickname: string | null
  createdAt: string
}

export interface SessionResponse {
  token: string
  expiresAt: string
  user: User
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

/* -------------------------------------------------------------- favoritos */

export interface FavoritesResponse {
  nftIds: string[]
}

/* ---------------------------------------------------------------- carrinho */

export type CartLineStatus = 'ok' | 'price_changed' | 'insufficient' | 'unavailable'

export interface CartLine {
  id: string // nftId:editionId
  nftId: string
  editionId: string
  editionLabel: string
  name: string
  tokenId: string
  image: NftImage
  quantity: number
  unitPrice: EthString // preço atual
  /** preço no momento da inclusão, para sinalizar alteração */
  priceWhenAdded: EthString
  lineTotal: EthString
  available: number | null
  maxQuantity: number
  status: CartLineStatus
  nftVersion: number
}

export interface CouponState {
  code: string
  status: 'applied' | 'invalid' | 'expired'
  description: string
  discountBps: number
}

export interface CartSummary {
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  network: Network
  total: EthString
  feeIsEstimate: boolean
}

export interface CartResponse {
  id: string
  owner: 'guest' | 'user'
  lines: CartLine[]
  coupon: CouponState | null
  summary: CartSummary
  /** soma das quantidades (badge do header) */
  itemCount: number
  hasIssues: boolean
  updatedAt: string
  version: number
}

export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}

export interface MergeCartRequest {
  guestCartId: string
}

/* ----------------------------------------------------------------- cotação */

export interface QuoteRequest {
  network: Network
}

export interface QuoteLine {
  lineId: string
  nftId: string
  editionId: string
  editionLabel: string
  name: string
  tokenId: string
  image: NftImage
  quantity: number
  unitPrice: EthString
  lineTotal: EthString
}

export interface QuoteResponse {
  id: string
  /** hash determinístico do conteúdo (itens, preços, cupom, taxa) */
  fingerprint: string
  lines: QuoteLine[]
  coupon: CouponState | null
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  network: Network
  createdAt: string
  expiresAt: string
  /** problemas que impedem a confirmação (quantidade acima do disponível) */
  blockers: { lineId: string; reason: CartLineStatus; message: string }[]
  /** itens indisponíveis mantidos no carrinho, mas fora desta cotação */
  excluded: { lineId: string; name: string; editionLabel: string; message: string }[]
}

/* ---------------------------------------------------------------- carteiras */

export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase'
export const WALLET_PROVIDERS: { id: WalletProvider; label: string }[] = [
  { id: 'metamask', label: 'MetaMask' },
  { id: 'walletconnect', label: 'WalletConnect' },
  { id: 'coinbase', label: 'Coinbase Wallet' },
]

export interface Wallet {
  slot: 'primary' | 'secondary'
  displayName: string
  nickname: string
  network: Network
  profileName: string
  address: string // 0x + 40 hex
  ensOrSecondary: string | null
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
  ensTld: '.eth'
  updatedAt: string
}

export type WalletInput = Omit<Wallet, 'slot' | 'updatedAt'>

export interface WalletsResponse {
  primary: Wallet | null
  secondary: Wallet | null
  /** quando true, a secundária espelha a principal */
  secondarySameAsPrimary: boolean
}

export interface WalletConnectRequest {
  slot: 'primary' | 'secondary'
  provider: WalletProvider
  network: Network
}

export interface WalletConnection {
  id: string
  slot: 'primary' | 'secondary'
  provider: WalletProvider
  network: Network
  address: string
  connectedAt: string
}

/* ----------------------------------------------------------------- pedidos */

export type OrderStatus = 'pending' | 'confirmed' | 'rejected'

export interface BuyerInfo {
  displayName: string
  username: string
  profileName: string
  email: string
  referralCode: string
  ensName: string
  ensOrSecondary: string | null
  note: string | null
}

export interface CreateOrderRequest {
  quoteId: string
  quoteFingerprint: string
  walletConnectionId: string
  buyer: BuyerInfo
}

export interface OrderReceipt {
  lines: QuoteLine[]
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  coupon: CouponState | null
  network: Network
  wallet: { provider: WalletProvider; address: string; slot: 'primary' | 'secondary' }
}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  /** referência simulada (0x…) — só definida após confirmação */
  transactionHash: string | null
  explorerUrl: string | null
  failureReason: string | null
  /** snapshot imutável do pedido (recibo) */
  receipt: OrderReceipt
  createdAt: string
  updatedAt: string
  version: number
}

/* ------------------------------------------------------------------ perfil */

export interface ProfileUpdateRequest {
  displayName: string
  username: string
  email: string
  ensName: string
  walletNickname: string
}

export interface PasswordChangeRequest {
  currentPassword: string
  newPassword: string
}

export interface AvatarUploadRequest {
  /** data URL (image/png|jpeg|webp) já redimensionada no cliente */
  dataUrl: string
}

/* ------------------------------------------------------------ tempo real */

export const SOCKET_PATH = '/socket.io'
/**
 * Host do Socket.IO. Em modo demo (mocks), um host dedicado e inexistente —
 * interceptado pelo MSW — evita colisão com o WebSocket de HMR do Vite.
 */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://realtime.kurio.test'

export interface RealtimeEnvelope<TType extends string, TResource extends string, TData> {
  /** identidade estável do evento — usada para descartar duplicatas */
  eventId: string
  type: TType
  resource: { type: TResource; id: string }
  /** versão do recurso após a mudança — eventos com versão <= conhecida são ignorados */
  version: number
  occurredAt: string
  /** usuário destinatário (eventos privados) */
  userId?: string
  data: TData
}

export type NftUpdatedEvent = RealtimeEnvelope<
  'nft.updated',
  'nft',
  {
    price: EthString
    previousPrice: EthString | null
    soldOut: boolean
    editions: Pick<Edition, 'id' | 'price' | 'available'>[]
  }
>

export type OrderUpdatedEvent = RealtimeEnvelope<
  'order.updated',
  'order',
  { status: OrderStatus; transactionHash: string | null; failureReason: string | null }
>

export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
  'session.ready': (payload: { userId: string | null }) => void
}

export interface ClientToServerEvents {
  'session.identify': (payload: { token: string | null }) => void
}
