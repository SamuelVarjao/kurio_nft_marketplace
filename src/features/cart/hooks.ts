import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemRequest, CartResponse } from '@/contracts'
import { api } from '@/lib/api/endpoints'
import { qk } from '@/lib/query'
import { guestCartStore, useSession } from '@/features/auth/session-store'

/** Carrinho do usuário (servidor) ou do visitante (X-Cart-Id persistido). */
export function useCart() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.cart(user?.id ?? null),
    queryFn: async ({ signal }) => {
      const cart = await api.cart.get({ signal })
      if (cart.owner === 'guest') guestCartStore.set(cart.id)
      return cart
    },
    staleTime: 10_000,
  })
}

function useCartMutation<V>(fn: (vars: V) => Promise<CartResponse>) {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const key = qk.cart(user?.id ?? null)
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => {
      if (cart.owner === 'guest') guestCartStore.set(cart.id)
      queryClient.setQueryData(key, cart)
    },
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useAddToCart() {
  return useCartMutation((body: AddCartItemRequest) => api.cart.add(body))
}

export function useUpdateCartLine() {
  return useCartMutation(({ lineId, quantity }: { lineId: string; quantity: number }) => api.cart.update(lineId, quantity))
}

export function useRemoveCartLine() {
  return useCartMutation(({ lineId }: { lineId: string }) => api.cart.remove(lineId))
}

export function useApplyCoupon() {
  return useCartMutation(({ code }: { code: string }) => api.cart.applyCoupon(code))
}

export function useRemoveCoupon() {
  return useCartMutation(() => api.cart.removeCoupon())
}

export function useAcknowledgeCart() {
  return useCartMutation(() => api.cart.acknowledge())
}
