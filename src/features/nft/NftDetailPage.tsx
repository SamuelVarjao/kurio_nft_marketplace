import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Heart, Mail, Search, ShoppingCart, Star } from 'lucide-react'
import { Linkedin, Twitter } from '@/components/kurio/brand-icons'
import type { Edition, NftDetail } from '@/contracts'
import { NETWORKS } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { NftImage } from '@/components/kurio/NftImage'
import { QuantityStepper } from '@/components/kurio/QuantityStepper'
import { ErrorState } from '@/components/kurio/states'
import { NotFound } from '@/components/kurio/NotFound'
import { ApiError } from '@/lib/api/errors'
import { notify } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { cn } from '@/lib/utils'
import { useNft, useRelated } from '@/features/catalog/hooks'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/NftCard'
import { useAddToCart, useCart } from '@/features/cart/hooks'
import { useFavorites, useToggleFavorite } from '@/features/favorites/hooks'
import { useSession } from '@/features/auth/session-store'

export function NftDetailPage({ nftId }: { nftId: string }) {
  const { data: nft, error, isPending, refetch, isRefetching } = useNft(nftId)
  useDocumentTitle(nft?.name ?? (error ? 'NFT não encontrado' : 'Carregando NFT'))

  if (isPending) return <DetailSkeleton />
  if (error instanceof ApiError && error.status === 404)
    return <NotFound title="NFT não encontrado" description={`Não existe um NFT com o identificador "${nftId}". Ele pode ter sido removido.`} />
  if (error || !nft)
    return (
      <div className="container-page py-16">
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} title="Não foi possível carregar este NFT" />
      </div>
    )
  return <Detail nft={nft} />
}

function availabilityText(e: Edition) {
  if (e.available === 0) return 'Esgotada'
  if (e.available === null) return 'Edição aberta'
  return `${e.available} de ${e.supply} disponíveis`
}

