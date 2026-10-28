import type { RngState } from '../rng'
import type { BetDef } from './bets'
import type { Pocket, WheelType } from './wheel'

export interface RouletteBet extends BetDef {
  amount: number
}

export interface RouletteResolution {
  betId: string
  stake: number
  /** Winnings on a win, minus the stake on a loss. */
  net: number
  effect: 'win' | 'lose'
}

export interface RouletteLimits {
  /** Inside bets together, and each outside bet, must reach this. */
  tableMin: number
  /** The most on a single number; other inside bets scale with what they cover. */
  maxStraight: number
  maxOutside: number
}

export interface RouletteState {
  wheel: WheelType
  bankroll: number
  bets: Record<string, RouletteBet>
  /**
   * `spinning`: the result is decided and the ball is in the air. `settled`:
   * paid, the marker on the winning number, waiting for the next spin.
   */
  phase: 'betting' | 'spinning' | 'settled'
  result: Pocket | null
  /** Most recent first, as the tote board reads. */
  history: Pocket[]
  resolutions: RouletteResolution[]
  lastBets: Record<string, RouletteBet>
  rng: RngState
  limits: RouletteLimits
  seq: number
}
