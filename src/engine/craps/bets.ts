import type { BetKind, PointNumber, Roll } from './types'
import { POINT_NUMBERS } from './types'

/**
 * The Aria layout, as data.
 *
 * Every payout, every house edge, every rule about when a bet may be made and
 * what it needs to hit lives here once. The felt draws itself from this, the
 * hit targets come from this, the breakdown rail explains bets from this, and
 * the state machine resolves against this — so the table can never tell the
 * player one thing and pay them another.
 */

export interface PayRatio {
  num: number
  den: number
}

export function pay(amount: number, ratio: PayRatio): number {
  // Casinos break payouts down to the dollar and never round in the player's
  // favour. Increments are enforced on placement, so this is rarely load-bearing
  // — but a $7 odds bet on the six really does pay $8, not $8.40.
  return Math.floor((amount * ratio.num) / ratio.den)
}

export function ratioText(ratio: PayRatio): string {
  return ratio.den === 1 ? `${ratio.num}:1` : `${ratio.num}:${ratio.den}`
}

/** True odds — what odds bets and buy bets pay, with no house cut at all. */
export const TRUE_ODDS: Record<PointNumber, PayRatio> = {
  4: { num: 2, den: 1 },
  10: { num: 2, den: 1 },
  5: { num: 3, den: 2 },
  9: { num: 3, den: 2 },
  6: { num: 6, den: 5 },
  8: { num: 6, den: 5 },
}

/** Laying against a number: the inverse of true odds. */
export const LAY_ODDS: Record<PointNumber, PayRatio> = {
  4: { num: 1, den: 2 },
  10: { num: 1, den: 2 },
  5: { num: 2, den: 3 },
  9: { num: 2, den: 3 },
  6: { num: 5, den: 6 },
  8: { num: 5, den: 6 },
}

/** Place bets pay slightly short of true odds. That gap is the house edge. */
export const PLACE_ODDS: Record<PointNumber, PayRatio> = {
  4: { num: 9, den: 5 },
  10: { num: 9, den: 5 },
  5: { num: 7, den: 5 },
  9: { num: 7, den: 5 },
  6: { num: 7, den: 6 },
  8: { num: 7, den: 6 },
}

export type HardNumber = 4 | 6 | 8 | 10
export const HARD_NUMBERS: readonly HardNumber[] = [4, 6, 8, 10]

export const HARD_ODDS: Record<HardNumber, PayRatio> = {
  4: { num: 7, den: 1 },
  10: { num: 7, den: 1 },
  6: { num: 9, den: 1 },
  8: { num: 9, den: 1 },
}

/**
 * Aria's field: double on the 2, triple on the 12. The 12 being tripled is what
 * drags the edge down from 5.6% to 2.8%, and is worth knowing about — plenty of
 * tables pay double on both.
 */
export const FIELD_PAYS: Record<number, number> = { 2: 2, 3: 1, 4: 1, 9: 1, 10: 1, 11: 1, 12: 3 }
export const FIELD_NUMBERS = [2, 3, 4, 9, 10, 11, 12]

/** 3-4-5x odds: whatever the point, the maximum odds bet pays 6x the line. */
export const ARIA_ODDS_MULTIPLE: Record<PointNumber, number> = {
  4: 3,
  10: 3,
  5: 4,
  9: 4,
  6: 5,
  8: 5,
}

/** Fire Bet, paid on distinct points made before the seven-out. */
export const FIRE_PAYS: Record<number, PayRatio> = {
  4: { num: 24, den: 1 },
  5: { num: 249, den: 1 },
  6: { num: 999, den: 1 },
}

export const SMALL_NUMBERS = [2, 3, 4, 5, 6]
export const TALL_NUMBERS = [8, 9, 10, 11, 12]
export const ALL_NUMBERS = [...SMALL_NUMBERS, ...TALL_NUMBERS]

export const ATS_PAYS: Record<'small' | 'tall' | 'all', PayRatio> = {
  small: { num: 30, den: 1 },
  tall: { num: 30, den: 1 },
  all: { num: 150, den: 1 },
}

/** The five percent the house takes for letting you buy or lay true odds. */
export const VIG_RATE = 0.05

