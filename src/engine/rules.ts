import type { RuleSet, TableTier } from './types'

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
 * 17s — the high-limit standard, and the one this app deals by default. Late
 * surrender and resplitting aces are both on, which together with S17 is what
 * brings the edge down to roughly a quarter of a percent.
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
 * The low-limit tables. Naturals pay 6:5, which costs the player more than
 * every other rule on this list combined — included so the statistics panel
 * can show exactly how much.
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

export const DEFAULT_RULE_PRESET = 'ariaSalon'

/**
 * Table tiers. Higher limits unlock as the bankroll grows, which gives the
 * pure-bankroll economy a sense of progression without bolting on XP or levels.
 */
export const TABLE_TIERS: TableTier[] = [
  {
    id: 'bronze',
    name: 'The Parlour',
    minBet: 5,
    maxBet: 500,
    requiredBankroll: 0,
    accent: '#c98f4b',
  },
  {
    id: 'gold',
    name: 'Gold Room',
    minBet: 25,
    maxBet: 2500,
    requiredBankroll: 25_000,
    accent: '#e2b857',
  },
  {
    id: 'platinum',
    name: 'High Limit Salon',
    minBet: 100,
    maxBet: 10_000,
    requiredBankroll: 100_000,
    accent: '#cfd8e3',
  },
  {
    id: 'noir',
    name: 'Noir · Invitation Only',
    minBet: 500,
    maxBet: 50_000,
    requiredBankroll: 500_000,
    accent: '#9b7bd4',
  },
]

export const STARTING_BANKROLL = 1_000

export function tableById(id: string): TableTier {
  return TABLE_TIERS.find((t) => t.id === id) ?? TABLE_TIERS[0]
}

export function unlockedTables(peakBankroll: number): TableTier[] {
  return TABLE_TIERS.filter((t) => peakBankroll >= t.requiredBankroll)
}
