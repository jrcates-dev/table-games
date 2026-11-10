import { ARIA_ODDS_MULTIPLE } from './bets'
import type { CrapsLimits } from './types'

/**
 * Aria's craps pit, as it actually runs.
 *
 * 3-4-5x odds, double on the 2 and triple on the 12 in the field, no Big 6/8
 * (Strip tables dropped it decades ago), and a Fire Bet and All/Tall/Small in
 * the apron.
 */
export interface CrapsTable {
  minBet: number
  maxBet: number
  maxSideBet: number
  maxProp: number
}

/** The main pit's limits. */
export const CRAPS_TABLE: CrapsTable = {
  minBet: 10,
  maxBet: 5_000,
  maxSideBet: 25,
  maxProp: 500,
}

export const CRAPS_STARTING_BANKROLL = 1_000

export function limitsFor(table: CrapsTable): CrapsLimits {
  return {
    minBet: table.minBet,
    maxBet: table.maxBet,
    oddsMultiple: ARIA_ODDS_MULTIPLE,
    maxSideBet: table.maxSideBet,
    maxProp: table.maxProp,
  }
}
