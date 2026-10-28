import type { Category } from './poker'

/**
 * Ultimate Texas Hold'em as the Strip deals it: one deck, shuffled every hand;
 * equal Ante and Blind; one raise per hand — 3x or 4x before the flop, 2x on
 * the flop, 1x on the river or fold; the dealer opens with a pair or better.
 */

export interface UthLimits {
  minAnte: number
  maxAnte: number
  minTrips: number
  maxTrips: number
}

export const UTH_LIMITS: UthLimits = { minAnte: 15, maxAnte: 1_000, minTrips: 5, maxTrips: 100 }

export const UTH_STARTING_BANKROLL = 1_000

/** The Blind pays only when you win, and only on a straight or better. Otherwise it pushes. */
export const BLIND_PAYS: Partial<Record<Category, number>> = {
  royal: 500,
  straightFlush: 50,
  quads: 10,
  fullHouse: 3,
  flush: 1.5,
  straight: 1,
}

export type TripsTableId = 'standard' | 'generous' | 'tight'

export interface TripsTable {
  id: TripsTableId
  name: string
  pays: Partial<Record<Category, number>>
}

/**
 * The three Trips pay tables you meet on the Strip. They differ only on the
 * full house, flush and straight, and that is a swing from under 1% to 3.5%.
 */
export const TRIPS_TABLES: Record<TripsTableId, TripsTable> = {
  standard: {
    id: 'standard',
    name: '50-40-30-8-6-5-3',
    pays: { royal: 50, straightFlush: 40, quads: 30, fullHouse: 8, flush: 6, straight: 5, trips: 3 },
  },
  generous: {
    id: 'generous',
    name: '50-40-30-9-7-4-3',
    pays: { royal: 50, straightFlush: 40, quads: 30, fullHouse: 9, flush: 7, straight: 4, trips: 3 },
  },
  tight: {
    id: 'tight',
    name: '50-40-30-8-7-4-3',
    pays: { royal: 50, straightFlush: 40, quads: 30, fullHouse: 8, flush: 7, straight: 4, trips: 3 },
  },
}

export const DEFAULT_TRIPS_TABLE: TripsTableId = 'standard'

/**
 * How often each hand turns up as the best five of seven cards — every one of
 * the 133,784,560 seven-card hands a deck holds, counted. Trips is paid on
 * nothing else, so its edge is exact.
 */
export const SEVEN_CARD_HANDS: Record<Category, number> = {
  royal: 4_324,
  straightFlush: 37_260,
  quads: 224_848,
  fullHouse: 3_473_184,
  flush: 4_047_644,
  straight: 6_180_020,
  trips: 6_461_620,
  twoPair: 31_433_400,
  pair: 58_627_800,
  high: 23_294_460,
}

export const SEVEN_CARD_TOTAL = 133_784_560

/** The house's edge on Trips under a pay table. */
export function tripsEdge(table: TripsTable): number {
  let ev = 0
  for (const [category, count] of Object.entries(SEVEN_CARD_HANDS) as Array<[Category, number]>) {
    const pays = table.pays[category]
    ev += (pays === undefined ? -1 : pays) * count
  }
  return -ev / SEVEN_CARD_TOTAL
}

/**
 * The main game with perfect play: the house keeps 2.185% of the Ante. Spread
 * over everything a player actually puts out — Ante, Blind and an average raise
 * — that is 0.53% of the money in action, which is how it compares with a
 * blackjack shoe. (Wizard of Odds' combinatorial analysis; an exhaustive count
 * of every board, starting hand and dealer hand gives the same 2.1850% and
 * 0.526%.) The coach plays this way: the chart, the flop worked out exactly,
 * and the river worked out exactly.
 */
export const UTH_HOUSE_EDGE = 0.02185
export const UTH_ELEMENT_OF_RISK = 0.00526
/**
 * The book's simple rules — the 4x chart, the flop rule, and calling the river
 * with fewer than 21 dealer outs — counted out exactly over every hand. The
 * Wizard publishes 2.43% for his version, which also calls the river with any
 * hidden pair; that clause costs a little, so the book leaves it out.
 */
export const UTH_SIMPLE_STRATEGY_EDGE = 0.02366
