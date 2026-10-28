/**
 * Core domain types for the table-games engine.
 *
 * Everything in `src/engine` is pure TypeScript with no React, no DOM and no
 * randomness beyond the injected seeded RNG. That keeps the rules testable and
 * makes it possible to hand the whole state object to a server later without a
 * rewrite.
 */

import type { RngState } from './rng'

export type Suit = 'S' | 'H' | 'D' | 'C'

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']

export const RANKS: readonly Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
]

/** A card sitting in the shoe. `id` is unique per physical card per shoe. */
export interface Card {
  id: string
  rank: Rank
  suit: Suit
}

/**
 * A card that has been dealt onto the felt. `seq` is a monotonic counter within
 * the round so the renderer can stagger deal animations deterministically.
 */
export interface DealtCard extends Card {
  seq: number
  faceDown: boolean
}

export type Phase =
  /** Awaiting the player's wager. */
  | 'betting'
  /** Cards are on the felt; the UI is playing the deal animation. */
  | 'dealing'
  /** Dealer shows an ace; insurance decision pending. */
  | 'insurance'
  /** Player is acting on `activeHandIndex`. */
  | 'playerTurn'
  /** Dealer is drawing to completion, one card per `dealerStep`. */
  | 'dealerTurn'
  /** Outcomes and payouts are final; awaiting `nextRound`. */
  | 'roundOver'

export type Outcome =
  | 'blackjack'
  | 'win'
  | 'push'
  | 'lose'
  | 'bust'
  | 'surrender'
  | 'dealerBlackjack'

export type PlayerAction =
  | 'hit'
  | 'stand'
  | 'double'
  | 'split'
  | 'surrender'
  | 'insurance'
  | 'declineInsurance'

/** One betting box. A split produces additional hands sharing the round. */
export interface PlayerHand {
  id: string
  cards: DealtCard[]
  bet: number
  /** True when this hand was produced by splitting, which bars a natural. */
  fromSplit: boolean
  /** Split aces receive exactly one card and cannot be hit (house rule). */
  splitAces: boolean
  doubled: boolean
  surrendered: boolean
  /** Player has finished acting on this hand. */
  resolved: boolean
  outcome?: Outcome
  /** Net chips returned to the bankroll, including the original wager. */
  payout?: number
}

export interface ShoeState {
  cards: Card[]
  /** Index of the next card to be drawn. */
  pos: number
  /** Once `pos` passes this, the shoe is reshuffled after the round. */
  cutIndex: number
  decks: number
  /** The generator as the last shuffle left it; the next one carries on from here. */
  rng: RngState
  /** Increments on every shuffle; used to reset the running count. */
  shuffleCount: number
}

export interface RoundState {
  phase: Phase
  hands: PlayerHand[]
  activeHandIndex: number
  dealer: DealtCard[]
  insuranceBet: number
  /** Insurance has been offered and answered (or was never available). */
  insuranceSettled: boolean
  insuranceOutcome?: 'win' | 'lose'
  /** Monotonic deal counter driving animation stagger. */
  seq: number
  /** Chips currently committed to the felt, for display. */
  wagered: number
}

export interface GameState {
  rules: RuleSet
  shoe: ShoeState
  bankroll: number
  round: RoundState
  /** Chips the player has staked on the next hand while in `betting`. */
  pendingBet: number
}

export type DoubleRule = 'any' | '9-11' | '10-11'
export type SurrenderRule = 'none' | 'late' | 'early'

export interface RuleSet {
  decks: number
  /** H17 when true, S17 when false. */
  dealerHitsSoft17: boolean
  /** 1.5 for the standard 3:2, 1.2 for the predatory 6:5. */
  blackjackPayout: number
  doubleAfterSplit: boolean
  doubleOn: DoubleRule
  /** Total boxes a player may occupy after splitting, including the original. */
  maxSplitHands: number
  resplitAces: boolean
  hitSplitAces: boolean
  surrender: SurrenderRule
  /** Dealer checks for a natural on an ace or ten, ending the round early. */
  dealerPeek: boolean
  insurancePayout: number
  /** Fraction of the shoe dealt before the cut card, e.g. 0.75. */
  penetration: number
}

export interface TableTier {
  id: string
  name: string
  minBet: number
  maxBet: number
  /** Bankroll required before this table unlocks. */
  requiredBankroll: number
  /** Accent colour used for the felt inlay and chip rail. */
  accent: string
}
