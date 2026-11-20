import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { CatalogQuery } from '@/contracts'
import { api } from '@/lib/api/endpoints'
import { qk } from '@/lib/query'

export const CATALOG_PAGE_SIZE = 9

export const catalogQuery = (q: CatalogQuery) =>
  queryOptions({
    queryKey: qk.catalog(q),
    // o `signal` aborta a requisição anterior quando os parâmetros mudam:
    // respostas fora de ordem nunca sobrescrevem a consulta atual
    queryFn: ({ signal }) => api.nfts.list(q, { signal }),
  })

export function useCatalog(q: CatalogQuery) {
  return useQuery({ ...catalogQuery(q), placeholderData: keepPreviousData })
}

export const featuredQuery = queryOptions({
  queryKey: qk.featured,
  queryFn: ({ signal }) => api.nfts.featured({ signal }),
  staleTime: 5 * 60_000,
})

export function useFeatured() {
  return useQuery(featuredQuery)
}

export const nftQuery = (id: string) =>
  queryOptions({
    queryKey: qk.nft(id),
    queryFn: ({ signal }) => api.nfts.detail(id, { signal }),
  })

export function useNft(id: string) {
  return useQuery(nftQuery(id))
}

export function useRelated(id: string) {
  return useQuery({
    queryKey: qk.related(id),
    queryFn: ({ signal }) => api.nfts.related(id, { signal }),
    staleTime: 60_000,
  })
}
