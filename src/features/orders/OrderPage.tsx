import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Copy, Loader2, X, XCircle } from 'lucide-react'
import { NETWORKS, WALLET_PROVIDERS, type Order } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { NftImage } from '@/components/kurio/NftImage'
import { NotFound } from '@/components/kurio/NotFound'
import { ErrorState } from '@/components/kurio/states'
import { ApiError } from '@/lib/api/errors'
import { notify } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useOrder } from '@/features/checkout/hooks'

function shortHash(h: string) {
  return `${h.slice(0, 6)}…${h.slice(-4)}`
}

export function OrderPage({ orderId }: { orderId: string }) {
  const order = useOrder(orderId)
  useDocumentTitle(order.data?.status === 'confirmed' ? 'Pedido confirmado' : 'Pedido')

  if (order.isPending)
    return (
      <div className="container-page flex justify-center py-16" aria-busy="true" aria-label="Carregando pedido">
        <Skeleton className="h-[600px] w-full max-w-[562px]" />
      </div>
    )
  if (order.error instanceof ApiError && (order.error.status === 404 || order.error.status === 403))
    return <NotFound title="Pedido não encontrado" description="Este pedido não existe ou pertence a outra conta." />
  if (order.error || !order.data)
    return (
      <div className="container-page py-16">
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      </div>
    )
  const o = order.data
  if (o.status === 'pending')
    return (
      <section className="container-page flex flex-col items-center gap-4 py-24 text-center" aria-live="polite" data-testid="order-status-pending">
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
        <h1 className="text-lg font-bold">Pedido em processamento</h1>
        <p className="text-sm text-muted-foreground">A confirmação aparece aqui assim que a rede confirmar a transação.</p>
      </section>
    )
  if (o.status === 'rejected')
    return (
      <section className="container-page flex flex-col items-center gap-4 py-24 text-center" data-testid="order-status-rejected">
        <XCircle className="size-10 text-destructive" aria-hidden />
        <h1 className="text-lg font-bold">Pagamento recusado</h1>
        <p className="text-sm text-muted-foreground">{o.failureReason}</p>
        <Button asChild>
          <Link to="/carrinho">Voltar ao carrinho</Link>
        </Button>
      </section>
    )
  return <Receipt order={o} />
}

function ThankYouIcon() {
  return (
    <svg viewBox="0 0 64 80" className="h-20 w-16 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M4 34v40h56V34" />
      <path d="M4 34 32 56l28-22" />
      <path d="M4 74 26 52M60 74 38 52" />
      <rect x="12" y="6" width="40" height="38" rx="3" fill="var(--card)" />
      <path d="M26 6a6 6 0 0 1 12 0" />
      <text x="32" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" fontFamily="inherit">
        THANK
      </text>
      <text x="32" y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor" stroke="none" fontFamily="inherit">
        YOU
      </text>
    </svg>
  )
}

