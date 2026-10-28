import { tableDenominations } from '../components/chips'
import type { TipContent } from '../components/tip'
import { TRIPS_TABLES, tripsEdge, UTH_ELEMENT_OF_RISK, UTH_HOUSE_EDGE } from '../engine/uth/rules'
import type { UthDecision, UthState } from '../engine/uth/types'
import { money, percent } from '../lib/format'
import type { UthSpotKind } from './geometry'

/** The rack: reds up, since Trips starts at $5. */
export function uthDenominations(game: Pick<UthState, 'limits'>) {
  return tableDenominations(game.limits.minTrips, game.limits.maxAnte)
}

export const DECISION_LABEL: Record<UthDecision, string> = {
  check: 'Check',
  bet4: 'Bet 4x',
  bet3: 'Bet 3x',
  bet2: 'Bet 2x',
  bet1: 'Bet 1x',
  fold: 'Fold',
}

export const DECISION_MULTIPLE: Partial<Record<UthDecision, number>> = { bet4: 4, bet3: 3, bet2: 2, bet1: 1 }

/** The hover card for a circle. */
export function tipFor(game: UthState, kind: UthSpotKind, showEdges: boolean): TipContent {
  const open = game.phase === 'betting' || game.phase === 'showdown'
  const on = game.phase === 'showdown' ? 0 : game.bets[kind]
  const table = TRIPS_TABLES[game.tripsTable]
  const reason = open ? undefined : 'No more bets — the hand is out'
  switch (kind) {
    case 'trips':
      return {
        title: 'Trips',
        pays: 'up to 50 to 1',
        wins: 'Three of a kind or better in your best five — even if you fold',
        loses: 'Anything less',
        edge: showEdges ? tripsEdge(table) : undefined,
        edgeNote: showEdges ? `pay table ${table.name}` : undefined,
        hint: on > 0 ? `${money(on)} down · click adds · right-click takes it back` : `${money(game.limits.minTrips)} – ${money(game.limits.maxTrips)} · optional`,
        reason,
      }
    case 'ante':
    case 'blind':
      return {
        title: kind === 'ante' ? 'Ante' : 'Blind',
        pays: kind === 'ante' ? '1 to 1' : 'up to 500 to 1',
        wins: kind === 'ante' ? 'You beat the dealer — pushes if the dealer does not open with a pair' : 'You win with a straight or better; any other win pushes',
        loses: 'The dealer beats you, or you fold',
        edge: showEdges ? UTH_HOUSE_EDGE : undefined,
        edgeNote: showEdges ? `the whole game, played by the book · ${percent(UTH_ELEMENT_OF_RISK, 2)} of all you bet` : undefined,
        hint: on > 0 ? `${money(on)} each on Ante and Blind · click adds to both` : `${money(game.limits.minAnte)} – ${money(game.limits.maxAnte)} · Ante and Blind go down together`,
        reason,
      }
    case 'play':
      return {
        title: 'Play',
        pays: '1 to 1',
        wins: 'Your hand beats the dealer’s, qualified or not',
        loses: 'The dealer’s hand beats yours',
        hint: on > 0 ? `${money(on)} — ${game.raise}x the Ante` : '4x or 3x before the flop, 2x on the flop, 1x on the river — with the buttons below',
        reason: open ? 'The Play bet is made with the buttons once the cards are out' : undefined,
      }
  }
}

/** Where a pointer target lives: a circle on the felt, or its row on the rail. */
export function spotKind(id: string): UthSpotKind {
  return (id.startsWith('rail:') ? id.slice(5) : id) as UthSpotKind
}
