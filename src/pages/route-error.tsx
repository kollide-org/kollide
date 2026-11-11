import { useRouteError } from 'react-router'

import { ErrorState } from '@/components/shared/error-state'
import { Wordmark } from '@/components/shared/wordmark'

export function RouteErrorPage() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)

  return (
    <main id="main" className="container-page flex min-h-dvh flex-col items-center justify-center gap-10 py-16">
      <title>Something went wrong · Kollide</title>
      <Wordmark />
      <ErrorState className="w-full max-w-xl" headingLevel="h1" onRetry={() => window.location.reload()} />
    </main>
  )
}
