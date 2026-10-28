/**
 * Craps domain types.
 *
 * The whole game is a pure function of these: `roll()` and `settle()` take a
 * state and return a new one, exactly as the blackjack engine does. Nothing in
 * here knows about timers, the DOM or three.js.
 */

import type { RngState } from '../rng'

/** A single die. */
export type DieFace = 1 | 2 | 3 | 4 | 5 | 6

/** The six numbers that can become a point. */
export type PointNumber = 4 | 5 | 6 | 8 | 9 | 10

export const POINT_NUMBERS: readonly PointNumber[] = [4, 5, 6, 8, 9, 10]

export interface Roll {
  a: DieFace
  b: DieFace
  total: number
  /** True when both dice show the same face and the total is 4, 6, 8 or 10. */
  hard: boolean
}

/**
 * Every wager the Aria layout takes.
 *
 * `comePoint` / `dontComePoint` are not separate spots on the felt — they are
 * what a come bet becomes once it travels to a number, and they are modelled
 * separately because from that moment they win and lose on different rolls than
 * the bet in the come box does.
 */
export type BetKind =
  // Line
  | 'passLine'
  | 'dontPass'
  | 'passOdds'
  | 'dontPassOdds'
  // Come
  | 'come'
  | 'dontCome'
  | 'comePoint'
  | 'dontComePoint'
  | 'comeOdds'
  | 'dontComeOdds'
  // Box numbers
  | 'place'
  | 'buy'
  | 'lay'
  // Outside
  | 'field'
  // Centre
  | 'hard'
  | 'any7'
  | 'anyCraps'
  | 'ce'
  | 'horn'
  | 'world'
  | 'two'
  | 'three'
  | 'eleven'
  | 'twelve'
  // Side bets, resolved across a whole shoot
  | 'fire'
  | 'small'
  | 'tall'
  | 'all'

/**
 * Whether a bet is live.
 *
 * `auto` is what a dealer assumes: place, buy, hardway and come-odds bets sit
 * idle on a come-out roll and everything else works. `on` and `off` are the
 * player overriding that out loud, which is a real and frequently used call.
 */
export type WorkingMode = 'auto' | 'on' | 'off'

export interface Bet {
  /** Stable per-spot identity, e.g. `place-6`. Re-betting the same spot adds. */
  id: string
  kind: BetKind
  amount: number
  /** The box number, for anything that rides on one. */
  number?: number
  working?: WorkingMode
  /** Commission already handed over, so it can be reported as money spent. */
  vigPaid?: number
}

/**
 * What one roll did to one bet. This is the record the breakdown rail reads,
 * so it carries a human sentence rather than only numbers.
 */
export interface Resolution {
  betId: string
  label: string
  effect: 'win' | 'lose' | 'push' | 'move' | 'point' | 'sevenOut'
  /**
   * Profit and loss for this bet from this roll — winnings if it won, minus the
   * stake if it was taken. Not the bankroll delta: a winning place bet stays on
   * the felt, so the bankroll only sees the winnings, and that is what this is.
   */
  net: number
  /** What was riding on it as the dice landed. */
  stake: number
  /** Stake still on the felt after this roll. */
  remaining: number
  detail: string
}

/** State that lives and dies with one shooter's turn at the dice. */
export interface ShootState {
  /** Distinct points made, in order. The Fire Bet is paid off this. */
  firePoints: PointNumber[]
  /** Every distinct total 2..12 rolled, for All / Tall / Small. */
  numbersHit: number[]
  rolls: number
  /** Every roll of this shoot, oldest first — the history entry's body. */
  log: RollLogEntry[]
}

export interface RollLogEntry {
  a: DieFace
  b: DieFace
  total: number
  /** Point in force *before* this roll; null on a come-out. */
  point: number | null
  /** Net change to the bankroll from this roll. */
  net: number
  /** What the roll did to the shoot, if anything notable. */
  note?: 'pointSet' | 'pointMade' | 'sevenOut' | 'natural' | 'craps'
}

export interface CrapsLimits {
  minBet: number
  maxBet: number
  /** Maximum odds multiple, by point. Aria runs 3-4-5x. */
  oddsMultiple: Record<PointNumber, number>
  /** Ceiling on the small side bets, which are always capped low. */
  maxSideBet: number
  maxProp: number
}

export type CrapsPhase = 'betting' | 'rolling'

export interface CrapsState {
  bankroll: number
  /** The shooter's point, or null on a come-out roll. */
  point: PointNumber | null
  bets: Record<string, Bet>
  limits: CrapsLimits
  /** The dice's generator, carried from throw to throw. */
  rng: RngState
  phase: CrapsPhase
  /** The roll in the air, or the one that just landed. */
  roll: Roll | null
  /** What the last settled roll did. */
  resolutions: Resolution[]
  shoot: ShootState
  shootNumber: number
  /**
   * Set on the single roll that ends a shoot, so the store can file it in
   * history. `settle` keeps no clock of its own, which is what lets the whole
   * engine stay a pure function of its inputs.
   */
  finishedShoot: ShootState | null
  /** Monotonic; the renderer keys dice animations off it. */
  seq: number
  /**
   * Buy commission handed over since the last roll. `settle` reports it as a
   * resolution of its own, so the money counts against that roll's net.
   */
  commission?: number
}
