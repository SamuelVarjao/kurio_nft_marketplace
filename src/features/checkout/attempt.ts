/**
 * Tentativa de compra persistida (por usuário). Garante que cliques
 * repetidos, timeouts, refresh ou reconexão reutilizem a MESMA chave de
 * idempotência e o mesmo corpo — o servidor devolve o mesmo pedido.
 */
import type { CreateOrderRequest } from '@/contracts'
import type { BuyerFormValues } from '@/contracts/schemas'

export interface CheckoutAttempt {
  key: string
  body: CreateOrderRequest
  orderId: string | null
  createdAt: number
}

const attemptKey = (userId: string) => `kurio:checkout-attempt:${userId}`
const draftKey = (userId: string) => `kurio:checkout-draft:${userId}`

export function newIdempotencyKey() {
  return `ord_${crypto.randomUUID()}`
}

export const attemptStore = {
  get(userId: string): CheckoutAttempt | null {
    try {
      const raw = localStorage.getItem(attemptKey(userId))
      return raw ? (JSON.parse(raw) as CheckoutAttempt) : null
    } catch {
      return null
    }
  },
  set(userId: string, attempt: CheckoutAttempt) {
    try {
      localStorage.setItem(attemptKey(userId), JSON.stringify(attempt))
    } catch {
      /* ignore */
    }
  },
  clear(userId: string) {
    try {
      localStorage.removeItem(attemptKey(userId))
    } catch {
      /* ignore */
    }
  },
}

export interface CheckoutDraft {
  buyer: BuyerFormValues
  network: string
  provider: string
  slot: 'primary' | 'secondary'
}

/** Rascunho do formulário — sobrevive a expiração de sessão e refresh. */
export const draftStore = {
  get(userId: string): CheckoutDraft | null {
    try {
      const raw = sessionStorage.getItem(draftKey(userId))
      return raw ? (JSON.parse(raw) as CheckoutDraft) : null
    } catch {
      return null
    }
  },
  set(userId: string, draft: CheckoutDraft) {
    try {
      sessionStorage.setItem(draftKey(userId), JSON.stringify(draft))
    } catch {
      /* ignore */
    }
  },
  clear(userId: string) {
    try {
      sessionStorage.removeItem(draftKey(userId))
    } catch {
      /* ignore */
    }
  },
}
