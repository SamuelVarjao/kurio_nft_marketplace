import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImageIcon } from 'lucide-react'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { applyServerErrors, EnsInput, Field, PasswordInput } from '@/components/kurio/form'
import { ErrorState } from '@/components/kurio/states'
import { passwordChangeSchema, profileSchema } from '@/contracts/schemas'
import type { User } from '@/contracts'
import { ApiError } from '@/lib/api/errors'
import { notify } from '@/lib/announce'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { prepareAvatar, useChangePassword, useProfile, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from './hooks'

type ProfileValues = z.input<typeof profileSchema>
type PasswordValues = z.input<typeof passwordChangeSchema>

export function ProfilePage() {
  useDocumentTitle('Perfil do colecionador')
  const profile = useProfile()
  if (profile.isPending) return <ProfileSkeleton />
  if (profile.error || !profile.data)
    return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} retrying={profile.isRefetching} title="Não foi possível carregar seu perfil" />
  return <ProfileForm user={profile.data} />
}

function toValues(u: User): ProfileValues {
  return { displayName: u.displayName, username: u.username, email: u.email, ensName: u.ensName ?? '', walletNickname: u.walletNickname ?? '' }
}

function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile()
  const changePassword = useChangePassword()
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: toValues(user) })
  const pw = useForm<PasswordValues>({ resolver: zodResolver(passwordChangeSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } })
  useEffect(() => form.reset(toValues(user)), [user, form])
  const e = form.formState.errors
  const pe = pw.formState.errors
  const saving = update.isPending || changePassword.isPending

  const save = async () => {
    const wantsPassword = Object.values(pw.getValues()).some((v) => v)
    const okProfile = await form.trigger()
    const okPassword = wantsPassword ? await pw.trigger() : true
    if (!okProfile || !okPassword) {
      notify('error', 'Revise os campos destacados')
      const first = Object.keys(form.formState.errors)[0] ?? Object.keys(pw.formState.errors)[0]
      if (first) document.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    // não confiar em formState.isDirty fora do render (proxy do RHF)
    const profileChanged = JSON.stringify(form.getValues()) !== JSON.stringify(toValues(user))
    if (profileChanged) {
      try {
        const values = profileSchema.parse(form.getValues())
        await update.mutateAsync(values)
        notify('success', 'Perfil atualizado')
      } catch (err) {
        if (err instanceof ApiError && Object.keys(err.fields).length) applyServerErrors(err.fields, form.setError)
        notify('error', 'Não foi possível salvar o perfil', (err as Error).message)
        return
      }
    }
    if (wantsPassword) {
      try {
        const { currentPassword, newPassword } = pw.getValues()
        await changePassword.mutateAsync({ currentPassword, newPassword })
        pw.reset()
        notify('success', 'Senha alterada', 'As outras sessões foram encerradas.')
      } catch (err) {
        if (err instanceof ApiError && Object.keys(err.fields).length) applyServerErrors(err.fields, pw.setError)
        notify('error', 'Não foi possível alterar a senha', (err as Error).message)
      }
    }
    if (!profileChanged && !wantsPassword) notify('info', 'Nenhuma alteração para salvar')
  }

  return (
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault()
        void save()
      }}
      aria-labelledby="profile-title"
    >
      <h1 id="profile-title" className="mb-6 text-base font-bold">
        Perfil do colecionador
      </h1>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field label="Nome de exibição" required error={e.displayName?.message}>
          {(p) => <Input {...p} autoComplete="name" {...form.register('displayName')} />}
        </Field>
        <Field label="Nome de usuário" required error={e.username?.message}>
          {(p) => <Input {...p} autoComplete="username" {...form.register('username')} />}
        </Field>
        <Field label="E-mail" required error={e.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...form.register('email')} />}
        </Field>
        <Field label="Nome ENS" required error={e.ensName?.message}>
          {(p) => <EnsInput {...p} {...form.register('ensName')} />}
        </Field>
        <Field label="Apelido da carteira" required error={e.walletNickname?.message}>
          {(p) => <Input {...p} {...form.register('walletNickname')} />}
        </Field>
        <AvatarField user={user} />
      </div>

      <fieldset className="mt-8 grid gap-5 md:max-w-[calc(50%-12px)]">
        <legend className="mb-4 text-base font-bold">Alterar senha</legend>
        <Field label="Senha atual" error={pe.currentPassword?.message}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" {...pw.register('currentPassword')} />}
        </Field>
        <Field label="Nova senha" error={pe.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...pw.register('newPassword')} />}
        </Field>
        <Field label="Confirmar nova senha" error={pe.confirmPassword?.message}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" {...pw.register('confirmPassword')} />}
        </Field>
      </fieldset>

      <Button type="submit" className="mt-8 w-28" disabled={saving} data-testid="profile-save">
        {saving ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function AvatarField({ user }: { user: User }) {
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const input = useRef<HTMLInputElement>(null)
  const busy = upload.isPending || remove.isPending
  const error = upload.error?.message
  return (
    <div className="flex flex-col gap-2">
      <span id="avatar-label" className="text-sm">
        Avatar
      </span>
      <div className="flex items-center gap-5">
        <span className="grid size-11 place-items-center overflow-hidden rounded-full border border-border bg-surface-2">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={`Avatar de ${user.displayName}`} className="size-full object-cover" data-testid="avatar-img" />
          ) : (
            <ImageIcon className="size-5 text-primary" aria-label="Sem avatar" />
          )}
        </span>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-labelledby="avatar-label"
          data-testid="avatar-input"
          onChange={async (ev) => {
            const file = ev.target.files?.[0]
            ev.target.value = ''
            if (!file) return
            try {
              const dataUrl = await prepareAvatar(file)
              await upload.mutateAsync(dataUrl)
              notify('success', 'Avatar atualizado')
            } catch (err) {
              notify('error', 'Não foi possível atualizar o avatar', (err as Error).message)
            }
          }}
        />
        <Button type="button" size="sm" className="h-9 px-6" disabled={busy} onClick={() => input.current?.click()}>
          {upload.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <button
          type="button"
          className="text-sm hover:text-primary disabled:opacity-50"
          disabled={busy || !user.avatarUrl}
          onClick={() => remove.mutate(undefined, { onSuccess: () => notify('success', 'Avatar removido'), onError: (err) => notify('error', 'Não foi possível remover', err.message) })}
        >
          Remover
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando perfil" className="grid gap-5 md:grid-cols-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}
