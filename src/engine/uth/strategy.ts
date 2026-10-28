import type { Card } from '../types'
import { categoryOf, encode, handName, namedCategory, PAIR, score, TWO_PAIR } from './poker'
import { BLIND_PAYS } from './rules'
import type { UthDecision } from './types'

/**
 * The coach for Ultimate Texas Hold'em.
 *
 * Before the flop the coach teaches the Wizard of Odds' chart, which is the
 * optimal one: an exhaustive count of every board and dealer hand agrees with
 * it on all 169 starting hands. On the flop it works the call out exactly —
 * every turn, river and dealer hand — off the main thread, and falls back on
 * the Wizard's simple flop rule until the answer is in. On the river it scores
 * all 990 hands the dealer could hold. Played that way the coach is perfect
 * play: 2.185% of the Ante. Every EV here is in units of the Ante and counts
 * the Ante, Blind and Play together — never Trips, which no decision changes.
 */

export type Street = 'preflop' | 'flop' | 'river'

export interface UthAdvice {
  street: Street
  decision: UthDecision
  /** "Raise 4x", "Check", "Fold". */
  headline: string
  /** Why, in a sentence a dealer would say. */
  reason: string
  /** Exact EV of each choice, in Antes, when the coach has worked it out. */
  evs?: Partial<Record<UthDecision, number>>
  /** River only: the unseen cards that, with the board, beat you on their own. */
  outs?: number
}

type CardLike = Pick<Card, 'rank' | 'suit'>

const rankOf = (code: number) => code >> 2
const suitOf = (code: number) => code & 3

const DEUCE = 0
const THREE = 1
const FOUR = 2
const FIVE = 3
const SIX = 4
const SEVEN = 5
const EIGHT = 6
const TEN = 8
const JACK = 9
const QUEEN = 10
const KING = 11
const ACE = 12

/** The pre-flop chart: raise 4x or check. 3x is never right — a hand worth raising is worth the most. */
export function preflopAdvice(hole: readonly CardLike[]): UthAdvice {
  const [x, y] = hole.map(encode)
  const hi = Math.max(rankOf(x), rankOf(y))
  const lo = Math.min(rankOf(x), rankOf(y))
  const suited = suitOf(x) === suitOf(y)
  const raise = (reason: string): UthAdvice => ({ street: 'preflop', decision: 'bet4', headline: 'Raise 4x', reason })
  const check = (reason: string): UthAdvice => ({ street: 'preflop', decision: 'check', headline: 'Check', reason })

  if (hi === lo) {
    return lo >= THREE
      ? raise('Any pair from threes up raises 4x.')
      : check('Pocket deuces are the one pair that checks: too often the board plays over them.')
  }
  if (hi === ACE) return raise('Any ace raises 4x.')
  if (hi === KING) {
    if (suited || lo >= FIVE) return raise('A king raises 4x with any suited card, or with a five or better offsuit.')
    return check('A king raises with any suited card, but offsuit it needs a five or better beside it.')
  }
  if (hi === QUEEN) {
    if (suited ? lo >= SIX : lo >= EIGHT) return raise('A queen raises 4x with a six or better suited, or an eight or better offsuit.')
    return check(`A queen needs ${suited ? 'a six or better suited' : 'an eight or better offsuit'} to raise.`)
  }
  if (hi === JACK) {
    if (suited ? lo >= EIGHT : lo >= TEN) return raise('A jack raises 4x with an eight or better suited, or a ten offsuit.')
    return check(`A jack needs ${suited ? 'an eight or better suited' : 'a ten offsuit'} to raise.`)
  }
  return check('Too weak to raise 4x. Check, and see the flop for nothing.')
}

/**
 * The raising hands still worth 3x when the rack will not cover 4x: all of the
 * chart but K2s–K3s, K5o–K6o, Q6s–Q7s, Q8o–Q9o, J8s–J9s and JTo, which are
 * raises only because 4x pays that much more than 3x. From an exhaustive count
 * of every board and dealer hand.
 */
