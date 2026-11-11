import { Moon, Sun } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'

import { useTheme } from '@/app/providers/theme-context'
import { Button } from '@/components/ui/button'
import { spring } from '@/lib/motion'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggle } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const Icon = isDark ? Moon : Sun

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={resolvedTheme}
          className="inline-flex"
          initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
          transition={spring.snappy}
        >
          <Icon className="size-5" aria-hidden="true" />
        </m.span>
      </AnimatePresence>
    </Button>
  )
}
