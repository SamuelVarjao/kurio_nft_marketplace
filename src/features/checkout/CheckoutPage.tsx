import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Plug, Unplug, XCircle } from 'lucide-react'
import {
  NETWORKS,
  WALLET_PROVIDERS,
  type CreateOrderRequest,
  type Network,
  type Order,
  type QuoteResponse,
  type User,
  type Wallet,
  type WalletProvider,
} from '@/contracts'
import { buyerSchema, type BuyerFormValues } from '@/contracts/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { applyServerErrors, EnsInput, Field, NativeSelect } from '@/components/kurio/form'
import { NftImage } from '@/components/kurio/NftImage'
import { EmptyState, ErrorState } from '@/components/kurio/states'
import { WalletBadges } from '@/components/layout/Footer'
import { ApiError } from '@/lib/api/errors'
import { notify } from '@/lib/announce'
import { compareEth, formatEth } from '@/lib/eth'
import { qk } from '@/lib/query'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { cn } from '@/lib/utils'
import { useSession } from '@/features/auth/session-store'
import { useProfile, useWallets } from '@/features/account/hooks'
import { useCart } from '@/features/cart/hooks'
import { CouponForm, SummaryRows } from '@/features/cart/CartPage'
import { realtimeBus } from '@/features/realtime/events'
import { attemptStore, draftStore } from './attempt'
import { useCheckoutQuote, useOrder, usePlaceOrder, useWalletConnection } from './hooks'

export function CheckoutPage() {
  useDocumentTitle('Pagamento')
  const session = useSession()
  const user = session.user!
  const cart = useCart()
  const profile = useProfile()
  const wallets = useWallets()

  // retomada: tentativa pendente de antes do refresh/reconexão
  const [resumeOrderId, setResumeOrderId] = useState<string | null>(() => attemptStore.get(user.id)?.orderId ?? null)
  const [resumeBody] = useState(() => {
    const a = attemptStore.get(user.id)
    return a && !a.orderId ? a.body : null
  })

  if (cart.isPending || profile.isPending || wallets.isPending) return <CheckoutSkeleton />
  const error = cart.error ?? profile.error ?? wallets.error
  if (error)
    return (
      <div className="container-page py-12">
        <ErrorState
          error={error}
          onRetry={() => {
            void cart.refetch()
            void profile.refetch()
            void wallets.refetch()
          }}
        />
      </div>
    )
  if (resumeOrderId) return <PendingOrder orderId={resumeOrderId} onDismiss={() => setResumeOrderId(null)} />
  if (!cart.data || cart.data.lines.length === 0)
    return (
      <div className="container-page py-12">
        <EmptyState
          title="Seu carrinho está vazio"
          description="Adicione NFTs ao carrinho para finalizar uma compra."
          action={
            <Button asChild>
              <Link to="/mercado">Explorar mercado</Link>
            </Button>
          }
        />
      </div>
    )
  return (
    <CheckoutForm
      user={profile.data!}
      primary={wallets.data!.primary}
      secondary={wallets.data!.secondary}
      cartVersion={cart.data.version}
      resumeBody={resumeBody}
      onOrderPending={setResumeOrderId}
    />
  )
}

function defaultsFor(user: User, wallet: Wallet | null): BuyerFormValues {
  return {
    displayName: wallet?.displayName ?? user.displayName,
    username: user.username,
    profileName: wallet?.profileName ?? user.username,
    email: wallet?.email ?? user.email,
    referralCode: wallet?.referralCode ?? '',
    ensName: wallet?.ensName ?? user.ensName ?? '',
    ensOrSecondary: wallet?.ensOrSecondary ?? '',
    note: '',
  }
}