export function buyVig(amount: number): number {
  // Charged on placement and rounded down, which is why buying in $20 units is
  // the standard advice: $25 and $20 both cost exactly $1.
  return Math.floor(amount * VIG_RATE)
}

export function layVig(amount: number, number: PointNumber): number {
  // Laying is vigged on what you stand to *win*, not on what you put up, and
  // rounded down — but never below the $1 a dealer always takes.
  return Math.max(1, Math.floor(pay(amount, LAY_ODDS[number]) * VIG_RATE))
}

/** How many of the 36 dice combinations make each total. */
export const WAYS: Record<number, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
}

// Shared with every other table, so the same pill means the same thing everywhere.
export { edgeBand, type EdgeBand } from '../edge'

/**
 * Descriptive spec for a bet kind.
 *
 * `wins` and `loses` are the totals the breakdown rail prints. They are the
 * general case — a come bet in the box wins on 7 and 11, but the moment it
 * travels to the 6 it wins only on 6 — which is exactly why a travelled come
 * bet is a different kind.
 */
export interface BetSpec {
  kind: BetKind
  title: string
  /** Resolved on the very next throw, win or lose. */
  oneRoll: boolean
  /** Can only be made before the shooter's first come-out of a new shoot. */
  newShootOnly?: boolean
  /** Can only be made once a point is established. */
  pointOnly?: boolean
  /** Cannot be taken down or reduced once made. */
  contract?: boolean
  /** Idle on a come-out roll unless the player calls it on. */
  offOnComeOut?: boolean
  blurb: string
}

