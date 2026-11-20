/**
 * Funções de transporte tipadas — uma por operação do contrato REST.
 * Recebem `signal` para que o TanStack Query cancele respostas obsoletas.
 */
import type {
  AddCartItemRequest,
  CartResponse,
  CatalogQuery,
  CatalogResponse,
  CreateOrderRequest,
  FavoritesResponse,
  FeaturedResponse,
  LoginRequest,
  Network,
  NftDetail,
  NftSummary,
  Order,
  PasswordChangeRequest,
  ProfileUpdateRequest,
  QuoteResponse,
  RegisterRequest,
  SessionResponse,
  User,
  WalletConnectRequest,
  WalletConnection,
  WalletInput,
  WalletsResponse,
} from '@/contracts'
import { request } from './client'

type Opts = { signal?: AbortSignal }

export const ORDER_TIMEOUT_MS = 8_000

function catalogParams(q: CatalogQuery) {
  return {
    q: q.q || undefined,
    categories: q.categories?.length ? q.categories.join(',') : undefined,
    networks: q.networks?.length ? q.networks.join(',') : undefined,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    sort: q.sort,
    tab: q.tab,
    page: q.page,
    pageSize: q.pageSize,
  }
}

export const api = {
  auth: {
    register: (body: RegisterRequest) => request<SessionResponse>({ method: 'POST', url: '/auth/register', data: body }),
    login: (body: LoginRequest) => request<SessionResponse>({ method: 'POST', url: '/auth/login', data: body }),
    session: (o: Opts = {}) => request<{ user: User; expiresAt: string }>({ url: '/auth/session', signal: o.signal }),
    logout: () => request<void>({ method: 'POST', url: '/auth/logout' }),
  },
  nfts: {
    list: (q: CatalogQuery, o: Opts = {}) =>
      request<CatalogResponse>({ url: '/nfts', params: catalogParams(q), signal: o.signal }),
    featured: (o: Opts = {}) => request<FeaturedResponse>({ url: '/nfts/featured', signal: o.signal }),
    detail: (id: string, o: Opts = {}) => request<NftDetail>({ url: `/nfts/${encodeURIComponent(id)}`, signal: o.signal }),
    related: (id: string, o: Opts = {}) =>
      request<{ items: NftSummary[] }>({ url: `/nfts/${encodeURIComponent(id)}/related`, signal: o.signal }),
  },
  favorites: {
    list: (o: Opts = {}) => request<FavoritesResponse>({ url: '/favorites', signal: o.signal }),
    add: (nftId: string) => request<FavoritesResponse>({ method: 'PUT', url: `/favorites/${nftId}` }),
    remove: (nftId: string) => request<FavoritesResponse>({ method: 'DELETE', url: `/favorites/${nftId}` }),
  },
  cart: {
    get: (o: Opts & { network?: Network } = {}) =>
      request<CartResponse>({ url: '/cart', params: { network: o.network }, signal: o.signal }),
    add: (body: AddCartItemRequest) => request<CartResponse>({ method: 'POST', url: '/cart/items', data: body }),
    update: (lineId: string, quantity: number) =>
      request<CartResponse>({ method: 'PATCH', url: `/cart/items/${encodeURIComponent(lineId)}`, data: { quantity } }),
    remove: (lineId: string) => request<CartResponse>({ method: 'DELETE', url: `/cart/items/${encodeURIComponent(lineId)}` }),
    applyCoupon: (code: string) => request<CartResponse>({ method: 'PUT', url: '/cart/coupon', data: { code } }),
    removeCoupon: () => request<CartResponse>({ method: 'DELETE', url: '/cart/coupon' }),
    acknowledge: () => request<CartResponse>({ method: 'POST', url: '/cart/acknowledge' }),
    merge: (guestCartId: string) => request<CartResponse>({ method: 'POST', url: '/cart/merge', data: { guestCartId } }),
  },
  quotes: {
    create: (network: Network) => request<QuoteResponse>({ method: 'POST', url: '/quotes', data: { network } }),
  },
  walletConnections: {
    connect: (body: WalletConnectRequest) =>
      request<WalletConnection>({ method: 'POST', url: '/wallet-connections', data: body }),
    active: (o: Opts = {}) => request<WalletConnection | null>({ url: '/wallet-connections/active', signal: o.signal }),
    disconnect: (id: string) => request<void>({ method: 'DELETE', url: `/wallet-connections/${id}` }),
  },
  orders: {
    create: (body: CreateOrderRequest, idempotencyKey: string) =>
      request<Order>({
        method: 'POST',
        url: '/orders',
        data: body,
        headers: { 'Idempotency-Key': idempotencyKey },
        timeout: ORDER_TIMEOUT_MS,
      }),
    get: (id: string, o: Opts = {}) => request<Order>({ url: `/orders/${encodeURIComponent(id)}`, signal: o.signal }),
    list: (status?: Order['status'], o: Opts = {}) =>
      request<{ items: Order[] }>({ url: '/orders', params: { status }, signal: o.signal }),
  },
  profile: {
    get: (o: Opts = {}) => request<User>({ url: '/profile', signal: o.signal }),
    update: (body: ProfileUpdateRequest) => request<User>({ method: 'PATCH', url: '/profile', data: body }),
    uploadAvatar: (dataUrl: string) => request<User>({ method: 'PUT', url: '/profile/avatar', data: { dataUrl } }),
    removeAvatar: () => request<User>({ method: 'DELETE', url: '/profile/avatar' }),
    changePassword: (body: PasswordChangeRequest) => request<void>({ method: 'POST', url: '/profile/password', data: body }),
  },
  wallets: {
    get: (o: Opts = {}) => request<WalletsResponse>({ url: '/wallets', signal: o.signal }),
    save: (slot: 'primary' | 'secondary', body: WalletInput) =>
      request<WalletsResponse>({ method: 'PUT', url: `/wallets/${slot}`, data: body }),
    setSameAsPrimary: (enabled: boolean) =>
      request<WalletsResponse>({ method: 'PUT', url: '/wallets/secondary/same-as-primary', data: { enabled } }),
  },
}
