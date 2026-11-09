import { categoryOf, DEFAULT_HAND_RULES, score2, score5, type HandRules } from './hands'
import { FLUSH, STRAIGHT, STRAIGHT_FLUSH } from '../uth/poker'
import { FIVE_ACES } from './hands'

/**
 * Every way to set seven cards: two of them in the low hand, the other five in
 * the high hand — 21 ways in all. A set is legal only when the high hand
 * outranks the low; anything else is a foul.
 */

export interface SetHand {
  /** Indices into the seven of the two cards in the low hand, ascending. */
  low: [number, number]
  /** The other five. */
  high: number[]
  lowScore: number
  highScore: number
  legal: boolean
}

export const ALL_LOWS: Array<[number, number]> = []
for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) ALL_LOWS.push([a, b])

export function setHand(cards: readonly number[], low: readonly number[], rules: HandRules = DEFAULT_HAND_RULES): SetHand {
  const [a, b] = low[0] < low[1] ? [low[0], low[1]] : [low[1], low[0]]
  const high: number[] = []
  for (let i = 0; i < cards.length; i++) if (i !== a && i !== b) high.push(i)
  const lowScore = score2(cards[a], cards[b])
  const highScore = score5(
    high.map((i) => cards[i]),
    rules,
  )
  return { low: [a, b], high, lowScore, highScore, legal: highScore > lowScore }
}

export function allSets(cards: readonly number[], rules: HandRules = DEFAULT_HAND_RULES): SetHand[] {
  return ALL_LOWS.map((low) => setHand(cards, low, rules))
}

/** A high hand that is a straight, a flush or a straight flush (five aces is not). */
export function isStraightOrFlush(highScore: number): boolean {
  const c = categoryOf(highScore)
  return c === STRAIGHT || c === FLUSH || c === STRAIGHT_FLUSH
}

export function isFiveAces(highScore: number): boolean {
  return categoryOf(highScore) === FIVE_ACES
}

export function sameLow(a: readonly number[], b: readonly number[]): boolean {
  const [x, y] = a[0] < a[1] ? a : [a[1], a[0]]
  const [u, v] = b[0] < b[1] ? b : [b[1], b[0]]
  return x === u && y === v
}
