import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { FieldError } from '@/components/forms/step-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSubmitAppeal } from '@/features/profile/queries'
import type { Appeal } from '@/services'

interface AppealDialogProps {
  about: Appeal['about']
  reference: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Ask Kollide to look again at a tip or an account hold. */
export function AppealDialog({ about, reference, open, onOpenChange }: AppealDialogProps) {
  const appeal = useSubmitAppeal()
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (message.trim().length < 10) {
      setError('Tell us a little more, so we can look into it properly.')
      return
    }
    setError(null)
    appeal.mutate(
      { about, reference, message: message.trim() },
      {
        onSuccess: () => {
          onOpenChange(false)
          setMessage('')
          toast.success('We’ll look again', { description: 'A person on our team reads every appeal. You’ll hear back within a few days.' })
        },
        onError: (failure) => toast.error('Your appeal didn’t send', { description: failure.message }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{about === 'tip' ? 'Ask us to look at this tip again' : reference === 'suspended' ? 'Ask us to look at the suspension again' : 'Ask us to look at the hold again'}</DialogTitle>
          <DialogDescription>
            {about === 'tip'
              ? 'If the tip doesn’t sound like you, tell us why. While we look, it stays visible only to you.'
              : 'Tell us what happened from your side. While we look, your existing plans stay as they are.'}
          </DialogDescription>
        </DialogHeader>
        <form id="appeal-form" noValidate onSubmit={submit} className="grid gap-2">
          <Label htmlFor="appeal-message">Your side</Label>
          <Textarea
            id="appeal-message"
            value={message}
            maxLength={1000}
            onChange={(change) => setMessage(change.target.value)}
            className="min-h-32"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'appeal-message-error' : undefined}
          />
          <FieldError id="appeal-message-error" message={error} />
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="appeal-form" disabled={appeal.isPending}>
            {appeal.isPending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
