import type { Rank, Suit } from '../types'
import { CATEGORY_SHIFT, FLUSH, HIGH_CARD, PAIR, score, STRAIGHT, STRAIGHT_FLUSH } from '../uth/poker'

/**
 * Pai Gow hands, ranked.
 *
 * The deck is 53 cards: the 52 as small integers — rank × 4 + suit, deuce 0 to
 * ace 12, the same encoding the hold'em evaluator uses — and the joker as 52.
 * A hand's score is one integer whose high bits are its category and low bits
 * its kickers, so comparing two hands is `>`, and a 5-card hand and a 2-card
 * hand are scored on the same scale, which is what the foul rule compares.
 *
 * The joker is semi-wild ("the bug"): it plays as an ace, or as whatever card
 * completes a straight, a flush or a straight flush. Four aces and the joker
 * are five aces, the best hand in the game.
 */

export const JOKER = 52
export const DECK_SIZE = 53

export const FIVE_ACES = 9

const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']
const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const ACE = 12

export function codeOf(rank: Rank, suit: Suit): number {
  return RANKS.indexOf(rank) * 4 + SUITS.indexOf(suit)
}

/** "AS", "10H", "JK" — the shorthand the tests and the history use. */
export function parseCard(text: string): number {
  if (text === 'JK') return JOKER
  return codeOf(text.slice(0, -1) as Rank, text.slice(-1) as Suit)
}

export function cardText(code: number): string {
  return code === JOKER ? 'JK' : `${RANKS[code >> 2]}${SUITS[code & 3]}`
}

export function rankOf(code: number): Rank {
  return code === JOKER ? 'A' : RANKS[code >> 2]
}

export function suitOf(code: number): Suit {
  return code === JOKER ? 'S' : SUITS[code & 3]
}

/** The rank a card counts as when pairing: the joker is an ace. */
export function pairRank(code: number): number {
  return code === JOKER ? ACE : code >> 2
}

export interface HandRules {
  /**
   * A-2-3-4-5 as the second-best straight, under A-K-Q-J-10, the way some
   * older rooms still rank it. Off, the wheel is the lowest straight.
   */
  wheelSecond: boolean
}

export const DEFAULT_HAND_RULES: HandRules = { wheelSecond: false }

const P4 = 16 ** 4
const P3 = 16 ** 3

function pack(category: number, k: readonly number[]): number {
  let s = category
  for (let i = 0; i < 5; i++) s = s * 16 + (k[i] ?? 0)
  return s
}

export const FIVE_ACES_SCORE = pack(FIVE_ACES, [ACE])

export function categoryOf(s: number): number {
  return Math.floor(s / CATEGORY_SHIFT)
}

function primary(s: number): number {
  return Math.floor(s / P4) % 16
}

function secondary(s: number): number {
  return Math.floor(s / P3) % 16
}

/**
 * The wheel as the second-best straight: scored just above a king-high
 * straight (a king-high with an impossible 15 under it) and below the ace-high.
 */
function withWheel(s: number, rules: HandRules): number {
  if (!rules.wheelSecond) return s
  const c = categoryOf(s)
  if ((c === STRAIGHT || c === STRAIGHT_FLUSH) && primary(s) === 3) return pack(c, [11, 15])
  return s
}

function isWheelSecond(s: number): boolean {
  const c = categoryOf(s)
  return (c === STRAIGHT || c === STRAIGHT_FLUSH) && primary(s) === 11 && secondary(s) === 15
}

const five = new Int32Array(5)

function natural5(a: number, b: number, c: number, d: number, e: number, rules: HandRules): number {
  five[0] = a
  five[1] = b
  five[2] = c
  five[3] = d
  five[4] = e
  return withWheel(score(five, 5), rules)
}

/**
 * Score a five-card hand. With the joker in it, every card it could stand for
 * is tried, and a stand-in is allowed only if it is an ace or the hand it
 * makes is a straight, a flush or a straight flush.
 */
