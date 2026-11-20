import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { installControl } from './control'
import { resumePendingOrders } from './domain/commerce'

export async function startMocks() {
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  installControl()
  // pedidos pendentes antes de um refresh voltam a ser processados
  resumePendingOrders()
  return worker
}
