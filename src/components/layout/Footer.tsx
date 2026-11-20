import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from '@/components/kurio/brand-icons'
import type { CategoryId } from '@/contracts'
import { notify } from '@/lib/announce'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

type FooterLink =
  | { label: string; to: '/perfil' | '/perfil/favoritos' | '/perfil/carteiras' }
  | { label: string; to: '/em-breve/$secao'; secao: string }
  | { label: string; to: '/mercado'; cat: CategoryId }
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', to: '/perfil' },
      { label: 'Minha coleção', to: '/em-breve/$secao', secao: 'colecao' },
      { label: 'Atividade', to: '/em-breve/$secao', secao: 'atividade' },
      { label: 'Estúdio do criador', to: '/em-breve/$secao', secao: 'estudio' },
      { label: 'Lista de interesse', to: '/perfil/favoritos' },
    ],
  },
  {
    title: 'Central de ajuda',
    links: [
      { label: 'Central de ajuda', to: '/em-breve/$secao', secao: 'suporte' },
      { label: 'Como comprar NFTs', to: '/em-breve/$secao', secao: 'aprenda' },
      { label: 'Carteira e segurança', to: '/perfil/carteiras' },
      { label: 'Política do mercado', to: '/em-breve/$secao', secao: 'politica' },
      { label: 'Denunciar item', to: '/em-breve/$secao', secao: 'suporte' },
    ],
  },
  {
    title: 'Coleções',
    links: [
      { label: 'Arte digital', to: '/mercado', cat: 'arte-digital' },
      { label: 'Fotografia', to: '/mercado', cat: 'fotografia' },
      { label: 'Música', to: '/mercado', cat: 'musica' },
      { label: 'Arte 3D', to: '/mercado', cat: 'arte-3d' },
      { label: 'Utilidade', to: '/mercado', cat: 'utilidade' },
    ],
  },
]

/** Sem perfis oficiais: cada rede abre a busca por "kurio nft". */
const SOCIAL_QUERY = encodeURIComponent('kurio nft')
const SOCIAL = [
  { label: 'Facebook', Icon: Facebook, href: `https://www.facebook.com/search/top?q=${SOCIAL_QUERY}` },
  { label: 'Instagram', Icon: Instagram, href: `https://www.instagram.com/explore/search/keyword/?q=${SOCIAL_QUERY}` },
  { label: 'Twitter', Icon: Twitter, href: `https://x.com/search?q=${SOCIAL_QUERY}` },
  { label: 'LinkedIn', Icon: Linkedin, href: `https://www.linkedin.com/search/results/all/?keywords=${SOCIAL_QUERY}` },
  { label: 'YouTube', Icon: Youtube, href: `https://www.youtube.com/results?search_query=${SOCIAL_QUERY}` },
]

function FooterAnchor({ link }: { link: FooterLink }) {
  const cls = 'hover:text-primary'
  if (link.to === '/em-breve/$secao')
    return (
      <Link to={link.to} params={{ secao: link.secao }} className={cls}>
        {link.label}
      </Link>
    )
  if (link.to === '/mercado')
    return (
      <Link to={link.to} search={{ cat: link.cat }} className={cls}>
        {link.label}
      </Link>
    )
  return (
    <Link to={link.to} className={cls}>
      {link.label}
    </Link>
  )
}

export function WalletBadges({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-sm border border-primary/40 bg-band px-3 py-1 text-[9px] font-bold tracking-wider text-primary ${className}`}>
      METAMASK <span aria-hidden>·</span> WALLETCONNECT <span aria-hidden>·</span> COINBASE
    </span>
  )
}

function Newsletter() {
  const id = useId()
  const [email, setEmail] = useState('')
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg leading-tight font-bold">Antecipe-se ao próximo lançamento</h2>
      <form
        className="flex"
        onSubmit={(e) => {
          e.preventDefault()
          // fora do escopo da entrega: não simula sucesso
          notify('info', 'Newsletter indisponível nesta demonstração', 'Nenhum e-mail foi cadastrado.')
          setEmail('')
        }}
      >
        <label htmlFor={id} className="sr-only">
          E-mail para a newsletter
        </label>
        <input
          id={id}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          className="h-10 min-w-0 flex-1 rounded-l-sm border border-r-0 border-border bg-band/60 px-3 text-sm placeholder:text-subtle"
        />
        <button type="submit" className="rounded-r-sm bg-primary px-4 font-bold text-primary-foreground hover:bg-primary-hover">
          Enviar
        </button>
      </form>
      <p className="text-xs leading-relaxed text-muted-foreground">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="container-page mt-16 pb-24 md:mt-24 md:pb-6">
      <div className="overflow-hidden rounded-sm bg-card">
        <div className="grid gap-8 px-6 py-8 md:grid-cols-2 md:px-10 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.letter} className="flex flex-col gap-3 lg:border-r lg:border-primary/50 lg:pr-6">
              <span aria-hidden className="grid size-14 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {f.letter}
              </span>
              <h2 className="text-base font-bold">{f.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
          <Newsletter />
        </div>
        <div className="grid gap-3 bg-band px-6 py-6 text-sm sm:grid-cols-2 md:px-10 lg:grid-cols-4 lg:items-center">
          <span className="font-bold tracking-[0.2em]">KURIO</span>
          <p>Feito para colecionadores, criadores e cultura</p>
          <a href="mailto:contato@email.com" className="hover:text-primary">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-primary">
            +55 11 4002 8922
          </a>
        </div>
        <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 md:px-10 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-3 text-base font-bold">{col.title}</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterAnchor link={l} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="mb-3 text-base font-bold">Redes sociais</h2>
              <ul className="flex gap-2">
                {SOCIAL.map(({ label, Icon, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid size-8 place-items-center rounded-sm border border-primary/50 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                      title={`Buscar "kurio nft" no ${label}`}
                    >
                      <Icon className="size-4" aria-hidden />
                      <span className="sr-only">Buscar Kurio NFT no {label} (abre em nova aba)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-base font-bold">Carteiras compatíveis</h2>
              <WalletBadges />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
