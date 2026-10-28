import type { BaccaratBetKind, BaccaratLimits } from './types'

/**
 * Mini-baccarat on a Strip main floor: eight decks dealt from a shoe, the
 * Banker paid 95 cents on the dollar, the tie at 8 to 1, and the two side bets
 * every pit runs beside it — the pairs and the Dragon Bonus.
 */
export const BACCARAT_DECKS = 8
/** The cut card goes in sixteen from the back; the coup it comes out on is the last. */
export const BACCARAT_PENETRATION = (BACCARAT_DECKS * 52 - 16) / (BACCARAT_DECKS * 52)
export const BANKER_COMMISSION = 0.05
export const TIE_PAYS = 8
export const PAIR_PAYS = 11

/**
 * The Dragon Bonus, by margin of victory on a hand that drew. A natural that
 * wins pays even money whatever the margin; a natural tie pushes.
 */
export const DRAGON_MARGIN_PAYS: Readonly<Record<number, number>> = { 9: 30, 8: 10, 7: 6, 6: 4, 5: 2, 4: 1 }

export const BACCARAT_LIMITS: BaccaratLimits = {
  minBet: 25,
  maxBet: 10_000,
  minSide: 5,
  maxSide: 500,
}

export const BACCARAT_STARTING_BANKROLL = 1_000

export interface BaccaratBetSpec {
  kind: BaccaratBetKind
  title: string
  short: string
  pays: string
  side: boolean
  /** House edge off the top of a fresh eight-deck shoe, ties included. */
  edge: number
  wins: string
  loses: string
  blurb: string
}

/**
 * Every wager, with its edge off the top of a full shoe. These are exact: the
 * tests enumerate every way a coup can be dealt from eight decks, weighted by
 * the cards actually in them, and hold this card to the result.
 */
export const BACCARAT_BETS: Record<BaccaratBetKind, BaccaratBetSpec> = {
  banker: {
    kind: 'banker',
    title: 'Banker',
    short: 'Banker',
    pays: '19 to 20',
    side: false,
    edge: 0.010579,
    wins: 'Banker finishes closer to 9',
    loses: 'Player finishes closer to 9 · a tie pushes',
    blurb: 'The tableau favours the Banker hand, which wins 45.9% of coups to the Player’s 44.6%. The 5% commission is what keeps it from being a winning bet.',
  },
  player: {
    kind: 'player',
    title: 'Player',
    short: 'Player',
    pays: '1 to 1',
    side: false,
    edge: 0.012351,
    wins: 'Player finishes closer to 9',
    loses: 'Banker finishes closer to 9 · a tie pushes',
    blurb: 'Even money with no commission, and still a touch worse than the Banker: the Banker draws third, knowing what the Player did.',
  },
  tie: {
    kind: 'tie',
    title: 'Tie',
    short: 'Tie',
    pays: '8 to 1',
    side: false,
    edge: 0.143596,
    wins: 'Both hands finish on the same total',
    loses: 'Either hand wins',
    blurb: 'Ties come up about once in ten and a half coups. Paying 8 to 1 on a 9.5% chance leaves the house more than 14 cents of every dollar.',
  },
  playerPair: {
    kind: 'playerPair',
    title: 'Player Pair',
    short: 'P Pair',
    pays: '11 to 1',
    side: true,
    edge: 0.103614,
    wins: 'The Player’s first two cards are the same rank',
    loses: 'Any other two cards',
    blurb: 'A pair in the first two cards turns up 7.5% of the time from eight decks. The same for either side, and the same price.',
  },
  bankerPair: {
    kind: 'bankerPair',
    title: 'Banker Pair',
    short: 'B Pair',
    pays: '11 to 1',
    side: true,
    edge: 0.103614,
    wins: 'The Banker’s first two cards are the same rank',
    loses: 'Any other two cards',
    blurb: 'The mirror of the Player Pair: the Banker’s first two cards, same rank.',
  },
  dragonPlayer: {
    kind: 'dragonPlayer',
    title: 'Dragon Bonus · Player',
    short: 'Dragon P',
    pays: 'up to 30 to 1',
    side: true,
    edge: 0.026517,
    wins: 'Player wins with a natural, or by 4 or more',
    loses: 'Player loses, ties without a natural, or wins by 3 or less',
    blurb: 'Pays on the margin: 30 to 1 for winning by nine, down to even money for winning by four or with a natural. The best side bet in the pit.',
  },
  dragonBanker: {
    kind: 'dragonBanker',
    title: 'Dragon Bonus · Banker',
    short: 'Dragon B',
    pays: 'up to 30 to 1',
    side: true,
    edge: 0.093731,
    wins: 'Banker wins with a natural, or by 4 or more',
    loses: 'Banker loses, ties without a natural, or wins by 3 or less',
    blurb: 'The same pay table on the Banker side costs three and a half times as much — the Banker’s edge in the tableau comes from small wins, which the Dragon does not pay.',
  },
}

export const BACCARAT_ORDER: readonly BaccaratBetKind[] = [
  'banker',
  'player',
  'tie',
  'playerPair',
  'bankerPair',
  'dragonPlayer',
  'dragonBanker',
]
