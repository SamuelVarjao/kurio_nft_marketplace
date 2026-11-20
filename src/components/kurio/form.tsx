import { forwardRef, useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Campo de formulário acessível: label associado, asterisco de obrigatório
 * com texto alternativo, mensagem de erro ligada via aria-describedby.
 */
export function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
  id: idProp,
  hideLabel,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  className?: string
  id?: string
  hideLabel?: boolean
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; 'aria-required'?: boolean }) => ReactNode
}) {
  const auto = useId()
  const id = idProp ?? auto
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={cn('text-sm text-foreground', hideLabel && 'sr-only')}>
        {label}
        {required ? (
          <>
            <span aria-hidden className="ml-0.5 text-lg leading-none text-required">
              *
            </span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        ) : null}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          <span aria-hidden>⚠ </span>
          {error}
        </p>
      ) : null}
    </div>
  )
}

export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<typeof Input>>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-sm text-subtle hover:text-primary"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
      >
        {visible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
      </button>
    </div>
  )
})

/** Input com o TLD ".eth" à esquerda, como no Figma. */
export const EnsInput = forwardRef<HTMLInputElement, ComponentProps<typeof Input>>(function EnsInput({ className, ...props }, ref) {
  return (
    <div className="flex gap-2">
      <span className="inline-flex h-10 shrink-0 items-center rounded-sm border border-input px-3 text-sm text-foreground" aria-hidden>
        .eth
      </span>
      <Input ref={ref} className={cn('flex-1', className)} {...props} />
    </div>
  )
})

export const NativeSelect = forwardRef<HTMLSelectElement, ComponentProps<'select'>>(function NativeSelect(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-sm border border-input bg-background/40 px-3 pr-9 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
})

/** Aplica erros de campo vindos da API (ApiError.fields) ao react-hook-form. */
export function applyServerErrors(
  fields: Record<string, string>,
  setError: (name: never, error: { type: string; message: string }) => void,
  prefix = '',
) {
  let applied = 0
  for (const [key, message] of Object.entries(fields)) {
    const name = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key
    setError(name as never, { type: 'server', message })
    applied += 1
  }
  return applied
}
