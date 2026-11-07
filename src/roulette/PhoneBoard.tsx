import { AnimatePresence, motion } from 'motion/react'
import { play } from '../audio'
import { pocketColor, pocketLabel } from '../engine/roulette/wheel'
import { useRouletteStore } from '../store/rouletteStore'
import { useRouletteUi } from '../store/tableUi'

/** More than either board has room for: the oldest run off under the fade. */
const SHOWN = 16

/**
 * The tote board on a phone, where the rail that carries it starts folded.
 *
 * Upright, a strip across the top of the screen over the wheel, newest at the
 * left. Sideways, a board down the right-hand side under the bets tab, newest
 * at the top, with the reds set to the left, the blacks to the right and the
 * zeros between, as the marquee beside a casino's wheel shows them.
 *
 * The rail has the same numbers and more, so the board steps aside while the
 * rail is open, and a press on it opens the rail.
 */
export function PhoneBoard({ upright }: { upright: boolean }) {
  const history = useRouletteStore((s) => s.game.history)
  const railOpen = useRouletteUi((s) => s.railOpen)
  const toggleRail = useRouletteUi((s) => s.toggleRail)
  const shown = history.slice(0, SHOWN)
  const said = shown
    .slice(0, 10)
    .map((p) => `${pocketLabel(p)} ${pocketColor(p)}`)
    .join(', ')

  return (
    <AnimatePresence initial={false}>
      {!railOpen && (
        <motion.button
          key="board"
          type="button"
          className={`ro-board ro-board--${upright ? 'strip' : 'column'}`}
          onClick={() => {
            play('open')
            toggleRail()
          }}
          aria-label={shown.length === 0 ? 'Last numbers: no spins yet' : `Last numbers, newest first: ${said}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {shown.length === 0 ? (
            <span className="ro-board__empty">No spins yet</span>
          ) : (
            <span className="ro-board__numbers" aria-hidden="true">
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((p, i) => {
                  const colour = pocketColor(p)
                  return (
                    <motion.span
                      // Each spin keeps its key as newer ones push it along.
                      key={history.length - i}
                      layout
                      className={`ro-board__spin ro-board__spin--${colour}`}
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    >
                      <span className={`ro-num ro-num--${colour}${i === 0 ? ' is-latest' : ''}`}>{pocketLabel(p)}</span>
                    </motion.span>
                  )
                })}
              </AnimatePresence>
            </span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
