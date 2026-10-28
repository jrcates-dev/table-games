import { rankValue } from './cards'
import type { Card, PlayerHand } from './types'

export interface HandValue {
  /** Best total that does not bust, or the minimum total if the hand busted. */
  total: number
  /** True when an ace is still counted as 11. */
  soft: boolean
  busted: boolean
  /** Both totals when soft, e.g. [7, 17]. Used for the "7 / 17" display. */
  hard: number
}

/**
 * Standard blackjack evaluation: count every ace as 11, then demote aces to 1
 * one at a time while the total is over 21.
 */
export function evaluate(cards: readonly Card[]): HandValue {
  let total = 0
  let aces = 0
  for (const card of cards) {
    total += rankValue(card.rank)
    if (card.rank === 'A') aces++
  }
  let softAces = aces
  while (total > 21 && softAces > 0) {
    total -= 10
    softAces--
  }
  return {
    total,
    soft: softAces > 0,
    busted: total > 21,
    hard: softAces > 0 ? total - 10 : total,
  }
}

/**
 * A natural: exactly two cards totalling 21, and not the product of a split.
 * A split ten-and-ace is a plain 21 and pays even money.
 */
export function isNatural(hand: PlayerHand): boolean {
  return !hand.fromSplit && hand.cards.length === 2 && evaluate(hand.cards).total === 21
}

export function isDealerNatural(dealer: readonly Card[]): boolean {
  return dealer.length === 2 && evaluate(dealer).total === 21
}

/** Formats the total for the felt badge — soft hands show both readings. */
export function formatTotal(cards: readonly Card[]): string {
  const value = evaluate(cards)
  if (value.busted) return `${value.total}`
  if (value.soft && value.hard !== value.total) return `${value.hard}/${value.total}`
  return `${value.total}`
}
