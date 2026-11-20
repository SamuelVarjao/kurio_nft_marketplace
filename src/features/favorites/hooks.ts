import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FavoritesResponse } from '@/contracts'
import { api } from '@/lib/api/endpoints'
import { notify } from '@/lib/announce'
import { qk } from '@/lib/query'
import { useSession } from '@/features/auth/session-store'

export function useFavorites() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.favorites(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
    enabled: Boolean(user),
  })
}

/**
 * Atualização otimista com rollback: o coração muda na hora; se a API
 * falhar, o estado anterior é restaurado e o usuário é avisado.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const key = qk.favorites(user?.id ?? 'anon')

  return useMutation({
    mutationKey: ['toggle-favorite'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const ids = new Set(old?.nftIds ?? [])
        if (favorite) ids.add(nftId)
        else ids.delete(nftId)
        return { nftIds: [...ids] }
      })
      return { previous }
    },
    onError: (error, vars, ctx) => {
      queryClient.setQueryData(key, ctx?.previous)
      notify('error', vars.favorite ? 'Não foi possível favoritar' : 'Não foi possível remover dos favoritos', `${vars.name}: ${error.message}`)
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(key, data)
      notify('success', vars.favorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos', vars.name)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
