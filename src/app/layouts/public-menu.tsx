import { AppLink } from '@/components/shared/app-link'
import { Wordmark } from '@/components/shared/wordmark'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface PublicMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  links: { to: string; label: string }[]
  signedIn: boolean
  homePath: string
}

/** The site navigation on small screens, as a sheet from the right. */
export default function PublicMenu({ open, onOpenChange, links, signedIn, homePath }: PublicMenuProps) {
  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(22rem,88vw)]">
        <SheetHeader>
          <SheetTitle>
            <Wordmark to={null} />
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-1 flex-col px-4 pb-6">
          <ul className="grid gap-1">
            {links.map((link) => (
              <li key={link.to}>
                <AppLink to={link.to} onClick={close} className="flex min-h-14 items-center rounded-xl px-3 font-display text-h3 hover:bg-accent">
                  {link.label}
                </AppLink>
              </li>
            ))}
          </ul>
          <div className="mt-auto grid gap-3">
            {signedIn ? (
              <Button asChild size="lg">
                <AppLink to={homePath} onClick={close}>
                  Open Kollide
                </AppLink>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <AppLink to="/sign-in" onClick={close}>
                    Join Kollide
                  </AppLink>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <AppLink to="/sign-in" onClick={close}>
                    Sign in
                  </AppLink>
                </Button>
              </>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
