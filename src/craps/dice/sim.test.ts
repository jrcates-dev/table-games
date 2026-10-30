import { describe, expect, it } from 'vitest'
import { DICE } from '../layout'
import { bestThrow } from './sim'

/**
 * With the bet rail or a drawer over the far end, the dice are thrown down a
 * lane nearer the shooter so they land where the player can see them. A lane
 * is only worth choosing if throws down it really do finish in it.
 */
describe('dice lanes', () => {
  // Real dice wander; a die or so past the zone's edge is still where it was sent.
  const slack = 3 * DICE.scale

  for (const lane of DICE.lanes) {
    it(`throws sent ${lane}px nearer the shooter come to rest in that lane`, () => {
      for (let i = 0; i < 5; i++) {
        const t = bestThrow((i * 2654435761) >>> 0, 8, lane)
        for (const r of t.rest) {
          expect(r.x).toBeGreaterThan(DICE.zone.x0 - lane - slack)
          expect(r.x).toBeLessThan(DICE.zone.x1 - lane + slack)
          expect(r.y).toBeGreaterThan(DICE.walls.y0)
          expect(r.y).toBeLessThan(DICE.zone.y1 + slack)
        }
      }
    })
  }
})
