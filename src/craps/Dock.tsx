import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { play } from '../audio'
import { RackChip } from '../components/ChipStack'
import { crapsDenominations } from '../components/chips'
import { IconClear, IconDice, IconSpark, IconUndo } from '../components/icons'
import * as craps from '../engine/craps/craps'
import { money } from '../lib/format'
import { useCrapsStore, type NumberMode } from '../store/crapsStore'

/**
 * The shooter's side of the rail.
 *
 * Chips here are *selected*, not staked — the felt is where a bet is made.
 * That is the whole point of clicking the layout: you learn where the Come box
 * is by putting money in it, not by finding "Come" in a list.
 */
export function CrapsDock() {
  const game = useCrapsStore((s) => s.game)
  const chip = useCrapsStore((s) => s.chip)
  const setChip = useCrapsStore((s) => s.setChip)
  const roll = useCrapsStore((s) => s.roll)
  const clearBets = useCrapsStore((s) => s.clearBets)
  const undo = useCrapsStore((s) => s.undo)
  const canUndo = useCrapsStore((s) => s.undoStack.length > 0)
  const takeMaxOdds = useCrapsStore((s) => s.takeMaxOdds)
  const rebuy = useCrapsStore((s) => s.rebuy)
  const table = useCrapsStore((s) => s.table())

  const denominations = crapsDenominations(table.maxBet)
  const check = craps.canRoll(game)
  const rolling = game.phase === 'rolling'
  const atRisk = craps.totalAtRisk(game)
  const oddsAvailable = craps.oddsTargets(game).length > 0
  const broke = game.bankroll + atRisk < table.minBet

  return (
    <div className="dock-wrap">
      <Notice />
      <div className="dock dock--craps">
        {!check.ok && !rolling && !broke && <p className="dock__blocked">{check.reason}</p>}
        {broke ? (
          <div className="dock__row dock__row--center">
            <div className="dock__message">
              <span className="eyebrow">Out of chips</span>
              <p>The rack is empty. This run is filed with its peak — sit back down with a fresh stake.</p>
            </div>
            <button type="button" className="btn btn--gold btn--lg" onClick={rebuy}>
              Buy back in
            </button>
          </div>
        ) : (
          <div className="dock__row">
            <div className="rack" role="radiogroup" aria-label="Chip in hand">
              {denominations.map((denom, i) => (
                <button
                  key={denom.value}
                  type="button"
                  role="radio"
                  aria-checked={denom.value === chip}
                  className={`rack__chip${denom.value === chip ? ' is-selected' : ''}`}
                  onClick={() => setChip(denom.value)}
                  disabled={denom.value > game.bankroll}
                  onPointerEnter={() => play('hover')}
                  title={`${money(denom.value)} chip · key ${i + 1}`}
                >
                  <RackChip denom={denom} size={52} />
                  <kbd>{i + 1}</kbd>
                </button>
              ))}
            </div>

            <ModePicker />

            <div className="dock__buttons">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={undo}
                disabled={!canUndo || rolling}
                title={canUndo ? 'Step back one bet · Ctrl+Z' : 'Nothing to undo — the dice clear this every roll'}
              >
                <IconUndo width={15} height={15} /> Undo
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={clearBets} disabled={atRisk === 0 || rolling} title="Take down everything that can come down">
                <IconClear width={15} height={15} /> Clear
              </button>
              <button
                type="button"
                className={`btn btn--ghost btn--sm odds-btn${oddsAvailable && !rolling ? ' is-ready' : ''}`}
                onClick={() => takeMaxOdds()}
                disabled={!oddsAvailable || rolling}
                title="Back every flat bet with the maximum free odds — the only bet with no house edge · O"
              >
                <IconSpark width={15} height={15} /> Max odds
              </button>
              <button
                type="button"
                className={`btn btn--gold btn--lg roll-btn${check.ok ? ' is-armed' : ''}`}
                onClick={roll}
                disabled={!check.ok}
                title={check.reason}
              >
                <IconDice width={20} height={20} />
                {/* Both words hold their place, so the button keeps one width through a roll. */}
                <span className="roll-btn__label">
                  <span aria-hidden={rolling}>Roll</span>
                  <span aria-hidden={!rolling}>Rolling…</span>
                </span>
                <kbd>Space</kbd>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * What a click on one of the six box numbers means. A real table has one box
 * per number and you tell the dealer which bet you want in it; this is that
 * sentence as a control.
 */
function ModePicker() {
  const mode = useCrapsStore((s) => s.numberMode)
  const setMode = useCrapsStore((s) => s.setNumberMode)
  const options: Array<[NumberMode, string, string]> = [
    ['place', 'Place', 'Bet the number directly, paid slightly short of true odds'],
    ['buy', 'Buy', 'True odds for a 5% commission — worth it on the 4 and 10, not on the 6 and 8'],
    ['lay', 'Lay', 'Bet against the number: you want a 7 first'],
    ['odds', 'Odds', 'Back a come bet that has travelled to that number — no house edge'],
  ]
  return (
    <div className="mode-picker">
      <span className="eyebrow">Box numbers</span>
      <div className="segmented" role="radiogroup">
        {options.map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            className={mode === value ? 'is-active' : undefined}
            onClick={() => setMode(value)}
            title={hint}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** The dealer's reason for refusing whatever was just attempted. */
function Notice() {
  const notice = useCrapsStore((s) => s.notice)
  const dismiss = useCrapsStore((s) => s.dismissNotice)

  useEffect(() => {
    if (!notice) return
    play('notice')
    const timer = setTimeout(dismiss, 3200)
    return () => clearTimeout(timer)
  }, [notice, dismiss])

  return (
    <AnimatePresence>
      {notice && (
        <motion.button
          key={notice}
          type="button"
          className="dealer-notice"
          onClick={dismiss}
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6 }}
        >
          <span className="eyebrow">Dealer</span>
          {notice}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
