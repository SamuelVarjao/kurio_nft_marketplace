import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, Tag, Trash2, X } from 'lucide-react'
import type { CartLine, CartResponse } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NftImage } from '@/components/kurio/NftImage'
import { QuantityStepper } from '@/components/kurio/QuantityStepper'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { notify } from '@/lib/announce'
import { formatEth } from '@/lib/eth'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { cn } from '@/lib/utils'
import { useSession } from '@/features/auth/session-store'
import { useRelated } from '@/features/catalog/hooks'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/NftCard'
import { useAcknowledgeCart, useApplyCoupon, useCart, useRemoveCartLine, useRemoveCoupon, useUpdateCartLine } from './hooks'

export function CartPage() {
  useDocumentTitle('Carrinho')
  const cart = useCart()
  const session = useSession()
  const navigate = useNavigate()

  const data = cart.data
  const blocked = !data || data.lines.length === 0 || data.lines.every((l) => l.status === 'unavailable') || data.lines.some((l) => l.status === 'insufficient')

  const checkout = () => {
    if (!session.user) {
      notify('info', 'Entre para finalizar', 'Seus itens continuarão no carrinho.')
      void navigate({ to: '/entrar', search: { redirect: '/pagamento' } })
      return
    }
    void navigate({ to: '/pagamento' })
  }

  return (
    <div className="container-page pt-4 md:pt-6">
      <div className="mb-4 flex items-center gap-3 md:hidden">
        <button type="button" onClick={() => history.back()} className="grid size-9 place-items-center rounded-full bg-card" aria-label="Voltar">
          <ArrowLeft className="size-4" aria-hidden />
        </button>
      </div>
      <nav aria-label="Trilha de navegação" className="mb-2 hidden text-sm font-bold md:block">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>{' '}
        /{' '}
        <Link to="/mercado" className="hover:text-primary">
          Mercado
        </Link>{' '}
        / <span aria-current="page">Carrinho</span>
      </nav>
      <h1 className="mb-4 text-center text-lg font-bold md:sr-only">Carrinho de NFTs</h1>

      {cart.error && !data ? (
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} retrying={cart.isRefetching} title="Não foi possível carregar o carrinho" />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_322px] lg:gap-20">
          <section aria-labelledby="cart-items-title">
            <h2 id="cart-items-title" className="sr-only">
              Itens do carrinho
            </h2>
            {cart.isPending ? (
              <CartLinesSkeleton />
            ) : data && data.lines.length === 0 ? (
              <EmptyState
                title="Seu carrinho está vazio"
                description="Explore o mercado e adicione NFTs para colecionar."
                action={
                  <Button asChild>
                    <Link to="/mercado">Explorar mercado</Link>
                  </Button>
                }
              />
            ) : data ? (
              <CartLines cart={data} />
            ) : null}
          </section>
          <CartSummary cart={data} loading={cart.isPending} onCheckout={checkout} blocked={blocked} />
        </div>
      )}
      <AlsoViewed />
    </div>
  )
}

function CartLines({ cart }: { cart: CartResponse }) {
  const acknowledge = useAcknowledgeCart()
  const changed = cart.lines.filter((l) => l.status === 'price_changed')
  return (
    <>
      {changed.length ? (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-sm border border-warning/50 bg-warning/10 p-3 text-sm" data-testid="cart-price-notice">
          <AlertTriangle className="size-4 text-warning" aria-hidden />
          <span className="flex-1">
            {changed.length === 1 ? 'O preço de 1 item mudou' : `Os preços de ${changed.length} itens mudaram`} desde que foram adicionados. O resumo já reflete os valores atuais.
          </span>
          <Button size="sm" variant="outline" className="h-8" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
            Entendi
          </Button>
        </div>
      ) : null}
      <table className="hidden w-full border-separate border-spacing-y-3 text-left md:table" data-testid="cart-table">
        <thead>
          <tr className="text-sm font-bold">
            <th scope="col" className="border-b border-border pb-3">
              NFTs
            </th>
            <th scope="col" className="border-b border-border pb-3">
              Preço
            </th>
            <th scope="col" className="border-b border-border pb-3">
              Edições
            </th>
            <th scope="col" className="border-b border-border pb-3">
              Total
            </th>
            <th scope="col" className="border-b border-border pb-3">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cart.lines.map((line) => (
            <CartRow key={line.id} line={line} />
          ))}
        </tbody>
      </table>
      <ul className="flex flex-col gap-3 md:hidden">
        {cart.lines.map((line) => (
          <CartCard key={line.id} line={line} />
        ))}
      </ul>
    </>
  )
}