function threeXStillRaises(hole: readonly CardLike[]): boolean {
  const [x, y] = hole.map(encode)
  const hi = Math.max(rankOf(x), rankOf(y))
  const lo = Math.min(rankOf(x), rankOf(y))
  const suited = suitOf(x) === suitOf(y)
  if (hi === lo) return lo >= THREE
  if (hi === ACE) return true
  if (hi === KING) return suited ? lo >= FOUR : lo >= SEVEN
  if (hi === QUEEN) return suited ? lo >= EIGHT : lo >= TEN
  if (hi === JACK) return suited && lo >= TEN
  return false
}

/** The flop rule: bet 2x on a real hand or a strong flush draw, otherwise check. */
export function flopAdvice(hole: readonly CardLike[], flop: readonly CardLike[]): UthAdvice {
  const h = hole.map(encode)
  const b = flop.map(encode)
  const bet = (reason: string): UthAdvice => ({ street: 'flop', decision: 'bet2', headline: 'Bet 2x', reason })

  const mine = categoryOf(score([...h, ...b]))
  const board = categoryOf(score(b))
  const [r1, r2] = h.map(rankOf)
  const boardRanks = b.map(rankOf)
  // Deuces and a pair on the board is two pair in name only: every pocket pair
  // and every card that pairs the board beats it. Counted exactly, it checks.
  const deucesUnderBoardPair = r1 === DEUCE && r2 === DEUCE && mine === TWO_PAIR
  if (mine >= TWO_PAIR && mine > board && !deucesUnderBoardPair) return bet('Two pair or better, made with your own cards, bets 2x.')

  if (r1 === r2 && r1 !== DEUCE) return bet('A pocket pair bets 2x on the flop, except deuces.')
  if (boardRanks.includes(r1) || boardRanks.includes(r2)) return bet('You have a hidden pair (one of your cards paired the board), so bet 2x.')

  for (let s = 0; s < 4; s++) {
    const count = [...h, ...b].filter((c) => suitOf(c) === s).length
    if (count === 4 && h.some((c) => suitOf(c) === s && rankOf(c) >= TEN)) {
      return bet('Four to a flush with a ten or better of that suit in your hand bets 2x.')
    }
  }
  return {
    street: 'flop',
    decision: 'check',
    headline: 'Check',
    reason: deucesUnderBoardPair
      ? 'Deuces with a pair on the board is two pair in name only: any higher pair beats it. Check.'
      : r1 === r2
        ? 'Pocket deuces check on the flop unless they improve.'
        : 'Nothing to bet yet. Check, and decide on the river.',
  }
}

const unseenBuf = new Int32Array(52)
const hand7 = new Int32Array(7)

function unseen(known: readonly number[]): number {
  let n = 0
  for (let c = 0; c < 52; c++) if (!known.includes(c)) unseenBuf[n++] = c
  return n
}

/** What the Blind pays when you win with this hand: 0 below a straight, and it pushes. */
function blindMultiple(playerScore: number): number {
  return BLIND_PAYS[namedCategory(playerScore)] ?? 0
}

/**
 * Sum of the Ante, Blind and Play results over every dealer hand, for a Play
 * bet of one Ante and of two — the river result and the flop raise share the
 * same loop. `skipA` and `skipB` are indices into the unseen list that are not
 * available to the dealer (the turn and river, when the flop is enumerating).
 */
function dealerSweep(board: Int32Array, playerScore: number, n: number, skipA: number, skipB: number): { one: number; two: number; hands: number } {
  const blind = blindMultiple(playerScore)
  for (let i = 0; i < 5; i++) hand7[i + 2] = board[i]
  let one = 0
  let two = 0
  let hands = 0
  for (let i = 0; i < n; i++) {
    if (i === skipA || i === skipB) continue
    hand7[0] = unseenBuf[i]
    for (let j = i + 1; j < n; j++) {
      if (j === skipA || j === skipB) continue
      hand7[1] = unseenBuf[j]
      const dealer = score(hand7, 7)
      hands++
      if (playerScore === dealer) continue
      const ante = categoryOf(dealer) >= PAIR ? 1 : 0
      if (playerScore > dealer) {
        one += 1 + ante + blind
        two += 2 + ante + blind
      } else {
        one -= 1 + ante + 1
        two -= 2 + ante + 1
      }
    }
  }
  return { one, two, hands }
}

