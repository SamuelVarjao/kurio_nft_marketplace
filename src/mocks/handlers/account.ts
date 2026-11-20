import { http, HttpResponse } from 'msw'
import {
  API_BASE,
  type AvatarUploadRequest,
  type PasswordChangeRequest,
  type ProfileUpdateRequest,
  type Wallet,
  type WalletInput,
  type WalletsResponse,
} from '@/contracts'
import { passwordChangeRequestSchema, profileSchema, walletSchema, zodFieldErrors } from '@/contracts/schemas'
import { db, now, persist, publicUser } from '../db/store'
import { apiError, authenticate, readJson, withConditions } from '../lib/http'
import { sha256Hex } from '../lib/random'
import { getScenario } from '../scenarios'

const MAX_AVATAR_BYTES = 350_000

function walletsOf(userId: string): WalletsResponse {
  const w = db.wallets[userId] ?? { primary: null, secondary: null, secondarySameAsPrimary: false }
  return {
    primary: w.primary,
    secondary: w.secondarySameAsPrimary && w.primary ? { ...w.primary, slot: 'secondary' } : w.secondary,
    secondarySameAsPrimary: w.secondarySameAsPrimary,
  }
}

export const accountHandlers = [
  /* --------------------------------------------------------------- favoritos */
  http.get(
    `${API_BASE}/favorites`,
    withConditions('favorites', ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      return HttpResponse.json({ nftIds: db.favorites[auth.user.id] ?? [] })
    }),
  ),

  http.put(
    `${API_BASE}/favorites/:nftId`,
    withConditions('favorites', ({ request, params }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      if (getScenario().favoritesFail) return apiError(500, 'INTERNAL', 'Não foi possível salvar o favorito.', { retryable: true })
      const id = String(params.nftId)
      if (!db.nfts[id]) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
      const list = new Set(db.favorites[auth.user.id] ?? [])
      list.add(id)
      db.favorites[auth.user.id] = [...list]
      persist()
      return HttpResponse.json({ nftIds: db.favorites[auth.user.id] })
    }),
  ),

  http.delete(
    `${API_BASE}/favorites/:nftId`,
    withConditions('favorites', ({ request, params }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      if (getScenario().favoritesFail) return apiError(500, 'INTERNAL', 'Não foi possível remover o favorito.', { retryable: true })
      db.favorites[auth.user.id] = (db.favorites[auth.user.id] ?? []).filter((x) => x !== String(params.nftId))
      persist()
      return HttpResponse.json({ nftIds: db.favorites[auth.user.id] })
    }),
  ),

  /* ------------------------------------------------------------------ perfil */
  http.get(
    `${API_BASE}/profile`,
    withConditions('profile', ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      return HttpResponse.json(publicUser(auth.user))
    }),
  ),

  http.patch(
    `${API_BASE}/profile`,
    withConditions('profile', async ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const parsed = profileSchema.safeParse(await readJson<ProfileUpdateRequest>(request))
      if (!parsed.success)
        return apiError(422, 'VALIDATION_FAILED', 'Revise os campos destacados.', { fields: zodFieldErrors(parsed.error) })
      const fields: Record<string, string> = {}
      for (const u of Object.values(db.users)) {
        if (u.id === auth.user.id) continue
        if (u.email.toLowerCase() === parsed.data.email.toLowerCase()) fields.email = 'Este e-mail já está em uso.'
        if (u.username.toLowerCase() === parsed.data.username.toLowerCase()) fields.username = 'Este nome de usuário já está em uso.'
      }
      if (Object.keys(fields).length) return apiError(409, 'CONFLICT', 'Alguns dados já pertencem a outra conta.', { fields })
      Object.assign(auth.user, {
        displayName: parsed.data.displayName,
        username: parsed.data.username,
        email: parsed.data.email,
        ensName: parsed.data.ensName,
        walletNickname: parsed.data.walletNickname,
      })
      persist()
      return HttpResponse.json(publicUser(auth.user))
    }),
  ),

  http.put(
    `${API_BASE}/profile/avatar`,
    withConditions('profile', async ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const body = await readJson<AvatarUploadRequest>(request)
      const dataUrl = body?.dataUrl ?? ''
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl))
        return apiError(422, 'VALIDATION_FAILED', 'Formato não suportado. Use PNG, JPG ou WebP.', { fields: { avatar: 'Formato não suportado' } })
      if (dataUrl.length > MAX_AVATAR_BYTES)
        return apiError(422, 'VALIDATION_FAILED', 'Imagem muito grande (máx. 250 KB após otimização).', { fields: { avatar: 'Imagem muito grande' } })
      auth.user.avatarUrl = dataUrl
      persist()
      return HttpResponse.json(publicUser(auth.user))
    }),
  ),

  http.delete(
    `${API_BASE}/profile/avatar`,
    withConditions('profile', ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      auth.user.avatarUrl = null
      persist()
      return HttpResponse.json(publicUser(auth.user))
    }),
  ),

  http.post(
    `${API_BASE}/profile/password`,
    withConditions('profile', async ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const parsed = passwordChangeRequestSchema.safeParse(await readJson<PasswordChangeRequest>(request))
      if (!parsed.success)
        return apiError(422, 'VALIDATION_FAILED', 'Revise os campos destacados.', { fields: zodFieldErrors(parsed.error) })
      const currentHash = await sha256Hex(`${auth.user.salt}:${parsed.data.currentPassword}`)
      if (currentHash !== auth.user.passwordHash)
        return apiError(422, 'VALIDATION_FAILED', 'Senha atual incorreta.', { fields: { currentPassword: 'Senha atual incorreta' } })
      auth.user.passwordHash = await sha256Hex(`${auth.user.salt}:${parsed.data.newPassword}`)
      // encerra as demais sessões do usuário, mantém a atual
      for (const [token, s] of Object.entries(db.sessions))
        if (s.userId === auth.user.id && token !== auth.session.token) delete db.sessions[token]
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* ---------------------------------------------------------------- carteiras */
  http.get(
    `${API_BASE}/wallets`,
    withConditions('wallets', ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      return HttpResponse.json(walletsOf(auth.user.id))
    }),
  ),

  http.put(
    `${API_BASE}/wallets/:slot`,
    withConditions('wallets', async ({ request, params }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const slot = String(params.slot)
      if (slot !== 'primary' && slot !== 'secondary') return apiError(404, 'NOT_FOUND', 'Carteira inexistente.')
      const parsed = walletSchema.safeParse(await readJson<WalletInput>(request))
      if (!parsed.success)
        return apiError(422, 'VALIDATION_FAILED', 'Revise os campos destacados.', { fields: zodFieldErrors(parsed.error) })
      const current = db.wallets[auth.user.id] ?? { primary: null, secondary: null, secondarySameAsPrimary: false }
      const other = slot === 'primary' ? current.secondary : current.primary
      if (other && !current.secondarySameAsPrimary && other.address.toLowerCase() === parsed.data.address.toLowerCase())
        return apiError(409, 'CONFLICT', 'Este endereço já está cadastrado na outra carteira.', {
          fields: { address: 'Endereço já usado na outra carteira' },
        })
      const wallet: Wallet = { ...parsed.data, slot, updatedAt: new Date(now()).toISOString() } as Wallet
      if (slot === 'primary') current.primary = wallet
      else {
        current.secondary = wallet
        current.secondarySameAsPrimary = false
      }
      db.wallets[auth.user.id] = current
      persist()
      return HttpResponse.json(walletsOf(auth.user.id))
    }),
  ),

  http.put(
    `${API_BASE}/wallets/secondary/same-as-primary`,
    withConditions('wallets', async ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      const body = await readJson<{ enabled: boolean }>(request)
      const current = db.wallets[auth.user.id] ?? { primary: null, secondary: null, secondarySameAsPrimary: false }
      if (body?.enabled && !current.primary)
        return apiError(422, 'VALIDATION_FAILED', 'Cadastre a carteira principal primeiro.')
      current.secondarySameAsPrimary = Boolean(body?.enabled)
      db.wallets[auth.user.id] = current
      persist()
      return HttpResponse.json(walletsOf(auth.user.id))
    }),
  ),
]
