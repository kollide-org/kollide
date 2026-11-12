import { Flag } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { NativeSelect } from '@/components/shared/native-select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage, REPORT_REASONS, services, type ReportReason, type ReportSubject } from '@/services'

/**
 * "Report" for a person, an event or a squad. Kept deliberately plain: we never tell the reporter what happens to the
 * other person, and the other person is never told who reported them.
 */
export function ReportDialog({ subject, subjectId, label = 'Report', trigger }: { subject: ReportSubject; subjectId: string; label?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!reason) return
    setBusy(true)
    setError(null)
    try {
      await services.safety.report(subject, subjectId, reason, details.trim() || undefined)
      toast.success('Thank you. We have your report and will look into it.')
      setOpen(false)
      setReason('')
      setDetails('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="ghost" size="sm"><Flag /> {label}</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report</DialogTitle>
          <DialogDescription>Tell us what happened. Our team reads every report. They are private: the other person is never told who sent it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="report-reason">What is this about?</Label>
            <NativeSelect id="report-reason" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
              <option value="">Choose a reason</option>
              {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="report-details">More details (optional)</Label>
            <Textarea id="report-details" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <p className="text-sm text-muted-foreground">If you are in immediate danger, please contact local emergency services first.</p>
          {error ? <p role="alert" className="text-destructive-strong">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!reason || busy} onClick={() => void send()}>Send report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
