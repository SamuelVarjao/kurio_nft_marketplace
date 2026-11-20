import { delay, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/contracts'
import { db, now, persist, type SessionRecord, type UserRecord } from '../db/store'
import { errorCounters, getScenario, nextLatency, takeQueuedFailure, type RouteKey } from '../scenarios'

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: Partial<ApiErrorBody['error']> = {},
) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message, ...extra } }, { status })
}

const STATUS_CODE: Record<number, ApiErrorCode> = {
  401: 'SESSION_INVALID',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'TRANSIENT_FAILURE',
  500: 'INTERNAL',
  502: 'TRANSIENT_FAILURE',
  503: 'TRANSIENT_FAILURE',
}

function forcedError(status: number) {
  return apiError(status, STATUS_CODE[status] ?? 'INTERNAL', `Falha simulada (HTTP ${status})`, {
    retryable: status >= 500 || status === 429,
  })
}

/**
 * Envolve um resolver com as condições de rede do cenário ativo:
 * offline → erro de rede; falhas enfileiradas; erros HTTP por rota; latência.
 */
export function withConditions<P extends PathParams, B extends DefaultBodyType, R extends DefaultBodyType>(
  route: RouteKey,
  resolver: HttpResponseResolver<P, B, R>,
): HttpResponseResolver<P, B, R> {
  return async (info) => {
    const scenario = getScenario()
    await delay(nextLatency(route))
    if (scenario.offline) return HttpResponse.error() as never

    const queued = takeQueuedFailure(route)
    if (queued === 'network') return HttpResponse.error() as never
    if (typeof queued === 'number') return forcedError(queued) as never

    const he = scenario.httpError
    if (he && he.routes.includes(route)) {
      const served = errorCounters.get(route) ?? 0
      if (he.times === undefined || served < he.times) {
        errorCounters.set(route, served + 1)
        return forcedError(he.status) as never
      }
    }
    return resolver(info)
  }
}

export interface AuthContext {
  user: UserRecord
  session: SessionRecord
}

/** Valida o bearer token. Retorna o contexto ou uma resposta 401. */
export function authenticate(request: Request): AuthContext | Response {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return apiError(401, 'SESSION_INVALID', 'Faça login para continuar.')
  const session = db.sessions[token]
  if (!session) return apiError(401, 'SESSION_INVALID', 'Sessão inválida. Faça login novamente.')
  if (session.expiresAt <= now()) {
    delete db.sessions[token]
    persist()
    return apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  const user = db.users[session.userId]
  if (!user) return apiError(401, 'SESSION_INVALID', 'Sessão inválida.')
  return { user, session }
}

export function optionalAuth(request: Request): AuthContext | null | Response {
  if (!request.headers.get('authorization')) return null
  return authenticate(request)
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
