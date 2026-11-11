import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage, services } from '@/services'

export function Component() {
  const { role, refreshProfile } = useSession()
  const queryClient = useQueryClient()
  const application = useQuery({ queryKey: ['host-application'], queryFn: () => services.profile.getMyHostApplication() })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (role === 'host' || role === 'admin') return <Navigate to="/app/host" replace />

  async function apply(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await services.profile.applyToHost(message.trim())
      await queryClient.invalidateQueries({ queryKey: ['host-application'] })
      await refreshProfile()
      toast.success('Application sent.')
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const status = application.data?.status
  return (
    <div className="grid max-w-xl gap-6">
      <PageHeader eyebrow="Hosting" title="Become a host" description="Hosts run events. We approve every host to keep Kollide safe." />
      {status === 'pending' ? (
        <p role="status" className="rounded-xl bg-secondary p-4">Your application is with our team. We will let you know.</p>
      ) : (
        <form onSubmit={apply} className="grid gap-4">
          {status === 'rejected' ? (
            <p className="rounded-xl bg-secondary p-4">
              Your last application was not approved{application.data?.adminNote ? `: ${application.data.adminNote}` : '.'} You can apply again.
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="why">What would you like to host?</Label>
            <Textarea id="why" rows={5} maxLength={1000} required value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div>
            <Button type="submit" disabled={busy || message.trim().length === 0}>Send application</Button>
          </div>
        </form>
      )}
    </div>
  )
}
