import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/contracts'
import { NftImage } from '@/components/kurio/NftImage'
import { EthPrice } from '@/components/kurio/EthPrice'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart } from '@/features/cart/hooks'
import { useFavorites, useToggleFavorite } from '@/features/favorites/hooks'
import { useSession } from '@/features/auth/session-store'
import { notify } from '@/lib/announce'
import { cn } from '@/lib/utils'

const SIZES = '(min-width: 1280px) 260px, (min-width: 768px) 30vw, 46vw'

export function NftCard({ nft, priority = false, compact = false }: { nft: NftSummary; priority?: boolean; compact?: boolean }) {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const add = useAddToCart()
  const isFavorite = favorites.data?.nftIds.includes(nft.id) ?? false

  const onFavorite = () => {
    if (!session.user) {
      notify('info', 'Entre para favoritar', 'Seus favoritos ficam salvos na sua conta.')
      void navigate({ to: '/entrar', search: { redirect: location.href } })
      return
    }
    toggle.mutate({ nftId: nft.id, favorite: !isFavorite, name: nft.name })
  }

  const onAdd = () =>
    add.mutate(
      { nftId: nft.id, editionId: `${nft.id}:1/50`, quantity: 1 },
      {
        onSuccess: () => notify('success', 'Adicionado ao carrinho', `${nft.name} · edição 1/50`),
        onError: (e) => notify('error', 'Não foi possível adicionar', e.message),
      },
    )

  const action =
    'grid size-9 place-items-center rounded-sm bg-background/90 text-foreground transition-colors hover:text-primary focus-visible:text-primary disabled:opacity-50'

  return (
    <article className="group relative flex flex-col gap-3" aria-labelledby={`nft-${nft.id}-name`} data-testid="nft-card">
      <div className="relative bg-card p-2 md:p-4">
        {nft.rarity !== 'common' ? (
          <span className="absolute top-2 left-0 z-10 bg-primary px-3 py-1 text-xs font-bold text-primary-foreground md:top-4">
            {nft.rarity === 'rare' ? 'RARO' : 'LENDÁRIO'}
          </span>
        ) : null}
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} tabIndex={-1} aria-hidden>
          <NftImage image={nft.image} sizes={SIZES} priority={priority} className="rounded-xl" decorative />
        </Link>
        {nft.soldOut ? (
          <span className="absolute right-3 bottom-3 rounded-sm bg-background/90 px-2 py-1 text-xs font-bold text-warning md:right-5 md:bottom-5">
            Esgotado
          </span>
        ) : null}
        {!compact ? (
          <div
            className={cn(
              'absolute top-3 right-3 z-20 flex gap-1 md:inset-x-0 md:top-auto md:right-auto md:bottom-4 md:justify-center',
              'transition-opacity [@media(hover:hover)]:opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
            )}
          >
            <button type="button" className={cn(action, 'hidden md:grid')} onClick={onAdd} disabled={nft.soldOut || add.isPending} aria-label={`Adicionar ${nft.name} ao carrinho`}>
              <ShoppingCart className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              className={cn(action, isFavorite && 'text-primary', 'max-md:size-8 max-md:rounded-full')}
              onClick={onFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
              data-testid="favorite-toggle"
            >
              <Heart className={cn('size-5 max-md:size-4', isFavorite && 'fill-current')} aria-hidden />
            </button>
            <Link to="/nft/$nftId" params={{ nftId: nft.id }} className={cn(action, 'hidden md:grid')} aria-label={`Ver detalhes de ${nft.name}`}>
              <Search className="size-5" aria-hidden />
            </Link>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        <h3 id={`nft-${nft.id}-name`} className="truncate text-sm md:text-base">
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none" data-testid="nft-card-link">
            {nft.name}
          </Link>
        </h3>
        <EthPrice value={nft.price} previous={nft.previousPrice} className="relative text-sm md:text-base" />
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" data-testid="nft-card-skeleton">
      <div className="bg-card p-2 md:p-4">
        <Skeleton className="aspect-square w-full rounded-xl" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}
