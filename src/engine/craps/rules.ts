import { ARIA_ODDS_MULTIPLE } from './bets'
import type { CrapsLimits } from './types'

/**
 * Aria's craps pit, as it actually runs.
 *
 * 3-4-5x odds, double on the 2 and triple on the 12 in the field, no Big 6/8
 * (Strip tables dropped it decades ago), and a Fire Bet and All/Tall/Small in
 * the apron. The three tiers here are the same pit at three different tables,
 * which is why the rules never change between them — only the limits do.
 */
export interface CrapsTable {
  id: string
  name: string
  subtitle: string
  minBet: number
  maxBet: number
  maxSideBet: number
  maxProp: number
  requiredBankroll: number
  accent: string
}

export const CRAPS_TABLES: CrapsTable[] = [
  {
    id: 'main',
    name: 'Main Pit',
    subtitle: 'Aria · 3-4-5x odds',
    minBet: 10,
    maxBet: 5_000,
    maxSideBet: 25,
    maxProp: 500,
    requiredBankroll: 0,
    accent: '#c98f4b',
  },
  {
    id: 'highLimit',
    name: 'High Limit',
    subtitle: 'Aria · 3-4-5x odds',
    minBet: 25,
    maxBet: 15_000,
    maxSideBet: 100,
    maxProp: 1_500,
    requiredBankroll: 50_000,
    accent: '#e2b857',
  },
  {
    id: 'salon',
    name: 'Sky Suite Salon',
    subtitle: 'By arrangement · 3-4-5x odds',
    minBet: 100,
    maxBet: 50_000,
    maxSideBet: 500,
    maxProp: 5_000,
    requiredBankroll: 250_000,
    accent: '#cfd8e3',
  },
]

export const CRAPS_STARTING_BANKROLL = 1_000

export function crapsTableById(id: string): CrapsTable {
  return CRAPS_TABLES.find((t) => t.id === id) ?? CRAPS_TABLES[0]
}

export function unlockedCrapsTables(peakBankroll: number): CrapsTable[] {
  return CRAPS_TABLES.filter((t) => peakBankroll >= t.requiredBankroll)
}

export function limitsFor(table: CrapsTable): CrapsLimits {
  return {
    minBet: table.minBet,
    maxBet: table.maxBet,
    oddsMultiple: ARIA_ODDS_MULTIPLE,
    maxSideBet: table.maxSideBet,
    maxProp: table.maxProp,
  }
}
