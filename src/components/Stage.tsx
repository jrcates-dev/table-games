import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { IconZoomIn, IconZoomOut } from './icons'
import { StageScale } from './stageScale'
import { useStageZoom, type StageZoom } from './stageZoom'

/**
 * A fixed-size canvas that scales to fit.
 *
 * A table is composed like a photograph — the shoe sits exactly here, the
 * betting circle exactly there — so it is laid out once in logical pixels and
 * the whole composition is scaled to the space available, rather than letting
 * every element reflow independently and the picture fall apart at odd window
 * sizes. The interface chrome around it stays responsive in real pixels.
 */

interface StageProps {
  width: number
  height: number
  children: ReactNode
  className?: string
  /** Never scale up past this. */
  maxScale?: number
  /**
   * A line in the composition, in logical pixels from the top, that must stay
   * clear of `reserve` screen pixels at the bottom of the window — where the
   * dock sits. Everything above it is playable and must never be covered;
   * anything below it is rail and room, and may be.
   */
  safeBottom?: number
  reserve?: number
  /** Screen pixels the top bar covers, kept clear when the picture is zoomed. */
  reserveTop?: number
  /** Let a finger look closer: pinch, drag, and a button. See stageZoom. */
  zoom?: StageZoom
}

export function Stage({ width, height, children, className, maxScale = 1.6, safeBottom, reserve = 0, reserveTop = 0, zoom }: StageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: width, h: height })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  let scale = Math.min(box.w / width, box.h / height)
  if (safeBottom) scale = Math.min(scale, (box.h - reserve) / safeBottom)
  scale = Math.min(maxScale, Math.max(0.2, scale))

  // Centred, unless centring would push the playable area under the dock — in
  // which case the picture rises just far enough to clear it.
  let top = (box.h - height * scale) / 2
  if (safeBottom && top + safeBottom * scale > box.h - reserve) top = box.h - reserve - safeBottom * scale
  const left = (box.w - width * scale) / 2

  const floor = safeBottom ?? height
  const frame = useMemo(
    () => ({ scale, left, top, w: box.w, h: box.h, width, floor, reserveTop, reserve }),
    [scale, left, top, box.w, box.h, width, floor, reserveTop, reserve],
  )
  const { zoomed, toggle } = useStageZoom(ref, layer, frame, zoom)

  return (
    <div ref={ref} className={`stage${zoom ? ' stage--zoom' : ''}${className ? ` ${className}` : ''}`}>
      <div ref={layer} className="stage__zoom">
        <StageScale.Provider value={scale}>
          <div
            className="stage__inner"
            style={{
              width,
              height,
              transform: `translate(${left}px, ${top}px) scale(${scale})`,
            }}
          >
            {children}
          </div>
        </StageScale.Provider>
      </div>
      {zoom && (
        <button
          type="button"
          className={`icon-btn stage__zoom-btn${zoomed ? ' is-active' : ''}`}
          style={{ top: reserveTop + 6 }}
          hidden={zoom.playing}
          aria-label={zoomed ? 'Show the whole table' : 'Zoom in on the layout'}
          onClick={toggle}
        >
          {zoomed ? <IconZoomOut /> : <IconZoomIn />}
        </button>
      )}
    </div>
  )
}
