import { useLayoutEffect, useState, type RefObject } from 'react'

/** Kept between a card and the screen's edge. */
const MARGIN = 12

/**
 * Where a hover card sits from the point it belongs to.
 *
 * From a mouse: to the pointer's right if there is room, else its left, above
 * it unless that runs under the top bar. From a finger: centred over it and
 * well clear, since the finger and thumb cover what is below and beside; under
 * it if there is no room over it; and on a screen too short for either, to one
 * side. Never off the edge of the screen. Returns the card's `translate`.
 */
export function useTipPlacement(ref: RefObject<HTMLElement | null>, x: number, y: number, key: unknown, touch: boolean): string {
  const [place, setPlace] = useState({ dx: 20, dy: 20 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const width = el.offsetWidth
    const height = el.offsetHeight
    const right = window.innerWidth - MARGIN
    const bottom = window.innerHeight - MARGIN
    const clampX = (left: number) => Math.max(MARGIN, Math.min(left, right - width))
    const clampY = (top: number) => Math.max(MARGIN, Math.min(top, bottom - height))
    let left: number
    let top: number
    if (touch) {
      left = clampX(x - width / 2)
      top = y - 32 - height
      if (top < MARGIN) top = y + 32
      if (top + height > bottom) {
        left = x + 40 + width <= right ? x + 40 : clampX(x - 40 - width)
        top = clampY(y - height / 2)
      }
    } else {
      left = x + 20 + width > right ? x - 18 - width : x + 20
      left = clampX(left)
      top = y - 18 - height < 70 ? y + 20 : y - 14 - height
      top = clampY(top)
    }
    setPlace({ dx: left - x, dy: top - y })
  }, [ref, x, y, key, touch])

  return `${place.dx}px ${place.dy}px`
}
