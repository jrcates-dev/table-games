import * as bac from '../engine/baccarat/baccarat'
import { BACCARAT_BETS, BANKER_COMMISSION, PAIR_PAYS, TIE_PAYS } from '../engine/baccarat/rules'
import type { BaccaratBetKind, BaccaratState } from '../engine/baccarat/types'
import { cents } from '../engine/edge'
import { tableDenominations } from '../components/chips'
import type { TipContent } from '../components/tip'
import { money } from '../lib/format'
import type { LiveOdds } from '../store/baccaratStore'

/** What a bet of this size wins if it comes in — the best case, for the Dragon. */
export function potentialWin(kind: BaccaratBetKind, amount: number): { amount: number; upTo: boolean } {
  switch (kind) {
    case 'player':
      return { amount, upTo: false }
    case 'banker':
      return { amount: cents(amount * (1 - BANKER_COMMISSION)), upTo: false }
    case 'tie':
      return { amount: amount * TIE_PAYS, upTo: false }
    case 'playerPair':
    case 'bankerPair':
      return { amount: amount * PAIR_PAYS, upTo: false }
    case 'dragonPlayer':
    case 'dragonBanker':
      return { amount: amount * 30, upTo: true }
  }
}

/**
 * The hover card for a spot on the apron.
 *
 * The edge it leads with is the one off the top of a full eight-deck shoe:
 * at a real table nobody knows what is left in the shoe, so that is the price
 * of the bet as far as the player can tell. With live odds on, the same bet
 * priced from the cards actually left follows underneath, smaller.
 */
export function tipFor(game: BaccaratState, kind: BaccaratBetKind, live: LiveOdds, showEdges: boolean): TipContent {
  const spec = BACCARAT_BETS[kind]
  const check = bac.canPlace(game.phase === 'settled' ? bac.nextCoup(game) : game, kind)
  const on = game.phase === 'settled' ? 0 : game.bets[kind] ?? 0
  const min = bac.minFor(game, kind)
  const max = bac.maxFor(game, kind)
  const shoe = showEdges && live.live
  return {
    title: spec.title,
    pays: spec.pays,
    wins: spec.wins,
    loses: spec.loses,
    edge: showEdges ? spec.edge : undefined,
    edgeNote: shoe ? 'standard eight-deck odds' : undefined,
    shoeEdge: shoe ? live.edges[kind] : undefined,
    shoeNote: shoe ? `This shoe · ${live.cardsLeft} cards left` : undefined,
    hint: on > 0 ? `${money(on)} down · click adds · right-click takes it back` : `${money(min)} – ${money(max)}`,
    reason: check.ok ? undefined : check.reason,
  }
}

/** The bet a hovered spot stands for: an apron spot, or its row on the rail. */
export function spotKind(id: string): BaccaratBetKind {
  return (id.startsWith('rail:') ? id.slice(5) : id) as BaccaratBetKind
}

/** The rack: reds up, since the side bets start at $5. */
export function baccaratDenominations(maxBet: number) {
  return tableDenominations(5, maxBet)
}
