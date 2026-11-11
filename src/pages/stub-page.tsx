import { Hammer, type LucideIcon } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'

interface StubPageProps {
  title: string
  eyebrow?: string
  description?: string
  /** The milestone in which this screen is built. */
  milestone: number
  icon?: LucideIcon
  /** Public pages have no padded <main>, so the stub adds its own. */
  padded?: boolean
}

/**
 * Holds a route open until its milestone. It lets the layouts, navigation and
 * role guards be reviewed before the screens themselves exist.
 */
export function StubPage({ title, eyebrow, description, milestone, icon = Hammer, padded = false }: StubPageProps) {
  const content = (
    <>
      <title>{`${title} · Kollide`}</title>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        className="mt-10"
        icon={icon}
        title="Not built yet"
        description={`This screen is part of milestone ${milestone}. The layout, navigation and theme around it are ready to review.`}
      />
    </>
  )

  return padded ? <div className="container-page py-12 md:py-20">{content}</div> : content
}
