import type { ReactNode } from 'react'

/**
 * Something standing up off a tilted table — a total, a marker — turned back
 * to face the camera. It stands centred on its spot, or with its right edge on
 * it when `align` is 'end'.
 */
export function Billboard({ x, y, tilt, align = 'center', children }: { x: number; y: number; tilt: number; align?: 'center' | 'end'; children: ReactNode }) {
  const shift = align === 'end' ? '-100%' : '-50%'
  return (
    <div className="bj-billboard" style={{ left: x, top: y }}>
      <div className="bj-billboard__stand" style={{ transform: `translateX(${shift}) rotateX(${-tilt}deg)`, transformOrigin: align === 'end' ? '100% 100%' : undefined }}>
        {children}
      </div>
    </div>
  )
}
