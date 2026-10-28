/**
 * How expensive a wager is, in five words.
 *
 * Every table in the building prices its bets on the same scale, so a player
 * who has learned that a red pill means "don't" at the craps table can read
 * the roulette layout and the baccarat apron without being told again. The
 * thresholds are the house's expected win per dollar of the bet's own stake.
 */
export type EdgeBand = 'none' | 'low' | 'fair' | 'poor' | 'terrible'

export function edgeBand(edge: number): EdgeBand {
  if (edge <= 0) return 'none'
  if (edge < 0.02) return 'low'
  if (edge < 0.05) return 'fair'
  if (edge < 0.1) return 'poor'
  return 'terrible'
}

/** How bad a bet is, in one word, for the colour-coded pill. */
export const EDGE_LABEL: Record<EdgeBand, string> = {
  none: 'Fair',
  low: 'Good',
  fair: 'Fair-ish',
  poor: 'Costly',
  terrible: 'Sucker',
}

/** Whole dollars and cents, without the float drift of adding 0.95 a few hundred times. */
export function cents(amount: number): number {
  return Math.round(amount * 100) / 100
}
