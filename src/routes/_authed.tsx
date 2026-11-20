import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { sessionStore } from '@/features/auth/session-store'

/**
 * Guard das rotas privadas (checkout, pedido, perfil, carteiras, favoritos).
 * Sem sessão válida → login com `redirect` para retomar o fluxo.
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ location }) => {
    const s = sessionStore.get()
    if (!s.token || sessionStore.isExpiredLocally()) {
      throw redirect({ to: '/entrar', search: { redirect: location.href, reason: s.token ? 'expired' : undefined } })
    }
  },
  component: () => <Outlet />,
})
