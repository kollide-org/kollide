import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

import { cn } from '@/lib/utils'

/**
 * A real, scannable QR code, drawn as one SVG path. It is always dark on
 * light, whatever the theme, because scanners need that contrast.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, 'M')
    code.addData(value)
    code.make()
    const count = code.getModuleCount()
    let d = ''
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (code.isDark(row, col)) d += `M${col + 4} ${row + 4}h1v1h-1z`
      }
    }
    return { size: count + 8, path: d }
  }, [value])

  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={cn('block bg-white', className)} shapeRendering="crispEdges">
      <path d={path} fill="#1e1719" />
    </svg>
  )
}
