import { http, HttpResponse } from 'msw'
import type { LoginRequest, RegisterRequest, SessionResponse } from '@/contracts'
import { API_BASE } from '@/contracts'
import { loginSchema, registerRequestSchema, zodFieldErrors } from '@/contracts/schemas'
import { db, nextId, now, persist, publicUser, type UserRecord } from '../db/store'
import { apiError, authenticate, readJson, withConditions } from '../lib/http'
import { sha256Hex } from '../lib/random'
import { getScenario } from '../scenarios'

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return 'kt_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function openSession(user: UserRecord): SessionResponse {
  const token = randomToken()
  const expiresAt = now() + getScenario().sessionTtlMs
  db.sessions[token] = { token, userId: user.id, createdAt: now(), expiresAt }
  persist()
  return { token, expiresAt: new Date(expiresAt).toISOString(), user: publicUser(user) }
}

export const authHandlers = [
  http.post(
    `${API_BASE}/auth/register`,
    withConditions('auth', async ({ request }) => {
      const body = await readJson<RegisterRequest>(request)
      const parsed = registerRequestSchema.safeParse(body)
      if (!parsed.success)
        return apiError(422, 'VALIDATION_FAILED', 'Revise os campos destacados.', { fields: zodFieldErrors(parsed.error) })
      const { username, email, password } = parsed.data
      const fields: Record<string, string> = {}
      const users = Object.values(db.users)
      if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) fields.email = 'Este e-mail já está cadastrado.'
      if (users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
        fields.username = 'Este nome de usuário já está em uso.'
      if (Object.keys(fields).length) return apiError(409, 'CONFLICT', 'Já existe uma conta com esses dados.', { fields })

      const salt = nextId('salt')
      const user: UserRecord = {
        id: nextId('usr'),
        username,
        displayName: username,
        email,
        avatarUrl: null,
        ensName: null,
        ensTld: '.eth',
        walletNickname: null,
        createdAt: new Date(now()).toISOString(),
        salt,
        passwordHash: await sha256Hex(`${salt}:${password}`),
      }
      db.users[user.id] = user
      db.favorites[user.id] = []
      db.wallets[user.id] = { primary: null, secondary: null, secondarySameAsPrimary: false }
      persist()
      return HttpResponse.json(openSession(user), { status: 201 })
    }),
  ),

  http.post(
    `${API_BASE}/auth/login`,
    withConditions('auth', async ({ request }) => {
      const body = await readJson<LoginRequest>(request)
      const parsed = loginSchema.safeParse(body)
      if (!parsed.success)
        return apiError(422, 'VALIDATION_FAILED', 'Revise os campos destacados.', { fields: zodFieldErrors(parsed.error) })
      const user = Object.values(db.users).find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase())
      const hash = user ? await sha256Hex(`${user.salt}:${parsed.data.password}`) : null
      if (!user || hash !== user.passwordHash) return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      return HttpResponse.json(openSession(user))
    }),
  ),

  http.get(
    `${API_BASE}/auth/session`,
    withConditions('auth', ({ request }) => {
      const auth = authenticate(request)
      if (auth instanceof Response) return auth
      return HttpResponse.json({
        user: publicUser(auth.user),
        expiresAt: new Date(auth.session.expiresAt).toISOString(),
      })
    }),
  ),

  http.post(
    `${API_BASE}/auth/logout`,
    withConditions('auth', ({ request }) => {
      const token = request.headers.get('authorization')?.replace('Bearer ', '')
      if (token && db.sessions[token]) {
        delete db.sessions[token]
        persist()
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
