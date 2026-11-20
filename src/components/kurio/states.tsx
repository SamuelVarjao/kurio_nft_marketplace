import type { ReactNode } from 'react'
import { AlertTriangle, RotateCw, SearchX, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'

export function ErrorState({
  error,
  onRetry,
  title = 'Algo deu errado',
  className,
  retrying,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
  retrying?: boolean
}) {
  const e = error instanceof ApiError ? error : null
  const offline = e?.kind === 'network' || e?.kind === 'timeout'
  const Icon = offline ? WifiOff : AlertTriangle
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-md border border-border bg-card px-6 py-10 text-center', className)}>
      <Icon className="size-8 text-primary" aria-hidden />
      <h2 className="text-base font-bold">{offline ? 'Sem conexão' : title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{e?.message ?? 'Não foi possível carregar as informações.'}</p>
      {e && e.status ? <p className="text-xs text-subtle">Código: {e.code} (HTTP {e.status})</p> : null}
      {onRetry ? (
        <Button onClick={onRetry} disabled={retrying} className="mt-2">
          <RotateCw className={cn('size-4', retrying && 'animate-spin')} aria-hidden />
          {retrying ? 'Tentando…' : 'Tentar novamente'}
        </Button>
      ) : null}
    </div>
  )
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-12 text-center">
      {icon ?? <SearchX className="size-8 text-primary" aria-hidden />}
      <h2 className="text-base font-bold">{title}</h2>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  )
}
