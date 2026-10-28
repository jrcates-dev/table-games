import { AnimatePresence, motion } from 'motion/react'
import { memo, useEffect, useRef } from 'react'
import { play } from '../audio'
import { ChipStack } from '../components/ChipStack'
import type { GameState } from '../engine/types'
import { BET_Y, CAMERA, CIRCLE, handCenters, INSURANCE_SPOT, TRAY } from './geometry'

/**
 * The money on the felt, moving the way a dealer moves it.
 *
 * A losing bet is raked into the tray. A winner is paid from the tray, the
 * payout set down beside the bet. A push is left where it is. When the round
 * clears, whatever is still yours slides back to your side of the rail.
 */

interface StackItem {
  key: string
  amount: number
  x: number
  y: number
  /** Where it arrives from, if not already standing here. */
  from?: { x: number; y: number }
  /** Raked into the tray. */
  swept?: boolean
  /** Seconds to wait before moving — lets the result register first. */
  delay?: number
  /** Leaves without ceremony, because another stack is taking its place. */
  handOff?: boolean
  dropIn?: boolean
  seed: number
}

const PLAYER_SIDE = { y: 1010 }
const SIZE = 62

function deriveStacks(game: GameState): StackItem[] {
  const { round } = game
  const items: StackItem[] = []

  if (round.phase === 'betting') {
    if (game.pendingBet > 0) {
      items.push({ key: 'pending', amount: game.pendingBet, x: CIRCLE.x, y: CIRCLE.y, handOff: true, dropIn: true, seed: 1 })
    }
    return items
  }

  const over = round.phase === 'roundOver'
  const centers = handCenters(round.hands.length)

  round.hands.forEach((hand, i) => {
    const x = centers[i]
    const base = hand.doubled ? hand.bet / 2 : hand.bet
    const lost = over && (hand.outcome === 'lose' || hand.outcome === 'bust' || hand.outcome === 'dealerBlackjack')
    const offset = hand.doubled ? -30 : 0
    // The first box's wager is the one that was already in the circle.
    const from = i === 0 ? undefined : { x, y: PLAYER_SIDE.y }

    if (hand.outcome === 'surrender' && over) {
      items.push({ key: `bet:${hand.id}`, amount: base / 2, x: x + offset, y: BET_Y, from, seed: i + 2 })
      items.push({ key: `half:${hand.id}`, amount: base / 2, x: x + offset + 1, y: BET_Y, swept: true, delay: 0.5, seed: i + 9 })
    } else {
      items.push({ key: `bet:${hand.id}`, amount: base, x: x + offset, y: BET_Y, from, swept: lost, delay: 0.55 + i * 0.12, seed: i + 2 })
    }

    if (hand.doubled) {
      items.push({
        key: `dbl:${hand.id}`,
        amount: base,
        x: x + 30,
        y: BET_Y + 6,
        from: { x: x + 30, y: PLAYER_SIDE.y },
        swept: lost,
        delay: 0.6 + i * 0.12,
        seed: i + 20,
      })
    }

    if (over && hand.payout !== undefined && hand.payout > hand.bet) {
      const winnings = hand.payout - hand.bet
      items.push({
        key: `pay:${hand.id}`,
        amount: winnings,
        x: x + (hand.doubled ? 92 : 74),
        y: BET_Y - 4,
        from: { x: TRAY.x + (i - 1) * 40, y: TRAY.y + 20 },
        delay: 0.4 + i * 0.16,
        seed: i + 40,
      })
    }
  })

  if (round.insuranceBet > 0) {
    const insuranceLost = round.insuranceOutcome === 'lose'
    items.push({
      key: 'ins',
      amount: round.insuranceBet,
      x: INSURANCE_SPOT.x,
      y: INSURANCE_SPOT.y,
      from: { x: INSURANCE_SPOT.x, y: PLAYER_SIDE.y },
      swept: insuranceLost,
      delay: 0.35,
      seed: 60,
    })
    if (round.insuranceOutcome === 'win') {
      items.push({
        key: 'ins-pay',
        amount: round.insuranceBet * game.rules.insurancePayout,
        x: INSURANCE_SPOT.x + 72,
        y: INSURANCE_SPOT.y,
        from: { x: TRAY.x + 120, y: TRAY.y + 20 },
        delay: 0.3,
        seed: 61,
      })
    }
  }
  return items
}

export const BetLayer = memo(function BetLayer({ game }: { game: GameState }) {
  const items = deriveStacks(game)
  useSettlementSounds(game)

  return (
    <AnimatePresence>
      {items.map((item) => (
        <Stack key={item.key} item={item} />
      ))}
    </AnimatePresence>
  )
})

const EASE: [number, number, number, number] = [0.25, 0.7, 0.3, 1]

function Stack({ item }: { item: StackItem }) {
  const start = item.from ?? { x: item.x, y: item.y }
  const fromTray = item.from !== undefined && item.from.y < BET_Y
  const delay = item.from || item.swept ? item.delay ?? 0 : 0
  // Raked stacks shrink away into the tray rather than fading: fading a
  // stood-up stack would flatten it onto the felt for the length of the fade.
  const target = item.swept
    ? { x: TRAY.x + ((item.seed * 37) % 160) - 80, y: TRAY.y + 8, scale: 0.01 }
    : { x: item.x, y: item.y, scale: 1 }

  return (
    <motion.div
      className="bj-stack"
      initial={{ x: start.x, y: start.y, scale: fromTray ? 0.45 : 1 }}
      animate={target}
      exit={
        item.handOff || item.swept
          ? { opacity: 0, transition: { duration: 0 } }
          : { y: PLAYER_SIDE.y + 40, transition: { duration: 0.6, ease: [0.5, 0, 0.3, 1] } }
      }
      transition={{
        x: { duration: item.swept ? 0.5 : 0.55, delay, ease: EASE },
        y: { duration: item.swept ? 0.5 : 0.55, delay, ease: EASE },
        scale: item.swept ? { duration: 0.22, delay: delay + 0.42 } : { duration: 0.45, delay, ease: EASE },
      }}
    >
      <div className="bj-stack__shadow" style={{ width: SIZE * 1.1, height: SIZE * 0.9 }} />
      <ChipStack amount={item.amount} size={SIZE} tilt={CAMERA.tilt} seed={item.seed} dropIn={item.dropIn} />
    </motion.div>
  )
}

/** The rack being worked: rakes and payouts heard as they land. */
function useSettlementSounds(game: GameState) {
  const phase = game.round.phase
  const last = useRef(phase)
  useEffect(() => {
    const prev = last.current
    last.current = phase
    if (phase !== 'roundOver' || prev === 'roundOver') return
    const hands = game.round.hands
    const lost = hands.some((h) => h.outcome === 'lose' || h.outcome === 'bust' || h.outcome === 'dealerBlackjack' || h.outcome === 'surrender')
    const paid = hands.filter((h) => (h.payout ?? 0) > h.bet).length
    if (lost) play('chipSlide', { at: 0.62 })
    for (let i = 0; i < paid; i++) play('chipStack', { at: 0.85 + i * 0.16, count: 5 })
  }, [phase, game.round.hands])

  // Insurance is settled at the peek, long before the round is.
  const insurance = game.round.insuranceOutcome
  const lastInsurance = useRef(insurance)
  useEffect(() => {
    if (insurance === lastInsurance.current) return
    lastInsurance.current = insurance
    if (insurance === 'lose') play('chipSlide', { at: 0.4 })
  }, [insurance])
}
