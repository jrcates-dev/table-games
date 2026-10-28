import { AnimatePresence, motion } from 'motion/react'
import { play } from '../audio'
import { FlatDie } from '../components/CssDie'
import { IconChevron } from '../components/icons'
import { ALL_NUMBERS, SMALL_NUMBERS, spec, TALL_NUMBERS, WAYS } from '../engine/craps/bets'
import * as craps from '../engine/craps/craps'
import type { Bet } from '../engine/craps/types'
import { money, signedMoney } from '../lib/format'
import { useCrapsStore, useNextRoll } from '../store/crapsStore'
import { useCrapsUiStore } from '../store/crapsUiStore'
import { BAND_LABEL, describeBet, loseCondition, potentialWin, winCondition } from './betInfo'
import { LastRoll } from './LastRoll'

/**
 * Every bet on the felt, what it needs, and what the next roll does to it.
 *
 * This is the difference between craps being unlearnable and craps being
 * obvious. A felt covered in chips is opaque; the same felt as a list of "Pass
 * Line $10 — wins 6, loses 7" is not. It folds away for anyone who no longer
 * needs it.
 */
export function Rail() {
  const open = useCrapsUiStore((s) => s.railOpen)
  const toggle = useCrapsUiStore((s) => s.toggleRail)
  const game = useCrapsStore((s) => s.game)
  const showProjection = useCrapsStore((s) => s.profile.settings.showProjection)
  const bets = Object.values(game.bets).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
  const atRisk = craps.totalAtRisk(game)

  return (
    <AnimatePresence initial={false} mode="wait">
      {open ? (
        <motion.aside
          key="open"
          className="rail"
          aria-label="Your bets"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        >
          <header className="rail__head">
            <div>
              <span className="eyebrow">Your bets</span>
              <strong className="rail__count">{bets.length === 0 ? 'Nothing up' : `${bets.length} on the felt`}</strong>
            </div>
            <div className="rail__risk">
              <span className="eyebrow">At risk</span>
              <strong className="num">{money(atRisk)}</strong>
            </div>
            <button
              type="button"
              className="icon-btn rail__fold"
              onClick={() => {
                play('close')
                toggle()
              }}
              aria-label="Fold the bet rail"
              title="Fold away"
            >
              <IconChevron />
            </button>
          </header>

          <PointStatus />
          <LastRoll />
          {showProjection && bets.length > 0 && <NextRoll />}

          <div className="rail__list">
            {bets.length === 0 ? (
              <p className="rail__empty">
                Click the felt to put chips down. The shooter needs a line bet before the dice come out — start on the{' '}
                <strong>Pass Line</strong> or the <strong>Don’t Pass Bar</strong>.
              </p>
            ) : (
              bets.map((bet) => <BetRow key={bet.id} bet={bet} />)
            )}
          </div>

          <SideBetProgress />
        </motion.aside>
      ) : (
        <motion.button
          key="closed"
          type="button"
          className="rail-tab"
          onClick={() => {
            play('open')
            toggle()
          }}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          title="Show your bets"
        >
          <span className="rail-tab__label">Your bets</span>
          <strong className="num">{money(atRisk)}</strong>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

/** Roughly the order a dealer reads the felt: line, come, box, centre. */
const ORDER = [
  'passLine', 'passOdds', 'dontPass', 'dontPassOdds', 'come', 'comePoint', 'comeOdds', 'dontCome', 'dontComePoint',
  'dontComeOdds', 'place', 'buy', 'lay', 'field', 'hard', 'anyCraps', 'any7', 'ce', 'horn', 'world', 'two', 'three',
  'eleven', 'twelve', 'fire', 'small', 'tall', 'all',
]

function PointStatus() {
  const game = useCrapsStore((s) => s.game)
  const point = game.point
  const last = game.roll
  const rolling = game.phase === 'rolling'
  return (
    <div className={`point-status${point ? ' is-on' : ''}`}>
      <div className="point-status__puck">{point ? 'ON' : 'OFF'}</div>
      <div className="point-status__text">
        <strong>{point ? `The point is ${point}` : 'Come-out roll'}</strong>
        <span>{point ? `${WAYS[point]} ways to make it · 6 ways to seven out` : '7 or 11 wins the line · 2, 3 or 12 loses'}</span>
      </div>
      {last && !rolling && (
        <div className="point-status__dice" title="Last roll">
          <FlatDie value={last.a} size={24} />
          <FlatDie value={last.b} size={24} />
        </div>
      )}
    </div>
  )
}

function BetRow({ bet }: { bet: Bet }) {
  const game = useCrapsStore((s) => s.game)
  const showEdges = useCrapsStore((s) => s.profile.settings.showEdges)
  const takeDown = useCrapsStore((s) => s.takeDown)
  const toggleWorking = useCrapsStore((s) => s.toggleWorking)
  const takeMaxOdds = useCrapsStore((s) => s.takeMaxOdds)

  const info = describeBet(bet.kind, bet.number, game.point)
  const win = potentialWin(bet, game.point)
  const working = craps.isWorking(bet, game.point)
  const removable = craps.canRemove(bet, game.point)
  const togglable = craps.canToggleWorking(bet)
  const resolution = game.phase === 'betting' ? game.resolutions.find((r) => r.betId === bet.id) : undefined
  const oddsKind = bet.kind === 'comePoint' ? 'comeOdds' : bet.kind === 'dontComePoint' ? 'dontComeOdds' : null
  const oddsRoom = oddsKind ? craps.maxFor(game, oddsKind, bet.number) : 0

  return (
    <motion.article
      layout
      className={`bet-row bet-row--${info.band}${working ? '' : ' is-off'}${resolution ? ` is-${resolution.effect}` : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="bet-row__top">
        <span className="bet-row__name">{info.title}</span>
        <span className="bet-row__amount num">{money(bet.amount)}</span>
      </div>
      <div className="bet-row__needs">
        <span>
          <em className="tone-win">Wins</em> {winCondition(bet.kind, bet.number, game.point)}
        </span>
        <span>
          <em className="tone-lose">Loses</em> {loseCondition(bet.kind, bet.number, game.point)}
        </span>
      </div>
      <div className="bet-row__foot">
        <span className="bet-row__pays">
          {info.payout} · {win.upTo ? 'up to ' : ''}
          <strong>{money(win.amount)}</strong>
        </span>
        {showEdges && (
          <span className={`edge-pill edge-pill--${info.band}`} title={`${(info.edge * 100).toFixed(2)}% house edge`}>
            {info.edge === 0 ? '0%' : `${(info.edge * 100).toFixed(1)}%`} · {BAND_LABEL[info.band]}
          </span>
        )}
      </div>
      {!working && <div className="bet-row__off">Off this roll</div>}
      <div className="bet-row__actions">
        {oddsKind && oddsRoom > 0 && (
          <button type="button" className="is-odds" onClick={() => takeMaxOdds({ kind: oddsKind, number: bet.number })} title="True odds behind this come bet — the house keeps nothing">
            + Odds {money(oddsRoom)}
          </button>
        )}
        {togglable && (
          <button type="button" onClick={() => toggleWorking(bet.id)}>
            {working ? 'Turn off' : 'Turn on'}
          </button>
        )}
        {removable && (
          <button type="button" className="is-danger" onClick={() => takeDown(bet.id)}>
            Take down
          </button>
        )}
        {!removable && !togglable && <span className="bet-row__locked">{spec(bet.kind).newShootOnly ? 'Rides until the seven-out' : 'Contract — stays until it resolves'}</span>}
      </div>
    </motion.article>
  )
}

function SideBetProgress() {
  const game = useCrapsStore((s) => s.game)
  const { fire, small, tall, all } = game.bets
  if (!fire && !small && !tall && !all) return null
  const hit = game.shoot.numbersHit
  const set = (numbers: readonly number[]) => (
    <div className="ats-set">
      {numbers.map((n) => (
        <span key={n} className={hit.includes(n) ? 'is-hit' : ''}>
          {n}
        </span>
      ))}
    </div>
  )
  return (
    <div className="side-progress">
      <span className="eyebrow">This shoot</span>
      {fire && (
        <div className="side-progress__row">
          <span>Fire</span>
          <div className="fire-pips">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={i < game.shoot.firePoints.length ? 'is-lit' : ''} />
            ))}
          </div>
          <em>{game.shoot.firePoints.length === 0 ? 'no points yet' : game.shoot.firePoints.join(' · ')}</em>
        </div>
      )}
      {small && (
        <div className="side-progress__row">
          <span>Small</span>
          {set(SMALL_NUMBERS)}
        </div>
      )}
      {tall && (
        <div className="side-progress__row">
          <span>Tall</span>
          {set(TALL_NUMBERS)}
        </div>
      )}
      {all && (
        <div className="side-progress__row">
          <span>All</span>
          {set(ALL_NUMBERS)}
        </div>
      )}
    </div>
  )
}

/**
 * What each of the eleven possible totals would do to the felt as it stands —
 * computed by running the real settler against every pair of dice, so it can
 * never promise something the table then refuses to pay.
 */
function NextRoll() {
  const outcomes = useNextRoll()
  if (outcomes.length === 0) return null
  const peak = Math.max(1, ...outcomes.map((o) => Math.abs(o.net)))
  return (
    <div className="next-roll">
      <span className="eyebrow">If the next roll is…</span>
      <div className="next-roll__grid">
        {outcomes.map((o) => {
          const tone = o.net > 0 ? 'win' : o.net < 0 ? 'lose' : 'flat'
          return (
            <div key={o.total} className={`next-roll__cell is-${tone}`} title={`${o.ways} of 36 ways${o.hardNet !== null ? ` · as a pair: ${signedMoney(o.hardNet)}` : ''}`}>
              <span className="next-roll__bar-wrap">
                <span className="next-roll__bar" style={{ height: `${Math.max(4, (Math.abs(o.net) / peak) * 100)}%` }} />
              </span>
              <span className="next-roll__total num">{o.total}</span>
              <span className="next-roll__net num">{o.net === 0 ? '—' : o.net > 0 ? `+${compact(o.net)}` : `−${compact(-o.net)}`}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(Math.round(n))
}
