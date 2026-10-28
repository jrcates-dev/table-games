import { availableActions } from './blackjack'
import { rankValue } from './cards'
import type { Card, GameState, PlayerAction, RuleSet } from './types'

/**
 * What each play is worth.
 *
 * The expected result of every legal action on the hand being played, as a
 * fraction of that hand's bet: +0.10 wins a dime on the dollar in the long
 * run, −0.50 is what surrendering always costs. Doubling and splitting put
 * more money out, and their figures count all of it against the one original
 * bet, the way every published table quotes them.
 *
 * The arithmetic is composition-dependent and exact for hitting, standing and
 * doubling: the cards that can come are a fresh shoe of the table's size less
 * every card on the felt, and each card the player or the dealer draws comes
 * out of what is left. The dealer plays by the table's soft-17 rule, and when
 * the dealer has peeked and shown no natural, the hole card is known not to
 * make one. Play after the first decision is assumed to be the best possible
 * for the exact cards held.
 *
 * Splitting is the one place an exact answer is out of reach — every box
 * changes what the next can draw — so it is worked out the established way,
 * and lands within a twentieth of a percent of the exact tables: each box is
 * priced exactly for the cards left once the pair is split, and resplits are
 * counted from the chance of catching another of the pair.
 */

/** The plays a hand can make once it is the player's turn. */
export type Decision = 'hit' | 'stand' | 'double' | 'split' | 'surrender'

export type DecisionEvs = Partial<Record<Decision, number>>

export const DECISIONS: readonly Decision[] = ['hit', 'stand', 'double', 'split', 'surrender']

export interface DecisionSpot {
  /** The cards in the hand being played. */
  cards: readonly Card[]
  upcard: Card
  rules: RuleSet
  /** What the engine will accept right now; anything else gets no figure. */
  legal: readonly PlayerAction[]
  /** Every other card on the felt this round, such as the other split boxes. */
  seen?: readonly Card[]
  /** Boxes in play, this one included. A split adds one, up to the table's cap. */
  boxes?: number
}

/** Aces are 1 here and become 11 in the total; every ten-valued card is a 10. */
function cardValue(card: Card): number {
  return card.rank === 'A' ? 1 : rankValue(card.rank)
}

/** A multiset of drawn values packs into one number: four bits per value. */
const KEY = [0, 1, 16, 256, 4096, 65536, 1048576, 16777216, 268435456, 4294967296, 68719476736]

function bestTotal(sum: number, ace: boolean): number {
  return ace && sum <= 11 ? sum + 10 : sum
}

/** Whether the table lets a two-card hand double, by its total alone. */
function canDouble(rules: RuleSet, sum: number, ace: boolean): boolean {
  if (rules.doubleOn === 'any') return true
  if (ace && sum <= 11) return false
  return sum >= (rules.doubleOn === '9-11' ? 9 : 10) && sum <= 11
}

/**
 * Every way the dealer's hand can go from one upcard, as a graph of states.
 *
 * A state is the set of cards drawn so far — order does not matter once the
 * cards are out — and each card value leads either to another state or to an
 * end: a standing total, a bust, or (from the hole card only) a natural. The
 * shape is the same whatever is left in the shoe, so it is built once per
 * upcard and soft-17 rule, and pricing the dealer for a given shoe is one pass
 * over flat arrays.
 */
interface DealerGraph {
  states: number
  /** Cards each state holds beyond the upcard: eleven slots a state, by value. */
  held: Uint8Array
  size: Uint8Array
  /** By state and value, the next state, or an end encoded as −1 − outcome. */
  next: Int32Array
}

// Positions in a dealer outcome: 0–4 for 17–21, 5 for a bust, 6 for a natural.
const BUST = 5
const NATURAL = 6

const graphs = new Map<string, DealerGraph>()

