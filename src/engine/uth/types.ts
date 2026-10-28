import type { DealtCard, ShoeState } from '../types'
import type { Category } from './poker'
import type { TripsTableId, UthLimits } from './rules'

export type UthPhase =
  /** Ante, Blind and Trips going down. */
  | 'betting'
  /** Two cards each; check, or raise 3x or 4x. */
  | 'preflop'
  /** Three on the board; check, or raise 2x. */
  | 'flop'
  /** All five; raise 1x or fold. */
  | 'river'
  /** Everything turned over, the hands read, the money not yet moved. */
  | 'reveal'
  /** Paid and taken, waiting for the next hand. */
  | 'showdown'

export type UthDecision = 'check' | 'bet4' | 'bet3' | 'bet2' | 'bet1' | 'fold'

export type UthBetKind = 'ante' | 'blind' | 'play' | 'trips'

export interface UthBets {
  ante: number
  blind: number
  trips: number
  play: number
}

export interface UthResolution {
  kind: UthBetKind
  stake: number
  net: number
  effect: 'win' | 'lose' | 'push'
  note: string
}

export interface UthResult {
  playerScore: number
  dealerScore: number
  playerCategory: Category
  dealerCategory: Category
  playerName: string
  dealerName: string
  /** Indices into hole-then-board of the five cards that play, for each side. */
  playerBest: number[]
  dealerBest: number[]
  outcome: 'win' | 'lose' | 'tie' | 'fold'
  dealerQualifies: boolean
}

export interface UthState {
  deck: ShoeState
  bankroll: number
  bets: UthBets
  phase: UthPhase
  player: DealtCard[]
  dealer: DealtCard[]
  /** All five, dealt with the hand; `revealed` says how many are face up. */
  board: DealtCard[]
  revealed: 0 | 3 | 5
  /** The street the Play bet was made on, if it has been. */
  raisedOn: 'preflop' | 'flop' | 'river' | null
  /** The multiple of the Ante the Play bet is. */
  raise: number
  result: UthResult | null
  resolutions: UthResolution[]
  lastBets: { ante: number; trips: number }
  tripsTable: TripsTableId
  limits: UthLimits
  seq: number
}