const SPECS: Record<BetKind, BetSpec> = {
  passLine: {
    kind: 'passLine',
    title: 'Pass Line',
    oneRoll: false,
    contract: true,
    blurb:
      'The foundation bet. Wins immediately on 7 or 11, loses on 2, 3 or 12. Any other number becomes the point, and from then on you need that point again before a 7.',
  },
  dontPass: {
    kind: 'dontPass',
    title: "Don't Pass",
    oneRoll: false,
    blurb:
      'The mirror of the pass line. Wins on 2 or 3, loses on 7 or 11, pushes on 12. Once a point is set you want a 7 before the point — you are betting against the shooter, which includes yourself.',
  },
  passOdds: {
    kind: 'passOdds',
    title: 'Pass Odds',
    oneRoll: false,
    pointOnly: true,
    blurb:
      'Paid at true odds with no house edge whatsoever — the only fair bet on any table in Vegas. Taken behind an existing pass line bet, up to 3-4-5x.',
  },
  dontPassOdds: {
    kind: 'dontPassOdds',
    title: "Don't Pass Odds",
    oneRoll: false,
    pointOnly: true,
    blurb:
      'True odds laid behind a don’t pass bet. No house edge. You lay more than you win, because a 7 before the point is now the favourite. Up to 6x the line on any point.',
  },
  come: {
    kind: 'come',
    title: 'Come',
    oneRoll: false,
    pointOnly: true,
    contract: true,
    blurb:
      'A pass line bet started mid-roll. The next throw is its own private come-out: 7 or 11 wins, 2, 3 or 12 loses, anything else moves your bet to that number.',
  },
  dontCome: {
    kind: 'dontCome',
    title: "Don't Come",
    oneRoll: false,
    pointOnly: true,
    blurb:
      'A don’t pass bet started mid-roll. 2 or 3 wins, 12 pushes, 7 or 11 loses, anything else moves your bet behind that number.',
  },
  comePoint: {
    kind: 'comePoint',
    title: 'Come',
    oneRoll: false,
    contract: true,
    blurb: 'A come bet that has travelled to a number. It wins if that number rolls before a 7.',
  },
  dontComePoint: {
    kind: 'dontComePoint',
    title: "Don't Come",
    oneRoll: false,
    blurb: 'A don’t come bet behind a number. It wins if a 7 rolls before that number.',
  },
  comeOdds: {
    kind: 'comeOdds',
    title: 'Come Odds',
    oneRoll: false,
    offOnComeOut: true,
    blurb:
      'True odds behind a travelled come bet. No house edge. Off on the come-out roll unless you call it on.',
  },
  dontComeOdds: {
    kind: 'dontComeOdds',
    title: "Don't Come Odds",
    oneRoll: false,
    blurb: 'True odds laid behind a travelled don’t come bet. No house edge.',
  },
  place: {
    kind: 'place',
    title: 'Place',
    oneRoll: false,
    offOnComeOut: true,
    blurb:
      'Bet a number directly. It wins every time that number rolls and stays up to win again — until a 7 takes it down. Off on the come-out unless you call it on.',
  },
  buy: {
    kind: 'buy',
    title: 'Buy',
    oneRoll: false,
    offOnComeOut: true,
    blurb:
      'Like a place bet, but paid at true odds for a 5% commission, paid up front and again out of every win that keeps it working. On the 4 and 10 that is a clear improvement on placing; on the 6 and 8 it is distinctly worse.',
  },
  lay: {
    kind: 'lay',
    title: 'Lay',
    oneRoll: false,
    blurb:
      'The reverse of a buy: you put up the big end and win the small end if a 7 comes before the number. Commission is 5% of what you stand to win, never less than $1.',
  },
  field: {
    kind: 'field',
    title: 'Field',
    oneRoll: true,
    blurb:
      'One roll. Wins on 2, 3, 4, 9, 10, 11 and 12 — seven numbers out of eleven, which looks generous until you notice the four it misses are the four most common.',
  },
  hard: {
    kind: 'hard',
    title: 'Hardway',
    oneRoll: false,
    offOnComeOut: true,
    blurb:
      'The number thrown as a pair. Loses if it comes any other way, and loses on a 7. Stays up and can win repeatedly.',
  },
  any7: {
    kind: 'any7',
    title: 'Any Seven',
    oneRoll: true,
    blurb:
      'One roll on the single most likely number. Pays 4:1 on a 5:1 shot — the worst bet on the table by a distance.',
  },
  anyCraps: {
    kind: 'anyCraps',
    title: 'Any Craps',
    oneRoll: true,
    blurb: 'One roll. Wins on 2, 3 or 12.',
  },
  ce: {
    kind: 'ce',
    title: 'C & E',
    oneRoll: true,
    blurb:
      'Half on any craps, half on the eleven, in one bet. Pays 3:1 if a craps rolls and 7:1 on the yo.',
  },
  horn: {
    kind: 'horn',
    title: 'Horn',
    oneRoll: true,
    blurb:
      'One roll split four ways across 2, 3, 11 and 12. One quarter wins, the other three are lost, and the payout is quoted net of them.',
  },
  world: {
    kind: 'world',
    title: 'World',
    oneRoll: true,
    blurb:
      'The horn plus the 7, split five ways. A 7 pays exactly what the other four units lose, so it comes out a push.',
  },
  two: { kind: 'two', title: 'Snake Eyes', oneRoll: true, blurb: 'One roll on the 2. Pays 30:1 on a 35:1 shot.' },
  three: { kind: 'three', title: 'Ace Deuce', oneRoll: true, blurb: 'One roll on the 3. Pays 15:1 on a 17:1 shot.' },
  eleven: { kind: 'eleven', title: 'Yo', oneRoll: true, blurb: 'One roll on the 11. Pays 15:1 on a 17:1 shot.' },
  twelve: { kind: 'twelve', title: 'Boxcars', oneRoll: true, blurb: 'One roll on the 12. Pays 30:1 on a 35:1 shot.' },
  fire: {
    kind: 'fire',
    title: 'Fire Bet',
    oneRoll: false,
    newShootOnly: true,
    contract: true,
    blurb:
      'Tracks how many *different* points you make before sevening out. Nothing at all until the fourth, then it pays enormously. Made only before a new shooter’s first roll.',
  },
  small: {
    kind: 'small',
    title: 'Small',
    oneRoll: false,
    newShootOnly: true,
    contract: true,
    blurb: 'Roll every number from 2 to 6 before a 7 shows. Pays 30:1.',
  },
  tall: {
    kind: 'tall',
    title: 'Tall',
    oneRoll: false,
    newShootOnly: true,
    contract: true,
    blurb: 'Roll every number from 8 to 12 before a 7 shows. Pays 30:1.',
  },
  all: {
    kind: 'all',
    title: 'All',
    oneRoll: false,
    newShootOnly: true,
    contract: true,
    blurb: 'Roll all ten numbers — every total except the 7 — before a 7 shows. Pays 150:1.',
  },
}

