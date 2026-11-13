import { Cookie, Download, LogOut, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { useConsent } from '@/app/providers/consent-context'
import { useSession } from '@/app/providers/session-context'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage, services } from '@/services'

export function Component() {
  const { user, signOut } = useSession()
  const { openSettings } = useConsent()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function exportData() {
    try {
      const data = await services.profile.exportMyData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'kollide-my-data.json'
      link.click()
      URL.revokeObjectURL(url)
    } catch (caught) {
      toast.error(errorMessage(caught))
    }
  }

  async function deleteAccount() {
    setBusy(true)
    try {
      await services.profile.deleteMyAccount()
      await signOut()
      toast.success('Your account has been deleted.')
      await navigate('/', { replace: true })
    } catch (caught) {
      toast.error(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <div className="ph-no-capture grid gap-8">
      <PageHeader eyebrow="Account" title="Settings" description={user?.email ? `Signed in as ${user.email}` : undefined} />
      <Card>
        <CardContent className="grid gap-4 pt-6">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => void signOut().then(() => navigate('/'))}>
              <LogOut /> Sign out
            </Button>
            <Button variant="outline" onClick={() => void exportData()}>
              <Download /> Export my data
            </Button>
            <Button variant="outline" onClick={openSettings}>
              <Cookie /> Cookie settings
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-3 pt-6">
          <h2 className="text-h3">Delete my account</h2>
          <p className="text-muted-foreground">
            This removes your profile details, photos, interests and contact information and signs you out everywhere.
            It cannot be undone. Other people’s history with you stays, shown as “Former member”.
          </p>
          <div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 /> Delete my account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete your account?</DialogTitle>
                  <DialogDescription>Type DELETE to confirm. This cannot be undone.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-delete">Type DELETE</Label>
                  <Input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button variant="destructive" disabled={typed !== 'DELETE' || busy} onClick={() => void deleteAccount()}>
                    Delete forever
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
