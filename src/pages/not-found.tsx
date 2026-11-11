import { Compass } from 'lucide-react'

import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { Wordmark } from '@/components/shared/wordmark'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main id="main" className="container-page flex min-h-dvh flex-col items-center justify-center gap-10 py-16">
      <title>Page not found · Kollide</title>
      <Wordmark />
      <EmptyState
        className="w-full max-w-xl"
        icon={Compass}
        headingLevel="h1"
        title="We couldn’t find that page"
        description="The link may be old, or the event may have ended. There is plenty more happening in Bengaluru."
        action={
          <Button asChild>
            <AppLink to="/">Back to Kollide</AppLink>
          </Button>
        }
      />
    </main>
  )
}
