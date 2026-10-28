import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { IconInfo } from '../components/icons'
import { needsShuffle, penetrationPct } from '../engine/cards'
import { betRamp, breakEvenCount, EDGE_PER_TRUE_COUNT, suggestedBetUnits, type CountSnapshot } from '../engine/counting'
import type { Decision } from '../engine/ev'
import { DEFAULT_RULE_PRESET, RULE_PRESETS } from '../engine/rules'
import { ACTION_LABELS } from '../engine/strategy'
import { money, percent } from '../lib/format'
import { lastPressWasTouch } from '../lib/touch'
import { selectCanShuffle, useCount, useGameStore } from '../store/gameStore'
import { useUiStore } from '../store/uiStore'
import { betShare, decisionEvsFor } from './prices'

/**
 * The counter's heads-up display: running count, true count, decks left and
 * how deep the shoe is, with the cut card marked. Derived from the shoe itself
 * rather than accumulated, so it can never drift from the felt. Hovering it,
 * tapping it or tabbing to it explains what the numbers are saying.
 */
export function CountHud() {
  const show = useGameStore((s) => s.profile.settings.showCount)
  const shoe = useGameStore((s) => s.game.shoe)
  const count = useCount()
  const [explain, setExplain] = useState(false)
  if (!show) return null

  const dealt = penetrationPct(shoe)
  const cut = shoe.cutIndex / shoe.cards.length
  const tone = (v: number, pivot = 1) => (v >= pivot ? 'is-hot' : v <= -pivot ? 'is-cold' : '')

  return (
    <motion.aside
      className="count-hud"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      tabIndex={0}
      aria-describedby={explain ? 'count-tip' : undefined}
      // A finger's enter and leave come with its tap, so a finger opens it by
      // tapping, and tapping anywhere else closes it again.
      onPointerEnter={(event) => event.pointerType !== 'touch' && setExplain(true)}
      onPointerLeave={(event) => event.pointerType !== 'touch' && setExplain(false)}
      onClick={() => lastPressWasTouch() && setExplain(true)}
      onFocus={() => setExplain(true)}
      onBlur={() => setExplain(false)}
    >
      <span className="eyebrow count-hud__head">
        Hi-Lo count
        <IconInfo width={14} height={14} />
      </span>
      <div className="count-hud__grid">
        <div>
          <span>Running</span>
          <strong className={`num ${tone(count.running, 2)}`}>{count.running > 0 ? `+${count.running}` : count.running}</strong>
        </div>
        <div>
          <span>True</span>
          <strong className={`num ${tone(count.true)}`}>
            {count.true > 0 ? '+' : ''}
            {count.true.toFixed(1)}
          </strong>
        </div>
        <div>
          <span>Decks left</span>
          <strong className="num">{count.decksRemaining.toFixed(1)}</strong>
        </div>
      </div>
      <div className="count-hud__shoe" title={`Cut card at ${Math.round(cut * 100)}%`}>
        <div className="count-hud__fill" style={{ width: `${dealt * 100}%` }} />
        <div className="count-hud__cut" style={{ left: `${cut * 100}%` }} />
      </div>
      <AnimatePresence>{explain && <CountTip count={count} />}</AnimatePresence>
    </motion.aside>
  )
}

