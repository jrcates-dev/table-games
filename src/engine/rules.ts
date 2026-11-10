import type { RuleSet, TableLimits } from './types'

/**
 * Vegas Strip, the classic high-limit standard and our default.
 *
 * Six decks, dealer stands on all 17s, naturals pay 3:2, double on any two
 * cards, double after split, split to four hands, split aces get exactly one
 * card each and cannot be resplit, dealer peeks for a natural.
 */
export const VEGAS_STRIP: RuleSet = {
  decks: 6,
  dealerHitsSoft17: false,
  blackjackPayout: 1.5,
  doubleAfterSplit: true,
  doubleOn: 'any',
  maxSplitHands: 4,
  resplitAces: false,
  hitSplitAces: false,
  surrender: 'none',
  dealerPeek: true,
  insurancePayout: 2,
  penetration: 0.75,
}

/** Modern Strip / downtown: same shape but the dealer hits soft 17. */
export const DOWNTOWN_H17: RuleSet = {
  ...VEGAS_STRIP,
  dealerHitsSoft17: true,
  surrender: 'late',
}

export const SINGLE_DECK: RuleSet = {
  ...VEGAS_STRIP,
  decks: 1,
  doubleAfterSplit: false,
  doubleOn: '10-11',
  maxSplitHands: 2,
  penetration: 0.6,
}

/**
 * Aria, 2026.
 *
 * The best shoe game in the building is the six-deck table that stands on all
 * 17s — the high-limit standard. Late surrender and resplitting aces are both
 * on, which together with S17 is what brings the edge down to roughly a
 * quarter of a percent.
 */
export const ARIA_SALON: RuleSet = {
  decks: 6,
  dealerHitsSoft17: false,
  blackjackPayout: 1.5,
  doubleAfterSplit: true,
  doubleOn: 'any',
  maxSplitHands: 4,
  resplitAces: true,
  hitSplitAces: false,
  surrender: 'late',
  dealerPeek: true,
  insurancePayout: 2,
  penetration: 0.75,
}

/** Aria's $25 main-floor shoe: the same game, except the dealer hits soft 17. */
export const ARIA_MAIN_FLOOR: RuleSet = {
  ...ARIA_SALON,
  dealerHitsSoft17: true,
}

/** Aria's pitch game: two decks, stands on soft 17, double after split. */
export const ARIA_DOUBLE_DECK: RuleSet = {
  ...ARIA_SALON,
  decks: 2,
  resplitAces: false,
  surrender: 'none',
  penetration: 0.62,
}

/**
 * The low-limit tables, and the game most of the Strip deals today: six decks,
 * the dealer hits soft 17, and naturals pay 6:5, which costs the player more
 * than every other rule on this list combined. A new player sits down here, as
 * they would walking in off the floor; the 3:2 tables are a choice away in
 * Settings, and the statistics panel shows exactly what the difference costs.
 */
export const ARIA_SIX_FIVE: RuleSet = {
  ...ARIA_SALON,
  dealerHitsSoft17: true,
  blackjackPayout: 1.2,
  resplitAces: false,
  surrender: 'none',
}

/**
 * The tables on offer. `houseEdge` is the house's edge against perfect basic
 * strategy off the top of a fresh shoe, worked out exactly for these rules, as
 * a fraction of the initial bet. It is what the count has to overcome before
 * raising a bet makes sense.
 */
export const RULE_PRESETS: Record<string, { name: string; rules: RuleSet; houseEdge: number }> = {
  ariaSalon: { name: 'Aria High Limit · 6 Deck · S17 · 3:2', rules: ARIA_SALON, houseEdge: 0.0027 },
  ariaMainFloor: { name: 'Aria Main Floor · 6 Deck · H17 · 3:2', rules: ARIA_MAIN_FLOOR, houseEdge: 0.0047 },
  ariaDoubleDeck: { name: 'Aria Double Deck · S17 · 3:2', rules: ARIA_DOUBLE_DECK, houseEdge: 0.0019 },
  ariaSixFive: { name: 'Aria Low Limit · 6 Deck · H17 · 6:5', rules: ARIA_SIX_FIVE, houseEdge: 0.0198 },
  vegasStrip: { name: 'Classic Strip · 6 Deck · S17 · No Surrender', rules: VEGAS_STRIP, houseEdge: 0.0041 },
  downtownH17: { name: 'Downtown · 6 Deck · H17 · Surrender', rules: DOWNTOWN_H17, houseEdge: 0.0053 },
  singleDeck: { name: 'Single Deck · Classic', rules: SINGLE_DECK, houseEdge: 0.0026 },
}

/** Where a new player sits down: the low-limit 6:5 shoe (see ARIA_SIX_FIVE). */
export const DEFAULT_RULE_PRESET = 'ariaSixFive'

/** What the blackjack table takes in the circle. */
export const BLACKJACK_TABLE: TableLimits = { minBet: 5, maxBet: 500 }

export const STARTING_BANKROLL = 1_000
