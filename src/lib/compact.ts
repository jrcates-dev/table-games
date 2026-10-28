import { useSyncExternalStore } from 'react'

/**
 * A phone held sideways. Under this height the top bar, dock and lobby tighten
 * (see the phone section of responsive.css), so the tables reserve less of the
 * screen for the dock.
 */
const COMPACT = '(max-height: 500px)'

/** Screen pixels the compact dock takes off the bottom of a table. */
export const COMPACT_RESERVE = 80

/** Screen pixels the top bar covers, full size and compact: a zoomed table keeps clear of them. */
export const TOPBAR = 70
export const COMPACT_TOPBAR = 50

export function isCompact(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(COMPACT).matches === true
}

/**
 * Sideways on a phone, or no wider than a tablet, an open bet rail would sit
 * over the felt, so until the player opens it the rail starts folded.
 */
export function railStartsFolded(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(`${COMPACT}, (max-width: 1100px)`).matches === true
}

export function useCompact(): boolean {
  return useSyncExternalStore(subscribe, isCompact, () => false)
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(COMPACT)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
