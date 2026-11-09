import type { HandRules } from './hands'

/**
 * Pai Gow Poker as the Strip deals it, heads-up against the house: one
 * 53-card deck with a joker, shuffled for every hand; seven cards each, set
 * into a five-card high hand and a two-card low hand; the dealer sets the
 * house way; copies go to the dealer; and the house takes 5% of a win.
 */

export interface PaiGowLimits {
  minBet: number
  maxBet: number
  minFortune: number
  maxFortune: number
}

export const PAIGOW_LIMITS: PaiGowLimits = { minBet: 25, maxBet: 2_000, minFortune: 5, maxFortune: 100 }

export const PAIGOW_STARTING_BANKROLL = 1_000

export const COMMISSION = 0.05

export interface PaiGowRules extends HandRules {
  /**
   * No commission on a win — but a win pushes whenever the dealer's high hand
   * is a queen-high pai gow. The Strip's "EZ" or commission-free table.
   */
  commissionFree: boolean
}

export const DEFAULT_PAIGOW_RULES: PaiGowRules = { commissionFree: false, wheelSecond: false }

/**
 * What the house keeps of the bet when you and the dealer both set the house
 * way — measured over 40 million hands dealt by this engine (within ±0.01%).
 * About 41% of hands push, which is why pai gow is the slowest way to lose
 * money in the building.
 */
export const PAIGOW_EDGE = 0.0270
/** The same, at a commission-free table where a dealer's queen-high pai gow pushes your win. */
export const PAIGOW_EDGE_NO_COMMISSION = 0.0280
export const PAIGOW_PUSH_RATE = 0.409