function Detail({ nft }: { nft: NftDetail }) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useSession()
  const cart = useCart()
  const add = useAddToCart()
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const [imageIndex, setImageIndex] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [tab, setTab] = useState<'details' | 'reviews'>('details')

  const firstAvailable = nft.editions.find((e) => e.available !== 0)
  const [editionId, setEditionId] = useState(() => {
    const def = nft.editions.find((e) => e.id === nft.defaultEditionId)
    return def && def.available !== 0 ? def.id : (firstAvailable?.id ?? nft.defaultEditionId)
  })
  const edition = nft.editions.find((e) => e.id === editionId)!
  const inCart = cart.data?.lines.find((l) => l.editionId === editionId)?.quantity ?? 0
  const limit = edition.available === null ? edition.maxPerOrder : Math.min(edition.maxPerOrder, edition.available)
  const max = Math.max(0, limit - inCart)
  const [quantity, setQuantity] = useState(1)
  useEffect(() => setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, max))), [max])

  const unavailable = edition.available === 0 || max === 0
  const isFavorite = favorites.data?.nftIds.includes(nft.id) ?? false
  const network = NETWORKS.find((n) => n.id === nft.network)?.label ?? nft.network
  const image = nft.gallery[imageIndex] ?? nft.image

  const addToCart = (goToCart: boolean) =>
    add.mutate(
      { nftId: nft.id, editionId, quantity },
      {
        onSuccess: () => {
          notify('success', 'Adicionado ao carrinho', `${nft.name} · edição ${edition.label} · ${quantity} un.`)
          setQuantity(1)
          if (goToCart) void navigate({ to: '/carrinho' })
        },
        onError: (e) => notify('error', 'Não foi possível adicionar ao carrinho', e.message),
      },
    )

  const onFavorite = () => {
    if (!session.user) {
      notify('info', 'Entre para favoritar', 'Seus favoritos ficam salvos na sua conta.')
      void navigate({ to: '/entrar', search: { redirect: location.href } })
      return
    }
    toggleFavorite.mutate({ nftId: nft.id, favorite: !isFavorite, name: nft.name })
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = `${nft.name} na Kurio`

  return (
    <article className="pb-28 md:pb-0" aria-labelledby="nft-title">
      <div className="container-page pt-4 md:pt-6">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <button type="button" onClick={() => history.back()} className="grid size-9 place-items-center rounded-full bg-card" aria-label="Voltar">
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onFavorite}
            className={cn('grid size-9 place-items-center rounded-full bg-card', isFavorite && 'text-primary')}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
          >
            <Heart className={cn('size-4', isFavorite && 'fill-current')} aria-hidden />
          </button>
        </div>
        <nav aria-label="Trilha de navegação" className="mb-4 hidden text-sm font-bold md:block">
          <Link to="/" className="hover:text-primary">
            Início
          </Link>{' '}
          /{' '}
          <Link to="/mercado" className="hover:text-primary">
            Mercado
          </Link>{' '}
          / <span aria-current="page" className="text-muted-foreground">{nft.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-8">
          {/* galeria */}
          <div className="grid gap-4 md:grid-cols-[96px_1fr]">
            <ul className="order-2 flex gap-3 md:order-1 md:flex-col" aria-label="Vistas da obra">
              {nft.gallery.map((g, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setImageIndex(i)}
                    aria-label={`Mostrar vista ${i + 1}: ${g.alt}`}
                    aria-pressed={i === imageIndex}
                    className={cn('block w-16 overflow-hidden rounded-sm ring-2 md:w-24', i === imageIndex ? 'ring-primary' : 'ring-transparent hover:ring-primary/50')}
                  >
                    <NftImage image={g} sizes="96px" decorative />
                  </button>
                </li>
              ))}
            </ul>
            <div className="relative order-1 bg-card p-4 md:order-2 md:p-5">
              <NftImage image={image} sizes="(min-width: 1024px) 400px, 90vw" priority className="rounded-2xl" />
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-background/90 hover:text-primary"
                aria-label="Ampliar imagem"
              >
                <Search className="size-5" aria-hidden />
              </button>
            </div>
          </div>

          {/* informações */}
          <div className="flex flex-col gap-4">
            <h1 id="nft-title" className="text-2xl font-bold md:text-[28px]">
              {nft.name}
            </h1>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <p className="text-2xl font-bold text-primary" data-testid="detail-price">
                {formatEth(edition.price)}
                {nft.previousPrice && edition.id === nft.defaultEditionId ? (
                  <span className="ml-3 text-base font-normal text-subtle line-through">
                    <span className="sr-only">Preço anterior </span>
                    {formatEth(nft.previousPrice)}
                  </span>
                ) : null}
              </p>
              <p className="flex items-center gap-2 text-sm">
                <span className="flex text-primary" aria-hidden>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="size-4 fill-current" />
                  ))}
                </span>
                <span>
                  <span className="sr-only">Nota {nft.rating.average.toLocaleString('pt-BR')} de 5, </span>
                  {nft.rating.count} avaliações de colecionadores
                </span>
              </p>
            </div>

            <section aria-labelledby="about-title">
              <h2 id="about-title" className="mb-2 text-sm font-bold">
                Sobre este NFT:
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{nft.description}</p>
            </section>

            <fieldset>
              <legend className="mb-2 text-sm font-bold">Edição:</legend>
              <div role="radiogroup" aria-label="Edição" className="flex flex-wrap gap-2">
                {nft.editions.map((e) => {
                  const selected = e.id === editionId
                  const soldOut = e.available === 0
                  return (
                    <button
                      key={e.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-disabled={soldOut}
                      aria-describedby={`ed-${e.kind.replace('/', '-')}`}
                      onClick={() => !soldOut && setEditionId(e.id)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs transition-colors',
                        selected ? 'border-primary font-bold text-primary' : 'border-border text-muted-foreground hover:border-primary/60',
                        soldOut && 'cursor-not-allowed line-through opacity-50 hover:border-border',
                      )}
                      data-testid={`edition-${e.label}`}
                    >
                      {e.label}
                      <span id={`ed-${e.kind.replace('/', '-')}`} className="sr-only">
                        {`, ${formatEth(e.price)}, ${availabilityText(e)}`}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-subtle" data-testid="edition-availability">
                {availabilityText(edition)} · máx. {edition.maxPerOrder} por pedido
                {inCart ? ` · ${inCart} já no carrinho` : ''}
              </p>
            </fieldset>

            <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
              <QuantityStepper value={quantity} max={Math.max(1, max)} onChange={setQuantity} label={nft.name} disabled={unavailable} />
              <div className="flex gap-3">
                <Button onClick={() => addToCart(true)} disabled={unavailable || add.isPending} className="h-9 min-w-28 uppercase" data-testid="buy-button">
                  {unavailable ? (edition.available === 0 ? 'Esgotada' : 'Limite atingido') : 'Comprar'}
                </Button>
                <Button variant="outline" onClick={onFavorite} aria-pressed={isFavorite} className="h-9" data-testid="detail-favorite">
                  <Heart className={cn('size-4', isFavorite && 'fill-current')} aria-hidden />
                  {isFavorite ? 'Favoritado' : 'Favoritar'}
                </Button>
              </div>
            </div>
            {unavailable && edition.available !== 0 ? (
              <p className="text-xs text-warning" role="status">
                Você já tem o limite desta edição no carrinho.
              </p>
            ) : null}

            <dl className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div>
                <dt className="inline">ID do token: </dt>
                <dd className="inline">{nft.tokenId}</dd>
              </div>
              <div>
                <dt className="inline">Coleção: </dt>
                <dd className="inline">{nft.collection.name}</dd>
              </div>
              <div>
                <dt className="inline">Atributos: </dt>
                <dd className="inline">{nft.attributes.join(', ')}</dd>
              </div>
            </dl>
            <div className="flex items-center gap-3 text-sm font-bold">
              <span>Compartilhar este NFT:</span>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (abre em nova aba)" className="hover:text-primary">
                <Linkedin className="size-4" aria-hidden />
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`} aria-label="Compartilhar por e-mail" className="hover:text-primary">
                <Mail className="size-4" aria-hidden />
              </a>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no Twitter (abre em nova aba)" className="hover:text-primary">
                <Twitter className="size-4" aria-hidden />
              </a>
            </div>
          </div>
        </div>

        {/* abas */}
        <section className="mt-12 md:mt-20" aria-label="Mais informações">
          <div role="tablist" className="flex gap-8 border-b border-border">
            {(
              [
                ['details', 'Detalhes do NFT'],
                ['reviews', `Avaliações de colecionadores (${nft.rating.count})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className={cn('-mb-px border-b-2 pb-2 text-sm md:text-base', tab === id ? 'border-primary font-bold text-primary' : 'border-transparent hover:text-primary')}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'details' ? (
            <div id="panel-details" role="tabpanel" aria-labelledby="tab-details" className="flex flex-col gap-4 py-4 text-sm leading-relaxed text-muted-foreground">
              {nft.longDescription.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <h3 className="font-bold text-foreground">Rede:</h3>
              <p className="-mt-3">Cunhado na {network} com procedência imutável e metadados armazenados no IPFS.</p>
              <h3 className="font-bold text-foreground">Contrato:</h3>
              <p className="-mt-3">Direitos autorais do criador: {nft.creator.royaltyBps / 100}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p>
              <h3 className="font-bold text-foreground">Direitos autorais:</h3>
              <p className="-mt-3 break-all">
                {nft.contractAddress.slice(0, 6)}…{nft.contractAddress.slice(-4)} · Contrato inteligente ERC-721 verificado.
              </p>
            </div>
          ) : (
            <div id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" className="py-6 text-sm text-muted-foreground">
              Nota média {nft.rating.average.toLocaleString('pt-BR')} de 5 em {nft.rating.count} avaliações. A leitura das avaliações individuais não faz parte desta demonstração.
            </div>
          )}
        </section>

        <Related nftId={nft.id} />
      </div>

      {/* barra fixa de compra — mobile */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card px-4 py-3 md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden>Qtd.</span>
            <QuantityStepper size="sm" value={quantity} max={Math.max(1, max)} onChange={setQuantity} label={nft.name} disabled={unavailable} />
          </div>
          <p className="text-lg font-bold text-primary">{formatEth(edition.price)}</p>
        </div>
        <div className="flex gap-3">
          <Button className="h-11 flex-1 rounded-full" onClick={() => addToCart(true)} disabled={unavailable || add.isPending}>
            {unavailable ? 'Indisponível' : 'Comprar NFT'}
          </Button>
          <Button variant="surface" size="icon-lg" className="rounded-full" onClick={() => addToCart(false)} disabled={unavailable || add.isPending} aria-label="Adicionar ao carrinho">
            <ShoppingCart aria-hidden />
          </Button>
        </div>
      </div>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="border border-border bg-card p-3 sm:max-w-2xl">
          <DialogTitle className="sr-only">{nft.name}</DialogTitle>
          <DialogDescription className="sr-only">{image.alt}</DialogDescription>
          <NftImage image={image} sizes="(min-width: 768px) 640px, 95vw" className="rounded-xl" />
        </DialogContent>
      </Dialog>
    </article>
  )
}

function Related({ nftId }: { nftId: string }) {
  const { data, isPending } = useRelated(nftId)
  const items = useMemo(() => data?.items ?? [], [data])
  return (
    <section aria-labelledby="related-title" className="mt-12 md:mt-20">
      <h2 id="related-title" className="mb-6 border-b border-border pb-3 text-base font-bold text-primary">
        Mais desta coleção
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0" aria-label="NFTs relacionados">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-40 shrink-0 md:w-[calc((100%-4rem)/5)]">
                <NftCardSkeleton />
              </li>
            ))
          : items.map((n) => (
              <li key={n.id} className="w-40 shrink-0 snap-start md:w-[calc((100%-4rem)/5)]">
                <NftCard nft={n} compact />
              </li>
            ))}
      </ul>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page pt-6" aria-busy="true" aria-label="Carregando NFT" data-testid="detail-skeleton">
      <Skeleton className="mb-4 hidden h-4 w-40 md:block" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,560px)_1fr]">
        <div className="grid gap-4 md:grid-cols-[96px_1fr]">
          <div className="order-2 flex gap-3 md:order-1 md:flex-col">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-square w-16 md:w-24" />
            ))}
          </div>
          <div className="order-1 bg-card p-4 md:order-2 md:p-5">
            <Skeleton className="aspect-square w-full rounded-2xl" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-2/3" />
        </div>
      </div>
    </div>
  )
}
