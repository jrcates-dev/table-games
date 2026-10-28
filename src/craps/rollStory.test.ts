import { describe, expect, it } from 'vitest'
import * as c from '../engine/craps/craps'
import { CRAPS_TABLES, limitsFor } from '../engine/craps/rules'
import type { BetKind, CrapsState, DieFace } from '../engine/craps/types'
import { explainRoll } from './rollStory'

const LIMITS = limitsFor(CRAPS_TABLES[0]) // $10 min, 3-4-5x odds

function game(): CrapsState {
  return c.createGame(100_000, 1, LIMITS)
}

function bet(state: CrapsState, kind: BetKind, amount: number, number?: number): CrapsState {
  return c.placeBet(state, kind, amount, number)
}

/** Throw a pair and explain it, the way the store does. */
function explain(state: CrapsState, a: DieFace, b: DieFace) {
  const before = c.rollExactly(state, a, b)
  const after = c.settle(before)
  return { after, story: explainRoll(before, after)! }
}

function item(story: ReturnType<typeof explain>['story'], id: string) {
  return story.items.find((i) => i.id === id)
}

describe('what happened last roll', () => {
  it('accounts for every bet the dice met, once, and nets to the roll', () => {
    let s = bet(game(), 'passLine', 10)
    s = c.settle(c.rollExactly(s, 4, 2)) // point 6
    for (const [kind, amount, n] of [
      ['passOdds', 50], ['place', 12, 8], ['buy', 20, 4], ['lay', 40, 10], ['hard', 5, 8],
      ['come', 10], ['field', 10], ['horn', 4], ['fire', 5],
    ] as Array<[BetKind, number, number?]>) {
      s = bet(s, kind, amount, n)
    }

    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        const { after, story } = explain(s, a as DieFace, b as DieFace)
        const ids = story.items.map((i) => i.id).filter((id) => id !== 'commission')
        expect(ids.slice().sort()).toEqual(Object.keys(s.bets).sort())
        expect(story.net).toBe(after.resolutions.reduce((sum, r) => sum + r.net, 0))
        const decided = story.items.filter((i) => i.outcome === 'won' || i.outcome === 'lost')
        expect(decided.reduce((sum, i) => sum + i.amount, 0)).toBe(story.net)
        for (const i of story.items) expect(i.why.length).toBeGreaterThan(0)
      }
    }
  })

  it('says why a field bet lost and a place bet won on the same 8', () => {
    let s = c.settle(c.rollExactly(bet(game(), 'passLine', 10), 4, 2))
    s = bet(bet(s, 'field', 10), 'place', 12, 8)
    const { story } = explain(s, 5, 3)

    expect(story.headline).toBe('Easy 8')
    expect(item(story, 'field')).toMatchObject({ outcome: 'lost', amount: -10, why: 'The field loses on 5, 6, 7 and 8.' })
    expect(item(story, 'place-8')).toMatchObject({ outcome: 'won', amount: 14, fate: 'Your $12 stays up.' })
    expect(item(story, 'place-8')!.why).toContain('pays 7:6')
    expect(item(story, 'passLine')).toMatchObject({ outcome: 'waiting', why: 'Wins on 6, loses on 7.' })
    expect(story.waitingLabel).toBe('Not decided by an 8')
  })

  it('tells a bet that sat out the come-out from one that lost', () => {
    let s = c.settle(c.rollExactly(bet(game(), 'passLine', 10), 4, 2))
    s = bet(bet(s, 'place', 12, 8), 'hard', 5, 8)
    s = c.settle(c.rollExactly(s, 3, 3)) // point made, back to a come-out
    const { story } = explain(s, 4, 3)

    expect(item(story, 'passLine')).toMatchObject({ outcome: 'won' })
    expect(item(story, 'passLine')!.why).toContain('natural')
    expect(item(story, 'place-8')).toMatchObject({ outcome: 'off', amount: 12 })
    expect(item(story, 'place-8')!.why).toContain('off on the come-out')
    expect(item(story, 'hard-8')).toMatchObject({ outcome: 'waiting' })
    expect(item(story, 'hard-8')!.why).toContain('Off on the come-out')
  })

  it('reports the point against both line bets', () => {
    const s = bet(bet(game(), 'passLine', 10), 'dontPass', 10)
    const { story } = explain(s, 5, 4)

    expect(story.headline).toBe('The point is 9')
    expect(item(story, 'passLine')).toMatchObject({ outcome: 'point' })
    expect(item(story, 'dontPass')).toMatchObject({ outcome: 'point' })
    expect(item(story, 'dontPass')!.why).toContain('a 7 before another 9')
  })

  it('explains a seven-out bet by bet', () => {
    let s = c.settle(c.rollExactly(bet(game(), 'passLine', 10), 5, 4)) // point 9
    s = bet(bet(s, 'passOdds', 40), 'hard', 5, 6)
    const { story } = explain(s, 6, 1)

    expect(story.headline).toBe('Seven out')
    expect(story.summary).toContain('point (9)')
    expect(item(story, 'passLine')).toMatchObject({ outcome: 'lost', why: 'A 7 came before the point 9.' })
    expect(item(story, 'passOdds')).toMatchObject({ outcome: 'lost', amount: -40 })
    expect(item(story, 'hard-6')).toMatchObject({ outcome: 'lost', why: 'A 7 takes the hardways.' })
  })

  it('says a come bet moved rather than won or lost', () => {
    let s = c.settle(c.rollExactly(bet(game(), 'passLine', 10), 4, 2))
    s = bet(s, 'come', 10)
    const { story } = explain(s, 3, 2)

    expect(item(story, 'come')).toMatchObject({ outcome: 'moved', amount: 10 })
    expect(item(story, 'come')!.why).toContain('moves to the 5')
  })

  it('shows come odds handed back, not lost, on a come-out 7', () => {
    let s = c.settle(c.rollExactly(bet(game(), 'passLine', 10), 5, 3)) // point 8
    s = c.settle(c.rollExactly(bet(s, 'come', 10), 5, 4)) // come bet to the 9
    s = c.settle(c.rollExactly(bet(s, 'comeOdds', 40, 9), 4, 4)) // point made, new come-out
    const { story } = explain(s, 3, 4)

    expect(item(story, 'passLine')).toMatchObject({ outcome: 'won', amount: 10 })
    expect(item(story, 'comePoint-9')).toMatchObject({ outcome: 'lost', amount: -10 })
    expect(item(story, 'comePoint-9')!.why).toContain('work on the come-out too')
    expect(item(story, 'comeOdds-9')).toMatchObject({
      outcome: 'off',
      amount: 40,
      why: 'Come odds are off on the come-out, so the 7 could not take them.',
      fate: 'Your $40 comes back.',
    })
    expect(story.net).toBe(0)
  })

  it('shows pass odds that were turned off handed back on a seven-out', () => {
    let s = c.settle(c.rollExactly(bet(game(), 'passLine', 10), 5, 4)) // point 9
    s = c.toggleWorking(bet(s, 'passOdds', 40), 'passOdds')
    const { story } = explain(s, 6, 1)

    expect(item(story, 'passLine')).toMatchObject({ outcome: 'lost', amount: -10 })
    expect(item(story, 'passOdds')).toMatchObject({ outcome: 'off', amount: 40, fate: 'Your $40 comes back.' })
    expect(item(story, 'passOdds')!.why).toContain('turned off')
    expect(story.net).toBe(-10)
  })
})
