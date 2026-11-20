import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Stepper acessível (botões + valor anunciado). Quantidades são inteiras. */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  size = 'md',
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (next: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const btn = cn(
    'grid place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40',
    size === 'sm' ? 'size-6' : 'h-10 w-7 md:h-11 md:w-8',
  )
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center gap-3', className)}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Diminuir quantidade de ${label}`}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <output aria-live="polite" aria-label={`Quantidade: ${value}`} className="min-w-4 text-center tabular-nums">
        {value}
      </output>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Aumentar quantidade de ${label}`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}
