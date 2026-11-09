import { DEFAULT_HAND_RULES, JOKER, namedCategory, score5 } from './hands'

/**
 * Fortune Bonus: the side bet on every Strip pai gow table, paid on the
 * player's seven cards however they are set — and whether the main bet wins,
 * pushes, loses or fouls. Three of a kind or better pays; the joker plays as
 * it does in the game, an ace or the card that completes a straight or flush.
 */

export type FortuneHand =
  | 'natural7SF'
  | 'royalMatch'
  | 'joker7SF'
  | 'fiveAces'
  | 'royal'
  | 'straightFlush'
  | 'quads'
  | 'fullHouse'
  | 'flush'
  | 'trips'
  | 'straight'

/** Best first. */
export const FORTUNE_ORDER: FortuneHand[] = [
  'natural7SF',
  'royalMatch',
  'joker7SF',
  'fiveAces',
  'royal',
  'straightFlush',
  'quads',
  'fullHouse',
  'flush',
  'trips',
  'straight',
]

export const FORTUNE_LABEL: Record<FortuneHand, string> = {
  natural7SF: '7-card straight flush, no joker',
  royalMatch: 'Royal flush + royal match',
  joker7SF: '7-card straight flush with joker',
  fiveAces: 'Five aces',
  royal: 'Royal flush',
  straightFlush: 'Straight flush',
  quads: 'Four of a kind',
  fullHouse: 'Full house',
  flush: 'Flush',
  trips: 'Three of a kind',
  straight: 'Straight',
}

/** "To 1". The Fortune pay table posted on the Strip (the Wizard of Odds' table 1). */
export const FORTUNE_PAYS: Record<FortuneHand, number> = {
  natural7SF: 8_000,
  royalMatch: 2_000,
  joker7SF: 1_000,
  fiveAces: 400,
  royal: 150,
  straightFlush: 50,
  quads: 25,
  fullHouse: 5,
  flush: 4,
  trips: 3,
  straight: 2,
}

/**
 * Envy: with $5 or more on Fortune, a player is paid these flat amounts when
 * someone else at the table — dealer excluded — makes four of a kind or
 * better. Heads-up with the dealer there is nobody to envy, so it is shown
 * for reference and never paid.
 */
export const ENVY_MIN = 5
export const ENVY_PAYS: Partial<Record<FortuneHand, number>> = {
  natural7SF: 5_000,
  royalMatch: 1_000,
  joker7SF: 500,
  fiveAces: 250,
  royal: 50,
  straightFlush: 25,
  quads: 5,
}

const ACE = 12

/** Whether ranks (aces counted high and low) sit inside one run of seven. */
function inRunOfSeven(ranks: number[]): boolean {
  for (let start = -1; start <= 6; start++) {
    const end = start + 6
    if (ranks.every((r) => (r >= start && r <= end) || (r === ACE && start === -1))) return true
  }
  return false
}

function sevenCardStraightFlush(cards: readonly number[]): 'natural7SF' | 'joker7SF' | null {
  const natural = cards.filter((c) => c !== JOKER)
  const joker = natural.length < cards.length
  const suit = natural[0] & 3
  if (natural.some((c) => (c & 3) !== suit)) return null
  const ranks = natural.map((c) => c >> 2)
  if (new Set(ranks).size !== ranks.length) return null
  if (!inRunOfSeven(ranks)) return null
  return joker ? 'joker7SF' : 'natural7SF'
}

/** A royal flush in five of the seven, and the other two a natural suited king and queen. */
function royalMatch(cards: readonly number[]): boolean {
  const joker = cards.includes(JOKER)
  for (let s = 0; s < 4; s++) {
    const royal = [ACE, 11, 10, 9, 8].map((r) => r * 4 + s)
    const missing = royal.filter((c) => !cards.includes(c))
    if (missing.length > 1 || (missing.length === 1 && !joker)) continue
    const rest = cards.filter((c) => !royal.includes(c) && !(missing.length === 1 && c === JOKER))
    if (rest.length !== 2 || rest.includes(JOKER)) continue
    const [a, b] = rest
    if ((a & 3) !== (b & 3)) continue
    const r = [a >> 2, b >> 2].sort((x, y) => x - y)
    if (r[0] === 10 && r[1] === 11) return true
  }
  return false
}

/** The best five of seven, with the joker semi-wild. */
export function bestFive(cards: readonly number[]): number {
  let best = -1
  const pick: number[] = [0, 0, 0, 0, 0]
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++) {
      let k = 0
      for (let i = 0; i < 7; i++) if (i !== a && i !== b) pick[k++] = cards[i]
      const s = score5(pick, DEFAULT_HAND_RULES)
      if (s > best) best = s
    }
  return best
}

/** What the seven cards make for Fortune, or null if less than a straight. */
export function fortuneHand(cards: readonly number[]): FortuneHand | null {
  const seven = sevenCardStraightFlush(cards)
  if (seven === 'natural7SF') return seven
  if (royalMatch(cards)) return 'royalMatch'
  if (seven) return seven
  const category = namedCategory(bestFive(cards))
  switch (category) {
    case 'fiveAces':
    case 'royal':
    case 'straightFlush':
    case 'quads':
    case 'fullHouse':
    case 'flush':
    case 'trips':
    case 'straight':
      return category
    default:
      return null
  }
}

/**
 * How many of the 154,143,080 seven-card hands a 53-card deck holds make each
 * Fortune hand — every one of them counted: the 20,358,520 with the joker by
 * `fortuneHand` itself, the 133,784,560 without by the hold'em evaluator (whose
 * totals match the published seven-card counts) plus the two seven-card
 * specials. They agree with the Wizard of Odds' table to the hand. Fortune is
 * paid on nothing else, so its edge is exact.
 */
export const FORTUNE_COUNTS: Record<FortuneHand, number> = {
  natural7SF: 32,
  royalMatch: 72,
  joker7SF: 196,
  fiveAces: 1_128,
  royal: 26_020,
  straightFlush: 184_644,
  quads: 307_472,
  fullHouse: 4_188_528,
  flush: 6_172_088,
  trips: 7_470_676,
  straight: 11_236_028,
}

export const FORTUNE_TOTAL = 154_143_080

export function fortuneEdge(pays: Record<FortuneHand, number> = FORTUNE_PAYS): number {
  let ev = 0
  let paid = 0
  for (const hand of FORTUNE_ORDER) {
    ev += pays[hand] * FORTUNE_COUNTS[hand]
    paid += FORTUNE_COUNTS[hand]
  }
  ev -= FORTUNE_TOTAL - paid
  return -ev / FORTUNE_TOTAL
}
