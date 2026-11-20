import './index.css'

/**
 * A camada de mocks (MSW + Socket.IO simulado) é ativada por configuração:
 * `VITE_ENABLE_MOCKS` (padrão: ativada — não há backend real nesta entrega).
 *
 * O engine.io-client guarda a referência de `globalThis.WebSocket` ao ser
 * avaliado; por isso o socket.io-client é importado sob demanda pelo
 * RealtimeProvider (após o mount, com o MSW já ativo). O app em si não
 * conhece os mocks — eles interceptam na camada de rede.
 */
async function enableMocks() {
  if (import.meta.env.VITE_ENABLE_MOCKS === 'false') return
  const { startMocks } = await import('./mocks/browser')
  await startMocks()
}

// o bundle do app baixa em paralelo ao registro do Service Worker; só monta
// (e só faz requisições) depois que os mocks estão ativos
Promise.all([enableMocks(), import('./app/bootstrap')]).then(([, { mount }]) => mount(document.getElementById('root')!))
