import { AnimatePresence, motion } from 'motion/react'
import { play } from '../audio'
import { ChipRack } from '../components/ChipRack'
import { DealerNotice } from '../components/DealerNotice'
import { EdgePill } from '../components/EdgePill'
import { IconBook, IconClear } from '../components/icons'
import { Money } from '../components/Money'
import { OutOfChips } from '../components/OutOfChips'
import { TRIPS_TABLES, tripsEdge, UTH_HOUSE_EDGE } from '../engine/uth/rules'
import type { UthDecision } from '../engine/uth/types'
import * as uth from '../engine/uth/uth'
import { money, signedMoney } from '../lib/format'
import { currentAdvice, holeName, useUthStore } from '../store/uthStore'
import { useUthUi } from '../store/tableUi'
import { DECISION_LABEL, DECISION_MULTIPLE, uthDenominations } from './betInfo'

/**
 * The player's side of the rail: the chips while the circles are open, the
 * three decisions of a hand with the book play flagged, the dealer at work
 * while the hand is read, and the result with a one-press rebet.
 */
export function UthDock() {
  const phase = useUthStore((s) => s.game.phase)
  const notice = useUthStore((s) => s.notice)
  const dismiss = useUthStore((s) => s.dismissNotice)
  const mode = phase === 'betting' ? 'betting' : phase === 'reveal' ? 'wait' : phase === 'showdown' ? 'over' : 'decide'

  return (
    <div className="dock-wrap">
      <DealerNotice notice={notice} onDismiss={dismiss} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode === 'decide' ? `decide:${phase}` : mode}
          className={`dock dock--${mode} dock--uth`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          // On its way out it takes no clicks, so a fast second click can't act
          // on what comes next before it is on screen.
          exit={{ opacity: 0, y: 10, pointerEvents: 'none' }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {mode === 'betting' && <Betting />}
          {mode === 'decide' && <Decide />}
          {mode === 'wait' && <Reading />}
          {mode === 'over' && <Settled />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Betting() {
  const game = useUthStore((s) => s.game)
  const chip = useUthStore((s) => s.chip)
  const setChip = useUthStore((s) => s.setChip)
  const deal = useUthStore((s) => s.deal)
  const clear = useUthStore((s) => s.clearBets)
  const rebet = useUthStore((s) => s.rebet)
  const rebuy = useUthStore((s) => s.rebuy)
  const showEdges = useUthStore((s) => s.profile.settings.showEdges)
  const check = uth.canDeal(game)
  const staked = uth.totalOnFelt(game)
  // An Ante, its Blind and one river call is the least a hand can need.
  const broke = game.bankroll + staked < game.limits.minAnte * 3
  const hasLast = game.lastBets.ante > 0

  if (broke) return <OutOfChips onRebuy={rebuy} />

  return (
    <>
      {!check.ok && staked > 0 && <p className="dock__blocked">{check.reason}</p>}
      <div className="dock__row">
        <ChipRack denominations={uthDenominations(game)} chip={chip} bankroll={game.bankroll} onSelect={setChip} />
        <div className="wager">
          <span className="eyebrow">In the circles</span>
          <Money value={staked} className={`wager__value${staked > 0 ? ' is-set' : ''}`} flash={false} duration={0.35} />
          <span className="wager__hint">
            Ante {money(game.limits.minAnte)} – {money(game.limits.maxAnte)} · Trips {money(game.limits.minTrips)}+
          </span>
        </div>
        {showEdges && (
          <div className="ba-book uth-prices" title="What the house keeps">
            <span className="ba-book__text">Ante + Blind</span>
            <EdgePill edge={UTH_HOUSE_EDGE} label={false} />
            <span className="ba-book__text">Trips</span>
            <EdgePill edge={tripsEdge(TRIPS_TABLES[game.tripsTable])} label={false} />
          </div>
        )}
        <div className="dock__buttons">
          <button type="button" className="btn btn--ghost btn--sm" onClick={clear} disabled={staked === 0} title="Take everything back · C">
            <IconClear width={15} height={15} /> Clear
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={rebet} disabled={!hasLast || staked > 0} title="The last hand's bets again · R">
            Rebet
          </button>
          <button type="button" className="btn btn--gold btn--lg deal-btn" onClick={deal} disabled={!check.ok} title={check.reason}>
            Deal <kbd>Space</kbd>
          </button>
        </div>
      </div>
    </>
  )
}

const KEYS: Record<UthDecision, string> = { check: 'C', bet4: '4', bet3: '3', bet2: '2', bet1: '1', fold: 'F' }
// Three seats on every street, so nothing slides between decisions: the pass
// (a check, or the fold on the river) always on the left, the bets beside it,
// and an empty seat held open when a street has fewer.
const ORDER: Record<string, Array<UthDecision | null>> = {
  preflop: ['check', 'bet3', 'bet4'],
  flop: ['check', 'bet2', null],
  river: ['fold', 'bet1', null],
}
const STREET: Record<string, string> = { preflop: 'Before the flop', flop: 'On the flop', river: 'On the river' }

function Decide() {
  const game = useUthStore((s) => s.game)
  const decide = useUthStore((s) => s.decide)
  const coach = useUthStore((s) => s.profile.settings.coach)
  const flopEvs = useUthStore((s) => s.flopEvs)
  const toggle = useUthUi((s) => s.togglePanel)
  const legal = uth.legalDecisions(game)
  const advice = coach ? currentAdvice(game, flopEvs) : null
  const order = ORDER[game.phase] ?? []

  return (
    <div className="dock__row">
      <div className="hand-info">
        <span className="eyebrow">{STREET[game.phase]}</span>
        <strong className="hand-info__total">{holeName(game.player)}</strong>
        <span className="hand-info__bet">
          Ante {money(game.bets.ante)} · Blind {money(game.bets.blind)}
        </span>
      </div>

      <div className="actions">
        {order.map((d, seat) => {
          if (!d) return <span key={seat} className="action uth-action is-vacant" aria-hidden="true" />
          const enabled = legal.includes(d)
          const m = DECISION_MULTIPLE[d]
          const recommended = advice?.decision === d
          return (
            <button
              key={d}
              type="button"
              className={`action uth-action uth-action--${d}${recommended ? ' is-recommended' : ''}`}
              disabled={!enabled}
              onClick={() => decide(d)}
              onPointerEnter={() => enabled && play('hover')}
              title={!enabled && m ? 'Not enough in the rack' : undefined}
            >
              {recommended && <span className="action__book">Book</span>}
              <span className="action__label">{DECISION_LABEL[d]}</span>
              <span className="uth-action__amount">{m ? money(game.bets.ante * m) : d === 'fold' ? `lose ${money(game.bets.ante * 2)}` : 'free'}</span>
              <kbd>{KEYS[d]}</kbd>
            </button>
          )
        })}
      </div>

      {advice ? (
        <button
          type="button"
          className="coach-card uth-coach"
          data-drawer-toggle
          onClick={() => {
            play('click')
            toggle('reference')
          }}
          title="The book · ?"
        >
          <span className="ba-book__text">
            <IconBook width={14} height={14} /> {advice.headline}
          </span>
          <span className="uth-coach__reason">{advice.reason}</span>
          {advice.evs && advice.street === 'flop' && (
            <span className="uth-coach__evs">
              Bet 2x {antes(advice.evs.bet2 ?? 0)} · Check {antes(advice.evs.check ?? 0)} Antes, on average
            </span>
          )}
          {advice.evs && advice.street === 'river' && (
            <span className="uth-coach__evs">
              Bet {antes(advice.evs.bet1 ?? 0)} · Fold {antes(-2)} Antes, on average
            </span>
          )}
        </button>
      ) : (
        <span className="ba-next">Coach off — the book is in Settings</span>
      )}
    </div>
  )
}

/** An EV in Antes, signed: "+0.31", "−2.00". */
const antes = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`

function Reading() {
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
  const game = useUthStore((s) => s.game)
  const lastNet = useUthStore((s) => s.lastNet)
  const rebetAndDeal = useUthStore((s) => s.rebetAndDeal)
  const clear = useUthStore((s) => s.clearBets)
  const rebuy = useUthStore((s) => s.rebuy)
  const result = game.result
  const again = game.lastBets.ante * 2 + game.lastBets.trips
  const broke = game.bankroll < game.limits.minAnte * 3
  const canAgain = game.lastBets.ante > 0 && again + game.lastBets.ante <= game.bankroll
  const head = !result
    ? 'This hand'
    : result.outcome === 'fold'
      ? 'Folded'
      : result.outcome === 'tie'
        ? 'A tie'
        : result.outcome === 'win'
          ? `${result.playerName} wins`
          : `Dealer’s ${result.dealerName.toLowerCase()} wins`

  return (
    <div className="dock__row dock__row--center">
      <div className="settled">
        <span className="eyebrow">{head}</span>
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
          <span className="ba-next">Click a circle for new bets</span>
          <button type="button" className="btn btn--ghost" onClick={clear} title="Clear the circles for new bets · C">
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
