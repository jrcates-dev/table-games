import { describe, expect, it } from 'vitest'
import { advance, fade, flightPath, type Particle } from './celebrate'

const spark = (): Particle => ({ x: 100, y: 200, vx: 3, vy: -4, life: 0, max: 60, size: 2, color: '#fff', spin: 0.1, angle: 0.5, kind: 'sparks' })

describe('flightPath', () => {
  it('starts where the particle is launched and leaves it untouched', () => {
    const p = spark()
    const path = flightPath(p, 5)
    expect(path[0]).toEqual({ x: 100, y: 200, angle: 0.5, alpha: 1 })
    expect(p).toEqual(spark())
  })

  it('lands where the canvas would have drawn it, faded out', () => {
    const p = spark()
    for (let i = 0; i < p.max; i++) advance(p)
    const path = flightPath(spark(), 7)
    const last = path[path.length - 1]
    expect(path).toHaveLength(7)
    expect(last.x).toBeCloseTo(p.x)
    expect(last.y).toBeCloseTo(p.y)
    expect(last.angle).toBeCloseTo(p.angle)
    expect(last.alpha).toBe(fade(p))
    expect(last.alpha).toBe(0)
  })

  it('falls under gravity after it rises', () => {
    const ys = flightPath({ ...spark(), kind: 'coins', vy: -8, max: 120 }, 12).map((at) => at.y)
    const top = Math.min(...ys)
    expect(top).toBeLessThan(ys[0])
    expect(ys[ys.length - 1]).toBeGreaterThan(top)
  })
})