/** Exact EV of raising 2x on the flop and of checking it, in Antes. */
export interface FlopEvs {
  bet2: number
  check: number
}

/**
 * The flop call worked out exactly. Where it agrees with the simple rule — 98
 * flops in 100 — the coach gives the rule's reason, so the rule is still what
 * you learn; where it does not, it says so.
 */
export function exactFlopAdvice(hole: readonly CardLike[], flop: readonly CardLike[], evs: FlopEvs): UthAdvice {
  const rule = flopAdvice(hole, flop)
  const decision: UthDecision = evs.bet2 > evs.check ? 'bet2' : 'check'
  const reason =
    decision === rule.decision
      ? rule.reason
      : decision === 'bet2'
        ? 'The simple rule checks here, but counted out over every turn, river and dealer hand, betting 2x is worth more.'
        : 'The simple rule bets here, but counted out over every turn, river and dealer hand, checking is worth more.'
  return { street: 'flop', decision, headline: decision === 'bet2' ? 'Bet 2x' : 'Check', reason, evs: { bet2: evs.bet2, check: evs.check } }
}

/** Exact EV of calling 1x and of folding on the river, in Antes. */
export function riverEvs(hole: readonly CardLike[], board: readonly CardLike[]): { bet1: number; fold: number } {
  const h = hole.map(encode)
  const b = board.map(encode)
  const n = unseen([...h, ...b])
  const boardBuf = Int32Array.from(b)
  const player = score([...h, ...b])
  const { one, hands } = dealerSweep(boardBuf, player, n, -1, -1)
  return { bet1: one / hands, fold: -2 }
}

/** The unseen cards that beat you all by themselves, whatever the dealer's other card is. */
export function dealerOuts(hole: readonly CardLike[], board: readonly CardLike[]): number {
  const h = hole.map(encode)
  const b = board.map(encode)
  const player = score([...h, ...b])
  const n = unseen([...h, ...b])
  const six = new Int32Array(6)
  for (let i = 0; i < 5; i++) six[i] = b[i]
  let outs = 0
  for (let i = 0; i < n; i++) {
    six[5] = unseenBuf[i]
    if (score(six, 6) > player) outs++
  }
  return outs
}

export function riverAdvice(hole: readonly CardLike[], board: readonly CardLike[]): UthAdvice {
  const evs = riverEvs(hole, board)
  const outs = dealerOuts(hole, board)
  const bet = evs.bet1 > evs.fold
  const h = hole.map(encode)
  const b = board.map(encode)
  const mine = score([...h, ...b])
  const theirs = score(b)
  const playsBoard = mine === theirs
  const ownHand = categoryOf(mine) >= PAIR && !playsBoard
  const reason = playsBoard
    ? bet
      ? 'The board plays for you, but the dealer seldom beats it. Call and take the tie.'
      : 'The board plays for you, so the best you can do is tie. Fold.'
    : bet
      ? ownHand
        ? `${handName(mine)} with your own cards: call. You win or tie often enough that calling beats giving up the Ante and Blind.`
        : `Only ${outs} of the cards you can't see beat you on their own. That is few enough to call.`
      : `${outs} of the cards you can't see beat you on their own. Folding loses less than calling.`
  return {
    street: 'river',
    decision: bet ? 'bet1' : 'fold',
    headline: bet ? 'Bet 1x' : 'Fold',
    reason,
    evs: { bet1: evs.bet1, fold: evs.fold },
    outs,
  }
}

/**
 * Exact EV of raising 2x on the flop and of checking it — checking plays the
 * river perfectly afterwards. Every turn and river, against every dealer hand:
 * just over a million hands, so the table works it out off the main thread.
 */
