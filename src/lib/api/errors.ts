import { AxiosError, isAxiosError, isCancel } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from '@/contracts'

export type ErrorKind = 'http' | 'network' | 'timeout' | 'canceled'

/** Erro normalizado da camada de transporte — o único tipo que a UI conhece. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED'
  readonly kind: ErrorKind
  readonly fields: Record<string, string>
  readonly details: unknown
  readonly retryable: boolean

  constructor(init: {
    message: string
    status: number
    code: ApiError['code']
    kind: ErrorKind
    fields?: Record<string, string>
    details?: unknown
    retryable?: boolean
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.kind = init.kind
    this.fields = init.fields ?? {}
    this.details = init.details
    this.retryable = init.retryable ?? false
  }

  get isAuthError() {
    return this.code === 'SESSION_EXPIRED' || this.code === 'SESSION_INVALID'
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isCancel(error)) return new ApiError({ message: 'Requisição cancelada', status: 0, code: 'CANCELED', kind: 'canceled' })
  if (isAxiosError(error)) {
    const ax = error as AxiosError<ApiErrorBody>
    if (ax.code === AxiosError.ECONNABORTED || ax.code === AxiosError.ETIMEDOUT)
      return new ApiError({
        message: 'O servidor demorou para responder. Verifique sua conexão e tente novamente.',
        status: 0,
        code: 'TIMEOUT',
        kind: 'timeout',
        retryable: true,
      })
    if (!ax.response)
      return new ApiError({
        message: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
        status: 0,
        code: 'NETWORK',
        kind: 'network',
        retryable: true,
      })
    const body = ax.response.data?.error
    const status = ax.response.status
    return new ApiError({
      message: body?.message ?? `Erro inesperado (HTTP ${status}).`,
      status,
      code: body?.code ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED'),
      kind: 'http',
      fields: body?.fields,
      details: body?.details,
      retryable: body?.retryable ?? (status >= 500 || status === 429),
    })
  }
  return new ApiError({ message: (error as Error)?.message ?? 'Erro inesperado', status: 0, code: 'INTERNAL', kind: 'http' })
}
