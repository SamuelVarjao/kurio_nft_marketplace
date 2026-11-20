import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { nftQuery } from '@/features/catalog/hooks'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/NftCard'
import { useFavorites } from '@/features/favorites/hooks'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export const Route = createFileRoute('/_authed/perfil/favoritos')({
  component: FavoritesPage,
})

function FavoritesPage() {
  useDocumentTitle('Lista de interesse')
  const favorites = useFavorites()
  const ids = favorites.data?.nftIds ?? []
  const nfts = useQueries({ queries: ids.map((id) => nftQuery(id)) })
  return (
    <section aria-labelledby="fav-title">
      <h1 id="fav-title" className="mb-6 text-base font-bold">
        Lista de interesse
      </h1>
      {favorites.isPending ? (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : favorites.error ? (
        <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} />
      ) : ids.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-8 text-primary" aria-hidden />}
          title="Nenhum favorito ainda"
          description="Toque no coração de um NFT para guardá-lo aqui."
          action={
            <Button asChild>
              <Link to="/mercado">Explorar mercado</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3" data-testid="favorites-grid">
          {nfts.map((q, i) => (
            <li key={ids[i]}>{q.data ? <NftCard nft={q.data} /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
