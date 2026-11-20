import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart, LogIn, LogOut, Search, ShoppingCart, User, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useCart } from '@/features/cart/hooks'
import { useLogout } from '@/features/auth/hooks'
import { useSession } from '@/features/auth/session-store'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Início', match: (p: string) => p === '/' },
  { to: '/mercado', label: 'Mercado', match: (p: string) => /^\/(mercado|nft|carrinho|pagamento|pedido)/.test(p) },
  { to: '/em-breve/$secao', secao: 'criadores', label: 'Criadores', match: (p: string) => p === '/em-breve/criadores' },
  { to: '/em-breve/$secao', secao: 'aprenda', label: 'Aprenda', match: (p: string) => p === '/em-breve/aprenda' },
] as const

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-sm font-bold tracking-[0.2em] text-foreground', className)} aria-label="Kurio — página inicial">
      KURIO
    </Link>
  )
}

export function CartButton({ className }: { className?: string }) {
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  return (
    <Link
      to="/carrinho"
      className={cn('relative grid size-10 place-items-center rounded-sm text-foreground hover:text-primary', className)}
      aria-label={count ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
      data-testid="header-cart"
    >
      <ShoppingCart className="size-6" aria-hidden />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute top-0.5 right-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground"
          data-testid="cart-count"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  )
}

export function SearchDialog({
  open,
  onOpenChange,
  returnFocusTo,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  returnFocusTo?: React.RefObject<HTMLButtonElement | null>
}) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-24 translate-y-0 border border-border bg-card sm:max-w-lg"
        onCloseAutoFocus={(e) => {
          if (returnFocusTo?.current) {
            e.preventDefault()
            returnFocusTo.current.focus()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Buscar NFTs</DialogTitle>
          <DialogDescription>Procure por nome, coleção ou ID do token.</DialogDescription>
        </DialogHeader>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            onOpenChange(false)
            void navigate({ to: '/mercado', search: { q: value.trim() || undefined } })
          }}
          className="flex gap-2"
        >
          <label htmlFor="global-search" className="sr-only">
            Termo de busca
          </label>
          <Input id="global-search" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Explorar coleções" />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function UserMenu() {
  const session = useSession()
  const logout = useLogout()
  const navigate = useNavigate()
  const location = useLocation()
  if (!session.user) {
    return (
      <Button asChild size="default" className="h-9 px-3">
        <Link to="/entrar" search={{ redirect: location.href }} data-testid="header-login">
          <LogIn className="size-5" aria-hidden />
          Entrar
        </Link>
      </Button>
    )
  }
  const u = session.user
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-9 items-center gap-2 rounded-sm border border-border px-2 text-sm hover:border-primary"
          aria-label={`Menu da conta de ${u.displayName}`}
          data-testid="user-menu"
        >
          {u.avatarUrl ? (
            <img src={u.avatarUrl} alt="" className="size-6 rounded-full object-cover" />
          ) : (
            <User className="size-5 text-primary" aria-hidden />
          )}
          <span className="hidden max-w-32 truncate lg:inline">{u.displayName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border border-border bg-card">
        <DropdownMenuLabel className="truncate">{u.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: '/perfil' })}>
          <User aria-hidden /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/perfil/carteiras' })}>
          <Wallet aria-hidden /> Carteiras
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/perfil/favoritos' })}>
          <Heart aria-hidden /> Lista de interesse
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })
          }
          data-testid="logout"
        >
          <LogOut aria-hidden /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [searchOpen, setSearchOpen] = useState(false)
  const searchButton = useRef<HTMLButtonElement>(null)
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container-page flex h-16 items-center justify-between gap-4 border-b border-border md:h-[68px]">
        <Logo />
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-6 lg:gap-10">
            {NAV.map((item) => {
              const active = item.match(pathname)
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    params={'secao' in item ? { secao: item.secao } : {}}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-block py-5 text-[15px] transition-colors hover:text-primary',
                      active ? 'font-bold text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary' : 'text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="flex items-center gap-1 sm:gap-3">
          <button
            ref={searchButton}
            type="button"
            onClick={() => setSearchOpen(true)}
            className="grid size-10 place-items-center rounded-sm hover:text-primary"
            aria-label="Buscar"
          >
            <Search className="size-6" aria-hidden />
          </button>
          <CartButton className="hidden md:grid" />
          <div className="hidden md:block">
            <UserMenu />
          </div>
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} returnFocusTo={searchButton} />
    </header>
  )
}
