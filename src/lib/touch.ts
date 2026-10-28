import { buzz } from './haptics'

/**
 * A finger in place of a mouse.
 *
 * A mouse finds out what a spot pays by resting on it; a finger cannot hover,
 * so it presses and holds instead. The card that comes up stays up when the
 * finger lifts, until the next tap anywhere else, which only closes it; and
 * the tap a long press would otherwise end in is swallowed — holding a spot to
 * read it never also bets on it, and nor does tapping the card away. A long
 * press on Android also opens the context menu, which the tables use (from a
 * mouse) to take a bet down; from a finger it is never that.
 */

const HOLD_MS = 420
/** How far a finger may drift and still be holding still. */
const SLOP = 10

let lastPointer = 'mouse'
let press: { id: number; x: number; y: number; timer: number } | null = null
/** A hold fired and the finger is still down: its click is not a tap. */
let held = false
/** Until when the click that ends the current press is not a tap. A new press starts afresh. */
let swallowUntil = 0
let dismiss: (() => void) | null = null

/** Whether the most recent press came from a finger. */
export function lastPressWasTouch(): boolean {
  return lastPointer === 'touch'
}

/** Forget a press that is turning into something else — a pinch, a drag. */
export function cancelHold() {
  if (!press) return
  window.clearTimeout(press.timer)
  press = null
}

/** The press under way is a gesture, not a tap: the click it ends in does nothing. */
export function swallowClick() {
  swallowUntil = performance.now() + 1000
}

/**
 * Give the next tap elsewhere something to close, as a long press does with
 * its card. Returns a way to stop waiting, for when it closes some other way.
 */
export function closeOnNextTap(close: () => void): () => void {
  dismiss?.()
  dismiss = close
  return () => {
    if (dismiss === close) dismiss = null
  }
}

/** Wire the window-wide half of it. Safe to call more than once. */
let installed = false
export function installTouch() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const capture = { capture: true }
  window.addEventListener(
    'pointerdown',
    (event) => {
      lastPointer = event.pointerType
      swallowUntil = 0
      // The next tap closes a card a long press left open, unless it lands on the card, and does nothing else.
      if (dismiss && !(event.target instanceof Element && event.target.closest('[data-pinned-tip]'))) {
        const close = dismiss
        dismiss = null
        // The card may already be gone, taken down from its own button.
        if (document.querySelector('[data-pinned-tip]')) swallowUntil = performance.now() + 1000
        close()
      }
    },
    capture,
  )
  window.addEventListener(
    'pointermove',
    (event) => {
      if (press && event.pointerId === press.id && Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP) cancelHold()
    },
    capture,
  )
  window.addEventListener(
    'pointerup',
    () => {
      cancelHold()
      if (held) {
        held = false
        swallowUntil = performance.now() + 1000
      }
    },
    capture,
  )
  window.addEventListener(
    'pointercancel',
    () => {
      cancelHold()
      held = false
    },
    capture,
  )
  window.addEventListener(
    'click',
    (event) => {
      if (performance.now() > swallowUntil) return
      swallowUntil = 0
      event.preventDefault()
      event.stopPropagation()
    },
    capture,
  )
  window.addEventListener(
    'contextmenu',
    (event) => {
      if (lastPointer !== 'touch') return
      event.preventDefault()
      event.stopPropagation()
    },
    capture,
  )
}

/**
 * Start timing a press. If the finger stays put long enough, `onHold` runs
 * with where it is, and gets back a way to close whatever it opened — which
 * the next tap elsewhere calls.
 */
export function startHold(event: React.PointerEvent, onHold: (x: number, y: number) => () => void) {
  if (event.pointerType !== 'touch') return
  cancelHold()
  const { pointerId, clientX: x, clientY: y } = event
  press = {
    id: pointerId,
    x,
    y,
    timer: window.setTimeout(() => {
      press = null
      held = true
      buzz('thud')
      dismiss?.()
      dismiss = onHold(x, y)
    }, HOLD_MS),
  }
}
