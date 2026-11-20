/**
 * Estado do catálogo na URL (busca, filtros, ordenação, aba e página).
 * Valores padrão são omitidos para manter a URL limpa; listas são CSV.
 */
import {
  CATEGORIES,
  NETWORKS,
  SORT_OPTIONS,
  type CatalogQuery,
  type CatalogTab,
  type CategoryId,
  type Network,
  type SortOption,
} from '@/contracts'
import { isEthString } from '@/lib/eth'
import { CATALOG_PAGE_SIZE } from './hooks'

export interface CatalogSearch {
  q?: string
  cat?: string
  net?: string
  min?: string
  max?: string
  sort?: SortOption
  tab?: CatalogTab
  page?: number
}

const CAT_IDS = CATEGORIES.map((c) => c.id) as string[]
const NET_IDS = NETWORKS.map((n) => n.id) as string[]
const SORT_IDS = SORT_OPTIONS.map((s) => s.id) as string[]

function csv(raw: unknown, allowed: string[]): string | undefined {
  if (typeof raw !== 'string') return undefined
  const values = [...new Set(raw.split(',').filter((v) => allowed.includes(v)))].sort()
  return values.length ? values.join(',') : undefined
}

export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const page = Number(raw.page)
  return {
    q: typeof raw.q === 'string' && raw.q.trim() ? raw.q.trim().slice(0, 80) : undefined,
    cat: csv(raw.cat, CAT_IDS),
    net: csv(raw.net, NET_IDS),
    min: typeof raw.min === 'string' && isEthString(raw.min) ? raw.min : typeof raw.min === 'number' ? String(raw.min) : undefined,
    max: typeof raw.max === 'string' && isEthString(raw.max) ? raw.max : typeof raw.max === 'number' ? String(raw.max) : undefined,
    sort: typeof raw.sort === 'string' && SORT_IDS.includes(raw.sort) && raw.sort !== 'recent' ? (raw.sort as SortOption) : undefined,
    tab: raw.tab === 'new' || raw.tab === 'trending' ? raw.tab : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

export function toCatalogQuery(s: CatalogSearch): CatalogQuery {
  return {
    q: s.q,
    categories: (s.cat?.split(',') ?? []) as CategoryId[],
    networks: (s.net?.split(',') ?? []) as Network[],
    minPrice: s.min,
    maxPrice: s.max,
    sort: s.sort ?? 'recent',
    tab: s.tab ?? 'all',
    page: s.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

export function toggleCsv(current: string | undefined, value: string): string | undefined {
  const set = new Set(current?.split(',').filter(Boolean) ?? [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return set.size ? [...set].sort().join(',') : undefined
}

export function hasActiveFilters(s: CatalogSearch) {
  return Boolean(s.q || s.cat || s.net || s.min || s.max)
}