/** Recibo: renderiza exclusivamente o snapshot `order.receipt`. */
function Receipt({ order }: { order: Order }) {
  const navigate = useNavigate()
  const [explorerOpen, setExplorerOpen] = useState(false)
  const r = order.receipt
  const date = new Date(order.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  const provider = WALLET_PROVIDERS.find((p) => p.id === r.wallet.provider)?.label
  const network = NETWORKS.find((n) => n.id === r.network)?.label
  return (
    <div className="container-page flex justify-center py-8 md:py-24">
      <section aria-labelledby="receipt-title" className="relative w-full max-w-[562px] border-b-[10px] border-primary bg-card" data-testid="order-status-confirmed">
        <button type="button" onClick={() => void navigate({ to: '/' })} className="absolute top-4 right-4 grid size-9 place-items-center text-primary hover:bg-primary/10" aria-label="Fechar e voltar ao início">
          <X className="size-5" aria-hidden />
        </button>
        <div className="flex flex-col items-center gap-4 border-b border-primary/50 px-6 pt-6 pb-5">
          <ThankYouIcon />
          <h1 id="receipt-title" className="text-center font-bold text-muted-foreground">
            Seus NFTs agora estão na sua carteira
          </h1>
        </div>
        <dl className="grid grid-cols-2 gap-y-3 border-b border-primary/50 px-6 py-4 text-sm sm:grid-cols-4 sm:divide-x sm:divide-primary/60">
          <div className="pr-3">
            <dt className="font-bold text-muted-foreground">ID da transação</dt>
            <dd className="text-muted-foreground" data-testid="tx-hash">
              {order.transactionHash ? shortHash(order.transactionHash) : '—'}
            </dd>
          </div>
          <div className="sm:px-3">
            <dt className="text-muted-foreground">Data</dt>
            <dd className="text-muted-foreground">{date}</dd>
          </div>
          <div className="sm:px-3">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="text-muted-foreground tabular-nums">{formatEth(r.total, { minFraction: 3 })}</dd>
          </div>
          <div className="sm:pl-3">
            <dt className="font-bold text-muted-foreground">Carteira</dt>
            <dd className="text-muted-foreground">{provider}</dd>
          </div>
        </dl>
        <div className="px-6 py-5 sm:px-10">
          <h2 className="mb-2 text-sm font-bold">Detalhes da transação</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="pb-2 font-bold">
                  NFTs
                </th>
                <th scope="col" className="pb-2 text-center font-bold">
                  Edições
                </th>
                <th scope="col" className="pb-2 text-right font-bold">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody data-testid="receipt-lines">
              {r.lines.map((l) => (
                <tr key={l.lineId}>
                  <td className="py-2">
                    <div className="flex items-center gap-3">
                      <NftImage image={l.image} sizes="64px" decorative className="size-16 shrink-0 rounded-sm" />
                      <div className="min-w-0">
                        <p className="font-bold">{l.name}</p>
                        <p className="text-xs text-primary">ID do token: {l.tokenId}</p>
                        <p className="text-xs text-subtle">Edição {l.editionLabel}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center text-muted-foreground">(x {l.quantity})</td>
                  <td className="text-right font-bold text-primary tabular-nums">{formatEth(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 ml-auto flex max-w-xs flex-col gap-1 border-b border-border pb-3 text-sm">
            {r.discount !== '0' ? (
              <div className="flex justify-between">
                <dt>Desconto {r.coupon ? `(${r.coupon.code})` : ''}</dt>
                <dd className="tabular-nums">(-) {formatEth(r.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt>Taxa de rede</dt>
              <dd className="tabular-nums">{formatEth(r.networkFee, { minFraction: 3 })}</dd>
            </div>
            <div className="flex justify-between font-bold">
              <dt>Total</dt>
              <dd className="text-lg text-primary tabular-nums" data-testid="receipt-total">
                {formatEth(r.total, { minFraction: 3 })}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            Transação confirmada na {network}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
          </p>
          <div className="mt-5 flex justify-center pb-4">
            <Button onClick={() => setExplorerOpen(true)} className="h-11 px-4">
              Ver no Etherscan
            </Button>
          </div>
        </div>
      </section>
      <Dialog open={explorerOpen} onOpenChange={setExplorerOpen}>
        <DialogContent className="border border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Explorador simulado</DialogTitle>
            <DialogDescription>
              Esta é uma transação simulada — ela não existe no Etherscan real. Referência gerada pela simulação:
            </DialogDescription>
          </DialogHeader>
          <code className="block rounded-sm bg-background p-3 text-xs break-all" data-testid="explorer-hash">
            {order.transactionHash}
          </code>
          <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <dt>Rede</dt>
            <dd>{network}</dd>
            <dt>Carteira</dt>
            <dd className="break-all">{r.wallet.address}</dd>
            <dt>Pedido</dt>
            <dd>{order.id}</dd>
          </dl>
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(order.transactionHash ?? '').then(
                () => notify('success', 'Referência copiada'),
                () => notify('error', 'Não foi possível copiar'),
              )
            }}
          >
            <Copy className="size-4" aria-hidden /> Copiar referência
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
