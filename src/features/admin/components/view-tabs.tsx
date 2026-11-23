import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { Count } from './queue'

export interface ViewTab<Value extends string> {
  value: Value
  label: string
  count?: number
}

/**
 * Tabs for the parts of one admin page. The open tab is kept in the address
 * (`?view=`), so a link or a refresh lands on the same place.
 */
export function ViewTabs<Value extends string>({
  label,
  tabs,
  children,
}: {
  label: string
  tabs: ViewTab<Value>[]
  children: (view: Value) => ReactNode
}) {
  const [params, setParams] = useSearchParams()
  const requested = params.get('view')
  const view = tabs.find((tab) => tab.value === requested)?.value ?? tabs[0].value

  return (
    <Tabs
      value={view}
      onValueChange={(next) =>
        setParams(
          (current) => {
            const updated = new URLSearchParams(current)
            if (next === tabs[0].value) updated.delete('view')
            else updated.set('view', next)
            return updated
          },
          { replace: true, preventScrollReset: true },
        )
      }
      className="gap-8"
    >
      <TabsList aria-label={label} className="max-w-full justify-start overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex-none">
            {tab.label}
            <Count value={tab.count} />
          </TabsTrigger>
        ))}
      </TabsList>
      {/* Radix mounts only the open panel, so each one loads its data when it is first opened. */}
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {children(tab.value)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
