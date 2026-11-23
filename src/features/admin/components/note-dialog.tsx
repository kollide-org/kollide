import { useId, useState, type FormEvent, type ReactNode } from 'react'

import { FieldError } from '@/components/forms/step-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface NoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  label: string
  /** Shown under the field, for example who will read the note. */
  hint?: string
  confirmLabel: string
  pending: boolean
  destructive?: boolean
  minLength?: number
  onConfirm: (note: string) => void
}

/**
 * Asks the admin for a short written reason before an action that a member
 * will be told about, or that someone else on the team will read later.
 */
export function NoteDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  hint,
  confirmLabel,
  pending,
  destructive = false,
  minLength = 5,
  onConfirm,
}: NoteDialogProps) {
  const id = useId()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (note.trim().length < minLength) {
      setError('Add a few words, so the decision makes sense later.')
      return
    }
    setError(null)
    onConfirm(note.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} noValidate onSubmit={submit} className="grid gap-2">
          <Label htmlFor={`${id}-note`}>{label}</Label>
          <Textarea
            id={`${id}-note`}
            value={note}
            maxLength={600}
            onChange={(change) => setNote(change.target.value)}
            className="min-h-28"
            aria-invalid={error ? true : undefined}
            aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined}
          />
          {hint ? (
            <p id={`${id}-hint`} className="text-sm text-muted-foreground">
              {hint}
            </p>
          ) : null}
          <FieldError id={`${id}-error`} message={error} />
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} variant={destructive ? 'destructive' : 'default'} disabled={pending}>
            {pending ? 'Saving…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
