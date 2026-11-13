import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { PersonPreview } from '@/services'

interface PersonAvatarProps {
  person: Pick<PersonPreview, 'firstName' | 'photoUrl'>
  className?: string
}

/** A person's photo, with their initial while it loads or if there is none. */
export function PersonAvatar({ person, className }: PersonAvatarProps) {
  return (
    <Avatar className={cn('size-10', className)}>
      {person.photoUrl ? <AvatarImage src={person.photoUrl} alt="" loading="lazy" /> : null}
      <AvatarFallback className="bg-highlight-soft font-semibold text-highlight-soft-foreground">
        {person.firstName.charAt(0)}
      </AvatarFallback>
    </Avatar>
  )
}
