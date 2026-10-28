import { createRng, seedRng, shuffle, type Rng, type Seed } from './rng'
import { RANKS, SUITS, type Card, type Rank, type ShoeState } from './types'

/** Blackjack value of a rank. Aces are returned as 11 and reduced by the hand. */
export function rankValue(rank: Rank): number {
  if (rank === 'A') return 11
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank)
}

export function isTen(rank: Rank): boolean {
  return rankValue(rank) === 10
}

/**
 * Two cards are splittable when they share a *value*, not a rank — a King and a
 * Jack are a legal split at every casino in Nevada.
 */
export function sameSplitValue(a: Rank, b: Rank): boolean {
  return rankValue(a) === rankValue(b)
}

function buildShoeCards(decks: number): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${rank}${suit}-${d}`, rank, suit })
      }
    }
  }
  return cards
}

export function createShoe(decks: number, penetration: number, seed: Seed): ShoeState {
  return shuffled(decks, penetration, createRng(seedRng(seed)), 0)
}

/**
 * Reshuffle in place of the old shoe. The generator carries on from where the
 * last shuffle left it, so a whole session is one continuous stream.
 */
export function reshuffle(shoe: ShoeState, penetration: number): ShoeState {
  return shuffled(shoe.decks, penetration, createRng(shoe.rng), shoe.shuffleCount + 1)
}

function shuffled(decks: number, penetration: number, rng: Rng, shuffleCount: number): ShoeState {
  const cards = shuffle(buildShoeCards(decks), rng)
  return {
    cards,
    pos: 0,
    cutIndex: Math.floor(cards.length * penetration),
    decks,
    rng: rng.state(),
    shuffleCount,
  }
}

/**
 * Draw one card. Returns the card plus the advanced shoe so callers stay pure.
 * If the shoe somehow runs dry mid-round we wrap rather than throw, because
 * stranding a player mid-hand is worse than a vanishingly rare repeat.
 */
export function draw(shoe: ShoeState): { card: Card; shoe: ShoeState } {
  const pos = shoe.pos % shoe.cards.length
  return { card: shoe.cards[pos], shoe: { ...shoe, pos: shoe.pos + 1 } }
}

/** True once the cut card has been passed; the shoe is retired after the round. */
export function needsShuffle(shoe: ShoeState): boolean {
  return shoe.pos >= shoe.cutIndex
}

/** Decks still behind the cut card, used for the true-count divisor. */
export function decksRemaining(shoe: ShoeState): number {
  return Math.max(0.25, (shoe.cards.length - shoe.pos) / 52)
}

/** How far into the shoe we are, 0..1, for the penetration meter. */
export function penetrationPct(shoe: ShoeState): number {
  return Math.min(1, shoe.pos / shoe.cards.length)
}