export function score5(cards: readonly number[], rules: HandRules = DEFAULT_HAND_RULES): number {
  const j = cards.indexOf(JOKER)
  if (j < 0) return natural5(cards[0], cards[1], cards[2], cards[3], cards[4], rules)
  const rest = cards.filter((_, i) => i !== j)
  if (rest.every((c) => c >> 2 === ACE)) return FIVE_ACES_SCORE

  let rankMask = 0
  let sameSuit = true
  for (const c of rest) {
    rankMask |= 1 << (c >> 2)
    if ((c & 3) !== (rest[0] & 3)) sameSuit = false
  }
  const has = (c: number) => rest[0] === c || rest[1] === c || rest[2] === c || rest[3] === c
  const distinct = popcount(rankMask) === 4
  let best = -1
  const tryAs = (c: number) => {
    if (has(c)) return
    const s = natural5(rest[0], rest[1], rest[2], rest[3], c, rules)
    const cat = categoryOf(s)
    if (c >> 2 === ACE || cat === STRAIGHT || cat === FLUSH || cat === STRAIGHT_FLUSH) {
      if (s > best) best = s
    }
  }
  // As an ace. The suit only matters if the other four are suited.
  for (let s = 0; s < 4; s++) {
    const ace = ACE * 4 + s
    if (has(ace)) continue
    if (sameSuit && s !== (rest[0] & 3)) continue
    tryAs(ace)
    if (!sameSuit) break
  }
  // To fill a flush: any card of the suit.
  if (sameSuit) for (let r = 0; r < ACE; r++) tryAs(r * 4 + (rest[0] & 3))
  // To fill a straight: any rank the four are missing, in any suit not held.
  if (distinct) {
    for (let r = 0; r < 13; r++) {
      if (rankMask & (1 << r)) continue
      for (let s = 0; s < 4; s++) {
        if (!has(r * 4 + s)) {
          tryAs(r * 4 + s)
          break
        }
      }
    }
  }
  return best
}

function popcount(x: number): number {
  let n = 0
  while (x) {
    x &= x - 1
    n++
  }
  return n
}

/** Score a two-card hand: a pair, or two high cards. The joker is an ace here. */
export function score2(a: number, b: number): number {
  const x = pairRank(a)
  const y = pairRank(b)
  if (x === y) return pack(PAIR, [x])
  return pack(HIGH_CARD, x > y ? [x, y] : [y, x])
}

export type PaiGowCategory =
  | 'fiveAces'
  | 'royal'
  | 'straightFlush'
  | 'quads'
  | 'fullHouse'
  | 'flush'
  | 'straight'
  | 'trips'
  | 'twoPair'
  | 'pair'
  | 'high'

const BY_NUMBER: PaiGowCategory[] = ['high', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush', 'fiveAces']

export function namedCategory(s: number): PaiGowCategory {
  const c = categoryOf(s)
  if (c === STRAIGHT_FLUSH && primary(s) === ACE) return 'royal'
  return BY_NUMBER[c]
}

export const CATEGORY_LABEL: Record<PaiGowCategory, string> = {
  fiveAces: 'Five aces',
  royal: 'Royal flush',
  straightFlush: 'Straight flush',
  quads: 'Four of a kind',
  fullHouse: 'Full house',
  flush: 'Flush',
  straight: 'Straight',
  trips: 'Three of a kind',
  twoPair: 'Two pair',
  pair: 'Pair',
  high: 'High card',
}

const WORD = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace']
const PLURAL = ['twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings', 'aces']
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Full house, kings over fours"; "Ace high" — the way a dealer reads a hand. */
export function handName(s: number, cards = 5): string {
  const a = primary(s)
  const b = secondary(s)
  if (isWheelSecond(s)) return categoryOf(s) === STRAIGHT ? 'Straight, five high' : 'Straight flush, five high'
  switch (namedCategory(s)) {
    case 'fiveAces':
      return 'Five aces'
    case 'royal':
      return 'Royal flush'
    case 'straightFlush':
      return `Straight flush, ${WORD[a]} high`
    case 'quads':
      return `Four ${PLURAL[a]}`
    case 'fullHouse':
      return `Full house, ${PLURAL[a]} over ${PLURAL[b]}`
    case 'flush':
      return `Flush, ${WORD[a]} high`
    case 'straight':
      return `Straight, ${WORD[a]} high`
    case 'trips':
      return `Three ${PLURAL[a]}`
    case 'twoPair':
      return `Two pair, ${PLURAL[a]} and ${PLURAL[b]}`
    case 'pair':
      return `Pair of ${PLURAL[a]}`
    default:
      // Two cards are read by both ranks; five by the top one.
      return cards === 2 ? `${cap(WORD[a])}-${WORD[b]}` : `${cap(WORD[a])} high`
  }
}

/** A hand's score is "pai gow": nothing — no pair, straight or flush. */
export function isPaiGow(s: number): boolean {
  return categoryOf(s) === HIGH_CARD
}

/** The top card of a pai gow hand, as a rank index (queen is 10). */
export function topRank(s: number): number {
  return primary(s)
}

export const QUEEN = 10
export { ACE as ACE_RANK }
