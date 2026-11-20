import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NftImage } from '@/components/kurio/NftImage'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { cn } from '@/lib/utils'
import { useFeatured } from '@/features/catalog/hooks'
import { CatalogSection } from '@/features/catalog/components/CatalogSection'
import type { CatalogSearch } from '@/features/catalog/search'

export function HomePage({ search, onSearchChange }: { search: CatalogSearch; onSearchChange: (s: CatalogSearch) => void }) {
  useDocumentTitle('Seja dono do futuro da arte digital')
  return (
    <>
      <Hero />
      <CatalogSection search={search} onSearchChange={onSearchChange} aside={<Spotlight />} />
      <Promos />
      <Journal />
    </>
  )
}

function Hero() {
  const { data } = useFeatured()
  const [index, setIndex] = useState(0)
  const slides = data?.hero ?? []
  const current = slides[index]
  return (
    <section aria-labelledby="hero-title" className="container-page pt-4 md:pt-3">
      <div className="relative grid grid-cols-[1fr_42%] items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-[#5a3720] to-card p-4 md:grid-cols-[1fr_minmax(0,450px)] md:gap-10 md:rounded-none md:bg-none md:p-0 md:pl-12">
        <div className="relative z-10 flex flex-col gap-2 md:gap-6 md:py-16">
          <p className="text-[10px] tracking-wider md:text-sm">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="text-sm leading-snug font-bold tracking-wide uppercase sm:text-2xl md:text-[40px] md:leading-[1.6]">
            Seja dono do futuro
            <br /> da arte digital
          </h1>
          <p className="line-clamp-3 max-w-lg text-[10px] leading-relaxed text-muted-foreground sm:text-xs md:line-clamp-none md:text-sm md:leading-6">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <div>
            <Button asChild className="h-8 px-3 text-xs uppercase md:h-10 md:px-7 md:text-sm">
              <a href="#catalogo">Explorar</a>
            </Button>
          </div>
        </div>
        <div className="relative">
          {current ? (
            <Link to="/nft/$nftId" params={{ nftId: current.id }} aria-label={`Ver ${current.name}`} className="block">
              <NftImage image={current.image} sizes="(min-width: 768px) 450px, 42vw" priority className="rounded-xl md:rounded-2xl" />
            </Link>
          ) : (
            <Skeleton className="aspect-square w-full rounded-2xl" />
          )}
        </div>
        {slides.length > 1 ? (
          <div className="col-span-2 -mt-2 flex justify-center gap-1 md:absolute md:bottom-6 md:left-[52%] md:mt-0" role="group" aria-label="Destaques">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Destaque ${i + 1}: ${s.name}`}
                aria-pressed={i === index}
                className="grid size-6 place-items-center"
              >
                <span className={cn('block size-2 rounded-full bg-primary transition-opacity', i === index ? 'opacity-100' : 'opacity-40')} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Spotlight() {
  const { data } = useFeatured()
  const s = data?.spotlight
  return (
    <section aria-labelledby="spotlight-title" className="flex flex-col">
      <div className="bg-card px-5 pt-4 pb-3">
        <h2 id="spotlight-title" className="text-xl font-bold text-primary uppercase">
          NFT em destaque
        </h2>
        <p className="pl-5 text-base font-bold uppercase">Oferta limitada</p>
      </div>
      {s ? (
        <Link to="/nft/$nftId" params={{ nftId: s.id }} className="group block" aria-label={`NFT em destaque: ${s.name}`}>
          <NftImage image={s.image} sizes="310px" className="rounded-2xl transition-transform group-hover:scale-[1.01]" />
        </Link>
      ) : (
        <Skeleton className="aspect-square w-full rounded-2xl" />
      )}
    </section>
  )
}

const PROMOS = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: { src: '/images/nfts/emerald', alt: '' },
    search: { tab: 'new' as const },
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: { src: '/images/nfts/ivory', alt: '' },
    search: { cat: 'arte-digital' },
  },
]

function Promos() {
  return (
    <section aria-label="Coleções em destaque" className="container-page mt-16 grid gap-6 md:mt-24 lg:grid-cols-2 lg:gap-4">
      {PROMOS.map((p) => (
        <article key={p.title} className="grid grid-cols-[minmax(0,45%)_1fr] items-center overflow-hidden rounded-sm bg-card">
          <NftImage image={p.image} sizes="(min-width: 1024px) 270px, 45vw" decorative className="h-full" />
          <div className="flex flex-col items-end gap-3 p-4 text-right md:p-5">
            <h2 className="text-sm leading-snug font-bold md:text-base">{p.title}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{p.text}</p>
            <Button asChild size="sm" className="h-8 px-4">
              <Link to="/mercado" search={p.search}>
                Explorar <ArrowRight className="size-3" aria-hidden />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: '6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', art: 'ivory' },
  { date: '13 de setembro', read: '2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', art: 'emerald' },
  { date: '15 de setembro', read: '3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', art: 'violet' },
  { date: '15 de setembro', read: '2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', art: 'golden' },
]

function Journal() {
  return (
    <section aria-labelledby="journal-title" className="container-page mt-16 md:mt-24">
      <div className="mb-8 text-center">
        <h2 id="journal-title" className="text-xl font-bold md:text-2xl">
          Diário da Cunhagem
        </h2>
        <p className="mt-3 text-xs text-muted-foreground md:text-sm">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </div>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((p) => (
          <li key={p.title}>
            <article className="relative flex h-full flex-col overflow-hidden rounded-sm bg-card">
              <img src={`/images/nfts/${p.art}-320.webp`} alt="" width={320} height={200} loading="lazy" className="aspect-[16/10] w-full object-cover object-top" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-[11px] text-subtle">
                  {p.date} <span aria-hidden>|</span> Leitura de {p.read}
                </p>
                <h3 className="text-sm font-bold">{p.title}</h3>
                <p className="text-xs text-muted-foreground">{p.text}</p>
                <Link
                  to="/em-breve/$secao"
                  params={{ secao: 'diario' }}
                  className="mt-auto text-xs font-bold text-primary after:absolute after:inset-0 hover:underline"
                  aria-label={`Ler mais: ${p.title}`}
                >
                  Ler mais →
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
