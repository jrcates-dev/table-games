import type { Card, Rank, Suit } from '../types'

/**
 * Poker hands, ranked.
 *
 * Built for speed, because the coach evaluates a lot of them: deciding a river
 * exactly means scoring the dealer's 990 possible hole cards, and the flop
 * means a million. Cards are small integers — rank × 4 + suit, with deuce as
 * rank 0 and the ace as 12 — and a hand's score is one integer whose high bits
 * are its category and low bits its kickers, so comparing two hands is `>`.
 */

export const HIGH_CARD = 0
export const PAIR = 1
export const TWO_PAIR = 2
export const TRIPS = 3
export const STRAIGHT = 4
export const FLUSH = 5
export const FULL_HOUSE = 6
export const QUADS = 7
export const STRAIGHT_FLUSH = 8

export type Category = 'royal' | 'straightFlush' | 'quads' | 'fullHouse' | 'flush' | 'straight' | 'trips' | 'twoPair' | 'pair' | 'high'

const RANK_CHARS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const SUIT_CHARS: readonly Suit[] = ['S', 'H', 'D', 'C']

export function rankIndex(rank: Rank): number {
  return RANK_CHARS.indexOf(rank)
}

export function encode(card: Pick<Card, 'rank' | 'suit'>): number {
  return rankIndex(card.rank) * 4 + SUIT_CHARS.indexOf(card.suit)
}

export function decode(code: number): { rank: Rank; suit: Suit } {
  return { rank: RANK_CHARS[code >> 2], suit: SUIT_CHARS[code & 3] }
}

/** The top rank of the best straight in a 13-bit rank mask, or −1. The wheel is five-high. */
const STRAIGHT_TOP = new Int8Array(1 << 13).fill(-1)
for (let mask = 0; mask < 1 << 13; mask++) {
  for (let top = 12; top >= 4; top--) {
    const run = 0b11111 << (top - 4)
    if ((mask & run) === run) {
      STRAIGHT_TOP[mask] = top
      break
    }
  }
  const wheel = (1 << 12) | 0b1111
  if (STRAIGHT_TOP[mask] < 0 && (mask & wheel) === wheel) STRAIGHT_TOP[mask] = 3
}

const counts = new Int8Array(13)
const suitCount = new Int8Array(4)
const suitMask = new Int32Array(4)

function pack(category: number, k: readonly number[]): number {
  let score = category
  for (let i = 0; i < 5; i++) score = score * 16 + (k[i] ?? 0)
  return score
}

/** The highest `n` ranks set in a mask, best first. */
function topRanks(mask: number, n: number, out: number[]): number[] {
  for (let r = 12; r >= 0 && out.length < n; r--) if (mask & (1 << r)) out.push(r)
  return out
}

/**
 * Score the best five-card hand among `len` cards (five to seven). Higher is
 * better; equal is a split pot.
 */
export function score(cards: ArrayLike<number>, len = cards.length): number {
  counts.fill(0)
  suitCount.fill(0)
  suitMask.fill(0)
  let rankMask = 0
  for (let i = 0; i < len; i++) {
    const c = cards[i]
    const r = c >> 2
    const s = c & 3
    counts[r]++
    suitCount[s]++
    suitMask[s] |= 1 << r
    rankMask |= 1 << r
  }

  // A flush rules out quads and a full house in seven cards, so it is safe to
  // settle it first.
  for (let s = 0; s < 4; s++) {
    if (suitCount[s] >= 5) {
      const top = STRAIGHT_TOP[suitMask[s]]
      if (top >= 0) return pack(STRAIGHT_FLUSH, [top])
      return pack(FLUSH, topRanks(suitMask[s], 5, []))
    }
  }

  let quad = -1
  let trip1 = -1
  let trip2 = -1
  let pair1 = -1
  let pair2 = -1
  for (let r = 12; r >= 0; r--) {
    const n = counts[r]
    if (n === 4) quad = r
    else if (n === 3) {
      if (trip1 < 0) trip1 = r
      else if (trip2 < 0) trip2 = r
    } else if (n === 2) {
      if (pair1 < 0) pair1 = r
      else if (pair2 < 0) pair2 = r
    }
  }

  if (quad >= 0) return pack(QUADS, [quad, topRanks(rankMask & ~(1 << quad), 1, [])[0]])
  if (trip1 >= 0 && (trip2 >= 0 || pair1 >= 0)) return pack(FULL_HOUSE, [trip1, Math.max(trip2, pair1)])
  const straight = STRAIGHT_TOP[rankMask]
  if (straight >= 0) return pack(STRAIGHT, [straight])
  if (trip1 >= 0) return pack(TRIPS, [trip1, ...topRanks(rankMask & ~(1 << trip1), 2, [])])
  if (pair2 >= 0) return pack(TWO_PAIR, [pair1, pair2, topRanks(rankMask & ~(1 << pair1) & ~(1 << pair2), 1, [])[0]])
  if (pair1 >= 0) return pack(PAIR, [pair1, ...topRanks(rankMask & ~(1 << pair1), 3, [])])
  return pack(HIGH_CARD, topRanks(rankMask, 5, []))
}

