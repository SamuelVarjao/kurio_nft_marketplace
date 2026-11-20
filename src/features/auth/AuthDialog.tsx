import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useRouter } from '@tanstack/react-router'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { applyServerErrors, Field, PasswordInput } from '@/components/kurio/form'
import { loginSchema, registerSchema } from '@/contracts/schemas'
import { ApiError } from '@/lib/api/errors'
import { notify } from '@/lib/announce'
import { cn } from '@/lib/utils'
import { useLogin, useRegister } from './hooks'

export type AuthMode = 'login' | 'register'

export function AuthDialog({ mode, redirect, reason }: { mode: AuthMode; redirect?: string; reason?: 'expired' }) {
  const router = useRouter()
  const done = (to = redirect ?? '/') => void router.navigate({ href: to, replace: true })
  const close = () => done(redirect && !redirect.startsWith('/pagamento') && !redirect.startsWith('/perfil') ? redirect : '/')

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className={cn(
          'gap-0 overflow-y-auto border-0 bg-card p-0 sm:max-w-[500px]',
          'max-sm:inset-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none',
          'sm:rounded-sm sm:border-b-[10px] sm:border-primary',
        )}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          document.getElementById(mode === 'login' ? 'login-email' : 'register-username')?.focus()
        }}
      >
        <div className="flex flex-col items-center px-6 pt-10 pb-8 sm:px-20">
          <p className="mb-12 text-2xl font-bold tracking-[0.2em] sm:hidden" aria-hidden>
            KURIO
          </p>
          <nav aria-label="Acesso" className="mb-8 flex items-center gap-2 text-xl">
            <Link
              to="/entrar"
              search={{ redirect }}
              replace
              aria-current={mode === 'login' ? 'page' : undefined}
              className={cn(mode === 'login' ? 'text-primary' : 'text-foreground hover:text-primary', 'max-sm:hidden')}
            >
              Entrar
            </Link>
            <span aria-hidden className="h-6 w-px bg-primary max-sm:hidden" />
            <Link
              to="/cadastro"
              search={{ redirect }}
              replace
              aria-current={mode === 'register' ? 'page' : undefined}
              className={cn(mode === 'register' ? 'text-primary' : 'text-foreground hover:text-primary', 'max-sm:hidden')}
            >
              Criar conta
            </Link>
            <span className="text-lg font-bold sm:hidden">{mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}</span>
          </nav>
          <DialogTitle className="sr-only">{mode === 'login' ? 'Entrar na Kurio' : 'Criar conta na Kurio'}</DialogTitle>
          <DialogDescription className="mb-6 text-center text-xs leading-relaxed text-foreground">
            {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
          </DialogDescription>
          {reason === 'expired' ? (
            <p role="alert" className="mb-4 w-full rounded-sm border border-warning/50 bg-warning/10 p-3 text-xs" data-testid="session-expired-notice">
              Sua sessão expirou. Entre novamente — você voltará para onde estava.
            </p>
          ) : null}
          {mode === 'login' ? <LoginForm onDone={() => done()} /> : <RegisterForm onDone={() => done()} />}
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-6 pt-4 pb-10 sm:px-20">
          <p className="-mt-7 self-center bg-card px-2 text-xs">Ou continue com</p>
          <SocialButton provider="Google" />
          <SocialButton provider="Facebook" />
          <p className="mt-6 text-center text-xs sm:hidden">
            {mode === 'login' ? (
              <>
                Novo na Kurio?{' '}
                <Link to="/cadastro" search={{ redirect }} replace className="text-primary">
                  Crie uma conta
                </Link>
              </>
            ) : (
              <>
                Já tem uma conta?{' '}
                <Link to="/entrar" search={{ redirect }} replace className="text-primary">
                  Entre
                </Link>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SocialButton({ provider }: { provider: 'Google' | 'Facebook' }) {
  return (
    <button
      type="button"
      onClick={() => notify('info', `Login com ${provider} indisponível`, 'Use e-mail e senha nesta demonstração.')}
      className="flex h-10 items-center justify-center gap-3 rounded-sm border border-border text-xs hover:border-primary"
    >
      {provider === 'Google' ? (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8Z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9Z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#1877F2" d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.6c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.1H8.3v3.2h2.6V22H14v-10.3h2.6l.4-3.2H14Z" />
        </svg>
      )}
      Continuar com {provider}
    </button>
  )
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const login = useLogin()
  const form = useForm<z.input<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const { errors } = form.formState
  const submitted = useRef(false)
  useEffect(() => {
    if (login.isSuccess && !submitted.current) {
      submitted.current = true
      onDone()
    }
  }, [login.isSuccess, onDone])

  return (
    <form
      className="flex w-full flex-col gap-3"
      noValidate
      onSubmit={form.handleSubmit((values) =>
        login.mutate(values, {
          onSuccess: (s) => notify('success', `Bem-vindo, ${s.user.displayName}!`),
          onError: (e) => {
            if (e instanceof ApiError && Object.keys(e.fields).length) applyServerErrors(e.fields, form.setError)
            else form.setError('root', { message: e.message })
          },
        }),
      )}
    >
      <Field label="E-mail" error={errors.email?.message} id="login-email" hideLabel>
        {(p) => <Input {...p} type="email" autoComplete="email" placeholder="E-mail" {...form.register('email')} />}
      </Field>
      <Field label="Senha" error={errors.password?.message} id="login-password" hideLabel>
        {(p) => <PasswordInput {...p} autoComplete="current-password" placeholder="Senha" {...form.register('password')} />}
      </Field>
      <button type="button" className="self-end text-xs text-primary hover:underline" onClick={() => notify('info', 'Recuperação de senha indisponível', 'Use as credenciais fictícias do README nesta demonstração.')}>
        Esqueceu a senha?
      </button>
      {errors.root ? (
        <p role="alert" className="text-xs text-destructive" data-testid="login-error">
          {errors.root.message}
        </p>
      ) : null}
      <Button type="submit" className="mt-2 h-11 w-full" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const register = useRegister()
  const form = useForm<z.input<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors } = form.formState
  const submitted = useRef(false)
  useEffect(() => {
    if (register.isSuccess && !submitted.current) {
      submitted.current = true
      onDone()
    }
  }, [register.isSuccess, onDone])

  return (
    <form
      className="flex w-full flex-col gap-3"
      noValidate
      onSubmit={form.handleSubmit(({ username, email, password }) =>
        register.mutate(
          { username, email, password },
          {
            onSuccess: () => notify('success', 'Conta criada!', 'Seu perfil de colecionador está pronto.'),
            onError: (e) => {
              if (e instanceof ApiError && Object.keys(e.fields).length) {
                applyServerErrors(e.fields, form.setError)
                const first = Object.keys(e.fields)[0]
                form.setFocus(first as 'email')
              } else form.setError('root', { message: e.message })
            },
          },
        ),
      )}
    >
      <Field label="Nome de usuário" error={errors.username?.message} id="register-username" hideLabel>
        {(p) => <Input {...p} autoComplete="username" placeholder="Nome de usuário" {...form.register('username')} />}
      </Field>
      <Field label="E-mail" error={errors.email?.message} id="register-email" hideLabel>
        {(p) => <Input {...p} type="email" autoComplete="email" placeholder="Digite seu e-mail" {...form.register('email')} />}
      </Field>
      <Field label="Senha" error={errors.password?.message} id="register-password" hideLabel hint="Mínimo de 8 caracteres, com letras e números.">
        {(p) => <PasswordInput {...p} autoComplete="new-password" placeholder="Senha" {...form.register('password')} />}
      </Field>
      <Field label="Confirmar senha" error={errors.confirmPassword?.message} id="register-confirm" hideLabel>
        {(p) => <PasswordInput {...p} autoComplete="new-password" placeholder="Confirmar senha" {...form.register('confirmPassword')} />}
      </Field>
      {errors.root ? (
        <p role="alert" className="text-xs text-destructive">
          {errors.root.message}
        </p>
      ) : null}
      <Button type="submit" className="mt-2 h-11 w-full" disabled={register.isPending}>
        {register.isPending ? 'Criando…' : 'Criar conta'}
      </Button>
    </form>
  )
}
