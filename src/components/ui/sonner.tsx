import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { useTheme } from '@/app/providers/theme-context'

function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme}
      position="top-center"
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-5 text-success-strong" />,
        info: <Info className="size-5 text-primary" />,
        warning: <TriangleAlert className="size-5 text-warning-strong" />,
        error: <CircleAlert className="size-5 text-destructive-strong" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius-xl)',
          fontFamily: 'var(--font-body-family)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'shadow-overlay! text-base!',
          description: 'text-muted-foreground! text-sm!',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
