import type { DealtCard, ShoeState } from '../types'

/**
 * Punto banco, as a pure state machine.
 *
 * There are no decisions once the cards are out — the tableau decides every
 * third card — so a coup is dealt in one step and the renderer is handed the
 * finished hands to turn over at its own pace.
 */

export type BaccaratBetKind =
  | 'player'
  | 'banker'
  | 'tie'
  | 'playerPair'
  | 'bankerPair'
  | 'dragonPlayer'
  | 'dragonBanker'

export type Side = 'player' | 'banker'
export type Winner = Side | 'tie'

export interface CoupCard extends DealtCard {
  side: Side
  /** The tableau's third card, which a dealer lays sideways. */
  third: boolean
}

export interface Coup {
  player: CoupCard[]
  banker: CoupCard[]
  playerTotal: number
  bankerTotal: number
  winner: Winner
  /** Either side made 8 or 9 on its first two cards, so nobody drew. */
  natural: boolean
  playerPair: boolean
  bankerPair: boolean
}

export interface BaccaratResolution {
  kind: BaccaratBetKind
  stake: number
  /** Profit on a win (after commission), minus the stake on a loss, zero on a push. */
  net: number
  effect: 'win' | 'lose' | 'push'
  /** Why, in the dealer's words — "Banker wins 7 to 5, less 5%". */
  note: string
}

/** One coup on the scoreboard, for the bead plate and the big road. */
export interface ScoreEntry {
  winner: Winner
  playerTotal: number
  bankerTotal: number
  natural: boolean
  playerPair: boolean
  bankerPair: boolean
}

export interface BaccaratLimits {
  minBet: number
  maxBet: number
  minSide: number
  maxSide: number
}

export type BaccaratBets = Partial<Record<BaccaratBetKind, number>>

export interface BaccaratState {
  shoe: ShoeState
  /** Money in the rack. Chips on the felt are not in it. Kept to the cent. */
  bankroll: number
  bets: BaccaratBets
  /**
   * `dealt`: the cards are out and the renderer is turning them over; the
   * money has not moved. `settled`: paid and taken, waiting for the next coup.
   */
  phase: 'betting' | 'dealt' | 'settled'
  coup: Coup | null
  resolutions: BaccaratResolution[]
  /** Every coup of this shoe, oldest first. */
  scores: ScoreEntry[]
  /** What was on the felt for the last coup, for a one-click rebet. */
  lastBets: BaccaratBets
  /** The card turned up at the start of the shoe, which decides how many are burned. */
  burnCard: DealtCard | null
  burned: number
  limits: BaccaratLimits
  /** Monotonic per coup, for keying animations. */
  seq: number
}