function dealerGraph(up: number, hitsSoft17: boolean): DealerGraph {
  const id = `${up}:${hitsSoft17}`
  const known = graphs.get(id)
  if (known) return known

  const held: number[][] = [new Array(11).fill(0)]
  const sums = [up]
  const next: number[] = []
  const index = new Map<number, number>([[0, 0]])
  const keys = [0]

  for (let s = 0; s < held.length; s++) {
    for (let v = 1; v <= 10; v++) {
      const sum = sums[s] + v
      const ace = up === 1 || v === 1 || held[s][1] > 0
      const total = bestTotal(sum, ace)
      const soft = ace && sum <= 11
      let to: number
      if (sum > 21) to = -1 - BUST
      else if (s === 0 && total === 21) to = -1 - NATURAL
      else if (total > 17 || (total === 17 && !(soft && hitsSoft17))) to = -1 - (total - 17)
      else {
        const key = keys[s] + KEY[v]
        let child = index.get(key)
        if (child === undefined) {
          child = held.length
          index.set(key, child)
          keys.push(key)
          const cards = held[s].slice()
          cards[v]++
          held.push(cards)
          sums.push(sum)
        }
        to = child
      }
      next[s * 11 + v] = to
    }
  }

  const graph: DealerGraph = {
    states: held.length,
    held: Uint8Array.from(held.flat()),
    size: Uint8Array.from(held.map((cards) => cards.reduce((a, b) => a + b, 0))),
    next: Int32Array.from({ length: held.length * 11 }, (_, i) => next[i] ?? 0),
  }
  graphs.set(id, graph)
  return graph
}

/**
 * One decision's worth of arithmetic, over the cards not yet seen.
 *
 * Values are carried "weighted": the payoff times the chance the dealer has no
 * natural, which is what the peek has already ruled out. Weighting rather than
 * conditioning at every step keeps the sum honest — a hand that draws a ten
 * leaves fewer tens for the hole card, so a natural becomes a touch less
 * likely — and dividing once at the end by the same chance from the starting
 * cards gives the expectation the player actually faces.
 */
class Analysis {
  private readonly counts: number[]
  private left: number
  /** The dealer has already looked under this upcard and found no natural. */
  private readonly peeked: boolean
  /** The hole card that would have made a natural. */
  private readonly natural: number
  private readonly graph: DealerGraph
  private readonly scratch: Float64Array
  /**
   * Both memos are keyed by the cards gone from the first shoe analysed, so a
   * thinner shoe made by `without` can share them: its own draws plus what it
   * started without land on the same key as the same shoe reached by drawing.
   */
  private readonly offset: number
  private readonly dealerMemo: Map<number, Float64Array>
  private readonly bestMemo: Map<number, number>

  constructor(rules: RuleSet, up: number, counts: number[], from?: Analysis, offset = 0) {
    this.counts = counts
    this.left = counts.reduce((sum, n) => sum + n, 0)
    this.natural = up === 1 ? 10 : up === 10 ? 1 : 0
    this.peeked = rules.dealerPeek && this.natural !== 0
    this.graph = from?.graph ?? dealerGraph(up, rules.dealerHitsSoft17)
    this.scratch = from?.scratch ?? new Float64Array(this.graph.states * 7)
    this.offset = offset
    this.dealerMemo = from?.dealerMemo ?? new Map()
    this.bestMemo = from?.bestMemo ?? new Map()
  }

  /** The same shoe with `k` more cards of value `v` gone. */
  without(rules: RuleSet, up: number, v: number, k: number): Analysis {
    const counts = this.counts.slice()
    counts[v] -= k
    return new Analysis(rules, up, counts, this, this.offset + k * KEY[v])
  }

  /** The chance the hole card does not make a natural, from what is left now. */
  noNatural(): number {
    return this.peeked ? 1 - this.counts[this.natural] / this.left : 1
  }

  /**
   * How the dealer's hand ends — 17 to 21, bust, or a natural — given the
   * player has drawn `drawn` beyond the starting cards. Every composition gets
   * its own dealer, worked out once.
   */
  private dealer(drawn: number): Float64Array {
    const key = drawn + this.offset
    let outcome = this.dealerMemo.get(key)
    if (!outcome) {
      outcome = this.dealerFromHere()
      this.dealerMemo.set(key, outcome)
    }
    return outcome
  }

  private dealerFromHere(): Float64Array {
    const { counts, left } = this
    const { size, held, next, states } = this.graph
    const out = this.scratch
    // Children always come after their parents, so working backwards every
    // state's children are done before it is.
    for (let s = states - 1; s >= 0; s--) {
      const row = s * 11
      const cards = left - size[s]
      const at = s * 7
      for (let i = 0; i < 7; i++) out[at + i] = 0
      if (cards <= 0) continue
      for (let v = 1; v <= 10; v++) {
        const n = counts[v] - held[row + v]
        if (n <= 0) continue
        const p = n / cards
        const to = next[row + v]
        if (to < 0) {
          out[at - to - 1] += p
        } else {
          const from = to * 7
          for (let i = 0; i < 6; i++) out[at + i] += p * out[from + i]
        }
      }
    }
    return out.slice(0, 7)
  }

