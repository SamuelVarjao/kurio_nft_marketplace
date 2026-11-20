/**
 * Cliente HTTP único (Axios). Todas as chamadas REST passam por aqui.
 * Não contém respostas fictícias: em modo demo o MSW intercepta na rede.
 */
import axios, { type AxiosRequestConfig } from 'axios'
import { API_BASE } from '@/contracts'
import { guestCartStore, sessionStore } from '@/features/auth/session-store'
import { toApiError } from './errors'

export const DEFAULT_TIMEOUT_MS = 10_000

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? API_BASE,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  const { token } = sessionStore.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  const guestCart = guestCartStore.get()
  if (guestCart && !token) config.headers.set('X-Cart-Id', guestCart)
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error)
    const sentToken = (error?.config?.headers?.Authorization as string | undefined)?.slice(7)
    // só encerra a sessão se o 401 se refere ao token atual (evita corrida pós-login)
    if (apiError.isAuthError && sentToken && sentToken === sessionStore.get().token) {
      sessionStore.end(apiError.code === 'SESSION_EXPIRED' ? 'expired' : 'invalid')
    }
    return Promise.reject(apiError)
  },
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await http.request<T>(config)
  return res.data
}