export function flopEvs(hole: readonly CardLike[], flop: readonly CardLike[]): FlopEvs {
  const h = hole.map(encode)
  const f = flop.map(encode)
  const n = unseen([...h, ...f])
  const board = new Int32Array(5)
  for (let i = 0; i < 3; i++) board[i] = f[i]
  const seven = new Int32Array(7)
  seven[0] = h[0]
  seven[1] = h[1]
  for (let i = 0; i < 3; i++) seven[i + 2] = f[i]
  let bet2 = 0
  let check = 0
  let runouts = 0
  for (let t = 0; t < n; t++) {
    board[3] = seven[5] = unseenBuf[t]
    for (let r = t + 1; r < n; r++) {
      board[4] = seven[6] = unseenBuf[r]
      const player = score(seven, 7)
      const sweep = dealerSweep(board, player, n, t, r)
      bet2 += sweep.two / sweep.hands
      check += Math.max(sweep.one / sweep.hands, -2)
      runouts++
    }
  }
  return { bet2: bet2 / runouts, check: check / runouts }
}

/**
 * The coach's call for whatever street the hand is on. On the flop it is exact
 * when `flop` carries the worked-out EVs, and the simple rule until then.
 */
export function advise(hole: readonly CardLike[], visibleBoard: readonly CardLike[], flop?: FlopEvs): UthAdvice | null {
  if (hole.length !== 2) return null
  if (visibleBoard.length === 0) return preflopAdvice(hole)
  if (visibleBoard.length === 3) return flop ? exactFlopAdvice(hole, visibleBoard, flop) : flopAdvice(hole, visibleBoard)
  if (visibleBoard.length === 5) return riverAdvice(hole, visibleBoard)
  return null
}

/**
 * When the rack will not cover the book's play, the best of what it will:
 * short of 4x, raise 3x if the hand is still worth it and check if not; short
 * of 2x, check; short of the river call, fold.
 */
export function withinRack(advice: UthAdvice, legal: readonly UthDecision[], hole: readonly CardLike[]): UthAdvice {
  if (legal.includes(advice.decision)) return advice
  switch (advice.street) {
    case 'preflop':
      return legal.includes('bet3') && threeXStillRaises(hole)
        ? { ...advice, decision: 'bet3', headline: 'Raise 3x', reason: 'Not enough in the rack for 4x, but this hand is still worth raising 3x.' }
        : { ...advice, decision: 'check', headline: 'Check', reason: 'Not enough in the rack for 4x, and 3x is not worth it with this hand. Check.' }
    case 'flop':
      return { ...advice, decision: 'check', headline: 'Check', reason: 'Not enough in the rack for 2x. Check, and decide on the river.' }
    case 'river':
      return { ...advice, decision: 'fold', headline: 'Fold', reason: 'Not enough in the rack to call. Fold.' }
  }
}

/** The decision a reader would take from a parsed chart cell, for the strategy panel. */
export interface PreflopCell {
  label: string
  decision: 'bet4' | 'check'
}

const LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
const RANK_FOR_CHART = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const

/**
 * The pre-flop chart as a 13 × 13 grid, aces first: pairs on the diagonal,
 * suited hands above it and offsuit below, the way hold'em charts are drawn.
 */
export function preflopChart(): PreflopCell[][] {
  const rows: PreflopCell[][] = []
  for (let i = 12; i >= 0; i--) {
    const row: PreflopCell[] = []
    for (let j = 12; j >= 0; j--) {
      const hi = Math.max(i, j)
      const lo = Math.min(i, j)
      const suited = j < i
      const cards: CardLike[] = [
        { rank: RANK_FOR_CHART[hi], suit: 'S' },
        { rank: RANK_FOR_CHART[lo], suit: suited ? 'S' : 'H' },
      ]
      const label = hi === lo ? `${LABELS[hi]}${LABELS[lo]}` : `${LABELS[hi]}${LABELS[lo]}${suited ? 's' : 'o'}`
      row.push({ label, decision: preflopAdvice(cards).decision as 'bet4' | 'check' })
    }
    rows.push(row)
  }
  return rows
}
