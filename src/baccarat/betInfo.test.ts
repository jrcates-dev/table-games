import { describe, expect, it } from 'vitest'
import * as b from '../engine/baccarat/baccarat'
import { coupOdds, houseEdges, remainingRanks } from '../engine/baccarat/odds'
import { BACCARAT_BETS, BACCARAT_DECKS, BACCARAT_LIMITS } from '../engine/baccarat/rules'
import type { Card } from '../engine/types'
import type { LiveOdds } from '../store/baccaratStore'
import { tipFor } from './betInfo'

const game = b.createGame(100_000, 7, BACCARAT_LIMITS)

/** A shoe with every 8 and 9 already gone: the Dragon and the main bets all move. */
function lateShoe(): LiveOdds {
  const seen: Pick<Card, 'rank'>[] = []
  for (let i = 0; i < BACCARAT_DECKS * 4; i++) seen.push({ rank: '8' }, { rank: '9' })
  const ranks = remainingRanks(BACCARAT_DECKS, seen)
  return { edges: houseEdges(ranks), odds: coupOdds(ranks), cardsLeft: BACCARAT_DECKS * 44, live: true }
}

describe('the hover card', () => {
  it('leads with the standard eight-deck edge and puts the shoe figure under it', () => {
    const live = lateShoe()
    for (const spec of Object.values(BACCARAT_BETS)) {
      const tip = tipFor(game, spec.kind, live, true)
      expect(tip.edge, spec.kind).toBe(spec.edge)
      expect(tip.shoeEdge, spec.kind).toBe(live.edges[spec.kind])
      expect(tip.shoeNote).toBe('This shoe · 352 cards left')
    }
    expect(live.edges.banker).not.toBeCloseTo(BACCARAT_BETS.banker.edge, 4)
  })

  it('shows only the standard edge when live odds are off', () => {
    const full = remainingRanks(BACCARAT_DECKS, [])
    const off: LiveOdds = { edges: houseEdges(full), odds: coupOdds(full), cardsLeft: BACCARAT_DECKS * 52, live: false }
    const tip = tipFor(game, 'tie', off, true)
    expect(tip.edge).toBe(BACCARAT_BETS.tie.edge)
    expect(tip.shoeEdge).toBeUndefined()
    expect(tip.edgeNote).toBeUndefined()
  })

  it('shows no edge at all when edges are turned off', () => {
    const tip = tipFor(game, 'banker', lateShoe(), false)
    expect(tip.edge).toBeUndefined()
    expect(tip.shoeEdge).toBeUndefined()
  })
})
