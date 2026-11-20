import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { applyServerErrors, EnsInput, Field, NativeSelect } from '@/components/kurio/form'
import { ErrorState } from '@/components/kurio/states'
import { NETWORKS, WALLET_PROVIDERS, type Wallet, type WalletInput } from '@/contracts'
import { walletSchema, type WalletFormValues } from '@/contracts/schemas'
import { ApiError } from '@/lib/api/errors'
import { notify } from '@/lib/announce'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useSameAsPrimary, useSaveWallet, useWallets } from './hooks'

const EMPTY: WalletFormValues = {
  displayName: '',
  nickname: '',
  network: '' as never,
  profileName: '',
  address: '',
  ensOrSecondary: '',
  provider: '' as never,
  referralCode: '',
  email: '',
  ensName: '',
  ensTld: '.eth',
}

function toValues(w: Wallet | null): WalletFormValues {
  if (!w) return EMPTY
  return { ...w, ensOrSecondary: w.ensOrSecondary ?? '' }
}

export function WalletsPage() {
  useDocumentTitle('Carteiras')
  const wallets = useWallets()
  const sameAsPrimary = useSameAsPrimary()
  const [editing, setEditing] = useState<{ primary: boolean; secondary: boolean }>({ primary: false, secondary: false })

  if (wallets.isPending)
    return (
      <div aria-busy="true" aria-label="Carregando carteiras" className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  if (wallets.error || !wallets.data)
    return <ErrorState error={wallets.error} onRetry={() => void wallets.refetch()} retrying={wallets.isRefetching} title="Não foi possível carregar suas carteiras" />

  const { primary, secondary, secondarySameAsPrimary } = wallets.data
  const showPrimaryForm = Boolean(primary) || editing.primary
  const showSecondaryForm = !secondarySameAsPrimary && (Boolean(secondary) || editing.secondary)

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="primary-title">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 id="primary-title" className="text-base font-bold">
              Carteira principal
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!showPrimaryForm ? (
            <button type="button" className="font-bold text-primary hover:underline" onClick={() => setEditing((e) => ({ ...e, primary: true }))}>
              Adicionar
            </button>
          ) : null}
        </div>
        {showPrimaryForm ? (
          <WalletForm slot="primary" wallet={primary} onSaved={() => setEditing((e) => ({ ...e, primary: false }))} />
        ) : (
          <p className="text-sm text-subtle">Você ainda não adicionou uma carteira principal.</p>
        )}
      </section>

      <section aria-labelledby="secondary-title">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="secondary-title" className="text-base font-bold">
              Carteira secundária
            </h2>
            {!showSecondaryForm ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {secondarySameAsPrimary ? 'A carteira secundária usa os mesmos dados da principal.' : 'Você ainda não adicionou uma carteira secundária.'}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={secondarySameAsPrimary}
                disabled={!primary || sameAsPrimary.isPending}
                onChange={(ev) =>
                  sameAsPrimary.mutate(ev.target.checked, {
                    onSuccess: (w) => notify('success', w.secondarySameAsPrimary ? 'Secundária igual à principal' : 'Secundária independente'),
                    onError: (err) => notify('error', 'Não foi possível alterar', err.message),
                  })
                }
              />
              Igual à carteira principal
            </label>
            {!showSecondaryForm && !secondarySameAsPrimary ? (
              <button type="button" className="font-bold text-primary hover:underline" onClick={() => setEditing((e) => ({ ...e, secondary: true }))}>
                Adicionar
              </button>
            ) : null}
          </div>
        </div>
        {showSecondaryForm ? <WalletForm slot="secondary" wallet={secondary} onSaved={() => setEditing((e) => ({ ...e, secondary: false }))} /> : null}
      </section>
    </div>
  )
}

function WalletForm({ slot, wallet, onSaved }: { slot: 'primary' | 'secondary'; wallet: Wallet | null; onSaved: () => void }) {
  const save = useSaveWallet()
  const form = useForm<WalletFormValues>({ resolver: zodResolver(walletSchema), defaultValues: toValues(wallet) })
  useEffect(() => form.reset(toValues(wallet)), [wallet, form])
  const e = form.formState.errors
  const p = `${slot}-`

  return (
    <form
      noValidate
      aria-label={slot === 'primary' ? 'Dados da carteira principal' : 'Dados da carteira secundária'}
      onSubmit={form.handleSubmit(
        (values) => {
          const body = walletSchema.parse(values) as WalletInput
          save.mutate(
            { slot, body },
            {
              onSuccess: () => {
                notify('success', 'Carteira salva', slot === 'primary' ? 'Carteira principal atualizada.' : 'Carteira secundária atualizada.')
                onSaved()
              },
              onError: (err) => {
                if (err instanceof ApiError && Object.keys(err.fields).length) applyServerErrors(err.fields, form.setError)
                notify('error', 'Não foi possível salvar a carteira', err.message)
              },
            },
          )
        },
        () => notify('error', 'Revise os campos destacados'),
      )}
      data-testid={`wallet-form-${slot}`}
    >
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field id={`${p}displayName`} label="Nome de exibição" required error={e.displayName?.message}>
          {(a) => <Input {...a} {...form.register('displayName')} />}
        </Field>
        <Field id={`${p}nickname`} label="Apelido da carteira" required error={e.nickname?.message}>
          {(a) => <Input {...a} {...form.register('nickname')} />}
        </Field>
        <Field id={`${p}network`} label="Rede" required error={e.network?.message}>
          {(a) => (
            <NativeSelect {...a} {...form.register('network')}>
              <option value="">Selecione uma rede</option>
              {NETWORKS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id={`${p}profileName`} label="Nome do perfil" required error={e.profileName?.message}>
          {(a) => <Input {...a} {...form.register('profileName')} />}
        </Field>
        <Field id={`${p}address`} label="Endereço da carteira" required error={e.address?.message}>
          {(a) => <Input {...a} placeholder="Endereço 0x da carteira" spellCheck={false} autoComplete="off" {...form.register('address')} />}
        </Field>
        <Field id={`${p}ensOrSecondary`} label="ENS ou carteira secundária (opcional)" error={e.ensOrSecondary?.message} className="md:pt-7" hideLabel>
          {(a) => <Input {...a} placeholder="ENS ou carteira secundária (opcional)" {...form.register('ensOrSecondary')} />}
        </Field>
        <Field id={`${p}provider`} label="Tipo de carteira" required error={e.provider?.message}>
          {(a) => (
            <NativeSelect {...a} {...form.register('provider')}>
              <option value="">Selecione uma carteira</option>
              {WALLET_PROVIDERS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id={`${p}referralCode`} label="Código de indicação" required error={e.referralCode?.message}>
          {(a) => <Input {...a} autoComplete="off" {...form.register('referralCode')} />}
        </Field>
        <Field id={`${p}email`} label="E-mail" required error={e.email?.message}>
          {(a) => <Input {...a} type="email" autoComplete="email" {...form.register('email')} />}
        </Field>
        <Field id={`${p}ensName`} label="Nome ENS" required error={e.ensName?.message}>
          {(a) => <EnsInput {...a} {...form.register('ensName')} />}
        </Field>
      </div>
      <Button type="submit" className="mt-7 h-9 px-2 text-xs" disabled={save.isPending} data-testid={`wallet-save-${slot}`}>
        {save.isPending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}
