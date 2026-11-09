import { DEFAULT_HAND_RULES, JOKER, pairRank, type HandRules } from './hands'
import { allSets, isStraightOrFlush, setHand, type SetHand } from './split'
import { categoryOf } from './hands'
import { PAIR } from '../uth/poker'

/**
 * The house way: how the dealer sets a hand, and what the coach recommends.
 *
 * Every Strip room sets the dealer's hand by a fixed, written way, and lets a
 * player ask for theirs to be set the same way. Aria does not publish its own,
 * so this is the common Las Vegas way, the one the Wizard of Odds lays out:
 * written here as a list of rules, tried in order, each saying which hands it
 * covers and which two cards go in the low hand. The book prints the same
 * list, so what the dealer does and what the book says can never drift apart.
 *
 * Ranks are counted with the joker as an ace (it pairs with aces); a straight
 * or flush it completes is found separately, by setting every way and looking
 * at the high hand.
 */

export interface Group {
  rank: number
  /** Indices into the seven, natural aces before the joker. */
  idx: number[]
}

export interface Analysis {
  cards: readonly number[]
  rules: HandRules
  fives: Group[]
  quads: Group[]
  trips: Group[]
  pairs: Group[]
  /** Unpaired cards, highest first. The joker is an ace here. */
  singles: number[]
  /** Every legal set whose high hand is a straight, flush or straight flush. */
  sf: SetHand[]
}

export function analyse(cards: readonly number[], rules: HandRules = DEFAULT_HAND_RULES): Analysis {
  const byRank = new Map<number, number[]>()
  cards.forEach((c, i) => {
    const r = pairRank(c)
    byRank.set(r, [...(byRank.get(r) ?? []), i])
  })
  const groups: Group[] = [...byRank.entries()]
    .map(([rank, idx]) => ({ rank, idx: [...idx].sort((x, y) => Number(cards[x] === JOKER) - Number(cards[y] === JOKER)) }))
    .sort((a, b) => b.rank - a.rank)
  const of = (n: number) => groups.filter((g) => g.idx.length === n)
  const singles = of(1).map((g) => g.idx[0])
  const sf = allSets(cards, rules).filter((s) => s.legal && isStraightOrFlush(s.highScore))
  return { cards, rules, fives: of(5), quads: of(4), trips: of(3), pairs: of(2), singles, sf }
}

export interface HouseWayRule {
  id: string
  /** The hand it covers, as the book heads it. */
  hand: string
  /** What goes where, in plain English. */
  way: string
  applies(a: Analysis): boolean
  /** The two cards for the low hand. */
  low(a: Analysis): number[]
}

const ACE = 12
const KING = 11
const JACK = 9
const TEN = 8
const SEVEN = 5
const SIX = 4
const TWO = 0

const hasSingle = (a: Analysis, min: number) => a.singles.some((i) => pairRank(a.cards[i]) >= min)
const topSingles = (a: Analysis) => a.singles.slice(0, 2)
/** Two cards of a group, natural ones first. */
const two = (g: Group) => g.idx.slice(0, 2)
/** The straight or flush in the high hand that leaves the best low hand behind it. */
function bestStraightOrFlush(sets: SetHand[]): number[] {
  const best = [...sets].sort((x, y) => y.lowScore - x.lowScore || y.highScore - x.highScore)[0]
  return best.low
}
const withPairLow = (a: Analysis) => a.sf.filter((s) => categoryOf(s.lowScore) === PAIR)

const counts = (a: Analysis) => ({ quads: a.quads.length, trips: a.trips.length, pairs: a.pairs.length })

/**
 * The house way, in the order the dealer reads it. The first rule that covers
 * the hand decides it.
 */
