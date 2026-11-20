import { http, HttpResponse } from 'msw'
import {
  API_BASE,
  CATEGORIES,
  NETWORKS,
  type CatalogResponse,
  type CatalogTab,
  type CategoryId,
  type FeaturedResponse,
  type Network,
  type NftDetail,
  type SortOption,
} from '@/contracts'
import { compareEth, isEthString } from '@/lib/eth'
import { db } from '../db/store'
import { apiError, withConditions } from '../lib/http'
import { getScenario } from '../scenarios'
import { findNft, toSummary } from '../domain/commerce'

const SORTS: SortOption[] = ['recent', 'price_asc', 'price_desc', 'name_asc']
const TABS: CatalogTab[] = ['all', 'new', 'trending']

function list<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return []
  return raw.split(',').filter((v): v is T => (allowed as readonly string[]).includes(v))
}

export const catalogHandlers = [
  http.get(
    `${API_BASE}/nfts`,
    withConditions('catalog', ({ request }) => {
      const url = new URL(request.url)
      const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
      const categories = list<CategoryId>(url.searchParams.get('categories'), CATEGORIES.map((c) => c.id))
      const networks = list<Network>(url.searchParams.get('networks'), NETWORKS.map((n) => n.id))
      const minPrice = url.searchParams.get('minPrice')
      const maxPrice = url.searchParams.get('maxPrice')
      const sortParam = url.searchParams.get('sort') as SortOption
      const sort = SORTS.includes(sortParam) ? sortParam : 'recent'
      const tabParam = url.searchParams.get('tab') as CatalogTab
      const tab = TABS.includes(tabParam) ? tabParam : 'all'
      const pageSize = Math.min(48, Math.max(1, Number(url.searchParams.get('pageSize')) || 9))
      const requestedPage = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1))

      if (minPrice && !isEthString(minPrice))
        return apiError(400, 'VALIDATION_FAILED', 'Preço mínimo inválido.', { fields: { minPrice: 'Valor inválido' } })
      if (maxPrice && !isEthString(maxPrice))
        return apiError(400, 'VALIDATION_FAILED', 'Preço máximo inválido.', { fields: { maxPrice: 'Valor inválido' } })

      let all: NftDetail[] = getScenario().catalogEmpty ? [] : db.nftOrder.map((id) => db.nfts[id])

      // facets refletem busca + faixa de preço + aba (antes dos filtros de faceta)
      const base = all.filter((n) => {
        if (q && !`${n.name} ${n.collection.name} ${n.tokenId}`.toLowerCase().includes(q)) return false
        if (minPrice && compareEth(n.price, minPrice) < 0) return false
        if (maxPrice && compareEth(n.price, maxPrice) > 0) return false
        if (tab === 'new' && !n.isNew) return false
        return true
      })
      const facetCategories = CATEGORIES.map((c) => ({
        ...c,
        count: base.filter((n) => n.category === c.id && (networks.length === 0 || networks.includes(n.network))).length,
      }))
      const facetNetworks = NETWORKS.map((nw) => ({
        ...nw,
        count: base.filter((n) => n.network === nw.id && (categories.length === 0 || categories.includes(n.category))).length,
      }))

      all = base.filter(
        (n) =>
          (categories.length === 0 || categories.includes(n.category)) &&
          (networks.length === 0 || networks.includes(n.network)),
      )

      const sorted = [...all]
      if (tab === 'trending') sorted.sort((a, b) => b.trendingScore - a.trendingScore)
      else if (sort === 'price_asc') sorted.sort((a, b) => compareEth(a.price, b.price) || a.id.localeCompare(b.id))
      else if (sort === 'price_desc') sorted.sort((a, b) => compareEth(b.price, a.price) || a.id.localeCompare(b.id))
      else if (sort === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      else sorted.sort((a, b) => b.listedAt.localeCompare(a.listedAt))

      const total = sorted.length
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      const page = Math.min(requestedPage, totalPages)
      const prices = (getScenario().catalogEmpty ? [] : Object.values(db.nfts)).map((n) => n.price)
      const response: CatalogResponse = {
        items: sorted.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
        page,
        pageSize,
        total,
        totalPages,
        facets: {
          categories: facetCategories,
          networks: facetNetworks,
          priceRange: {
            min: prices.reduce((a, b) => (compareEth(a, b) <= 0 ? a : b), prices[0] ?? '0'),
            max: prices.reduce((a, b) => (compareEth(a, b) >= 0 ? a : b), prices[0] ?? '0'),
          },
        },
        applied: { q: q || undefined, categories, networks, minPrice: minPrice ?? undefined, maxPrice: maxPrice ?? undefined, sort, tab, page, pageSize },
      }
      return HttpResponse.json(response)
    }),
  ),

  http.get(
    `${API_BASE}/nfts/featured`,
    withConditions('catalog', () => {
      const pick = (id: string) => toSummary(db.nfts[id])
      const response: FeaturedResponse = {
        hero: ['nft-042', 'nft-088', 'nft-207'].map(pick),
        spotlight: pick('nft-118'),
      }
      return HttpResponse.json(response)
    }),
  ),

  http.get(
    `${API_BASE}/nfts/:id`,
    withConditions('nft', ({ params }) => {
      const nft = findNft(String(params.id))
      if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
      return HttpResponse.json(nft)
    }),
  ),

  http.get(
    `${API_BASE}/nfts/:id/related`,
    withConditions('nft', ({ params }) => {
      const nft = findNft(String(params.id))
      if (!nft) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
      const related = db.nftOrder
        .map((id) => db.nfts[id])
        .filter((n) => n.id !== nft.id)
        .slice(3, 12)
        .map(toSummary)
      return HttpResponse.json({ items: related })
    }),
  ),
]