export function spec(kind: BetKind): BetSpec {
  return SPECS[kind]
}

/**
 * House edge per dollar of the bet's own stake.
 *
 * One convention, applied to everything, so the numbers in the breakdown rail
 * are comparable to each other. Buy is the exception that proves it: its
 * commission is part of what goes down, so 4.76% is per dollar of stake plus
 * commission. Lay figures assume the 5% comes out of the win; tables that take
 * it up front quote 2.44%, 3.23% and 4.00%, and the reference card says so.
 */
export function houseEdge(kind: BetKind, number?: number): number {
  switch (kind) {
    case 'passLine':
    case 'come':
    case 'comePoint':
      return 0.0141
    case 'dontPass':
    case 'dontCome':
    case 'dontComePoint':
      return 0.0136
    case 'passOdds':
    case 'dontPassOdds':
    case 'comeOdds':
    case 'dontComeOdds':
      return 0
    case 'place':
      return number === 6 || number === 8 ? 0.0152 : number === 5 || number === 9 ? 0.04 : 0.0667
    case 'buy':
      return 0.0476
    case 'lay':
      return number === 4 || number === 10 ? 0.0167 : number === 5 || number === 9 ? 0.02 : 0.0227
    case 'field':
      return 0.0278
    case 'hard':
      return number === 6 || number === 8 ? 0.0909 : 0.1111
    case 'any7':
      return 0.1667
    case 'anyCraps':
      return 0.1111
    case 'ce':
      return 0.1111
    case 'horn':
      return 0.125
    case 'world':
      return 0.1333
    case 'two':
    case 'twelve':
      return 0.1389
    case 'three':
    case 'eleven':
      return 0.1111
    case 'fire':
      return 0.2076
    case 'small':
    case 'tall':
      return 0.183
    case 'all':
      return 0.206
  }
}

/**
 * The stake increment a dealer will actually accept.
 *
 * Placing the six in fives is the classic beginner's mistake: 7:6 on $5 pays
 * $5, so the seventh dollar simply evaporates. Snapping to the increment on
 * placement is what a dealer telling you "make it six" accomplishes.
 */
export function increment(kind: BetKind, number?: number): number {
  switch (kind) {
    case 'place':
      return number === 6 || number === 8 ? 6 : 5
    case 'buy':
      return 5
    case 'lay':
      return number === 4 || number === 10 ? 2 : number === 5 || number === 9 ? 3 : 6
    case 'passOdds':
    case 'comeOdds':
      // 6:5 and 3:2 both need the stake to divide evenly or the cents are lost.
      return number === 6 || number === 8 ? 5 : number === 5 || number === 9 ? 2 : 1
    case 'dontPassOdds':
    case 'dontComeOdds':
      return number === 6 || number === 8 ? 6 : number === 5 || number === 9 ? 3 : 2
    case 'ce':
      // Split in half across any craps and the yo, so it has to halve cleanly.
      return 2
    case 'horn':
      return 4
    case 'world':
      return 5
    default:
      return 1
  }
}

/** Snap a stake down to something the dealer can pay correctly. */
export function snap(amount: number, kind: BetKind, number?: number): number {
  const step = increment(kind, number)
  return Math.floor(amount / step) * step
}

/**
 * Totals that win and lose a bet, for the breakdown rail.
 *
 * Deliberately expressed as plain totals: "wins 6, loses 7" is the sentence a
 * new player needs, and it is the sentence the rail prints.
 */
