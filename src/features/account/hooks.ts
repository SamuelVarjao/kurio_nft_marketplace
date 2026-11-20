import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PasswordChangeRequest, ProfileUpdateRequest, User, WalletInput, WalletsResponse } from '@/contracts'
import { api } from '@/lib/api/endpoints'
import { qk } from '@/lib/query'
import { sessionStore, useSession } from '@/features/auth/session-store'

function useUserId() {
  const { user } = useSession()
  return user?.id ?? 'anon'
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: qk.profile(userId),
    queryFn: ({ signal }) => api.profile.get({ signal }),
    enabled: userId !== 'anon',
  })
}

function useProfileMutation<V>(fn: (v: V) => Promise<User>) {
  const qc = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: fn,
    onSuccess: (user) => {
      qc.setQueryData(qk.profile(userId), user)
      sessionStore.updateUser(user)
    },
  })
}

export const useUpdateProfile = () => useProfileMutation((body: ProfileUpdateRequest) => api.profile.update(body))
export const useUploadAvatar = () => useProfileMutation((dataUrl: string) => api.profile.uploadAvatar(dataUrl))
export const useRemoveAvatar = () => useProfileMutation(() => api.profile.removeAvatar())

export function useChangePassword() {
  return useMutation({ mutationFn: (body: PasswordChangeRequest) => api.profile.changePassword(body) })
}

export function useWallets() {
  const userId = useUserId()
  return useQuery({
    queryKey: qk.wallets(userId),
    queryFn: ({ signal }) => api.wallets.get({ signal }),
    enabled: userId !== 'anon',
  })
}

function useWalletsMutation<V>(fn: (v: V) => Promise<WalletsResponse>) {
  const qc = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: fn,
    onSuccess: (w) => qc.setQueryData(qk.wallets(userId), w),
  })
}

export const useSaveWallet = () =>
  useWalletsMutation(({ slot, body }: { slot: 'primary' | 'secondary'; body: WalletInput }) => api.wallets.save(slot, body))
export const useSameAsPrimary = () => useWalletsMutation((enabled: boolean) => api.wallets.setSameAsPrimary(enabled))

/** Redimensiona a imagem no cliente (máx. 256px, WebP) antes do upload. */
export async function prepareAvatar(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Formato não suportado. Use PNG, JPG ou WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Arquivo muito grande (máx. 5 MB).')
  const bitmap = await createImageBitmap(file)
  const size = 256
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  return canvas.toDataURL('image/webp', 0.85)
}
