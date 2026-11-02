import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * Brings the book's live entry into view: the blackjack square you are on, the
 * street you are deciding, the bets you have down. It runs as the book opens,
 * so you land on your own entry instead of scrolling to find it, and again,
 * gliding, if the entry moves while the book stays open (a decision made from
 * the keyboard, a split, a bet taken).
 *
 * `key` names the entry, so the book only moves when the entry does; null when
 * nothing is live, and the book stays where it is. Hang the returned ref on the
 * entry itself, whatever element that is.
 */
export function useBookFocus(key: string | null): (node: HTMLElement | null) => void {
  const entry = useRef<HTMLElement | null>(null)
  const opened = useRef(false)
  useLayoutEffect(() => {
    if (key !== null && entry.current) reveal(entry.current, opened.current)
    opened.current = true
  }, [key])
  return useCallback((node: HTMLElement | null) => {
    entry.current = node
  }, [])
}

/**
 * Scrolls the drawer the entry is in, and only that — never the page or the
 * stage around it, which `scrollIntoView` would happily do.
 *
 * The section the entry is in is centred in the visible part of the book when
 * it fits, so its heading comes with it (Pairs, The line); when it does not,
 * the entry alone is, or, taller still, shown from its top. A header marked
 * `data-pinned` stays stuck to the top of the book as it scrolls (the blackjack
 * card's "Your hand"), so the visible part starts below it rather than the
 * entry sliding in underneath.
 */
function reveal(entry: HTMLElement, glide: boolean) {
  const book = entry.closest<HTMLElement>('.drawer__body')
  if (!book) return
  const view = book.getBoundingClientRect()
  const pinned = book.querySelector<HTMLElement>('[data-pinned]')
  const covered = pinned ? Math.max(0, pinned.getBoundingClientRect().bottom - view.top) : 0
  const showing = book.clientHeight - covered
  const section = entry.closest('section')
  const whole = section && book.contains(section) ? section.getBoundingClientRect() : null
  const box = whole && whole.height <= showing ? whole : entry.getBoundingClientRect()
  const top = book.scrollTop + (box.top - view.top) - covered - Math.max(0, (showing - box.height) / 2)
  const max = book.scrollHeight - book.clientHeight
  const target = Math.round(Math.min(max, Math.max(0, top)))
  if (Math.abs(target - book.scrollTop) < 2) return
  book.scrollTo({ top: target, behavior: glide && !prefersReducedMotion() ? 'smooth' : 'auto' })
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
