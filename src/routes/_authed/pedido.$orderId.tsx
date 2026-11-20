import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/orders/OrderPage'

export const Route = createFileRoute('/_authed/pedido/$orderId')({
  component: OrderRoute,
})

function OrderRoute() {
  const { orderId } = Route.useParams()
  return <OrderPage orderId={orderId} />
}
