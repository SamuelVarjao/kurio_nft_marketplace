import { Link, useRouterState } from '@tanstack/react-router'
import { Heart, Home, LayoutGrid, ShoppingCart, User } from 'lucide-react'
import { useCart } from '@/features/cart/hooks'
import { useSession } from '@/features/auth/session-store'
import { cn } from '@/lib/utils'

/** Navegação inferior do frame mobile (Figma: Mobile / Início). */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { user } = useSession()
  const { data } = useCart()
  const count = data?.itemCount ?? 0
  const item = (active: boolean) =>
    cn('flex size-12 flex-col items-center justify-center rounded-full text-[10px]', active ? 'text-primary' : 'text-muted-foreground hover:text-primary')

  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        <li>
          <Link to="/" className={item(pathname === '/')} aria-current={pathname === '/' ? 'page' : undefined}>
            <Home className="size-5" aria-hidden />
            <span>Início</span>
          </Link>
        </li>
        <li>
          <Link to="/perfil/favoritos" className={item(pathname === '/perfil/favoritos')} aria-current={pathname === '/perfil/favoritos' ? 'page' : undefined}>
            <Heart className="size-5" aria-hidden />
            <span>Favoritos</span>
          </Link>
        </li>
        <li>
          <Link
            to="/mercado"
            className="-mt-6 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
            aria-label="Mercado"
            aria-current={pathname === '/mercado' ? 'page' : undefined}
          >
            <LayoutGrid className="size-6" aria-hidden />
          </Link>
        </li>
        <li>
          <Link to="/carrinho" className={cn(item(pathname === '/carrinho'), 'relative')} aria-label={`Carrinho, ${count} itens`} aria-current={pathname === '/carrinho' ? 'page' : undefined}>
            <ShoppingCart className="size-5" aria-hidden />
            <span aria-hidden>Carrinho</span>
            {count > 0 ? (
              <span aria-hidden className="absolute top-0 right-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-bold text-primary-foreground">
                {count}
              </span>
            ) : null}
          </Link>
        </li>
        <li>
          <Link
            to={user ? '/perfil' : '/entrar'}
            className={item(pathname.startsWith('/perfil') || pathname === '/entrar')}
            aria-current={pathname === '/perfil' ? 'page' : undefined}
          >
            <User className="size-5" aria-hidden />
            <span>{user ? 'Perfil' : 'Entrar'}</span>
          </Link>
        </li>
      </ul>
    </nav>
  )
}