function useLineActions(line: CartLine) {
  const update = useUpdateCartLine()
  const remove = useRemoveCartLine()
  return {
    pending: update.isPending || remove.isPending,
    setQuantity: (quantity: number) =>
      update.mutate(
        { lineId: line.id, quantity },
        {
          onSuccess: () => notify('success', 'Quantidade atualizada', `${line.name}: ${quantity} un.`),
          onError: (e) => notify('error', 'Não foi possível alterar a quantidade', e.message),
        },
      ),
    remove: () =>
      remove.mutate(
        { lineId: line.id },
        {
          onSuccess: () => notify('success', 'Item removido', `${line.name} (${line.editionLabel})`),
          onError: (e) => notify('error', 'Não foi possível remover', e.message),
        },
      ),
  }
}

function LineStatus({ line }: { line: CartLine }) {
  if (line.status === 'ok') return null
  const text =
    line.status === 'unavailable'
      ? 'Indisponível — edição esgotada'
      : line.status === 'insufficient'
        ? `Apenas ${line.available} disponível(is) — ajuste a quantidade`
        : `Preço alterado: ${formatEth(line.priceWhenAdded)} → ${formatEth(line.unitPrice)}`
  return (
    <span
      className={cn(
        'mt-1 inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-bold',
        line.status === 'price_changed' ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive',
      )}
      data-testid={`line-status-${line.status}`}
    >
      <AlertTriangle className="size-3" aria-hidden />
      {text}
    </span>
  )
}

function CartRow({ line }: { line: CartLine }) {
  const a = useLineActions(line)
  const unavailable = line.status === 'unavailable'
  const max = Math.max(line.quantity, line.maxQuantity)
  return (
    <tr className={cn('bg-card', unavailable && 'opacity-70')} data-testid="cart-line" data-line-id={line.id}>
      <td className="rounded-l-sm py-0 pr-4">
        <div className="flex items-center gap-4">
          <NftImage image={line.image} sizes="68px" decorative className="size-[68px] shrink-0 rounded-sm" />
          <div className="min-w-0 py-2">
            <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="block truncate font-bold hover:text-primary">
              {line.name}
            </Link>
            <span className="block text-sm text-subtle">
              ID do token: {line.tokenId} · Edição {line.editionLabel}
            </span>
            <LineStatus line={line} />
          </div>
        </div>
      </td>
      <td className="font-bold text-muted-foreground tabular-nums">{formatEth(line.unitPrice)}</td>
      <td>
        <QuantityStepper size="sm" value={line.quantity} max={max} onChange={a.setQuantity} label={`${line.name} (${line.editionLabel})`} disabled={a.pending || unavailable} />
      </td>
      <td className="font-bold text-primary tabular-nums">{unavailable ? <span className="text-subtle line-through">{formatEth(line.lineTotal)}</span> : formatEth(line.lineTotal)}</td>
      <td className="rounded-r-sm pr-4 text-right">
        <button type="button" onClick={a.remove} disabled={a.pending} className="grid size-9 place-items-center rounded-sm text-primary hover:bg-primary/10" aria-label={`Remover ${line.name} (${line.editionLabel}) do carrinho`}>
          <Trash2 className="size-5" aria-hidden />
        </button>
      </td>
    </tr>
  )
}

function CartCard({ line }: { line: CartLine }) {
  const a = useLineActions(line)
  const unavailable = line.status === 'unavailable'
  return (
    <li className={cn('flex gap-3 rounded-md bg-card p-2', unavailable && 'opacity-70')} data-testid="cart-line-mobile">
      <NftImage image={line.image} sizes="80px" decorative className="size-20 shrink-0 rounded-sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="truncate text-sm font-bold">
            {line.name}
          </Link>
          <button type="button" onClick={a.remove} disabled={a.pending} className="text-primary" aria-label={`Remover ${line.name} do carrinho`}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
        <span className="text-xs text-subtle">Edição: {line.editionLabel}</span>
        <LineStatus line={line} />
        <div className="mt-auto flex items-center justify-between">
          <span className="text-sm font-bold text-primary">{formatEth(line.lineTotal)}</span>
          <QuantityStepper size="sm" value={line.quantity} max={Math.max(line.quantity, line.maxQuantity)} onChange={a.setQuantity} label={line.name} disabled={a.pending || unavailable} />
        </div>
      </div>
    </li>
  )
}

function CartLinesSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando carrinho" data-testid="cart-skeleton">
      <Skeleton className="hidden h-6 w-full md:block" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-[68px] w-full md:h-[68px]" />
      ))}
    </div>
  )
}

