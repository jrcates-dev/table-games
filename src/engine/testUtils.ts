import { createGame } from './blackjack'
import { VEGAS_STRIP } from './rules'
import type { Card, GameState, Rank, RuleSet, Suit } from './types'

/**
 * Parse a card shorthand like `AS`, `10H`, `KD` into a Card. Used only by tests
 * to stack the shoe so rule behaviour can be asserted deterministically.
 */
export function card(code: string, index = 0): Card {
  const suit = code.slice(-1) as Suit
  const rank = code.slice(0, -1) as Rank
  return { id: `${rank}${suit}-t${index}`, rank, suit }
}

/**
 * Build a game whose shoe deals `codes` in order, followed by the normal
 * shuffled remainder so the shoe never runs dry.
 */
export function stackedGame(
  codes: string[],
  overrides: Partial<RuleSet> = {},
  bankroll = 10_000,
): GameState {
  const rules = { ...VEGAS_STRIP, ...overrides }
  const game = createGame(rules, bankroll, 1234)
  const stacked = codes.map((code, i) => card(code, i))
  return {
    ...game,
    shoe: { ...game.shoe, cards: [...stacked, ...game.shoe.cards] },
  }
}

/** Deal order is player, dealer-up, player, dealer-hole. */
export function openingOrder(
  player: [string, string],
  dealer: [string, string],
): string[] {
  return [player[0], dealer[0], player[1], dealer[1]]
}
