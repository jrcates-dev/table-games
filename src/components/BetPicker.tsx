import { AnimatePresence, motion } from 'motion/react'
import { useRef } from 'react'
import { play } from '../audio'
import { IconZoomIn } from './icons'
import { usePick } from './pick'
import { canZoom, zoomInAt } from './stageZoom'
import { useTipPlacement } from './tipPlace'

/** The card a tap between spots opens: see pick.ts. */
export function BetPicker() {
  const options = usePick((s) => s.options)
  const x = usePick((s) => s.x)
  const y = usePick((s) => s.y)
  const choose = usePick((s) => s.choose)
  const close = usePick((s) => s.close)
  const ref = useRef<HTMLDivElement>(null)
  const translate = useTipPlacement(ref, x, y, options, true)
  const open = options.length > 0 && choose !== null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          key="pick"
          className="spot-tip is-pinned bet-pick"
          data-pinned-tip
          role="dialog"
          aria-label="Which bet?"
          style={{ left: x, top: y, translate }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ duration: 0.14 }}
        >
          <div className="bet-pick__head">Which bet?</div>
          <div className="bet-pick__list">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="bet-pick__option"
                onClick={() => {
                  close()
                  choose(option.id)
                }}
              >
                <strong>{option.title}</strong>
                <span>{option.pays}</span>
              </button>
            ))}
          </div>
          {canZoom() && (
            <button
              type="button"
              className="btn btn--ghost btn--sm bet-pick__zoom"
              onClick={() => {
                play('click')
                close()
                zoomInAt(x, y)
              }}
            >
              <IconZoomIn />
              Zoom in
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