  /** The dealer's odds from the shoe as it stands, as the player sees them. */
  dealerOutcome(): DealerOdds {
    const d = this.dealer(0)
    const scale = this.peeked ? 1 / this.noNatural() : 1
    return {
      totals: [0, 1, 2, 3, 4].map((i) => d[i] * scale),
      bust: d[BUST] * scale,
      natural: this.peeked ? 0 : d[NATURAL],
    }
  }

  /** Standing on `total`. A natural the dealer was not checked for still beats it. */
  stand(total: number, drawn: number): number {
    const d = this.dealer(drawn)
    let ev = d[BUST]
    for (let t = 17; t <= 21; t++) {
      if (total > t) ev += d[t - 17]
      else if (total < t) ev -= d[t - 17]
    }
    return this.peeked ? ev : ev - d[NATURAL]
  }

  private bust(): number {
    return -this.noNatural()
  }

  /** The better of standing and hitting, for a hand past its first decision. */
  private best(sum: number, ace: boolean, drawn: number): number {
    const memoKey = (drawn + this.offset) * 64 + sum * 2 + (ace ? 1 : 0)
    const known = this.bestMemo.get(memoKey)
    if (known !== undefined) return known
    const total = bestTotal(sum, ace)
    let ev = this.stand(total, drawn)
    if (total < 21) ev = Math.max(ev, this.hit(sum, ace, drawn))
    this.bestMemo.set(memoKey, ev)
    return ev
  }

  /** Take one card, then play on as well as possible. */
  hit(sum: number, ace: boolean, drawn: number): number {
    const { counts } = this
    const left = this.left
    let ev = 0
    for (let v = 1; v <= 10; v++) {
      const n = counts[v]
      if (n === 0) continue
      counts[v]--
      this.left--
      const s = sum + v
      ev += (n / left) * (s > 21 ? this.bust() : this.best(s, ace || v === 1, drawn + KEY[v]))
      counts[v]++
      this.left++
    }
    return ev
  }

  /** Double the bet, take exactly one card, and stand. */
  double(sum: number, ace: boolean, drawn: number): number {
    const { counts } = this
    const left = this.left
    let ev = 0
    for (let v = 1; v <= 10; v++) {
      const n = counts[v]
      if (n === 0) continue
      counts[v]--
      this.left--
      const s = sum + v
      const a = ace || v === 1
      ev += (n / left) * (s > 21 ? this.bust() : this.stand(bestTotal(s, a), drawn + KEY[v]))
      counts[v]++
      this.left++
    }
    return 2 * ev
  }

  /**
   * One split box once it has caught `second`, played as well as the rules
   * allow. Split aces get their one card and stand unless the table lets
   * them be hit; any other box may double only with double after split.
   */
  private splitBox(pair: number, second: number, rules: RuleSet): number {
    const drawn = KEY[second]
    const sum = pair + second
    const ace = pair === 1 || second === 1
    const total = bestTotal(sum, ace)
    let ev = this.stand(total, drawn)
    if (total === 21 || (pair === 1 && !rules.hitSplitAces)) return ev
    ev = Math.max(ev, this.hit(sum, ace, drawn))
    if (rules.doubleAfterSplit && canDouble(rules, sum, ace)) ev = Math.max(ev, this.double(sum, ace, drawn))
    return ev
  }

  /**
   * What one split box is worth from this shoe: E if its second card is
   * anything but another of the pair, and P if it catches one and has to be
   * played as it stands.
   */
  splitBoxes(pair: number, rules: RuleSet): { unpaired: number; paired: number } {
    const { counts } = this
    const left = this.left

    let other = 0
    let otherWeight = 0
    for (let v = 1; v <= 10; v++) {
      const n = counts[v]
      if (n === 0 || v === pair) continue
      counts[v]--
      this.left--
      other += (n / left) * this.splitBox(pair, v, rules)
      otherWeight += (n / left) * this.noNatural()
      counts[v]++
      this.left++
    }

    let paired = 0
    if (counts[pair] > 0) {
      counts[pair]--
      this.left--
      paired = this.splitBox(pair, pair, rules) / this.noNatural()
      counts[pair]++
      this.left++
    }

    return { unpaired: otherWeight > 0 ? other / otherWeight : 0, paired }
  }
}

/**
 * Splitting a pair of `pair` from the shoe `counts`, with room to resplit
 * `resplits` more times.
 *
 * Each box is worth E or P (see `splitBoxes`), and with room left a matching
 * card opens another box instead of being played. Summing over how the boxes
 * can fall gives the total, counted against the one original bet. Every pair
 * card caught thins the shoe of them for the boxes still to come, which
 * matters most for tens, so E and P are priced again for each one taken out.
 */
