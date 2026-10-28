import { AnimatePresence, motion } from 'motion/react'
import { useRef } from 'react'
import { useTip } from '../components/tip'
import { useTipPlacement } from '../components/tipPlace'
import { availableActions } from '../engine/blackjack'
import { edgeBand } from '../engine/edge'
import { bestDecision, DECISIONS, type Decision, type DecisionEvs } from '../engine/ev'
import { ACTION_LABELS, basicStrategy } from '../engine/strategy'
import type { GameState } from '../engine/types'
import { money, signedMoney } from '../lib/format'
import { useGameStore } from '../store/gameStore'
import { betShare, decisionEvsFor, tipAction } from './prices'

/**
 * The coach's price list. Hovering a decision in the dock (holding it, on a
 * touch screen) says what that play is worth on this exact hand, what it gives
 * up against the book, and what every other play is worth beside it — so a
 * player can tell a hand worth pressing from one where the right play only
 * loses less.
 */

export function ActionTip() {
  const id = useTip((s) => s.id)
  const x = useTip((s) => s.x)
  const y = useTip((s) => s.y)
  const pinned = useTip((s) => s.pinned)
  const game = useGameStore((s) => s.game)
  const showCoach = useGameStore((s) => s.profile.settings.showCoach)
  const ref = useRef<HTMLDivElement>(null)

  const action = tipAction(id)
  const evs = action && showCoach ? decisionEvsFor(game) : null
  const tip = action && evs && evs[action] !== undefined ? priceList(game, evs, action) : null
  const translate = useTipPlacement(ref, x, y, id, pinned)

  return (
    <AnimatePresence>
      {tip && (
        <motion.div
          ref={ref}
          key="tip"
          className={`spot-tip action-tip${pinned ? ' is-pinned' : ''}`}
          data-pinned-tip={pinned || undefined}
          style={{ left: x, top: y, translate }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ duration: 0.14 }}
        >
          <div className="spot-tip__head">
            <strong>{ACTION_LABELS[tip.action]}</strong>
            <span className={tip.ev >= 0 ? 'tone-win' : 'tone-lose'}>{betShare(tip.ev)}</span>
          </div>
          <div className="action-tip__money">
            Averages <strong>{signedMoney(tip.ev * tip.bet, true)}</strong> on your {money(tip.bet)} bet
            {(tip.action === 'double' || tip.action === 'split') && ', extra stake included'}
          </div>
          <div className="spot-tip__edge">
            {tip.cost === null ? (
              <span className="edge-pill edge-pill--none">Book play</span>
            ) : (
              <span className={`edge-pill edge-pill--${edgeBand(tip.cost)}`}>
                {betShare(-tip.cost)} vs {ACTION_LABELS[tip.book]}
              </span>
            )}
            {tip.cost !== null && tip.cost > 0 && <span>{signedMoney(-tip.cost * tip.bet, true)} a hand</span>}
            {tip.cost !== null && tip.cost < 0 && (
              <span className="spot-tip__note">These exact cards edge it past the chart, which plays totals.</span>
            )}
          </div>
          <div className="action-tip__plays">
            {tip.plays.map((play) => {
              const ev = evs?.[play] ?? 0
              return (
                <div key={play} className={play === tip.action ? 'is-now' : undefined}>
                  <span>
                    {ACTION_LABELS[play]}
                    {play === tip.book && <em>Book</em>}
                  </span>
                  <strong className={ev >= 0 ? 'tone-win' : 'tone-lose'}>{betShare(ev)}</strong>
                  <span>{signedMoney(ev * tip.bet, true)}</span>
                </div>
              )
            })}
          </div>
          <div className="spot-tip__hint">{tip.verdict}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface PriceList {
  action: Decision
  ev: number
  bet: number
  book: Decision
  /** What this play gives up against the book, as a share of the bet. Null for the book play itself. */
  cost: number | null
  /** Every play with a figure, best first. */
  plays: Decision[]
  verdict: string
}

function priceList(game: GameState, evs: DecisionEvs, action: Decision): PriceList | null {
  const { round, rules } = game
  const hand = round.hands[round.activeHandIndex]
  const ev = evs[action]
  if (!hand || ev === undefined) return null

  const book = basicStrategy(hand, round.dealer[0], { rules, legal: availableActions(game) }) as Decision
  const bookEv = evs[book]
  const plays = DECISIONS.filter((play) => evs[play] !== undefined).sort((a, b) => (evs[b] as number) - (evs[a] as number))
  const best = bestDecision(evs) ?? book
  const top = evs[best] as number

  const verdict =
    top > 0.0005
      ? `A winning spot: ${ACTION_LABELS[best]} expects to win ${betShare(top, false)} of the bet.`
      : top < -0.0005
        ? `A losing spot whatever you do: ${ACTION_LABELS[best]} just loses the least.`
        : `Close to even at best: ${ACTION_LABELS[best]} is the pick.`

  return {
    action,
    ev,
    bet: hand.bet,
    book,
    cost: action === book || bookEv === undefined ? null : bookEv - ev,
    plays,
    verdict,
  }
}
