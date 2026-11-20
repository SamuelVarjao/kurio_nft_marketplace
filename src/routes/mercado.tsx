import { createFileRoute, Link } from '@tanstack/react-router'
import { catalogQuery } from '@/features/catalog/hooks'
import { CatalogSection } from '@/features/catalog/components/CatalogSection'
import { toCatalogQuery, validateCatalogSearch } from '@/features/catalog/search'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export const Route = createFileRoute('/mercado')({
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(catalogQuery(toCatalogQuery(deps)))
  },
  component: MarketRoute,
})

function MarketRoute() {
  useDocumentTitle('Mercado')
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <>
      <div className="container-page pt-6">
        <nav aria-label="Trilha de navegação" className="text-sm font-bold">
          <Link to="/" className="hover:text-primary">
            Início
          </Link>{' '}
          / <span aria-current="page">Mercado</span>
        </nav>
        <h1 className="mt-4 text-2xl font-bold">Mercado</h1>
      </div>
      <CatalogSection search={search} onSearchChange={(next) => void navigate({ search: next, resetScroll: false })} headingId="mercado-catalogo" />
    </>
  )
}