function splitValue(analysis: Analysis, rules: RuleSet, up: number, counts: number[], pair: number, resplits: number): number {
  const prices: Array<{ unpaired: number; paired: number }> = []
  for (let caught = 0; caught <= resplits && counts[pair] - caught >= 0; caught++) {
    prices.push(analysis.without(rules, up, pair, caught).splitBoxes(pair, rules))
  }

  // `boxes` still waiting for a second card, `caught` pair cards dealt to them so far.
  const total = (boxes: number, room: number, caught: number, pairs: number, cards: number): number => {
    if (boxes === 0) return 0
    const { unpaired, paired } = prices[Math.min(caught, prices.length - 1)]
    const q = cards > 0 ? pairs / cards : 0
    const onPair =
      room > 0
        ? total(boxes + 1, room - 1, caught + 1, pairs - 1, cards - 1)
        : paired + total(boxes - 1, 0, caught + 1, pairs - 1, cards - 1)
    return q * onPair + (1 - q) * (unpaired + total(boxes - 1, room, caught, pairs, cards - 1))
  }
  return total(2, resplits, 0, counts[pair], counts.reduce((sum, n) => sum + n, 0))
}

/** The shoe the table deals from, less the cards already showing. */
function unseen(decks: number, showing: readonly Card[]): number[] {
  const counts = [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 16].map((n) => n * decks)
  for (const card of showing) {
    const v = cardValue(card)
    if (counts[v] > 0) counts[v]--
  }
  return counts
}

export interface DealerOdds {
  /** The chance of finishing on 17, 18, 19, 20 and 21, in that order. */
  totals: number[]
  bust: number
  /** Zero once the dealer has peeked under an ace or ten and found nothing. */
  natural: number
}

/** How the dealer's hand will end from this upcard, with `seen` out of the shoe. */
export function dealerOdds(upcard: Card, rules: RuleSet, seen: readonly Card[] = []): DealerOdds {
  const analysis = new Analysis(rules, cardValue(upcard), unseen(rules.decks, [upcard, ...seen]))
  const { totals, bust, natural } = analysis.dealerOutcome()
  return { totals, bust, natural }
}

/** The expected result of each legal play on this hand, per unit of its bet. */
export function decisionEvs(spot: DecisionSpot): DecisionEvs {
  const { cards, upcard, rules, legal } = spot
  const evs: DecisionEvs = {}
  if (cards.length === 0) return evs

  const counts = unseen(rules.decks, [...cards, upcard, ...(spot.seen ?? [])])
  const analysis = new Analysis(rules, cardValue(upcard), counts)
  // Everything is weighted by the chance of no dealer natural; this undoes it.
  const norm = analysis.noNatural()
  const sum = cards.reduce((total, card) => total + cardValue(card), 0)
  const ace = cards.some((card) => card.rank === 'A')

  for (const action of DECISIONS) {
    if (!legal.includes(action)) continue
    switch (action) {
      case 'stand':
        evs.stand = analysis.stand(bestTotal(sum, ace), 0) / norm
        break
      case 'hit':
        evs.hit = analysis.hit(sum, ace, 0) / norm
        break
      case 'double':
        evs.double = analysis.double(sum, ace, 0) / norm
        break
      case 'surrender':
        // Half back, always: after the peek, or with no natural to fear.
        evs.surrender = -0.5
        break
      case 'split': {
        const pair = cardValue(cards[0])
        const room = Math.max(0, rules.maxSplitHands - (spot.boxes ?? 1) - 1)
        evs.split = splitValue(analysis, rules, cardValue(upcard), counts, pair, pair === 1 && !rules.resplitAces ? 0 : room)
        break
      }
    }
  }
  return evs
}

/** The same, for whichever hand is being played at this table right now. */
export function currentDecisionEvs(game: GameState): DecisionEvs | null {
  const { round } = game
  const hand = round.hands[round.activeHandIndex]
  const upcard = round.dealer[0]
  if (round.phase !== 'playerTurn' || !hand || !upcard) return null
  return decisionEvs({
    cards: hand.cards,
    upcard,
    rules: game.rules,
    legal: availableActions(game),
    seen: round.hands.filter((other) => other !== hand).flatMap((other) => other.cards),
    boxes: round.hands.length,
  })
}

/** The play worth the most, of those with a figure. */
export function bestDecision(evs: DecisionEvs): Decision | null {
  let best: Decision | null = null
  for (const action of DECISIONS) {
    const ev = evs[action]
    if (ev !== undefined && (best === null || ev > (evs[best] as number))) best = action
  }
  return best
}
