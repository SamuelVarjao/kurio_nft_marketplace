import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { api } from '@/lib/api/endpoints'
import { notify } from '@/lib/announce'
import { qk } from '@/lib/query'
import { useSessionCheck } from '@/features/auth/hooks'
import { sessionStore, useSession } from '@/features/auth/session-store'

/**
 * Efeitos globais de sessão:
 * - revalida a sessão persistida ao carregar (refresh);
 * - agenda verificação quando o token expira localmente;
 * - ao expirar/invalidar: limpa caches privados e leva ao login preservando
 *   a rota atual em `redirect` (o checkout também guarda o rascunho).
 */
export function SessionEffects() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const session = useSession()
  useSessionCheck()

  useEffect(
    () =>
      sessionStore.onEnd((reason) => {
        queryClient.removeQueries({ queryKey: qk.privateAll })
        queryClient.removeQueries({ queryKey: qk.cartAll })
        if (reason === 'logout') return
        notify('warning', 'Sua sessão expirou', 'Entre novamente para continuar de onde parou.')
        const href = router.state.location.href
        if (!router.state.location.pathname.startsWith('/entrar')) {
          void router.navigate({ to: '/entrar', search: { redirect: href, reason: 'expired' } })
        }
      }),
    [queryClient, router],
  )

  useEffect(() => {
    if (!session.expiresAt) return
    const wait = Date.parse(session.expiresAt) - Date.now()
    const t = setTimeout(
      () => {
        // confirma no servidor; um 401 encerra a sessão via interceptor
        api.auth.session().catch(() => undefined)
      },
      Math.max(0, wait + 250),
    )
    return () => clearTimeout(t)
  }, [session.expiresAt])

  return null
}