export function winningTotals(kind: BetKind, number?: number, point?: number | null): number[] {
  switch (kind) {
    case 'passLine':
      return point ? [point] : [7, 11]
    case 'dontPass':
      return point ? [7] : [2, 3]
    case 'come':
      return [7, 11]
    case 'dontCome':
      return [2, 3]
    // A live odds bet rides on the shooter's point and carries no number of its
    // own. The reference card has no point to read, so it names the number
    // instead — hence both being accepted here.
    case 'passOdds':
      return point ?? number ? [(point ?? number) as number] : []
    case 'dontPassOdds':
      return point ?? number ? [7] : []
    case 'comePoint':
    case 'comeOdds':
    case 'place':
    case 'buy':
    case 'hard':
      return number ? [number] : []
    case 'dontComePoint':
    case 'dontComeOdds':
    case 'lay':
      return [7]
    case 'field':
      return FIELD_NUMBERS
    case 'any7':
      return [7]
    case 'anyCraps':
      return [2, 3, 12]
    case 'ce':
      return [2, 3, 11, 12]
    case 'horn':
      return [2, 3, 11, 12]
    case 'world':
      return [2, 3, 11, 12]
    case 'two':
      return [2]
    case 'three':
      return [3]
    case 'eleven':
      return [11]
    case 'twelve':
      return [12]
    case 'fire':
    case 'small':
    case 'tall':
    case 'all':
      return []
  }
}

export function losingTotals(kind: BetKind, number?: number, point?: number | null): number[] {
  switch (kind) {
    case 'passLine':
      return point ? [7] : [2, 3, 12]
    case 'dontPass':
      return point ? [point] : [7, 11]
    case 'come':
      return [2, 3, 12]
    case 'dontCome':
      return [7, 11]
    case 'passOdds':
      return point ?? number ? [7] : []
    case 'dontPassOdds':
      return point ?? number ? [(point ?? number) as number] : []
    case 'comePoint':
    case 'comeOdds':
    case 'place':
    case 'buy':
      return [7]
    case 'hard':
      return number ? [7, number] : [7]
    case 'dontComePoint':
    case 'dontComeOdds':
    case 'lay':
      return number ? [number] : []
    case 'field':
      return [5, 6, 7, 8]
    case 'any7':
      return [2, 3, 4, 5, 6, 8, 9, 10, 11, 12]
    case 'anyCraps':
      return [4, 5, 6, 7, 8, 9, 10, 11]
    case 'ce':
      return [4, 5, 6, 7, 8, 9, 10]
    case 'horn':
      return [4, 5, 6, 7, 8, 9, 10]
    case 'world':
      return [4, 5, 6, 8, 9, 10]
    case 'two':
      return [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    case 'three':
      return [2, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    case 'eleven':
      return [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]
    case 'twelve':
      return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    case 'fire':
    case 'small':
    case 'tall':
    case 'all':
      return [7]
  }
}

/** Human payout text for the reference card and the rail. */
export function payoutText(kind: BetKind, number?: number): string {
  switch (kind) {
    case 'passLine':
    case 'dontPass':
    case 'come':
    case 'dontCome':
    case 'comePoint':
    case 'dontComePoint':
      return 'even money'
    case 'passOdds':
    case 'comeOdds':
    case 'buy':
      return number ? ratioText(TRUE_ODDS[number as PointNumber]) : 'true odds'
    case 'dontPassOdds':
    case 'dontComeOdds':
    case 'lay':
      return number ? ratioText(LAY_ODDS[number as PointNumber]) : 'true odds'
    case 'place':
      return number ? ratioText(PLACE_ODDS[number as PointNumber]) : ''
    case 'hard':
      return number ? ratioText(HARD_ODDS[number as HardNumber]) : ''
    case 'field':
      return '1:1 · 2 pays 2:1 · 12 pays 3:1'
    case 'any7':
      return '4:1'
    case 'anyCraps':
      return '7:1'
    case 'ce':
      return '3:1 craps · 7:1 yo'
    case 'horn':
      return '27:4 on 2 or 12 · 12:4 on 3 or 11'
    case 'world':
      return '26:5 on 2 or 12 · 11:5 on 3 or 11 · 7 pushes'
    case 'two':
    case 'twelve':
      return '30:1'
    case 'three':
    case 'eleven':
      return '15:1'
    case 'fire':
      return '4 points 24:1 · 5 points 249:1 · 6 points 999:1'
    case 'small':
    case 'tall':
      return '30:1'
    case 'all':
      return '150:1'
  }
}

/** True when the total, as thrown, is a pair — which is all a hardway cares about. */
export function isHardWay(roll: Roll, number: number): boolean {
  return roll.total === number && roll.a === roll.b
}

export { POINT_NUMBERS }
