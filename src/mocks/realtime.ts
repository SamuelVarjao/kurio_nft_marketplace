/**
 * Servidor Socket.IO simulado sobre o interceptador de WebSocket do MSW
 * (@mswjs/socket.io-binding). O cliente real (`socket.io-client`) conecta com
 * `transports: ['websocket']`; o binding codifica/decodifica os pacotes
 * Engine.IO/Socket.IO.
 *
 * Limitações do binding (documentadas em ARCHITECTURE.md): sem namespaces,
 * rooms, acks ou long-polling; o handshake é sintetizado pelo binding. Por isso
 * a identificação da sessão acontece via evento `session.identify` logo após o
 * `connect`, e o heartbeat (ping) é enviado manualmente aqui.
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { SOCKET_URL, type NftDetail, type NftUpdatedEvent, type Order, type OrderUpdatedEvent, type RealtimeEvent } from '@/contracts'
import { db, now } from './db/store'
import { getScenario } from './scenarios'

// o MSW remove o prefixo "/socket.io/" do caminho antes de casar a URL;
// casamos pelo host do socket (ws:// ou wss://)
const socketHost = new URL(SOCKET_URL).host.replace(/\./g, '\\.')
const link = ws.link(new RegExp(`^wss?://${socketHost}`))

interface Connection {
  id: number
  userId: string | null
  emit: (event: string, payload: unknown) => void
  close: () => void
}

const connections = new Set<Connection>()
const history: RealtimeEvent[] = []
let connectionSeq = 0
let blocked = false
let eventSeq = 0

/** Intervalo de ping do Engine.IO. O binding anuncia pingInterval=25s + pingTimeout=5s. */
const HEARTBEAT_MS = 20_000

export const realtimeHandlers = [
  link.addEventListener('connection', (connection) => {
    if (getScenario().offline || blocked) {
      connection.client.close(1000, 'unavailable')
      return
    }
    const io = toSocketIo(connection)
    const conn: Connection = {
      id: ++connectionSeq,
      userId: null,
      emit: (event, payload) => io.client.emit(event, payload),
      close: () => connection.client.close(1000, 'server closed'),
    }
    connections.add(conn)
    const heartbeat = setInterval(() => connection.client.send('2'), HEARTBEAT_MS)

    io.client.on('session.identify', (_event, payload: { token: string | null } | undefined) => {
      const token = payload?.token ?? null
      const session = token ? db.sessions[token] : undefined
      conn.userId = session && session.expiresAt > now() ? session.userId : null
      io.client.emit('session.ready', { userId: conn.userId })
    })

    connection.client.addEventListener('close', () => {
      clearInterval(heartbeat)
      connections.delete(conn)
    })
  }),
]

function record(event: RealtimeEvent) {
  history.push(event)
  if (history.length > 50) history.shift()
}

function nextEventId() {
  eventSeq += 1
  return `evt-${Date.now().toString(36)}-${eventSeq}`
}

export function buildNftEvent(nft: NftDetail, overrides: Partial<NftUpdatedEvent> = {}): NftUpdatedEvent {
  return {
    eventId: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date(now()).toISOString(),
    data: {
      price: nft.price,
      previousPrice: nft.previousPrice,
      soldOut: nft.soldOut,
      editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
    },
    ...overrides,
  }
}

export function emitNftUpdated(nft: NftDetail, overrides: Partial<NftUpdatedEvent> = {}) {
  const event = buildNftEvent(nft, overrides)
  record(event)
  for (const c of connections) c.emit('nft.updated', event)
  return event
}

export function emitOrderUpdated(order: Order) {
  const event: OrderUpdatedEvent = {
    eventId: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date(now()).toISOString(),
    userId: order.userId,
    data: { status: order.status, transactionHash: order.transactionHash, failureReason: order.failureReason },
  }
  record(event)
  // eventos privados: somente conexões identificadas com o dono do pedido
  for (const c of connections) if (c.userId === order.userId) c.emit('order.updated', event)
  return event
}

/* ---------------------------------------------- controles (testes/console) */

export const realtimeControl = {
  /** reenvia o último evento exatamente igual (mesmo eventId) */
  replayLast() {
    const last = history.at(-1)
    if (!last) return null
    for (const c of connections) {
      if (last.type === 'order.updated' && c.userId !== last.userId) continue
      c.emit(last.type, last)
    }
    return last
  },
  /** envia um nft.updated com versão antiga e preço arbitrário — deve ser ignorado */
  emitStale(nftId: string, price = '0.01') {
    const nft = db.nfts[nftId]
    if (!nft) throw new Error(`NFT inexistente: ${nftId}`)
    const event = buildNftEvent(nft, {
      version: Math.max(0, nft.version - 1),
      data: { ...buildNftEvent(nft).data, price },
    })
    for (const c of connections) c.emit('nft.updated', event)
    return event
  },
  /** emite evento de pedido para um usuário arbitrário (teste de isolamento) */
  emitForeignOrder(userId: string) {
    const fake: Order = {
      id: 'ord-foreign',
      userId,
      status: 'confirmed',
      transactionHash: '0xforeign',
      explorerUrl: null,
      failureReason: null,
      receipt: {} as Order['receipt'],
      createdAt: new Date(now()).toISOString(),
      updatedAt: new Date(now()).toISOString(),
      version: 99,
    }
    const event: OrderUpdatedEvent = {
      eventId: nextEventId(),
      type: 'order.updated',
      resource: { type: 'order', id: fake.id },
      version: fake.version,
      occurredAt: fake.createdAt,
      userId,
      data: { status: 'confirmed', transactionHash: '0xforeign', failureReason: null },
    }
    // envia para TODAS as conexões de propósito: o cliente deve descartar
    for (const c of connections) c.emit('order.updated', event)
    return event
  },
  /** derruba todas as conexões; com `blockMs`, recusa novas por esse tempo */
  disconnectAll(blockMs = 0) {
    if (blockMs > 0) {
      blocked = true
      setTimeout(() => {
        blocked = false
      }, blockMs)
    }
    for (const c of [...connections]) c.close()
  },
  setBlocked(value: boolean) {
    blocked = value
    if (value) for (const c of [...connections]) c.close()
  },
  connections() {
    return [...connections].map((c) => ({ id: c.id, userId: c.userId }))
  },
  history() {
    return [...history]
  },
}
