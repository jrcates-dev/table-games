import { tableDenominations } from '../components/chips'
import type { TipContent } from '../components/tip'
import { fortuneEdge } from '../engine/paigow/fortune'
import { PAIGOW_EDGE, PAIGOW_EDGE_NO_COMMISSION, type PaiGowRules } from '../engine/paigow/rules'
import type { PaiGowState } from '../engine/paigow/types'
import { money } from '../lib/format'
import type { PaiGowSpotKind } from './geometry'

/** The rack: reds up, since Fortune starts at $5. */
export function paigowDenominations(game: Pick<PaiGowState, 'limits'>) {
  return tableDenominations(game.limits.minFortune, game.limits.maxBet)
}

export function mainEdge(rules: PaiGowRules): number {
  return rules.commissionFree ? PAIGOW_EDGE_NO_COMMISSION : PAIGOW_EDGE
}

export const FORTUNE_EDGE = fortuneEdge()

/** The hover card for a circle. */
export function tipFor(game: PaiGowState, kind: PaiGowSpotKind, showEdges: boolean): TipContent {
  const open = game.phase === 'betting' || game.phase === 'showdown'
  const on = game.phase === 'showdown' ? 0 : game.bets[kind]
  const reason = open ? undefined : 'No more bets — the hand is out'
  if (kind === 'fortune') {
    return {
      title: 'Fortune Bonus',
      pays: 'up to 8,000 to 1',
      wins: 'A straight or better in your seven cards, however you set them — even a foul',
      loses: 'Anything less',
      edge: showEdges ? FORTUNE_EDGE : undefined,
      edgeNote: showEdges ? 'counted over all 154 million hands' : undefined,
      hint: on > 0 ? `${money(on)} down · click adds · right-click takes it back` : `${money(game.limits.minFortune)} – ${money(game.limits.maxFortune)} · optional`,
      reason,
    }
  }
  return {
    title: 'Bet',
    pays: game.rules.commissionFree ? '1 to 1, no commission' : '1 to 1, less 5% commission',
    wins: game.rules.commissionFree ? 'Both your hands beat the dealer’s — but a dealer’s queen-high pai gow pushes it' : 'Both your hands beat the dealer’s',
    loses: 'Both lose, copies included — or a foul. One each is a push.',
    edge: showEdges ? mainEdge(game.rules) : undefined,
    edgeNote: showEdges ? 'set the house way' : undefined,
    hint: on > 0 ? `${money(on)} down · click adds · right-click takes it back` : `${money(game.limits.minBet)} – ${money(game.limits.maxBet)}`,
    reason,
  }
}

/** Where a pointer target lives: a circle on the felt, or its row on the rail. */
export function spotKind(id: string): PaiGowSpotKind {
  return (id.startsWith('rail:') ? id.slice(5) : id) as PaiGowSpotKind
}

/** An EV in bets, signed: "+0.31", "−0.04". */
export const bets = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`