export const CATEGORY_SHIFT = 16 ** 5

export function categoryOf(s: number): number {
  return Math.floor(s / CATEGORY_SHIFT)
}

/** The first kicker — the rank that names the hand. */
function primary(s: number): number {
  return Math.floor(s / 16 ** 4) % 16
}

function secondary(s: number): number {
  return Math.floor(s / 16 ** 3) % 16
}

export function namedCategory(s: number): Category {
  switch (categoryOf(s)) {
    case STRAIGHT_FLUSH:
      return primary(s) === 12 ? 'royal' : 'straightFlush'
    case QUADS:
      return 'quads'
    case FULL_HOUSE:
      return 'fullHouse'
    case FLUSH:
      return 'flush'
    case STRAIGHT:
      return 'straight'
    case TRIPS:
      return 'trips'
    case TWO_PAIR:
      return 'twoPair'
    case PAIR:
      return 'pair'
    default:
      return 'high'
  }
}

const RANK_WORD = ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace']
const RANK_PLURAL = ['twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings', 'aces']

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Full house, kings over fours" — the way a dealer reads a hand. */
export function handName(s: number): string {
  const a = primary(s)
  const b = secondary(s)
  switch (namedCategory(s)) {
    case 'royal':
      return 'Royal flush'
    case 'straightFlush':
      return `Straight flush, ${RANK_WORD[a]} high`
    case 'quads':
      return `Four ${RANK_PLURAL[a]}`
    case 'fullHouse':
      return `Full house, ${RANK_PLURAL[a]} over ${RANK_PLURAL[b]}`
    case 'flush':
      return `Flush, ${RANK_WORD[a]} high`
    case 'straight':
      return `Straight, ${RANK_WORD[a]} high`
    case 'trips':
      return `Three ${RANK_PLURAL[a]}`
    case 'twoPair':
      return `Two pair, ${RANK_PLURAL[a]} and ${RANK_PLURAL[b]}`
    case 'pair':
      return `Pair of ${RANK_PLURAL[a]}`
    default:
      return `${cap(RANK_WORD[a])} high`
  }
}

export const CATEGORY_LABEL: Record<Category, string> = {
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

export interface HandInfo {
  score: number
  category: Category
  name: string
  /** The five cards that make the hand, by index into the cards given. */
  best: number[]
}

/** Score a hand and find which five cards make it — for the felt, not for the coach's loops. */
export function describe(cards: readonly Pick<Card, 'rank' | 'suit'>[]): HandInfo {
  const codes = cards.map(encode)
  const s = score(codes)
  let best = codes.map((_, i) => i).slice(0, 5)
  if (codes.length > 5) {
    // The first five-card subset that scores the same as all seven. Among
    // equal subsets prefer ones using fewer kickers that do not play — which
    // the scoring already guarantees, since a kicker is part of the score.
    const n = codes.length
    outer: for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++)
        for (let c = b + 1; c < n; c++)
          for (let d = c + 1; d < n; d++)
            for (let e = d + 1; e < n; e++) {
              if (score([codes[a], codes[b], codes[c], codes[d], codes[e]]) === s) {
                best = [a, b, c, d, e]
                break outer
              }
            }
  }
  return { score: s, category: namedCategory(s), name: handName(s), best }
}
