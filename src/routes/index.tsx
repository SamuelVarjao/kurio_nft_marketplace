import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '@/features/home/HomePage'
import { catalogQuery, featuredQuery } from '@/features/catalog/hooks'
import { toCatalogQuery, validateCatalogSearch } from '@/features/catalog/search'

export const Route = createFileRoute('/')({
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  // prefetch não bloqueante: a navegação não espera, mas a requisição sai antes
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(featuredQuery)
    void context.queryClient.prefetchQuery(catalogQuery(toCatalogQuery(deps)))
  },
  component: HomeRoute,
})

function HomeRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return <HomePage search={search} onSearchChange={(next) => void navigate({ search: next, resetScroll: false })} />
}
