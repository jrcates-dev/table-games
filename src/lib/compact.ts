import { useSyncExternalStore } from 'react'

/**
 * A phone held sideways. Under this height the top bar, dock and lobby tighten
 * (see the phone section of responsive.css), so the tables reserve less of the
 * screen for the dock.
 */
const COMPACT = '(max-height: 500px)'

/**
 * A phone held upright. The lobby and the card tables and roulette are laid
 * out for it (each view's upright fill, and the upright section of
 * responsive.css); craps asks to be turned sideways. Kept in step with that
 * stylesheet's query.
 */
const PORTRAIT = '(orientation: portrait) and (max-width: 600px)'

/** Screen pixels the compact dock takes off the bottom of a table. */
export const COMPACT_RESERVE = 80

/** Screen pixels the top bar covers, full size and compact: a zoomed table keeps clear of them. */
export const TOPBAR = 70
export const COMPACT_TOPBAR = 50

/**
 * Upright, the top bar and the dock, which stacks its row in two (see
 * responsive.css). Both are measured inside the notch and the home bar, which
 * the upright stage already keeps clear of.
 */
export const PORTRAIT_TOPBAR = 52
export const PORTRAIT_RESERVE = 146
/** Upright, the card count's strip under the top bar, when it is on. */
export const PORTRAIT_COUNT = 46

/**
 * A ref for a dock's wrapper: keeps `--dock-h` on the page at the dock's height
 * as it grows and shrinks from one phase to the next, so what floats over the
 * felt upright on a phone (the bets tab, the zoom, a drawer) stands just above
 * it however many rows it has (see responsive.css).
 */
export function measureDock(el: HTMLElement | null): (() => void) | undefined {
  if (!el || typeof ResizeObserver === 'undefined') return
  const root = document.documentElement
  let last = -1
  const observer = new ResizeObserver(() => {
    const height = Math.round(el.getBoundingClientRect().height)
    if (height === last) return
    last = height
    root.style.setProperty('--dock-h', `${height}px`)
  })
  observer.observe(el)
  return () => {
    observer.disconnect()
    root.style.removeProperty('--dock-h')
  }
}

export function isCompact(): boolean {
  return matches(COMPACT)
}

export function isPortrait(): boolean {
  return matches(PORTRAIT)
}

/**
 * Sideways on a phone, or no wider than a tablet, an open bet rail would sit
 * over the felt, so until the player opens it the rail starts folded.
 */
export function railStartsFolded(): boolean {
  return matches(`${COMPACT}, (max-width: 1100px)`)
}

export function useCompact(): boolean {
  return useSyncExternalStore(subscriber(COMPACT), isCompact, () => false)
}

export function usePortrait(): boolean {
  return useSyncExternalStore(subscriber(PORTRAIT), isPortrait, () => false)
}

function matches(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(query).matches === true
}

const subscribers = new Map<string, (onChange: () => void) => () => void>()

/** One stable subscribe function per query, so React never resubscribes on a render. */
function subscriber(query: string): (onChange: () => void) => () => void {
  let subscribe = subscribers.get(query)
  if (!subscribe) {
    subscribe = (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    }
    subscribers.set(query, subscribe)
  }
  return subscribe
}
