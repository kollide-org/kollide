import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { NativeSelect } from '@/components/shared/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatWhen } from '@/lib/format'
import { errorMessage, services, type AuditEntry, type AuditFilters } from '@/services'

const ACTION_LABEL = { INSERT: 'created', UPDATE: 'changed', DELETE: 'removed' } as const

/** Everything admins and the system changed, newest first. Read-only. Private feedback authors are never shown. */
export function Component() {
  const [form, setForm] = useState({ actor: '', action: '', table: '', from: '', to: '' })
  const [filters, setFilters] = useState<AuditFilters>({})
  const [older, setOlder] = useState<AuditEntry[]>([])
  const tables = useQuery({ queryKey: ['admin-audit-tables'], queryFn: () => services.admin.auditTables() })
  const log = useQuery({ queryKey: ['admin-audit', filters], queryFn: () => services.admin.auditLog({ ...filters, limit: 50 }) })

  function apply(event: FormEvent) {
    event.preventDefault()
    setOlder([])
    setFilters({
      actor: form.actor.trim() || undefined,
      action: (form.action || undefined) as AuditFilters['action'],
      table: form.table || undefined,
      from: form.from ? new Date(form.from).toISOString() : undefined,
      // "to" is the end of that day
      to: form.to ? new Date(new Date(form.to).getTime() + 86_400_000).toISOString() : undefined,
    })
  }

  async function loadOlder() {
    const all = [...(log.data ?? []), ...older]
    const last = all.at(-1)
    if (!last) return
    setOlder([...older, ...(await services.admin.auditLog({ ...filters, before: last.id, limit: 50 }))])
  }

  const rows = [...(log.data ?? []), ...older]
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Admin" title="Audit log" description="Every admin action and sensitive change, with who did it and when. It cannot be edited." />
      <form onSubmit={apply} role="search" aria-label="Filter the audit log" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="audit-actor">Actor id</Label>
          <Input id="audit-actor" value={form.actor} onChange={(e) => setForm({ ...form, actor: e.target.value })} className="w-80" placeholder="a user id" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="audit-action">Action</Label>
          <NativeSelect id="audit-action" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className="w-36">
            <option value="">Any</option><option value="INSERT">Created</option><option value="UPDATE">Changed</option><option value="DELETE">Removed</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="audit-table">Table</Label>
          <NativeSelect id="audit-table" value={form.table} onChange={(e) => setForm({ ...form, table: e.target.value })} className="w-52">
            <option value="">Any</option>
            {tables.data?.map((t) => <option key={t} value={t}>{t}</option>)}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="audit-from">From</Label>
          <Input id="audit-from" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="audit-to">To</Label>
          <Input id="audit-to" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
        </div>
        <Button type="submit">Filter</Button>
      </form>

      {log.isError ? <p role="alert" className="text-destructive-strong">{errorMessage(log.error)}</p> : null}
      {rows.length === 0 && !log.isPending ? <p className="text-muted-foreground">Nothing matches.</p> : null}
      <ol className="grid gap-2" aria-label="Audit entries">
        {rows.map((r) => (
          <li key={r.id} data-testid="audit-row" className="rounded-xl border border-border p-3">
            <details>
              <summary className="cursor-pointer">
                <span className="font-medium">{r.actorFirstName ?? (r.actorId ? 'An admin' : 'System')}</span> {ACTION_LABEL[r.action]} <code>{r.tableName}</code>
                {r.rowPk ? <span className="text-muted-foreground"> · {r.rowPk.slice(0, 8)}</span> : null}
                <span className="text-muted-foreground"> · {formatWhen(r.at)}</span>
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {r.oldData ? <pre className="overflow-x-auto rounded-xl bg-secondary p-3 text-xs">{`before\n${JSON.stringify(r.oldData, null, 2)}`}</pre> : null}
                {r.newData ? <pre className="overflow-x-auto rounded-xl bg-secondary p-3 text-xs">{`after\n${JSON.stringify(r.newData, null, 2)}`}</pre> : null}
              </div>
            </details>
          </li>
        ))}
      </ol>
      {rows.length >= 50 ? <div><Button variant="outline" onClick={() => void loadOlder()}>Load older entries</Button></div> : null}
    </div>
  )
}
