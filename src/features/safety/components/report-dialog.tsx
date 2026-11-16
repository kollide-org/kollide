import { Phone, ShieldAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { ChoiceChips } from '@/components/forms/choice'
import { FieldError } from '@/components/forms/step-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SAFETY_REPORT_LABELS } from '@/features/reviews/labels'
import { useSubmitSafetyReport } from '@/features/reviews/queries'
import { EMERGENCY_NUMBER } from '@/lib/safety'
import { SAFETY_REPORT_CATEGORIES, type SafetyReportCategory } from '@/services/types'

export interface ReportSubject {
  type: 'user' | 'event'
  id: string
  /** A first name, or the event's title. */
  name: string
  /** The event it happened at, when the report is about a person. */
  eventId?: string
}

interface ReportDialogProps {
  subject: ReportSubject
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DETAILS_MIN = 10

/** A safety report. It goes to Kollide's safety team; a report about a person puts them on hold. */
export function ReportDialog({ subject, open, onOpenChange }: ReportDialogProps) {
  const report = useSubmitSafetyReport()
  const [category, setCategory] = useState<SafetyReportCategory | null>(null)
  const [details, setDetails] = useState('')
  const [errors, setErrors] = useState<{ category?: string; details?: string }>({})
  const labels = SAFETY_REPORT_CATEGORIES.filter((value) => subject.type === 'user' || value !== 'fake_profile').map(
    (value) => SAFETY_REPORT_LABELS[value],
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!category) next.category = 'Choose what happened.'
    if (details.trim().length < DETAILS_MIN) next.details = 'Tell us what happened, in a sentence or two.'
    setErrors(next)
    if (next.category || next.details || !category) return
    report.mutate(
      { subjectType: subject.type, subjectId: subject.id, eventId: subject.eventId, category, details: details.trim() },
      {
        onSuccess: () => {
          onOpenChange(false)
          setCategory(null)
          setDetails('')
          toast.success('Thank you for telling us', { description: 'Our safety team will look at this within 24 hours.' })
        },
        onError: (error) => toast.error('Your report didn’t send', { description: error.message }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{subject.type === 'user' ? `Report ${subject.name}` : 'Report this event'}</DialogTitle>
          <DialogDescription>
            This goes to Kollide’s safety team, who reply within 24 hours.{' '}
            {subject.type === 'user'
              ? `While we look into it, ${subject.name}’s account is put on hold, so they can’t join anything new. They are never told who reported them.`
              : 'We may pause the event while we look into it.'}
          </DialogDescription>
        </DialogHeader>

        <p className="flex items-start gap-3 rounded-2xl bg-destructive-soft p-4 text-sm text-destructive-strong">
          <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            If you are in danger right now, call <strong>{EMERGENCY_NUMBER}</strong> first.
          </span>
        </p>

        <form id="safety-report" noValidate onSubmit={submit} className="grid gap-6">
          <div className="grid gap-3">
            <p className="text-sm font-medium" aria-hidden="true">
              What happened?
            </p>
            <ChoiceChips
              legend="What happened?"
              name="report-category"
              options={labels}
              value={category ? SAFETY_REPORT_LABELS[category] : null}
              onChange={(label) => setCategory(SAFETY_REPORT_CATEGORIES.find((value) => SAFETY_REPORT_LABELS[value] === label) ?? null)}
              describedBy={errors.category ? 'report-category-error' : undefined}
            />
            <FieldError id="report-category-error" message={errors.category} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-details">Tell us more</Label>
            <Textarea
              id="report-details"
              value={details}
              maxLength={1000}
              onChange={(change) => setDetails(change.target.value)}
              className="min-h-28"
              aria-invalid={errors.details ? true : undefined}
              aria-describedby={errors.details ? 'report-details-error' : 'report-details-hint'}
            />
            {errors.details ? (
              <FieldError id="report-details-error" message={errors.details} />
            ) : (
              <p id="report-details-hint" className="text-sm text-muted-foreground">
                What happened, and when. Only the safety team reads this.
              </p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="safety-report" variant="destructive" disabled={report.isPending}>
            <ShieldAlert aria-hidden="true" />
            {report.isPending ? 'Sending…' : 'Send report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