function CheckoutForm({
  user,
  primary,
  secondary,
  cartVersion,
  resumeBody,
  onOrderPending,
}: {
  user: User
  primary: Wallet | null
  secondary: Wallet | null
  cartVersion: number
  resumeBody: CreateOrderRequest | null
  onOrderPending: (orderId: string) => void
}) {
  const draft = useMemo(() => draftStore.get(user.id), [user.id])
  const [slot, setSlot] = useState<'primary' | 'secondary'>(draft?.slot ?? 'primary')
  const wallet = slot === 'primary' ? primary : secondary
  const [network, setNetwork] = useState<Network>((draft?.network as Network) ?? wallet?.network ?? 'ethereum')
  const [provider, setProvider] = useState<WalletProvider>((draft?.provider as WalletProvider) ?? wallet?.provider ?? 'metamask')
  const form = useForm<BuyerFormValues>({ resolver: zodResolver(buyerSchema), defaultValues: draft?.buyer ?? defaultsFor(user, primary) })
  const e = form.formState.errors

  const quote = useCheckoutQuote(network, cartVersion)
  const { active, connect, disconnect } = useWalletConnection()
  const placer = usePlaceOrder()
  const [review, setReview] = useState<QuoteResponse | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const navigate = useNavigate()
  const resumed = useRef(false)

  const connection = active.data
  const connected = Boolean(connection && connection.provider === provider && connection.network === network && connection.slot === slot)

  // rascunho persistido (retomada após expiração de sessão)
  const watched = useWatch({ control: form.control })
  useEffect(() => {
    draftStore.set(user.id, { buyer: { ...defaultsFor(user, primary), ...watched } as BuyerFormValues, network, provider, slot })
  }, [watched, network, provider, slot, user, primary])

  // retomada de uma tentativa que não recebeu resposta (timeout + refresh)
  useEffect(() => {
    if (!resumeBody || resumed.current) return
    resumed.current = true
    notify('info', 'Retomando sua compra', 'Verificando o pedido enviado antes da interrupção.')
    placer
      .place(resumeBody)
      .then((order) => onOrderPending(order.id))
      .catch((err: ApiError) => setOrderError(err.message))
  }, [resumeBody, placer, onOrderPending])

  const changeSlot = (next: 'primary' | 'secondary') => {
    setSlot(next)
    const w = next === 'primary' ? primary : secondary
    if (w) {
      setNetwork(w.network)
      setProvider(w.provider)
      form.reset({ ...form.getValues(), ...defaultsFor(user, w), note: form.getValues('note') })
    }
  }

  const doConnect = () =>
    connect.mutateAsync({ slot, provider, network }).then(
      (c) => {
        notify('success', 'Carteira conectada', `${WALLET_PROVIDERS.find((p) => p.id === c.provider)?.label} · ${short(c.address)}`)
        return c
      },
      (err: ApiError) => {
        notify('error', err.code === 'WALLET_REJECTED' ? 'Conexão recusada' : 'Não foi possível conectar', err.message)
        throw err
      },
    )

  const startReview = form.handleSubmit(
    async () => {
      setOrderError(null)
      if (!wallet) {
        notify('error', 'Cadastre uma carteira', 'Você precisa de uma carteira cadastrada para pagar.')
        return
      }
      try {
        if (!connected) await doConnect()
        // revalida preço, disponibilidade, cupom e taxas antes de revisar
        const fresh = await quote.refresh()
        if (quote.accepted && fresh.fingerprint !== quote.accepted.fingerprint) {
          notify('warning', 'A cotação mudou', 'Revise os novos valores antes de confirmar.')
          return
        }
        if (fresh.blockers.length) {
          notify('error', 'Ajuste o carrinho', fresh.blockers[0].message)
          return
        }
        setReview(fresh)
      } catch {
        /* erros já sinalizados */
      }
    },
    () => {
      notify('error', 'Revise os campos destacados')
    },
  )

  const confirm = async () => {
    if (!review || !active.data) return
    const buyer = buyerSchema.parse(form.getValues())
    const body: CreateOrderRequest = { quoteId: review.id, quoteFingerprint: review.fingerprint, walletConnectionId: active.data.id, buyer }
    try {
      const order = await placer.place(body)
      setReview(null)
      draftStore.clear(user.id)
      onOrderPending(order.id)
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.code === 'QUOTE_CHANGED') {
        const next = (apiErr.details as { quote?: QuoteResponse })?.quote
        if (next) quote.replace(next)
        setReview(null)
        notify('warning', 'A cotação mudou', 'Preço, disponibilidade ou taxas foram atualizados. Revise e confirme novamente.')
      } else if (apiErr.code === 'WALLET_REJECTED') {
        setReview(null)
        void active.refetch()
        notify('error', 'Carteira desconectada', apiErr.message)
      } else if (apiErr.code === 'VALIDATION_FAILED' && Object.keys(apiErr.fields).length) {
        setReview(null)
        applyServerErrors(apiErr.fields, form.setError, 'buyer.')
      } else {
        setOrderError(apiErr.message)
      }
    }
  }

  const q = quote.quote
  const confirmDisabled = !q || quote.loading || quote.changed || placer.busy || (q?.blockers.length ?? 0) > 0 || (q?.lines.length ?? 0) === 0

  return (
    <div className="container-page pt-4 md:pt-6">
      <div className="mb-4 flex items-center gap-3 md:hidden">
        <Link to="/carrinho" className="grid size-9 place-items-center rounded-full bg-card" aria-label="Voltar ao carrinho">
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <h1 className="flex-1 text-center text-lg font-bold">Pagamento com carteira</h1>
        <span className="size-9" />
      </div>
      <nav aria-label="Trilha de navegação" className="mb-8 hidden text-sm font-bold md:block">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>{' '}
        /{' '}
        <Link to="/mercado" className="hover:text-primary">
          Mercado
        </Link>{' '}
        / <span aria-current="page">Pagamento</span>
      </nav>

      <form
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault()
          void startReview()
        }}
        className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_394px] lg:gap-8"
      >
        <section aria-labelledby="buyer-title" className="order-2 lg:order-1">
          <h2 id="buyer-title" className="mb-4 text-lg font-bold">
            Perfil do colecionador
          </h2>
          {!wallet ? (
            <div role="alert" className="mb-6 rounded-sm border border-warning/50 bg-warning/10 p-3 text-sm">
              Nenhuma carteira {slot === 'primary' ? 'principal' : 'secundária'} cadastrada.{' '}
              <Link to="/perfil/carteiras" className="font-bold text-primary underline">
                Cadastrar carteira
              </Link>
            </div>
          ) : null}
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            <Field label="Nome de exibição" required error={e.displayName?.message}>
              {(a) => <Input {...a} autoComplete="name" {...form.register('displayName')} />}
            </Field>
            <Field label="Nome de usuário" required error={e.username?.message}>
              {(a) => <Input {...a} autoComplete="username" {...form.register('username')} />}
            </Field>
            <Field label="Rede" required id="checkout-network">
              {(a) => (
                <NativeSelect {...a} value={network} onChange={(ev) => setNetwork(ev.target.value as Network)} data-testid="checkout-network">
                  {NETWORKS.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Nome do perfil" required error={e.profileName?.message}>
              {(a) => <Input {...a} {...form.register('profileName')} />}
            </Field>
            <Field label="Endereço da carteira" required hint={wallet ? `Carteira ${slot === 'primary' ? 'principal' : 'secundária'} cadastrada` : undefined}>
              {(a) => <Input {...a} value={wallet?.address ?? ''} readOnly placeholder="Endereço 0x da carteira" className="text-muted-foreground" />}
            </Field>
            <Field label="ENS ou carteira secundária (opcional)" error={e.ensOrSecondary?.message} hideLabel className="md:pt-7">
              {(a) => <Input {...a} placeholder="ENS ou carteira secundária (opcional)" {...form.register('ensOrSecondary')} />}
            </Field>
            <Field label="Tipo de carteira" required id="checkout-provider">
              {(a) => (
                <NativeSelect {...a} value={provider} onChange={(ev) => setProvider(ev.target.value as WalletProvider)}>
                  {WALLET_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Código de indicação" required error={e.referralCode?.message}>
              {(a) => <Input {...a} autoComplete="off" {...form.register('referralCode')} />}
            </Field>
            <Field label="E-mail" required error={e.email?.message}>
              {(a) => <Input {...a} type="email" autoComplete="email" {...form.register('email')} />}
            </Field>
            <Field label="Nome ENS" required error={e.ensName?.message}>
              {(a) => <EnsInput {...a} {...form.register('ensName')} />}
            </Field>
          </div>
          <label className="mt-5 flex w-fit items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={slot === 'secondary'}
              onChange={(ev) => changeSlot(ev.target.checked ? 'secondary' : 'primary')}
              disabled={!secondary}
              data-testid="use-secondary"
            />
            Usar outra carteira?
            {!secondary ? <span className="text-xs text-subtle">(cadastre uma secundária)</span> : null}
          </label>
          <Field label="Observação do colecionador (opcional)" error={e.note?.message} className="mt-5 md:max-w-[340px]">
            {(a) => <Textarea {...a} rows={6} className="rounded-sm border-input bg-background/40" {...form.register('note')} />}
          </Field>
        </section>

        <aside aria-labelledby="your-nfts" className="order-1 flex flex-col gap-5 lg:order-2">
          <QuoteNotices quote={quote} />
          <div>
            <h2 id="your-nfts" className="text-lg font-bold">
              Seus NFTs
            </h2>
            <div className="mt-2 flex justify-between text-sm font-bold">
              <span>NFTs</span>
              <span>Subtotal</span>
            </div>
          </div>
          {!q ? (
            <div className="flex flex-col gap-3" aria-busy="true" data-testid="quote-skeleton">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-[68px] w-full" />
              ))}
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-3" data-testid="quote-lines">
                {q.lines.map((l) => (
                  <li key={l.lineId} className="flex items-center gap-3 rounded-sm bg-card pr-3">
                    <NftImage image={l.image} sizes="68px" decorative className="size-[68px] shrink-0 rounded-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{l.name}</p>
                      <p className="truncate text-xs text-subtle">
                        ID do token: {l.tokenId} · {l.editionLabel}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">(x {l.quantity})</span>
                    <span className="font-bold text-primary tabular-nums">{formatEth(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              {q.excluded.length ? (
                <ul className="flex flex-col gap-1 text-xs text-warning" data-testid="quote-excluded">
                  {q.excluded.map((x) => (
                    <li key={x.lineId}>
                      <AlertTriangle className="mr-1 inline size-3" aria-hidden />
                      {x.name} ({x.editionLabel}): {x.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              <details className="group text-sm">
                <summary className="cursor-pointer list-none text-center hover:text-primary">Tem um código promocional? Aplique aqui</summary>
                <div className="mt-3">
                  <CheckoutCoupon />
                </div>
              </details>
              <div className={cn(quote.loading && 'opacity-60')} aria-busy={quote.loading}>
                <SummaryRows subtotal={q.subtotal} discount={q.discount} networkFee={q.networkFee} total={q.total} />
              </div>
            </>
          )}

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 w-full text-center text-lg font-bold">Carteira e rede</legend>
            <div className="flex items-center gap-3 rounded-sm border border-border px-4 py-3">
              <WalletBadges />
            </div>
            {WALLET_PROVIDERS.map((p) => (
              <label
                key={p.id}
                className={cn('flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 text-sm transition-colors', provider === p.id ? 'border-primary' : 'border-border hover:border-primary/50')}
              >
                <input type="radio" name="provider" value={p.id} checked={provider === p.id} onChange={() => setProvider(p.id)} className="size-4 accent-[var(--primary)]" />
                {p.label}
              </label>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs" aria-live="polite" data-testid="wallet-status">
              {connected && connection ? (
                <>
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="size-4" aria-hidden /> Conectada: {short(connection.address)} · {NETWORKS.find((n) => n.id === connection.network)?.label}
                  </span>
                  <button type="button" className="flex items-center gap-1 text-primary hover:underline" onClick={() => disconnect.mutate(connection.id, { onSuccess: () => notify('info', 'Carteira desconectada') })}>
                    <Unplug className="size-3" aria-hidden /> Desconectar
                  </button>
                </>
              ) : (
                <>
                  <span className="text-subtle">Carteira não conectada</span>
                  <button type="button" disabled={!wallet || connect.isPending} className="flex items-center gap-1 font-bold text-primary hover:underline disabled:opacity-50" onClick={() => doConnect().catch(() => undefined)} data-testid="connect-wallet">
                    <Plug className="size-3" aria-hidden /> {connect.isPending ? 'Conectando…' : 'Conectar carteira'}
                  </button>
                </>
              )}
            </div>
          </fieldset>

          {orderError ? (
            <p role="alert" className="rounded-sm border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive" data-testid="order-error">
              {orderError}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full rounded-md" disabled={confirmDisabled || connect.isPending} data-testid="confirm-purchase">
            {connect.isPending ? 'Conectando carteira…' : 'Confirmar compra'}
          </Button>
        </aside>
      </form>

      <ReviewDialog
        quote={review}
        buyerEmail={form.getValues('email')}
        provider={provider}
        onCancel={() => setReview(null)}
        onConfirm={confirm}
        busy={placer.busy}
        phase={placer.phase}
        staleQuote={quote.changed}
        error={orderError}
        onNavigateHome={() => void navigate({ to: '/' })}
      />
    </div>
  )
}

function CheckoutCoupon() {
  const cart = useCart()
  return <CouponForm cart={cart.data} />
}

function QuoteNotices({ quote }: { quote: ReturnType<typeof useCheckoutQuote> }) {
  if (quote.error && !quote.quote) return <ErrorState error={quote.error} onRetry={() => void quote.refresh().catch(() => undefined)} title="Não foi possível calcular a cotação" />
  if (!quote.changed || !quote.quote || !quote.accepted) return null
  const prev = quote.accepted
  const next = quote.quote
  const diffs = next.lines
    .map((l) => ({ l, before: prev.lines.find((p) => p.lineId === l.lineId) }))
    .filter(({ l, before }) => !before || before.unitPrice !== l.unitPrice || before.quantity !== l.quantity)
  const removed = prev.lines.filter((p) => !next.lines.some((l) => l.lineId === p.lineId))
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-sm border border-warning/60 bg-warning/10 p-4 text-sm" data-testid="quote-changed">
      <p className="flex items-center gap-2 font-bold text-warning">
        <AlertTriangle className="size-4" aria-hidden /> A cotação mudou enquanto você estava aqui
      </p>
      <ul className="list-inside list-disc text-xs">
        {diffs.map(({ l, before }) => (
          <li key={l.lineId}>
            {l.name}: {before ? `${formatEth(before.unitPrice)} → ${formatEth(l.unitPrice)}` : 'novo item'}
          </li>
        ))}
        {removed.map((r) => (
          <li key={r.lineId}>{r.name}: indisponível — removido desta cotação</li>
        ))}
        {next.coupon?.code !== prev.coupon?.code ? <li>Cupom alterado</li> : null}
        {next.networkFee !== prev.networkFee ? <li>Taxa de rede: {formatEth(prev.networkFee)} → {formatEth(next.networkFee)}</li> : null}
      </ul>
      <p className="text-xs">
        Total: <s>{formatEth(prev.total)}</s> → <strong className={compareEth(next.total, prev.total) > 0 ? 'text-warning' : 'text-success'}>{formatEth(next.total)}</strong>
      </p>
      <Button type="button" size="sm" variant="outline" className="h-8 self-start" onClick={quote.accept} data-testid="accept-quote">
        Aceitar nova cotação
      </Button>
    </div>
  )
}

function ReviewDialog({
  quote,
  buyerEmail,
  provider,
  onCancel,
  onConfirm,
  busy,
  phase,
  staleQuote,
  error,
}: {
  quote: QuoteResponse | null
  buyerEmail: string
  provider: WalletProvider
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
  phase: 'idle' | 'submitting' | 'retrying'
  staleQuote: boolean
  error: string | null
  onNavigateHome: () => void
}) {
  return (
    <Dialog open={Boolean(quote)} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border border-border bg-card sm:max-w-lg" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Revise seu pedido</DialogTitle>
          <DialogDescription>Confira itens, valores e carteira. A compra só é enviada ao confirmar.</DialogDescription>
        </DialogHeader>
        {quote ? (
          <div className="flex flex-col gap-4 text-sm" data-testid="review-dialog">
            <ul className="flex flex-col gap-2">
              {quote.lines.map((l) => (
                <li key={l.lineId} className="flex justify-between gap-3">
                  <span className="truncate">
                    {l.name} <span className="text-subtle">({l.editionLabel}) × {l.quantity}</span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{formatEth(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <SummaryRows subtotal={quote.subtotal} discount={quote.discount} networkFee={quote.networkFee} total={quote.total} estimate={false} />
            <p className="text-xs text-muted-foreground">
              Carteira: {WALLET_PROVIDERS.find((p) => p.id === provider)?.label} · Rede {NETWORKS.find((n) => n.id === quote.network)?.label} · Recibo para {buyerEmail}
            </p>
            {staleQuote ? (
              <p role="alert" className="text-xs text-warning">
                A cotação mudou — feche e aceite a nova cotação antes de confirmar.
              </p>
            ) : null}
            {phase === 'retrying' ? (
              <p role="status" className="flex items-center gap-2 text-xs text-warning" data-testid="order-retrying">
                <Loader2 className="size-4 animate-spin" aria-hidden /> O servidor demorou a responder. Verificando o mesmo pedido, sem duplicar a compra…
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Voltar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy || staleQuote} data-testid="review-confirm">
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Enviando…
              </>
            ) : (
              'Confirmar e pagar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Pedido pendente: acompanha via socket (order.updated) + polling de fallback. */
function PendingOrder({ orderId, onDismiss }: { orderId: string; onDismiss: () => void }) {
  const { user } = useSession()
  const order = useOrder(orderId)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const status = order.data?.status

  const { refetch } = order
  useEffect(
    () =>
      realtimeBus.onOrder((ev) => {
        if (ev.resource.id === orderId) void refetch()
      }),
    [orderId, refetch],
  )

  useEffect(() => {
    if (!user || !status || status === 'pending') return
    attemptStore.clear(user.id)
    if (status === 'confirmed') {
      notify('success', 'Pagamento confirmado', 'Seus NFTs agora estão na sua carteira.')
      void qc.invalidateQueries({ queryKey: qk.cartAll })
      void navigate({ to: '/pedido/$orderId', params: { orderId }, replace: true })
    } else {
      notify('error', 'Pagamento recusado', order.data?.failureReason ?? undefined)
    }
  }, [status, user, orderId, navigate, qc, order.data?.failureReason])

  if (order.error)
    return (
      <div className="container-page py-12">
        <ErrorState
          error={order.error}
          onRetry={() => void order.refetch()}
          title="Não foi possível consultar seu pedido"
        />
        <button
          type="button"
          className="mt-4 text-sm text-primary underline"
          onClick={() => {
            if (user) attemptStore.clear(user.id)
            onDismiss()
          }}
        >
          Voltar ao pagamento
        </button>
      </div>
    )

  return (
    <section className="container-page flex justify-center py-16" aria-labelledby="pending-title" aria-live="polite">
      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-sm border-b-[10px] border-primary bg-card px-8 py-10 text-center" data-testid={`order-status-${status ?? 'loading'}`}>
        {status === 'rejected' ? (
          <>
            <XCircle className="size-12 text-destructive" aria-hidden />
            <h1 id="pending-title" className="text-lg font-bold">
              Pagamento recusado
            </h1>
            <p className="text-sm text-muted-foreground">{order.data?.failureReason}</p>
            <p className="text-xs text-subtle">Seus itens continuam no carrinho. Pedido {orderId}.</p>
            <div className="flex gap-3">
              <Button onClick={onDismiss} data-testid="retry-checkout">
                Tentar novamente
              </Button>
              <Button asChild variant="outline">
                <Link to="/carrinho">Ver carrinho</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="size-12 animate-spin text-primary" aria-hidden />
            <h1 id="pending-title" className="text-lg font-bold">
              Aguardando confirmação na rede
            </h1>
            <p className="text-sm text-muted-foreground">Seu pedido foi recebido e está sendo processado. Você pode recarregar a página — o estado será recuperado sem criar outra compra.</p>
            <p className="text-xs text-subtle">Pedido {orderId}</p>
          </>
        )}
      </div>
    </section>
  )
}

export function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function CheckoutSkeleton() {
  return (
    <div className="container-page grid gap-10 pt-16 lg:grid-cols-[1fr_394px]" aria-busy="true" aria-label="Carregando pagamento" data-testid="checkout-skeleton">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[68px] w-full" />
        ))}
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

export type { Order }
