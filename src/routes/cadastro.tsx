import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthDialog } from '@/features/auth/AuthDialog'
import { safeRedirect } from '@/features/auth/redirect'
import { sessionStore } from '@/features/auth/session-store'
import { HomePage } from '@/features/home/HomePage'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

interface AuthSearch {
  redirect?: string
  reason?: 'expired'
}

export const Route = createFileRoute('/cadastro')({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    redirect: safeRedirect(s.redirect),
    reason: s.reason === 'expired' ? 'expired' : undefined,
  }),
  beforeLoad: ({ search }) => {
    // já autenticado → segue para o destino
    if (sessionStore.get().token && !sessionStore.isExpiredLocally()) throw redirect({ href: search.redirect ?? '/' })
  },
  component: AuthRoute,
})

function AuthRoute() {
  const { redirect: to, reason } = Route.useSearch()
  useDocumentTitle('Criar conta')
  return (
    <>
      <div className="max-sm:hidden">
        <HomePage search={{}} onSearchChange={() => undefined} />
      </div>
      <AuthDialog mode="register" redirect={to} reason={reason} />
    </>
  )
}