export const HOUSE_WAY: HouseWayRule[] = [
  {
    id: 'five-aces',
    hand: 'Five aces',
    way: 'Split: a pair of aces in the low hand, three aces in the high — unless there is a pair of kings, which goes in the low hand instead.',
    applies: (a) => a.fives.length > 0,
    low: (a) => {
      const kings = a.pairs.find((g) => g.rank === KING)
      return kings ? two(kings) : two(a.fives[0])
    },
  },
  {
    id: 'quads-plus',
    hand: 'Four of a kind with a pair or three of a kind',
    way: 'The four stay together in the high hand; the pair (or two of the three) goes in the low.',
    applies: (a) => counts(a).quads > 0 && counts(a).pairs + counts(a).trips > 0,
    low: (a) => two([...a.trips, ...a.pairs].sort((x, y) => y.rank - x.rank)[0]),
  },
  {
    id: 'quads-low',
    hand: 'Four of a kind, 2s to 6s',
    way: 'Never split. The two highest other cards go in the low hand.',
    applies: (a) => a.quads.length > 0 && a.quads[0].rank <= SIX,
    low: topSingles,
  },
  {
    id: 'quads-mid',
    hand: 'Four of a kind, 7s to 10s',
    way: 'Keep them together if an ace or a king can go in the low hand; otherwise split them into two pairs.',
    applies: (a) => a.quads.length > 0 && a.quads[0].rank <= TEN,
    low: (a) => (hasSingle(a, KING) ? topSingles(a) : two(a.quads[0])),
  },
  {
    id: 'quads-high',
    hand: 'Four of a kind, jacks to kings',
    way: 'Keep them together if an ace can go in the low hand; otherwise split them into two pairs.',
    applies: (a) => a.quads.length > 0 && a.quads[0].rank < ACE,
    low: (a) => (hasSingle(a, ACE) ? topSingles(a) : two(a.quads[0])),
  },
  {
    id: 'quad-aces',
    hand: 'Four aces',
    way: 'Always split: a pair of aces in each hand.',
    applies: (a) => a.quads.length > 0,
    low: (a) => two(a.quads[0]),
  },
  {
    id: 'two-trips',
    hand: 'Two three of a kinds',
    way: 'A pair from the higher three goes in the low hand; the lower three stay in the high.',
    applies: (a) => a.trips.length >= 2,
    low: (a) => two(a.trips[0]),
  },
  {
    id: 'trips-two-pair',
    hand: 'Three of a kind and two pair',
    way: 'The higher pair goes in the low hand; the full house — the three and the lower pair — in the high.',
    applies: (a) => a.trips.length === 1 && a.pairs.length >= 2,
    low: (a) => two(a.pairs[0]),
  },
  {
    id: 'full-house',
    hand: 'Full house',
    way: 'Split: the pair in the low hand, the three in the high. Only with a pair of 2s and both an ace and a king to play in front does it stay together.',
    applies: (a) => a.trips.length === 1 && a.pairs.length === 1,
    low: (a) => {
      const pair = a.pairs[0]
      if (pair.rank === TWO && hasSingle(a, ACE) && a.singles.filter((i) => pairRank(a.cards[i]) >= KING).length >= 2) return topSingles(a)
      return two(pair)
    },
  },
  {
    id: 'trips-sf',
    hand: 'Three of a kind with a straight or flush',
    way: 'The straight or flush goes in the high hand, with a pair from the three in the low.',
    applies: (a) => a.trips.length === 1 && withPairLow(a).length > 0,
    low: (a) => bestStraightOrFlush(withPairLow(a)),
  },
  {
    id: 'trip-aces',
    hand: 'Three aces',
    way: 'Split: a pair of aces in the high hand, the third ace and the next-highest card in the low.',
    applies: (a) => a.trips.length === 1 && a.trips[0].rank === ACE,
    low: (a) => [a.trips[0].idx[0], a.singles[0]],
  },
  {
    id: 'trips',
    hand: 'Three of a kind',
    way: 'Keep it together in the high hand; the two highest other cards go in the low.',
    applies: (a) => a.trips.length === 1,
    low: topSingles,
  },
  {
    id: 'three-pair',
    hand: 'Three pair',
    way: 'The highest pair goes in the low hand; the other two stay together in the high.',
    applies: (a) => a.pairs.length >= 3,
    low: (a) => two(a.pairs[0]),
  },
  {
    id: 'two-pair-sf',
    hand: 'Two pair with a straight or flush',
    way: 'Play the straight or flush in the high hand if one of the pairs can still go in the low; otherwise play the two pair.',
    applies: (a) => a.pairs.length === 2 && withPairLow(a).length > 0,
    low: (a) => bestStraightOrFlush(withPairLow(a)),
  },
  {
    id: 'two-pair-high',
    hand: 'Two pair, aces or jacks and up',
    way: 'Always split: the higher pair in the high hand, the lower pair in the low.',
    applies: (a) => a.pairs.length === 2 && a.pairs[0].rank >= JACK,
    low: (a) => two(a.pairs[1]),
  },
  {
    id: 'two-pair-mid',
    hand: 'Two pair, 7s to 10s high',
    way: 'Split, unless there is an ace to play in the low hand — then both pairs stay in the high.',
    applies: (a) => a.pairs.length === 2 && a.pairs[0].rank >= SEVEN,
    low: (a) => (hasSingle(a, ACE) ? topSingles(a) : two(a.pairs[1])),
  },
  {
    id: 'two-pair-low',
    hand: 'Two pair, 6s and under',
    way: 'Keep both pairs in the high hand if an ace or a king can go in the low; otherwise split.',
    applies: (a) => a.pairs.length === 2,
    low: (a) => (hasSingle(a, KING) ? topSingles(a) : two(a.pairs[1])),
  },
  {
    id: 'pair-sf',
    hand: 'One pair with a straight or flush',
    way: 'The straight or flush goes in the high hand, with the pair in the low if it fits; otherwise the best two cards left.',
    applies: (a) => a.pairs.length === 1 && a.sf.length > 0,
    low: (a) => bestStraightOrFlush(withPairLow(a).length > 0 ? withPairLow(a) : a.sf),
  },
  {
    id: 'sf',
    hand: 'Straight, flush or straight flush',
    way: 'Play it in the high hand. With a choice of five, keep the one that leaves the best two cards for the low.',
    applies: (a) => a.pairs.length === 0 && a.sf.length > 0,
    low: (a) => bestStraightOrFlush(a.sf),
  },
  {
    id: 'one-pair',
    hand: 'One pair',
    way: 'The pair goes in the high hand; the two highest other cards in the low.',
    applies: (a) => a.pairs.length === 1,
    low: topSingles,
  },
  {
    id: 'pai-gow',
    hand: 'Pai gow (nothing)',
    way: 'The highest card stays in the high hand; the second- and third-highest go in the low.',
    applies: () => true,
    low: (a) => [a.singles[1], a.singles[2]],
  },
]

export interface HouseWaySet {
  set: SetHand
  rule: HouseWayRule
}

/** Set seven cards the house way. */
export function houseWay(cards: readonly number[], rules: HandRules = DEFAULT_HAND_RULES): HouseWaySet {
  const a = analyse(cards, rules)
  const rule = HOUSE_WAY.find((r) => r.applies(a))!
  const set = setHand(cards, rule.low(a), rules)
  if (set.legal) return { set, rule }
  // Never reached by the rules above (the tests deal a few hundred thousand
  // hands to make sure), but a dealer never fouls.
  const best = allSets(cards, rules)
    .filter((s) => s.legal)
    .sort((x, y) => y.highScore - x.highScore || y.lowScore - x.lowScore)[0]
  return { set: best, rule }
}
