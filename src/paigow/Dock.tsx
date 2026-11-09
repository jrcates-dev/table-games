import { AnimatePresence, motion } from 'motion/react'
import { play } from '../audio'
import { ChipRack } from '../components/ChipRack'
import { DealerNotice } from '../components/DealerNotice'
import { EdgePill } from '../components/EdgePill'
import { ArtClear, ArtDeal, ArtHouseWay, ArtRebet, ArtSetHand } from '../components/gameIcons'
import { IconBook } from '../components/icons'
import { Money } from '../components/Money'
import { OutOfChips } from '../components/OutOfChips'
import { handName } from '../engine/paigow/hands'
import * as pg from '../engine/paigow/paigow'
import { measureDock } from '../lib/compact'
import { money, signedMoney } from '../lib/format'
import { usePaiGowStore } from '../store/paigowStore'
import { usePaiGowUi } from '../store/tableUi'
import { bets, FORTUNE_EDGE, mainEdge, paigowDenominations } from './betInfo'
import { coachRead, EV_NOISE } from './coach'

/**
 * The player's side of the rail: the chips while the circles are open; while
 * the hand is being set, the two hands as they lie, the house way and what
 * your set is worth against it; the dealer at work; and the result.
 */
export function PaiGowDock() {
  const phase = usePaiGowStore((s) => s.game.phase)
  const notice = usePaiGowStore((s) => s.notice)
  const dismiss = usePaiGowStore((s) => s.dismissNotice)
  const mode = phase === 'betting' ? 'betting' : phase === 'setting' ? 'decide' : phase === 'reveal' ? 'wait' : 'over'

  return (
    <div className="dock-wrap" ref={measureDock}>
      <DealerNotice notice={notice} onDismiss={dismiss} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          className={`dock dock--${mode} dock--paigow`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10, pointerEvents: 'none' }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {mode === 'betting' && <Betting />}
          {mode === 'decide' && <Setting />}
          {mode === 'wait' && <Reading />}
          {mode === 'over' && <Settled />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Betting() {
  const game = usePaiGowStore((s) => s.game)
  const chip = usePaiGowStore((s) => s.chip)
  const setChip = usePaiGowStore((s) => s.setChip)
  const deal = usePaiGowStore((s) => s.deal)
  const clear = usePaiGowStore((s) => s.clearBets)
  const rebet = usePaiGowStore((s) => s.rebet)
  const rebuy = usePaiGowStore((s) => s.rebuy)
  const showEdges = usePaiGowStore((s) => s.profile.settings.showEdges)
  const check = pg.canDeal(game)
  const staked = pg.totalOnFelt(game)
  const broke = game.bankroll + staked < game.limits.minBet
  const hasLast = game.lastBets.wager > 0

  if (broke) return <OutOfChips onRebuy={rebuy} />

  return (
    <>
      {!check.ok && staked > 0 && <p className="dock__blocked">{check.reason}</p>}
      <div className="dock__row">
        <ChipRack denominations={paigowDenominations(game)} chip={chip} bankroll={game.bankroll} onSelect={setChip} />
        <div className="wager">
          <span className="eyebrow">In the circles</span>
          <Money value={staked} className={`wager__value${staked > 0 ? ' is-set' : ''}`} flash={false} duration={0.35} />
          <span className="wager__hint">
            Bet {money(game.limits.minBet)} – {money(game.limits.maxBet)} · Fortune {money(game.limits.minFortune)}+
          </span>
        </div>
        {showEdges && (
          <div className="ba-book pg-prices" title="What the house keeps">
            <span className="ba-book__text">Bet</span>
            <EdgePill edge={mainEdge(game.rules)} label={false} />
            <span className="ba-book__text">Fortune</span>
            <EdgePill edge={FORTUNE_EDGE} label={false} />
          </div>
        )}
        <div className="dock__buttons">
          <button type="button" className="btn btn--ghost btn--sm" onClick={clear} disabled={staked === 0} title="Take everything back · C">
            <ArtClear /> Clear
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={rebet} disabled={!hasLast || staked > 0} title="The last hand's bets again · R">
            <ArtRebet /> Rebet
          </button>
          <button type="button" className="btn btn--gold btn--lg deal-btn" onClick={deal} disabled={!check.ok} title={check.reason}>
            <ArtDeal /> Deal <kbd>Space</kbd>
          </button>
        </div>
      </div>
    </>
  )
}

function Setting() {
  const game = usePaiGowStore((s) => s.game)
  const low = usePaiGowStore((s) => s.low)
  const evs = usePaiGowStore((s) => s.evs)
  const coach = usePaiGowStore((s) => s.profile.settings.coach)
  const setHouseWay = usePaiGowStore((s) => s.setHouseWay)
  const confirm = usePaiGowStore((s) => s.confirmSet)
  const clearLow = usePaiGowStore((s) => s.clearLow)
  const togglePanel = usePaiGowUi((s) => s.togglePanel)
  const read = coachRead(game, low, evs?.seq === game.seq ? evs.evs : null)
  const mine = read?.mine ?? null
  const foul = mine ? !mine.legal : false

  return (
    <div className="dock__row">
      <div className={`hand-info pg-info${foul ? ' is-foul' : ''}`}>
        <span className="eyebrow">{foul ? 'Foul' : mine ? 'Your set' : 'Set your hand'}</span>
        {mine ? (
          <>
            <strong className="pg-info__high">{handName(mine.highScore, 5)}</strong>
            <span className="pg-info__low">{foul ? 'The low hand outranks the high — a foul loses the bet' : `${handName(mine.lowScore, 2)} in front`}</span>
          </>
        ) : (
          <>
            <strong className="pg-info__high">Pick {low.length === 0 ? 'two cards' : 'one more'}</strong>
            <span className="pg-info__low">for the low hand · tap the cards, or keys 1–7</span>
          </>
        )}
      </div>

      <div className="actions">
        <button
          type="button"
          className={`action pg-action pg-action--house${read?.matches ? ' is-done' : ''}`}
          onClick={setHouseWay}
          onPointerEnter={() => play('hover')}
          title="Set the hand the way the dealer would"
        >
          <span className="action__icon">
            <ArtHouseWay />
          </span>
          <span className="action__label">House way</span>
          <kbd>H</kbd>
        </button>
        <button
          type="button"
          className="action pg-action pg-action--clear"
          onClick={clearLow}
          disabled={low.length === 0}
          onPointerEnter={() => play('hover')}
        >
          <span className="action__icon">
            <ArtClear />
          </span>
          <span className="action__label">Start over</span>
          <kbd>C</kbd>
        </button>
        <button
          type="button"
          className={`action pg-action pg-action--set${foul ? ' is-foul' : ''}${read?.matches && coach ? ' is-recommended' : ''}`}
          onClick={confirm}
          disabled={!mine}
          onPointerEnter={() => play('hover')}
          title={foul ? 'A foul loses the bet' : undefined}
        >
          {read?.matches && coach && <span className="action__book">Book</span>}
          <span className="action__icon">
            <ArtSetHand />
          </span>
          <span className="action__label">{foul ? 'Set anyway' : 'Set hand'}</span>
          <kbd>Space</kbd>
        </button>
      </div>

      {coach && read ? (
        <button
          type="button"
          className="coach-card pg-coach"
          data-drawer-toggle
          onClick={() => {
            play('click')
            togglePanel('reference')
          }}
          title="The house way · ?"
        >
          <span className="ba-book__text">
            <IconBook width={14} height={14} /> House way · {read.rule.hand}
          </span>
          <span className="pg-coach__reason">{read.houseName}</span>
          <span className="pg-coach__evs">{evLine(read)}</span>
        </button>
      ) : (
        <span className="ba-next">Coach off — the house way is in the book</span>
      )}
    </div>
  )
}

/** The numbers, in bets: what the house way and your set are each worth, and the gap. */
function evLine(read: NonNullable<ReturnType<typeof coachRead>>): string {
  const { houseEv, mineEv, mine, matches, best } = read
  if (houseEv === null) return 'Working out what each set is worth…'
  const parts = [`House way ${bets(houseEv)} a bet`]
  if (mine && !matches && mineEv !== null) {
    const gap = mineEv - houseEv
    parts.push(
      !mine.legal ? 'yours fouls: −1.00' : Math.abs(gap) < EV_NOISE ? `yours ${bets(mineEv)}, as good` : gap < 0 ? `yours ${bets(mineEv)}, costs ${Math.abs(gap).toFixed(2)}` : `yours ${bets(mineEv)}, better by ${gap.toFixed(2)}`,
    )
  }
  if (best && (!mine || mineEv === null || best.ev > mineEv + EV_NOISE)) parts.push(`best by the numbers ${bets(best.ev)}: ${best.name.toLowerCase()}`)
  return parts.join(' · ')
}

function Reading() {
  return (
    <div className="dock__row dock__row--center">
      <div className="waiting">
        <span className="waiting__dots">
          <i />
          <i />
          <i />
        </span>
        The dealer sets the house way
      </div>
    </div>
  )
}

function Settled() {
  const game = usePaiGowStore((s) => s.game)
  const lastNet = usePaiGowStore((s) => s.lastNet)
  const rebetAndDeal = usePaiGowStore((s) => s.rebetAndDeal)
  const clear = usePaiGowStore((s) => s.clearBets)
  const rebuy = usePaiGowStore((s) => s.rebuy)
  const result = game.result
  const again = game.lastBets.wager + game.lastBets.fortune
  const broke = game.bankroll < game.limits.minBet
  const canAgain = game.lastBets.wager > 0 && again <= game.bankroll
  const head = !result
    ? 'This hand'
    : result.outcome === 'foul'
      ? 'Foul'
      : result.outcome === 'win'
        ? 'Both hands win'
        : result.outcome === 'lose'
          ? 'Dealer wins both'
          : result.queenHighPush
            ? 'Queen-high push'
            : 'One each — push'

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
            <ArtClear /> Clear bets <kbd>C</kbd>
          </button>
          <button type="button" className="btn btn--gold btn--lg deal-btn" onClick={rebetAndDeal} disabled={!canAgain}>
            <ArtRebet /> Rebet {money(again)} &amp; deal <kbd>Space</kbd>
          </button>
        </>
      )}
    </div>
  )
}
