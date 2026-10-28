import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { play } from '../audio'
import { IconClose } from './icons'

/**
 * Marks a button that opens and closes drawers itself, so pressing it is not a
 * press outside: the book button would otherwise close the book and reopen it.
 */
const DRAWER_TOGGLE = '[data-drawer-toggle]'

/** What a press outside still reaches: anything that is plainly a control. */
const CONTROL = 'button, a, input, select, textarea, label'

/**
 * Eats the click, or the right-click, that the press under way is about to
 * produce, and nothing after it: the next press disarms it, even if this one
 * became a scroll and never clicked at all.
 */
function swallowPress() {
  const swallow = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
  }
  const disarm = () => {
    window.removeEventListener('click', swallow, true)
    window.removeEventListener('contextmenu', swallow, true)
    window.removeEventListener('pointerdown', disarm, true)
  }
  window.addEventListener('click', swallow, true)
  window.addEventListener('contextmenu', swallow, true)
  // Added while this press is still being dispatched, so it waits for the next.
  window.addEventListener('pointerdown', disarm, true)
}

/**
 * A panel that slides in over the right of the table.
 *
 * The table stays visible and live beside it — the strategy card in particular
 * is a reference you consult mid-hand, not a screen you leave the game for.
 * A press anywhere outside puts it away. On the felt that press does nothing
 * more, so closing the book never drops a chip; a button still does its job,
 * so a decision in the dock is still one press.
 */
export function Drawer({
  open,
  title,
  eyebrow,
  wide = false,
  onClose,
  children,
}: {
  open: boolean
  title: string
  eyebrow?: string
  wide?: boolean
  onClose(): void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target || ref.current?.contains(target) || target.closest(DRAWER_TOGGLE)) return
      onClose()
      if (!target.closest(CONTROL)) swallowPress()
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [open, onClose])

  // A whoosh when the drawer moves — but not on first paint, when nothing did.
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current === open) return
    wasOpen.current = open
    play(open ? 'open' : 'close')
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          ref={ref}
          key={title}
          className={`drawer${wide ? ' drawer--wide' : ''}`}
          role="dialog"
          aria-label={title}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        >
          <header className="drawer__head">
            <div>
              {eyebrow && <span className="eyebrow">{eyebrow}</span>}
              <h2 className="drawer__title">{title}</h2>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <IconClose />
            </button>
          </header>
          <div className="drawer__body">{children}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
