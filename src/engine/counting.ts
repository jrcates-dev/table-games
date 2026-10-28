import { decksRemaining } from './cards'
import type { Card, GameState, Rank, ShoeState } from './types'

/**
 * Hi-Lo card counting.
 *
 * Low cards (2-6) leaving the shoe favour the player, so they count +1; tens
 * and aces count -1; 7-9 are neutral. The running count divided by the decks
 * still behind the cut card gives the true count, which is what actually drives
 * bet sizing and strategy deviations.
 */
export function hiLoValue(rank: Rank): number {
  switch (rank) {
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
      return 1
    case '7':
    case '8':
    case '9':
      return 0
    default:
      return -1
  }
}

/**
 * The running count derived from the shoe position, minus any card that has
 * been dealt but not yet exposed (the dealer's hole card).
 *
 * Deriving it rather than accumulating it means the count can never drift out
 * of sync with the felt, and it resets to zero automatically on a shuffle
 * because a fresh shoe starts at position zero.
 */
export function runningCount(shoe: ShoeState, hidden: readonly Card[] = []): number {
  let count = 0
  const dealt = Math.min(shoe.pos, shoe.cards.length)
  for (let i = 0; i < dealt; i++) count += hiLoValue(shoe.cards[i].rank)
  for (const card of hidden) count -= hiLoValue(card.rank)
  return count
}

export function trueCount(running: number, shoe: ShoeState): number {
  return running / decksRemaining(shoe)
}

export interface CountSnapshot {
  running: number
  true: number
  decksRemaining: number
  /** 0..1 through the shoe. */
  penetration: number
}

/** Everything the counting HUD needs, computed from live game state. */
export function countSnapshot(state: GameState): CountSnapshot {
  const hidden = state.round.dealer.filter((card) => card.faceDown)
  const running = runningCount(state.shoe, hidden)
  return {
    running,
    true: trueCount(running, state.shoe),
    decksRemaining: decksRemaining(state.shoe),
    penetration: Math.min(1, state.shoe.pos / state.shoe.cards.length),
  }
}

/** Roughly what each point of Hi-Lo true count is worth to the player. */
export const EDGE_PER_TRUE_COUNT = 0.005

/** The top of the spread, in units of the table minimum. */
const MAX_BET_UNITS = 12

/** The true count at which the cards have paid off the table's house edge. */
export function breakEvenCount(houseEdge = EDGE_PER_TRUE_COUNT): number {
  return houseEdge / EDGE_PER_TRUE_COUNT
}

/**
 * A Hi-Lo bet spread. You flat-bet the minimum until the count has paid off
 * the table's house edge, then scale roughly with the player's edge.
 *
 * The ramp is written for a typical half-percent shoe, which turns in the
 * player's favour around +1. A better game starts sooner; a 6:5 table, at
 * nearly 2%, not until about +4.
 */
export function suggestedBetUnits(trueCountValue: number, houseEdge = EDGE_PER_TRUE_COUNT): number {
  const effective = trueCountValue - breakEvenCount(houseEdge) + 1
  if (effective < 1) return 1
  return Math.min(MAX_BET_UNITS, Math.floor(effective) * 2)
}

export interface RampStep {
  /** The true count this step starts at; the first step is everything below the next. */
  from: number | null
  units: number
}

/** The whole of `suggestedBetUnits` laid out step by step, for showing the spread rather than one bet from it. */
export function betRamp(houseEdge = EDGE_PER_TRUE_COUNT): RampStep[] {
  const start = breakEvenCount(houseEdge)
  const steps: RampStep[] = [{ from: null, units: 1 }]
  for (let units = 2; units <= MAX_BET_UNITS; units += 2) steps.push({ from: start + units / 2 - 1, units })
  return steps
}
