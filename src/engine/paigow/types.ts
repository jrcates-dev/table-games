import type { RngState } from '../rng'
import type { DealtCard } from '../types'
import type { FortuneHand } from './fortune'
import type { PaiGowCategory } from './hands'
import type { PaiGowLimits, PaiGowRules } from './rules'

export type PaiGowPhase =
  /** The bet and Fortune going down. */
  | 'betting'
  /** Seven cards each; the player is setting theirs. */
  | 'setting'
  /** The dealer's hand turned and set, both read, the money not yet moved. */
  | 'reveal'
  /** Paid and taken, waiting for the next hand. */
  | 'showdown'

/** A card on a pai gow felt: an ordinary card, or the joker (drawn as one; its rank and suit are placeholders). */
export interface PaiGowCard extends DealtCard {
  code: number
  joker: boolean
}

export interface PaiGowBets {
  wager: number
  fortune: number
}

export type PaiGowBetKind = 'wager' | 'fortune'

export interface PaiGowResolution {
  kind: PaiGowBetKind
  stake: number
  net: number
  effect: 'win' | 'lose' | 'push'
  note: string
}

export interface SetRead {
  low: [number, number]
  lowScore: number
  highScore: number
  lowName: string
  highName: string
  highCategory: PaiGowCategory
}

export interface PaiGowResult {
  player: SetRead
  dealer: SetRead
  /** The house way rule the dealer set by. */
  dealerRule: string
  foul: boolean
  /** Each hand from the player's side; a copy is a tie, and goes to the dealer. */
  high: 'win' | 'lose' | 'copy'
  low: 'win' | 'lose' | 'copy'
  outcome: 'win' | 'push' | 'lose' | 'foul'
  /** Commission-free: a win that pushed because the dealer's high hand was a queen-high pai gow. */
  queenHighPush: boolean
  fortune: FortuneHand | null
}

export interface PaiGowState {
  /** The generator as the last shuffle left it; each hand is a fresh deck from here. */
  rng: RngState
  bankroll: number
  bets: PaiGowBets
  phase: PaiGowPhase
  /** Your seven, highest first, the joker leading. */
  player: PaiGowCard[]
  /** The dealer's seven, face down until the reveal. */
  dealer: PaiGowCard[]
  result: PaiGowResult | null
  resolutions: PaiGowResolution[]
  lastBets: PaiGowBets
  rules: PaiGowRules
  limits: PaiGowLimits
  seq: number
}
