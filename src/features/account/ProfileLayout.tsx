import type { ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { AlertTriangle, Download, Heart, LogOut, MapPin, ShoppingCart, Sparkles, User } from 'lucide-react'
import { useLogout } from '@/features/auth/hooks'
import { cn } from '@/lib/utils'

type Item =
  | { label: string; icon: typeof User; to: '/perfil' | '/perfil/carteiras' | '/perfil/favoritos' }
  | { label: string; icon: typeof User; to: '/em-breve/$secao'; secao: string }

const ITEMS: Item[] = [
  { label: 'Dados do perfil', icon: User, to: '/perfil' },
  { label: 'Carteiras', icon: MapPin, to: '/perfil/carteiras' },
  { label: 'Atividade', icon: ShoppingCart, to: '/em-breve/$secao', secao: 'atividade' },
  { label: 'Lista de interesse', icon: Heart, to: '/perfil/favoritos' },
  { label: 'Ofertas', icon: Sparkles, to: '/em-breve/$secao', secao: 'ofertas' },
  { label: 'Arquivos baixados', icon: Download, to: '/em-breve/$secao', secao: 'downloads' },
  { label: 'Suporte', icon: AlertTriangle, to: '/em-breve/$secao', secao: 'suporte' },
]

export function ProfileLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()
  const navigate = useNavigate()
  return (
    <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-6 pt-6 md:pt-7 lg:grid-cols-[274px_minmax(0,1fr)] lg:gap-6">
      <aside className="h-fit min-w-0 bg-card" aria-labelledby="profile-nav-title">
        <h2 id="profile-nav-title" className="px-2.5 pt-3 pb-2 text-lg font-bold">
          Meu perfil
        </h2>
        <nav aria-label="Meu perfil">
          <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
            {ITEMS.map((item) => {
              const active = item.to !== '/em-breve/$secao' && pathname === item.to
              const cls = cn(
                'relative flex shrink-0 items-center gap-2.5 px-4 py-2.5 text-sm whitespace-nowrap text-primary transition-colors hover:bg-primary/10',
                active && 'bg-primary/5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary',
              )
              const content = (
                <>
                  <item.icon className="size-4" aria-hidden /> {item.label}
                </>
              )
              return (
                <li key={item.label}>
                  {item.to === '/em-breve/$secao' ? (
                    <Link to={item.to} params={{ secao: item.secao }} className={cls}>
                      {content}
                    </Link>
                  ) : (
                    <Link to={item.to} className={cls} aria-current={active ? 'page' : undefined}>
                      {content}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSettled: () => void navigate({ to: '/' }) })}
          className="flex w-full items-center gap-2.5 border-t border-primary/40 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/10"
        >
          <LogOut className="size-4" aria-hidden /> Sair
        </button>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
