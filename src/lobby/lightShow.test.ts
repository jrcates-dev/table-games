import { describe, expect, it } from 'vitest'
import { BANKS, BULBS, bankKeyframes, SHOW, SHOW_MS, UNLIT } from './lightShow'

/** Whether a bank is lit at a moment of the show, read back from its keyframes. */
function litAt(bank: number, ms: number): boolean {
  const frames = bankKeyframes(bank)
  const at = ms / SHOW_MS
  let current = frames[0]
  for (const frame of frames) if ((frame.offset as number) <= at) current = frame
  return current.opacity === 1
}

describe('the marquee light show', () => {
  it('has a bulb count every pattern divides, so no pattern stutters where the loop closes', () => {
    expect(BULBS.length % BANKS).toBe(0)
    expect(BANKS % 3).toBe(0)
    expect(BANKS % 2).toBe(0)
  })

  it('gives every bank keyframes the Web Animations API accepts', () => {
    for (let bank = 0; bank < BANKS; bank++) {
      const frames = bankKeyframes(bank)
      expect(frames[0].offset).toBe(0)
      expect(frames.at(-1)?.offset).toBe(1)
      for (let i = 1; i < frames.length; i++) {
        expect(frames[i].offset as number).toBeGreaterThanOrEqual(frames[i - 1].offset as number)
      }
      for (const frame of frames) expect([1, UNLIT]).toContain(frame.opacity)
    }
  })

  it('plays back every beat as it is written', () => {
    let at = 0
    for (const beat of SHOW) {
      const middle = at + beat.ms / 2
      for (let bank = 0; bank < BANKS; bank++) expect(litAt(bank, middle)).toBe(beat.lit(bank))
      at += beat.ms
    }
  })

  it('opens with a clockwise chase: a third of the bulbs lit, stepping one bulb on each beat', () => {
    const beat = SHOW[0].ms
    const litBulbs = (ms: number) => BULBS.map((_, i) => litAt(i % BANKS, ms))
    const first = litBulbs(beat / 2)
    const second = litBulbs(beat * 1.5)
    expect(first.filter(Boolean)).toHaveLength(BULBS.length / 3)
    // What was lit at bulb i is lit at bulb i + 1 a beat later.
    first.forEach((on, i) => expect(second[(i + 1) % BULBS.length]).toBe(on))
  })
})
