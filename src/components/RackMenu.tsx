import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { play } from '../audio'
import { STARTING_BANKROLL } from '../engine/rules'
import { money } from '../lib/format'
import { useSharedBankroll } from '../store/sharedBankroll'
import { clampStartingBankroll, MAX_STARTING_BANKROLL, MIN_STARTING_BANKROLL } from '../store/stake'
import { MoneyInput } from './controls'

/** What a table hands the top bar so the bankroll can be reset or topped up. */
export interface RackControl {
  /** Chips on the felt that are still the player's, which a top-up keeps. */
  onFelt: number
  /** False while a hand, roll or spin is being played out. */
  canChange: boolean
  /** Whether the table has been played, so a change closes a run. */
  hasRun: boolean
  /** The store's own reset: the run is filed and a fresh one starts at this amount. */
  reset(amount: number): void
}

/**
 * Reset or top up the rack without leaving the table.
 *
 * Both are the lobby's reset underneath — a topped-up rack is a new run at the
 * higher figure, filed like a buy-back, so a run's peak still only ever counts
 * what the cards and dice paid. Neither is offered mid-hand. With the bankroll
 * shared, the new figure is every table's, and the menu says so.
 */
export function RackMenu({
  game,
  bankroll,
  rack,
  onClose,
}: {
  game: string
  bankroll: number
  rack: RackControl
  onClose(): void
}) {
  const [amount, setAmount] = useState(STARTING_BANKROLL)
  const [asking, setAsking] = useState<'topUp' | 'reset' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const shared = useSharedBankroll((s) => s.shared)
  const equity = bankroll + rack.onFelt
  const target = clampStartingBankroll(asking === 'topUp' ? equity + amount : amount)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    // The bankroll button toggles the menu itself, so a press on it is not "outside".
    const onDown = (event: PointerEvent) => {
      const node = event.target as Node
      if (ref.current?.contains(node) || ref.current?.parentElement?.contains(node)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [onClose])

  // A hand dealt from the dock while the question is up answers it.
  useEffect(() => {
    if (!rack.canChange) setAsking(null)
  }, [rack.canChange])

  return (
    <motion.div
      ref={ref}
      className="rack-menu"
      role="dialog"
      aria-label={shared ? 'Shared bankroll' : `${game} bankroll`}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {asking ? (
          <motion.div key="ask" className="rack-menu__ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="rack-menu__text">
              <strong>
                {asking === 'topUp'
                  ? `Top up to ${money(target)}?`
                  : shared
                    ? `Reset your bankroll to ${money(target)}?`
                    : `Reset your ${game} rack to ${money(target)}?`}
              </strong>
              <br />
              {shared && 'Your bankroll is shared, so every table plays from the new figure. '}
              {rack.hasRun
                ? `${shared ? `Your ${game}` : 'This'} run is saved to your history like a buy-back, and a new one starts. `
                : ''}
              {rack.onFelt > 0 && (asking === 'topUp' ? 'Chips on the felt come back to the rack first.' : 'Chips on the felt are cleared.')}
            </p>
            <div className="rack-menu__buttons">
              <button
                type="button"
                className="btn btn--gold btn--sm"
                onClick={() => {
                  rack.reset(target)
                  play('chipStack', { count: 4 })
                  onClose()
                }}
              >
                {asking === 'topUp' ? 'Top up' : 'Reset'}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAsking(null)}>
                Back
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="pick" className="rack-menu__pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <label className="rack-menu__field" title={`Between ${money(MIN_STARTING_BANKROLL)} and ${money(MAX_STARTING_BANKROLL)}`}>
              <span className="eyebrow">Amount</span>
              <MoneyInput value={amount} onCommit={(next) => setAmount(clampStartingBankroll(next))} />
            </label>
            <div className="rack-menu__buttons">
              <button
                type="button"
                className="btn btn--gold btn--sm"
                disabled={!rack.canChange || equity >= MAX_STARTING_BANKROLL}
                onClick={() => {
                  play('click')
                  setAsking('topUp')
                }}
              >
                Top up +{money(amount)}
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!rack.canChange}
                onClick={() => {
                  play('click')
                  setAsking('reset')
                }}
              >
                Reset to {money(amount)}
              </button>
            </div>
            {!rack.canChange && <p className="rack-menu__hint">Finish the hand in play first.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
