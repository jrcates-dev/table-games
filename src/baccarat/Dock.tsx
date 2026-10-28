import { AnimatePresence, motion } from 'motion/react'
import { ChipRack } from '../components/ChipRack'
import { DealerNotice } from '../components/DealerNotice'
import { OutOfChips } from '../components/OutOfChips'
import { EdgePill } from '../components/EdgePill'
import { IconBook, IconClear } from '../components/icons'
import { Money } from '../components/Money'
import * as bac from '../engine/baccarat/baccarat'
import { bestBet } from '../engine/baccarat/odds'
import { BACCARAT_BETS } from '../engine/baccarat/rules'
import { money, signedMoney } from '../lib/format'
import { play } from '../audio'
import { useBaccaratStore, useLiveOdds } from '../store/baccaratStore'
import { useBaccaratUi } from '../store/tableUi'
import { baccaratDenominations } from './betInfo'

/**
 * The player's side of the rail: the chip in hand and the deal while the felt
 * is open, the dealer at work while the coup is turned, and the result with a
 * one-press rebet once it is paid.
 */
export function BaccaratDock() {
  const game = useBaccaratStore((s) => s.game)
  const notice = useBaccaratStore((s) => s.notice)
  const dismiss = useBaccaratStore((s) => s.dismissNotice)
  const mode = game.phase === 'dealt' ? 'wait' : game.phase === 'settled' ? 'over' : 'betting'

  return (
    <div className="dock-wrap">
      <DealerNotice notice={notice} onDismiss={dismiss} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          className={`dock dock--${mode} dock--baccarat`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          // On its way out it takes no clicks, so a fast second click can't act
          // on what comes next before it is on screen.
          exit={{ opacity: 0, y: 10, pointerEvents: 'none' }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {mode === 'betting' && <Betting />}
          {mode === 'wait' && <Turning />}
          {mode === 'over' && <Settled />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Betting() {
  const game = useBaccaratStore((s) => s.game)
  const chip = useBaccaratStore((s) => s.chip)
  const setChip = useBaccaratStore((s) => s.setChip)
  const deal = useBaccaratStore((s) => s.deal)
  const clear = useBaccaratStore((s) => s.clearBets)
  const rebet = useBaccaratStore((s) => s.rebet)
  const rebuy = useBaccaratStore((s) => s.rebuy)
  const check = bac.canDeal(game)
  const staked = bac.totalOnFelt(game)
  const broke = game.bankroll + staked < game.limits.minSide
  const hasLast = Object.keys(game.lastBets).length > 0

  if (broke) return <OutOfChips onRebuy={rebuy} />

  return (
    <>
      {!check.ok && staked > 0 && <p className="dock__blocked">{check.reason}</p>}
      <div className="dock__row">
        <ChipRack denominations={baccaratDenominations(game.limits.maxBet)} chip={chip} bankroll={game.bankroll} onSelect={setChip} />
        <div className="wager">
          <span className="eyebrow">On the felt</span>
          <Money value={staked} className={`wager__value${staked > 0 ? ' is-set' : ''}`} flash={false} duration={0.35} />
          <span className="wager__hint">
            {money(game.limits.minBet)} – {money(game.limits.maxBet)} · sides {money(game.limits.minSide)}+
          </span>
        </div>
        <BookHint />
        <div className="dock__buttons">
          <button type="button" className="btn btn--ghost btn--sm" onClick={clear} disabled={staked === 0} title="Take everything back · C">
            <IconClear width={15} height={15} /> Clear
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={rebet} disabled={!hasLast || staked > 0} title="The last coup's bets again · R">
            Rebet
          </button>
          <button type="button" className={`btn btn--gold btn--lg deal-btn`} onClick={deal} disabled={!check.ok} title={check.reason}>
            Deal <kbd>Space</kbd>
          </button>
        </div>
      </div>
    </>
  )
}

/** The cheapest bet on the layout right now, the way the blackjack dock marks the book play. */
function BookHint() {
  const showEdges = useBaccaratStore((s) => s.profile.settings.showEdges)
  const live = useLiveOdds()
  const ui = useBaccaratUi((s) => s.togglePanel)
  if (!showEdges) return null
  const best = bestBet(live.edges)
  return (
    <button
      type="button"
      className="ba-book"
      data-drawer-toggle
      onClick={() => {
        play('click')
        ui('reference')
      }}
      title="Every bet, priced · ?"
    >
      <span className="action__book">Book</span>
      <span className="ba-book__text">
        <IconBook width={14} height={14} /> {BACCARAT_BETS[best].title}
      </span>
      <EdgePill edge={live.edges[best]} label={false} />
    </button>
  )
}

function Turning() {
  return (
    <div className="dock__row dock__row--center">
      <div className="waiting">
        <span className="waiting__dots">
          <i />
          <i />
          <i />
        </span>
        The dealer turns the cards
      </div>
    </div>
  )
}

function Settled() {
  const game = useBaccaratStore((s) => s.game)
  const lastNet = useBaccaratStore((s) => s.lastNet)
  const rebetAndDeal = useBaccaratStore((s) => s.rebetAndDeal)
  const clear = useBaccaratStore((s) => s.clearBets)
  const rebuy = useBaccaratStore((s) => s.rebuy)
  const coup = game.coup
  const again = Object.values(game.lastBets).reduce((sum, v) => sum + (v ?? 0), 0)
  const broke = game.bankroll < game.limits.minSide
  const canAgain = again > 0 && again <= game.bankroll

  return (
    <div className="dock__row dock__row--center">
      <div className="settled">
        <span className="eyebrow">{coup ? (coup.winner === 'tie' ? `Tie on ${coup.playerTotal}` : `${coup.winner === 'banker' ? 'Banker' : 'Player'} ${Math.max(coup.playerTotal, coup.bankerTotal)} over ${Math.min(coup.playerTotal, coup.bankerTotal)}`) : 'This coup'}</span>
        <strong className={`settled__net num ${lastNet === null ? '' : lastNet > 0 ? 'tone-win' : lastNet < 0 ? 'tone-lose' : 'tone-push'}`}>
          {lastNet === null || lastNet === 0 ? 'Push' : signedMoney(lastNet, true)}
        </strong>
      </div>
      {broke ? (
        <button type="button" className="btn btn--gold btn--lg" onClick={rebuy}>
          Buy back in
        </button>
      ) : (
        <>
          <span className="ba-next">Click the felt for new bets</span>
          <button type="button" className="btn btn--ghost" onClick={clear} title="Clear the felt for new bets · C">
            <IconClear width={15} height={15} /> Clear bets <kbd>C</kbd>
          </button>
          <button type="button" className="btn btn--gold btn--lg deal-btn" onClick={rebetAndDeal} disabled={!canAgain}>
            Rebet {money(again)} &amp; deal <kbd>Space</kbd>
          </button>
        </>
      )}
    </div>
  )
}
