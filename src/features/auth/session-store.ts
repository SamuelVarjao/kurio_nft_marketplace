/**
 * Sessão do colecionador — token bearer em localStorage (decisão registrada em
 * ARCHITECTURE.md). Store externo mínimo, lido via useSyncExternalStore e
 * também fora do React (interceptor do Axios, router guards, socket).
 */
import { useSyncExternalStore } from 'react'
import type { SessionResponse, User } from '@/contracts'

const SESSION_KEY = 'kurio:session'
const GUEST_CART_KEY = 'kurio:guest-cart'

export interface SessionState {
  token: string | null
  expiresAt: string | null
  user: User | null
  /** incrementa a cada troca de sessão — chave para socket e caches privados */
  generation: number
}

export type SessionEndReason = 'logout' | 'expired' | 'invalid'

function read(): SessionState {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Omit<SessionState, 'generation'>
      if (s.token && s.user) return { ...s, generation: 1 }
    }
  } catch {
    /* ignore */
  }
  return { token: null, expiresAt: null, user: null, generation: 1 }
}

let state: SessionState = read()
const listeners = new Set<() => void>()
const endListeners = new Set<(reason: SessionEndReason, previous: SessionState) => void>()

function write(next: SessionState) {
  state = next
  try {
    if (next.token) localStorage.setItem(SESSION_KEY, JSON.stringify({ token: next.token, expiresAt: next.expiresAt, user: next.user }))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export const sessionStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  start(session: SessionResponse) {
    write({ token: session.token, expiresAt: session.expiresAt, user: session.user, generation: state.generation + 1 })
  },
  updateUser(user: User) {
    if (!state.token) return
    write({ ...state, user })
  },
  end(reason: SessionEndReason) {
    if (!state.token) return
    const previous = state
    write({ token: null, expiresAt: null, user: null, generation: state.generation + 1 })
    endListeners.forEach((l) => l(reason, previous))
  },
  onEnd(listener: (reason: SessionEndReason, previous: SessionState) => void) {
    endListeners.add(listener)
    return () => {
      endListeners.delete(listener)
    }
  },
  isExpiredLocally() {
    return Boolean(state.expiresAt && Date.parse(state.expiresAt) <= Date.now())
  },
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

export const guestCartStore = {
  get(): string | null {
    try {
      return localStorage.getItem(GUEST_CART_KEY)
    } catch {
      return null
    }
  },
  set(id: string) {
    try {
      localStorage.setItem(GUEST_CART_KEY, id)
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(GUEST_CART_KEY)
    } catch {
      /* ignore */
    }
  },
}
