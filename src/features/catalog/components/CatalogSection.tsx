import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, SlidersHorizontal, Search, X } from 'lucide-react'
import { SORT_OPTIONS, type CatalogTab, type SortOption } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { cn } from '@/lib/utils'
import { CATALOG_PAGE_SIZE, useCatalog } from '../hooks'
import { hasActiveFilters, toCatalogQuery, type CatalogSearch } from '../search'
import { CatalogFilters } from './CatalogFilters'
import { NftCard, NftCardSkeleton } from './NftCard'

const TABS: { id: CatalogTab; label: string }[] = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
]

/**
 * Catálogo controlado pela URL. Toda mudança de filtro/busca/ordenação
 * reinicia a paginação (page → undefined).
 */
export function CatalogSection({
  search,
  onSearchChange,
  aside,
  headingId = 'catalogo-titulo',
}: {
  search: CatalogSearch
  onSearchChange: (next: CatalogSearch, opts?: { replace?: boolean }) => void
  aside?: ReactNode
  headingId?: string
}) {
  const query = toCatalogQuery(search)
  const { data, error, isPending, isFetching, isPlaceholderData, refetch, isRefetching } = useCatalog(query)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [term, setTerm] = useState(search.q ?? '')
  useEffect(() => setTerm(search.q ?? ''), [search.q])

  const patch = (p: Partial<CatalogSearch>) => onSearchChange({ ...search, ...p, page: undefined })
  const goTo = (page: number) => onSearchChange({ ...search, page: page > 1 ? page : undefined })

  const tab = search.tab ?? 'all'
  const sort = search.sort ?? 'recent'
  const showing = data ? `${data.total} ${data.total === 1 ? 'resultado' : 'resultados'}` : ''

  return (
    <section aria-labelledby={headingId} className="container-page mt-10 md:mt-16" id="catalogo">
      <h2 id={headingId} className="sr-only">
        Catálogo de NFTs
      </h2>

      {/* busca + filtros (mobile/tablet) */}
      <form
        role="search"
        className="mb-6 flex gap-2 lg:hidden"
        onSubmit={(e) => {
          e.preventDefault()
          patch({ q: term.trim() || undefined })
        }}
      >
        <div className="relative flex-1">
          <label htmlFor="catalog-search-mobile" className="sr-only">
            Explorar coleções
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            id="catalog-search-mobile"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Explorar coleções"
            className="h-11 w-full rounded-md border border-border bg-card pr-3 pl-9 text-sm placeholder:text-subtle"
            type="search"
          />
        </div>
        <Button type="button" variant="default" size="icon-lg" className="h-11 rounded-md" aria-label="Abrir filtros" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal aria-hidden />
        </Button>
      </form>

      <div className="grid gap-8 lg:grid-cols-[310px_1fr] lg:gap-12">
        <aside className="hidden flex-col gap-8 lg:flex" aria-label="Filtros do catálogo">
          <form
            role="search"
            className="relative"
            onSubmit={(e) => {
              e.preventDefault()
              patch({ q: term.trim() || undefined })
            }}
          >
            <label htmlFor="catalog-search" className="sr-only">
              Buscar no catálogo
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              id="catalog-search"
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por nome ou coleção"
              className="h-11 w-full rounded-sm border border-border bg-card pr-3 pl-9 text-sm placeholder:text-subtle"
              data-testid="catalog-search"
            />
          </form>
          <CatalogFilters search={search} facets={data?.facets} onChange={patch} />
          {aside}
        </aside>

        <div className="min-w-0">
          <div className="mb-6 flex flex-col gap-4 border-b border-border sm:flex-row sm:items-end sm:justify-between">
            <div role="tablist" aria-label="Seções do catálogo" className="-mb-px flex gap-5 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  aria-controls="catalog-results"
                  onClick={() => patch({ tab: t.id === 'all' ? undefined : t.id })}
                  className={cn(
                    'shrink-0 border-b-2 pb-3 text-sm whitespace-nowrap transition-colors',
                    tab === t.id ? 'border-primary font-bold text-primary' : 'border-transparent hover:text-primary',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pb-3 text-sm">
              <label id="sort-label" htmlFor="catalog-sort">
                Ordenar por:
              </label>
              <Select value={sort} onValueChange={(v) => patch({ sort: v === 'recent' ? undefined : (v as SortOption) })} disabled={tab === 'trending'}>
                <SelectTrigger id="catalog-sort" aria-labelledby="sort-label catalog-sort" className="h-9 min-w-52 border-border" data-testid="catalog-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border border-border bg-card">
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-live="polite" data-testid="catalog-status">
            {data ? <span className="text-muted-foreground">{showing}</span> : null}
            {isFetching && !isPending ? <span className="text-subtle">· atualizando…</span> : null}
            {hasActiveFilters(search) ? (
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                onClick={() => onSearchChange({ tab: search.tab, sort: search.sort })}
              >
                <X className="size-3" aria-hidden /> Limpar filtros
              </button>
            ) : null}
          </div>

          <div id="catalog-results" role="tabpanel" aria-busy={isFetching} className={cn('transition-opacity', isPlaceholderData && 'opacity-60')}>
            {isPending ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-8 md:gap-y-12" aria-label="Carregando NFTs">
                {Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) => (
                  <li key={i}>
                    <NftCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : error && !data ? (
              <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} title="Não foi possível carregar o catálogo" />
            ) : data && data.items.length === 0 ? (
              <EmptyState
                title="Nenhum NFT encontrado"
                description="Tente outros termos ou remova alguns filtros."
                action={
                  hasActiveFilters(search) ? (
                    <Button variant="outline" onClick={() => onSearchChange({})}>
                      Limpar filtros
                    </Button>
                  ) : null
                }
              />
            ) : data ? (
              <>
                {error ? (
                  <p role="alert" className="mb-4 text-sm text-destructive">
                    Falha ao atualizar: {(error as Error).message}{' '}
                    <button className="underline" onClick={() => void refetch()}>
                      Tentar novamente
                    </button>
                  </p>
                ) : null}
                <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-8 md:gap-y-12" data-testid="catalog-grid">
                  {data.items.map((nft, i) => (
                    <li key={nft.id}>
                      <NftCard nft={nft} priority={i < 3} />
                    </li>
                  ))}
                </ul>
                <Pagination page={data.page} totalPages={data.totalPages} onPage={goTo} />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto border-border bg-background p-0">
          <SheetHeader className="p-5 pb-0">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>{showing || 'Refine o catálogo'}</SheetDescription>
          </SheetHeader>
          <CatalogFilters search={search} facets={data?.facets} onChange={patch} idPrefix="m" />
          <div className="sticky bottom-0 border-t border-border bg-background p-4">
            <Button className="w-full" onClick={() => setFiltersOpen(false)}>
              Ver {showing || 'resultados'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
  const box = 'grid size-8 place-items-center rounded-sm border border-border text-sm transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40'
  return (
    <nav aria-label="Paginação" className="mt-12 flex justify-end" data-testid="pagination">
      <ul className="flex items-center gap-2">
        <li>
          <button type="button" className={box} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </li>
        {pages.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            {i > 0 && p - pages[i - 1] > 1 ? <span aria-hidden className="text-subtle">…</span> : null}
            <button
              type="button"
              className={cn(box, p === page && 'border-primary bg-primary font-bold text-primary-foreground hover:text-primary-foreground')}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Página ${p}`}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={box} onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Próxima página">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </li>
      </ul>
    </nav>
  )
}
