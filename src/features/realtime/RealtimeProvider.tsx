/**
 * Conexão Socket.IO por sessão. Uma troca de sessão (login/logout/troca de
 * usuário) destrói o socket anterior — listeners incluídos — e cria outro.
 * Após reconexão, os recursos ativos são reconciliados com a API REST.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { SOCKET_PATH, SOCKET_URL, type ClientToServerEvents, type ServerToClientEvents } from '@/contracts'
import { qk } from '@/lib/query'
import { useSession } from '@/features/auth/session-store'
import { applyNftUpdated, applyOrderUpdated, resetPrivateRealtimeMemory } from './events'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

const RealtimeContext = createContext<{ status: RealtimeStatus }>({ status: 'connecting' })

export function useRealtimeStatus() {
  return useContext(RealtimeContext).status
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const session = useSession()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const userId = session.user?.id ?? null
  const token = session.token

  useEffect(() => {
    resetPrivateRealtimeMemory()
    let disposed = false
    let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
    // import dinâmico: tira o socket.io-client do bundle inicial e garante que
    // ele capture o WebSocket já interceptado pelo MSW em modo demo
    void import('socket.io-client').then(({ io }) => {
      if (disposed) return
      socket = connect(io)
    })
    const connect = (io: typeof import('socket.io-client').io) => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      timeout: 8_000,
    })
    let connectedBefore = false

    socket.on('connect', () => {
      setStatus('connected')
      socket.emit('session.identify', { token })
      if (connectedBefore) {
        // reconciliação: o que mudou enquanto estávamos desconectados
        void queryClient.invalidateQueries({ queryKey: qk.catalogAll, refetchType: 'active' })
        void queryClient.invalidateQueries({ queryKey: qk.nftAll, refetchType: 'active' })
        void queryClient.invalidateQueries({ queryKey: qk.cartAll, refetchType: 'active' })
        if (userId) void queryClient.invalidateQueries({ queryKey: qk.orders(userId), refetchType: 'active' })
      }
      connectedBefore = true
    })
    socket.on('disconnect', () => setStatus('reconnecting'))
    socket.on('connect_error', () => setStatus(connectedBefore ? 'reconnecting' : 'offline'))
    socket.on('nft.updated', (event) => applyNftUpdated(queryClient, event))
    socket.on('order.updated', (event) => applyOrderUpdated(queryClient, event, userId))
    return socket
    }

    return () => {
      disposed = true
      socket?.removeAllListeners()
      socket?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.generation])

  return <RealtimeContext.Provider value={{ status }}>{children}</RealtimeContext.Provider>
}