export function CouponForm({ cart }: { cart: CartResponse | undefined }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const applied = cart?.coupon?.status === 'applied' ? cart.coupon : null
  const error = apply.error?.message ?? (cart?.coupon && cart.coupon.status !== 'applied' && !apply.isPending ? cart.coupon.description : null)

  if (applied)
    return (
      <div className="flex items-center justify-between gap-2 rounded-sm border border-primary/50 bg-primary/10 px-3 py-2 text-sm" data-testid="coupon-applied">
        <span className="flex items-center gap-2">
          <Tag className="size-4 text-primary" aria-hidden />
          <span>
            <strong>{applied.code}</strong> — {applied.description}
          </span>
        </span>
        <button
          type="button"
          onClick={() => remove.mutate(undefined, { onSuccess: () => notify('success', 'Cupom removido') })}
          disabled={remove.isPending}
          className="grid size-8 place-items-center rounded-sm text-primary hover:bg-primary/10"
          aria-label={`Remover cupom ${applied.code}`}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!code.trim()) return
        apply.mutate(
          { code: code.trim() },
          {
            onSuccess: (c) => {
              setCode('')
              notify('success', 'Cupom aplicado', c.coupon?.description)
            },
            onError: (err) => notify('error', 'Cupom não aplicado', err.message),
          },
        )
      }}
      noValidate
    >
      <label htmlFor="coupon" className="mb-2 block text-sm font-bold">
        Código promocional
      </label>
      <div className="flex">
        <input
          id="coupon"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (apply.error) apply.reset()
          }}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="h-10 min-w-0 flex-1 rounded-l-sm border border-r-0 border-primary bg-transparent px-2 text-xs uppercase placeholder:normal-case placeholder:text-subtle aria-invalid:border-destructive"
          data-testid="coupon-input"
        />
        <Button type="submit" className="h-10 rounded-l-none" disabled={apply.isPending || !cart?.lines.length}>
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
      {error ? (
        <p id="coupon-error" role="alert" className="mt-2 text-xs text-destructive" data-testid="coupon-error">
          {error}
        </p>
      ) : null}
    </form>
  )
}

export function SummaryRows({ subtotal, discount, networkFee, total, estimate = true }: { subtotal: string; discount: string; networkFee: string; total: string; estimate?: boolean }) {
  return (
    <dl className="flex flex-col gap-3 text-sm" data-testid="summary">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="text-base tabular-nums" data-testid="summary-subtotal">
          {formatEth(subtotal)}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt>Desconto do lançamento</dt>
        <dd className="tabular-nums" data-testid="summary-discount">
          (-) {formatEth(discount, { unit: discount !== '0' })}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt>Taxa de rede</dt>
        <dd className="text-base tabular-nums" data-testid="summary-fee">
          {formatEth(networkFee, { minFraction: 3 })}
        </dd>
      </div>
      {estimate ? <p className="-mt-2 text-right text-[11px] text-primary">Taxa estimada</p> : null}
      <div className="mt-3 flex justify-between border-t border-border pt-4 font-bold">
        <dt>Total</dt>
        <dd className="text-lg text-primary tabular-nums" data-testid="summary-total">
          {formatEth(total, { minFraction: 3 })}
        </dd>
      </div>
    </dl>
  )
}

function CartSummary({ cart, loading, onCheckout, blocked }: { cart: CartResponse | undefined; loading: boolean; onCheckout: () => void; blocked: boolean }) {
  return (
    <aside aria-labelledby="summary-title" className="flex flex-col gap-6 lg:pt-0">
      <h2 id="summary-title" className="border-b border-border pb-3 text-lg font-bold">
        Resumo da carteira
      </h2>
      <CouponForm cart={cart} />
      {loading || !cart ? (
        <div className="flex flex-col gap-3" aria-busy="true" data-testid="summary-skeleton">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
          <Skeleton className="mt-3 h-7 w-full" />
        </div>
      ) : (
        <SummaryRows {...cart.summary} />
      )}
      <Button className="h-10 w-full" onClick={onCheckout} disabled={blocked} data-testid="checkout-button">
        Conectar e finalizar
      </Button>
      {cart?.lines.some((l) => l.status === 'insufficient') ? (
        <p className="-mt-3 text-xs text-destructive" role="status">
          Ajuste as quantidades acima do disponível para continuar.
        </p>
      ) : null}
      <Link to="/mercado" className="-mt-2 text-center text-sm text-primary hover:underline">
        Continuar explorando
      </Link>
    </aside>
  )
}

function AlsoViewed() {
  const { data, isPending } = useRelated('nft-042')
  return (
    <section aria-labelledby="also-title" className="mt-16 md:mt-24">
      <h2 id="also-title" className="mb-6 border-b border-border pb-3 text-base font-bold text-primary">
        Colecionadores também viram
      </h2>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-40 shrink-0 md:w-[calc((100%-4rem)/5)]">
                <NftCardSkeleton />
              </li>
            ))
          : data?.items.slice(0, 8).map((n) => (
              <li key={n.id} className="w-40 shrink-0 snap-start md:w-[calc((100%-4rem)/5)]">
                <NftCard nft={n} compact />
              </li>
            ))}
      </ul>
    </section>
  )
}
