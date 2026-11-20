import { formatEth, type EthString } from '@/lib/eth'
import { cn } from '@/lib/utils'

export function EthPrice({
  value,
  previous,
  className,
  minFraction = 2,
}: {
  value: EthString
  previous?: EthString | null
  className?: string
  minFraction?: number
}) {
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2', className)}>
      <span className="font-bold text-primary">{formatEth(value, { minFraction })}</span>
      {previous ? (
        <span className="text-subtle line-through decoration-1">
          <span className="sr-only">Preço anterior: </span>
          {formatEth(previous, { minFraction })}
        </span>
      ) : null}
    </span>
  )
}
