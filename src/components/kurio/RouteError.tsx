import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { ErrorState } from './states'

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const { reset } = useQueryErrorResetBoundary()
  return (
    <div className="container-page py-16">
      <ErrorState
        error={error}
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