const signed = (value: number, digits = 0) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`

/**
 * A ramp step as the HUD will show it: rounded up to the tenth, so the first
 * true count the HUD prints at or past a step is one that has really reached it.
 */
const stepCount = (from: number) => signed(Math.ceil(from * 10 - 1e-9) / 10, 1)

/**
 * The card under the HUD, in the felts' tooltip style: how the count is kept,
 * why a high one is worth betting into, and this table's spread, the same one
 * "Count says" bets from, with the step the shoe is on now lit.
 */
function CountTip({ count }: { count: CountSnapshot }) {
  const rulePreset = useGameStore((s) => s.profile.settings.rulePreset)
  const table = useGameStore((s) => s.table())
  const houseEdge = (RULE_PRESETS[rulePreset] ?? RULE_PRESETS[DEFAULT_RULE_PRESET]).houseEdge
  const ramp = betRamp(houseEdge)
  const now = suggestedBetUnits(count.true, houseEdge)
  const start = stepCount(breakEvenCount(houseEdge))

  return (
    <motion.div
      id="count-tip"
      role="tooltip"
      className="spot-tip count-tip"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
      transition={{ duration: 0.14 }}
    >
      <div className="spot-tip__head">
        <strong>Reading the count</strong>
        <span>Bet {money(Math.min(table.maxBet, now * table.minBet))}</span>
      </div>
      <div className="spot-tip__rows count-tip__rows">
        <div>
          <em className="count-tip__term">Running</em>
          <span>Each 2–6 dealt adds one, each ten or ace takes one away; 7–9 are neutral.</span>
        </div>
        <div>
          <em className="count-tip__term">True</em>
          <span>
            Running ÷ decks left: {signed(count.running)} ÷ {count.decksRemaining.toFixed(1)} = {signed(count.true, 1)}. This is the one
            you bet by.
          </span>
        </div>
        <div>
          <em className="tone-win">High</em>
          <span>
            Tens and aces left: more blackjacks, better doubles, more dealer busts. Each +1 is worth about {percent(EDGE_PER_TRUE_COUNT)}{' '}
            to you.
          </span>
        </div>
        <div>
          <em className="tone-lose">Low</em>
          <span>Small cards left, and they help the dealer. Bet the minimum.</span>
        </div>
      </div>
      <div className="spot-tip__hint">
        Bet one unit ({money(table.minBet)}) until the true count clears this table’s {percent(houseEdge, 2)} house edge at{' '}
        {start}, then ramp up:
      </div>
      <div className="count-tip__ramp">
        {ramp.map((step) => (
          <div key={step.units} className={step.units === now ? 'is-now' : undefined}>
            <span>{step.from === null ? `< ${start}` : stepCount(step.from)}</span>
            <strong>{step.units}×</strong>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/**
 * The dealer is starting a fresh shoe — because the cut card came out last
 * hand, or because the player asked — which also means the count is back to
 * zero. Worth a moment's notice.
 */
export function ShuffleNotice() {
  const shoe = useGameStore((s) => s.game.shoe)
  const decks = useGameStore((s) => s.game.rules.decks)
  const counting = useGameStore((s) => s.profile.settings.showCount)
  const previous = useRef(shoe)
  const [notice, setNotice] = useState<{ early: boolean; at: number } | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = shoe
    if (shoe.shuffleCount === before.shuffleCount) return
    // Short of the cut card, the dealer only shuffles because they were asked.
    setNotice({ early: !needsShuffle(before), at: shoe.shuffleCount })
  }, [shoe])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 2600)
    return () => clearTimeout(timer)
  }, [notice])

  const shuffled = `${decks} ${decks === 1 ? 'deck' : 'decks'} shuffled.`
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          className="shuffle-notice"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
        >
          <span className="eyebrow">Fresh shoe</span>
          <p>
            {notice.early ? `Shuffled up early — ${shuffled}` : `The cut card came out — ${shuffled}`}
            {counting && ' The count starts again from zero.'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Double-clicking the shoe asks before it shuffles up: a fresh shoe throws
 * away the count, which is not something a stray click should do.
 */
export function ShuffleConfirm() {
  const asked = useUiStore((s) => s.shuffleAsk)
  const close = useUiStore((s) => s.closeShuffle)
  const allowed = useGameStore(selectCanShuffle)
  const shuffleUp = useGameStore((s) => s.shuffleUp)
  const decks = useGameStore((s) => s.game.rules.decks)
  const counting = useGameStore((s) => s.profile.settings.showCount)
  const open = asked && allowed

  // A hand dealt from the dock while the question is up answers it.
  useEffect(() => {
    if (asked && !allowed) close()
  }, [asked, allowed, close])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="challenge"
          role="alertdialog"
          aria-label="Reshuffle decks"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
          <span className="eyebrow">The shoe</span>
          <p className="challenge__text">
            <strong>Reshuffle Decks?</strong>
            <br />
            All {decks} {decks === 1 ? 'deck goes' : 'decks go'} back in the shoe
            {counting ? ' and the count starts again from zero.' : '.'}
          </p>
          <div className="challenge__buttons">
            <button
              type="button"
              className="btn btn--gold"
              autoFocus
              onClick={() => {
                close()
                shuffleUp()
              }}
            >
              Reshuffle
            </button>
            <button type="button" className="btn btn--ghost" onClick={close}>
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Strict coaching. A play that departs from the book is held once, with the
 * right play and the reason, and the player decides. The point is to teach,
 * not to take the controls away.
 */
export function CoachChallenge() {
  const challenge = useGameStore((s) => s.challenge)
  const act = useGameStore((s) => s.act)
  const dismiss = useGameStore((s) => s.dismissChallenge)
  const game = useGameStore((s) => s.game)
  const evs = challenge ? decisionEvsFor(game) : null
  const attempted = evs?.[challenge?.attempted as Decision]
  const correct = evs?.[challenge?.correct as Decision]
  // What the departure costs, as a share of the bet. The game is still at the
  // decision, so the figures are the ones the hover card showed.
  const cost = attempted !== undefined && correct !== undefined ? correct - attempted : null
  const bet = game.round.hands[game.round.activeHandIndex]?.bet ?? 0

  return (
    <AnimatePresence>
      {challenge && (
        <motion.div
          className="challenge"
          role="alertdialog"
          aria-label="Basic strategy check"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
          <span className="eyebrow">The book says</span>
          <p className="challenge__text">
            With <strong>{challenge.reason}</strong>, the correct play is{' '}
            <strong className="challenge__correct">{ACTION_LABELS[challenge.correct]}</strong>.
            {cost !== null && (
              <span className="challenge__cost">
                {cost > 0
                  ? `${ACTION_LABELS[challenge.attempted]} gives up ${betShare(cost, false)} of the bet, ${money(cost * bet, true)} a hand on average.`
                  : `With these exact cards ${ACTION_LABELS[challenge.attempted]} is worth as much or a touch more: the chart plays totals.`}
              </span>
            )}
          </p>
          <div className="challenge__buttons">
            <button
              type="button"
              className="btn btn--gold"
              onClick={() => {
                dismiss()
                act(challenge.correct, true)
              }}
            >
              {ACTION_LABELS[challenge.correct]}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => act(challenge.attempted, true)}>
              {ACTION_LABELS[challenge.attempted]} anyway
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
