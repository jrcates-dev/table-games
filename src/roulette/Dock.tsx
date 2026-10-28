import { AnimatePresence, motion } from 'motion/react'
import { play } from '../audio'
import { ChipRack } from '../components/ChipRack'
import { DealerNotice } from '../components/DealerNotice'
import { EdgePill } from '../components/EdgePill'
import { IconBook, IconClear } from '../components/icons'
import { Money } from '../components/Money'
import { OutOfChips } from '../components/OutOfChips'
import { houseEdge } from '../engine/roulette/bets'
import * as rl from '../engine/roulette/roulette'
import { pocketColor, pocketLabel } from '../engine/roulette/wheel'
import { money, signedMoney } from '../lib/format'
import { useRouletteStore } from '../store/rouletteStore'
import { useRouletteUi } from '../store/tableUi'
import { callText, rouletteDenominations } from './betInfo'

/**
 * The player's side of the rail: the chip in hand and the spin while the
 * layout is open, "no more bets" while the ball runs, and the number with a
 * one-press rebet once it is paid.
 */
export function RouletteDock() {
  const phase = useRouletteStore((s) => s.game.phase)
  const notice = useRouletteStore((s) => s.notice)
  const dismiss = useRouletteStore((s) => s.dismissNotice)
  const mode = phase === 'spinning' ? 'wait' : phase === 'settled' ? 'over' : 'betting'

  return (
    <div className="dock-wrap">
      <DealerNotice notice={notice} onDismiss={dismiss} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          className={`dock dock--${mode} dock--roulette`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          // On its way out it takes no clicks, so a fast second click can't act
          // on what comes next before it is on screen.
          exit={{ opacity: 0, y: 10, pointerEvents: 'none' }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {mode === 'betting' && <Betting />}
          {mode === 'wait' && <Spinning />}
          {mode === 'over' && <Settled />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Betting() {
  const game = useRouletteStore((s) => s.game)
  const chip = useRouletteStore((s) => s.chip)
  const setChip = useRouletteStore((s) => s.setChip)
  const spin = useRouletteStore((s) => s.spin)
  const clear = useRouletteStore((s) => s.clearBets)
  const double = useRouletteStore((s) => s.doubleBets)
  const rebet = useRouletteStore((s) => s.rebet)
  const rebuy = useRouletteStore((s) => s.rebuy)
  const check = rl.canSpin(game)
  const staked = rl.totalOnLayout(game)
  const broke = game.bankroll + staked < 1
  const hasLast = Object.keys(game.lastBets).length > 0

  if (broke) return <OutOfChips onRebuy={rebuy} />

  return (
    <>
      {!check.ok && staked > 0 && <p className="dock__blocked">{check.reason}</p>}
      <div className="dock__row">
        <ChipRack denominations={rouletteDenominations(game)} chip={chip} bankroll={game.bankroll} onSelect={setChip} />
        <div className="wager">
          <span className="eyebrow">On the layout</span>
          <Money value={staked} className={`wager__value${staked > 0 ? ' is-set' : ''}`} flash={false} duration={0.35} />
          <span className="wager__hint">
            {money(game.limits.tableMin)} min · {money(game.limits.maxStraight)} a number
          </span>
        </div>
        <BookHint />
        <div className="dock__buttons">
          <button type="button" className="btn btn--ghost btn--sm" onClick={clear} disabled={staked === 0} title="Take everything back · C">
            <IconClear width={15} height={15} /> Clear
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={double} disabled={staked === 0 || staked > game.bankroll} title="Every bet doubled · D">
            Double
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={rebet} disabled={!hasLast || staked > 0} title="The last spin's bets again · R">
            Rebet
          </button>
          <button type="button" className="btn btn--gold btn--lg deal-btn" onClick={spin} disabled={!check.ok} title={check.reason}>
            Spin <kbd>Space</kbd>
          </button>
        </div>
      </div>
    </>
  )
}

/** Roulette's book is one line long: every bet costs the same, so bet what you enjoy — and skip the Top Line. */
function BookHint() {
  const wheel = useRouletteStore((s) => s.game.wheel)
  const showEdges = useRouletteStore((s) => s.profile.settings.showEdges)
  const toggle = useRouletteUi((s) => s.togglePanel)
  if (!showEdges) return null
  const edge = houseEdge({ kind: 'straight', numbers: [1] }, wheel)
  return (
    <button
      type="button"
      className="ba-book"
      data-drawer-toggle
      onClick={() => {
        play('click')
        toggle('reference')
      }}
      title="Every bet, priced · ?"
    >
      <span className="action__book">Book</span>
      <span className="ba-book__text">
        <IconBook width={14} height={14} /> {wheel === 'double' ? 'Any bet but the Top Line' : 'Every bet the same'}
      </span>
      <EdgePill edge={edge} label={false} />
    </button>
  )
}

function Spinning() {
  return (
    <div className="dock__row dock__row--center">
      <div className="waiting">
        <span className="waiting__dots">
          <i />
          <i />
          <i />
        </span>
        No more bets
      </div>
    </div>
  )
}

function Settled() {
  const game = useRouletteStore((s) => s.game)
  const lastNet = useRouletteStore((s) => s.lastNet)
  const rebetAndSpin = useRouletteStore((s) => s.rebetAndSpin)
  const clear = useRouletteStore((s) => s.clearBets)
  const rebuy = useRouletteStore((s) => s.rebuy)
  const result = game.result
  const again = Object.values(game.lastBets).reduce((sum, b) => sum + b.amount, 0)
  const broke = game.bankroll < 1
  const canAgain = again > 0 && again <= game.bankroll

  return (
    <div className="dock__row dock__row--center">
      {result !== null && <span className={`ro-num ro-num--${pocketColor(result)} ro-num--big`}>{pocketLabel(result)}</span>}
      <div className="settled">
        <span className="eyebrow">{result === null ? 'This spin' : callText(result)}</span>
        <strong className={`settled__net num ${lastNet === null ? '' : lastNet > 0 ? 'tone-win' : lastNet < 0 ? 'tone-lose' : 'tone-push'}`}>
          {lastNet === null || lastNet === 0 ? 'Even' : signedMoney(lastNet)}
        </strong>
      </div>
      {broke ? (
        <button type="button" className="btn btn--gold btn--lg" onClick={rebuy}>
          Buy back in
        </button>
      ) : (
        <>
          <span className="ba-next">Click the layout for new bets</span>
          <button type="button" className="btn btn--ghost" onClick={clear} title="Clear the layout for new bets · C">
            <IconClear width={15} height={15} /> Clear bets <kbd>C</kbd>
          </button>
          <button type="button" className="btn btn--gold btn--lg deal-btn" onClick={rebetAndSpin} disabled={!canAgain}>
            Rebet {money(again)} &amp; spin <kbd>Space</kbd>
          </button>
        </>
      )}
    </div>
  )
}
