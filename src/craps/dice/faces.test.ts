import { describe, expect, it } from 'vitest'
import { axisAngle, FACE_NORMAL, faceUp, multiply, relabel, rotate, type Q4 } from './faces'

/**
 * The dice are thrown by a physics simulation that knows nothing about the
 * engine's result, then re-labelled so the engine's numbers land face up. These
 * tests are what make that honest: whatever orientation the simulation ends
 * in, the re-labelled die shows exactly the number it was asked to.
 */

function randomQuat(seed: number): Q4 {
  const r = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  const axis: [number, number, number] = [r(1) - 0.5, r(2) - 0.5, r(3) - 0.5]
  return axisAngle(axis, r(4) * Math.PI * 2)
}

describe('dice faces', () => {
  it('has opposite faces summing to seven', () => {
    for (const face of [1, 2, 3]) {
      const a = FACE_NORMAL[face]
      const b = FACE_NORMAL[7 - face]
      expect(a[0] + b[0]).toBe(0)
      expect(a[1] + b[1]).toBe(0)
      expect(a[2] + b[2]).toBe(0)
    }
  })

  it('carries every face onto every other face', () => {
    for (let want = 1; want <= 6; want++) {
      for (let got = 1; got <= 6; got++) {
        const moved = rotate(relabel(want, got), FACE_NORMAL[want])
        const target = FACE_NORMAL[got]
        expect(moved[0]).toBeCloseTo(target[0], 6)
        expect(moved[1]).toBeCloseTo(target[1], 6)
        expect(moved[2]).toBeCloseTo(target[2], 6)
      }
    }
  })

  it('shows the requested number whatever the simulated die landed on', () => {
    for (let seed = 1; seed <= 200; seed++) {
      // A resting die is flat, so snap a random orientation to its nearest face.
      const q = randomQuat(seed)
      const simulated = faceUp(q)
      for (let want = 1; want <= 6; want++) {
        const drawn = multiply(q, relabel(want, simulated))
        expect(faceUp(drawn)).toBe(want)
      }
    }
  })
})
