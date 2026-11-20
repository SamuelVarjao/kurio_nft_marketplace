import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest, SessionResponse } from '@/contracts'
import { api } from '@/lib/api/endpoints'
import { qk } from '@/lib/query'
import { guestCartStore, sessionStore, useSession } from './session-store'

/** Inicia a sessão e preserva o carrinho do visitante (merge no servidor). */
async function establish(session: SessionResponse, queryClient: ReturnType<typeof useQueryClient>) {
  // limpa qualquer resquício privado de uma sessão anterior
  queryClient.removeQueries({ queryKey: qk.privateAll })
  queryClient.removeQueries({ queryKey: qk.cartAll })
  sessionStore.start(session)
  const guestCartId = guestCartStore.get()
  if (guestCartId) {
    try {
      const merged = await api.cart.merge(guestCartId)
      queryClient.setQueryData(qk.cart(session.user.id), merged)
    } finally {
      guestCartStore.clear()
    }
  }
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginRequest) => api.auth.login(body),
    onSuccess: (session) => establish(session, queryClient),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RegisterRequest) => api.auth.register(body),
    onSuccess: (session) => establish(session, queryClient),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout()
      } catch {
        /* logout local mesmo se a API falhar */
      }
    },
    onSettled: () => {
      sessionStore.end('logout')
      queryClient.removeQueries({ queryKey: qk.privateAll })
      queryClient.removeQueries({ queryKey: qk.cartAll })
    },
  })
}

/** Revalida a sessão persistida ao carregar a página (recuperação após refresh). */
export function useSessionCheck() {
  const session = useSession()
  return useQuery({
    queryKey: ['session-check', session.generation],
    enabled: Boolean(session.token),
    queryFn: async ({ signal }) => {
      const res = await api.auth.session({ signal })
      sessionStore.updateUser(res.user)
      return res
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}
