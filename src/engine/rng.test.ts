import { describe, expect, it } from 'vitest'
import { createShoe, reshuffle } from './cards'
import * as craps from './craps/craps'
import { CRAPS_TABLES, limitsFor } from './craps/rules'
import type { CrapsState } from './craps/types'
import { createRng, randomSeed, seedRng, shuffle } from './rng'
import { RANKS } from './types'

/**
 * The randomness itself: the generator, the shuffle, and the dice.
 *
 * The rules tests stack the shoe and force the dice, so none of them would
 * notice a crooked generator. These would. Every check is a chi-square against
 * what fair dice and a fair shuffle give, at a threshold a fair generator
 * misses once in ten thousand runs; they are seeded, so a pass stays a pass.
 *
 * A much longer audit (two billion rolls, PractRand, the whole of mulberry32's
 * cycle) is what retired the old generator; these keep the new one honest at a
 * size the suite can afford.
 */

/** Pearson's statistic, and whether it is inside the 1-in-10,000 tail. */
function fair(observed: number[], expected: number[], constraints = 1): { chi: number; ok: boolean } {
  let chi = 0
  for (let i = 0; i < observed.length; i++) chi += (observed[i] - expected[i]) ** 2 / expected[i]
  const df = observed.length - constraints
  // Wilson-Hilferty: the chi-square quantile at z = 3.72, p = 1e-4.
  const critical = df * (1 - 2 / (9 * df) + 3.72 * Math.sqrt(2 / (9 * df))) ** 3
  return { chi, ok: chi < critical }
}

const zeros = (cells: number): number[] => Array.from({ length: cells }, () => 0)
const flat = (total: number, cells: number): number[] => Array.from({ length: cells }, () => total / cells)

describe('the generator', () => {
  it('is sfc32, output for output', () => {
    // Reference values from the C implementation.
    const rng = createRng([1, 2, 3, 4])
    const raw = Array.from({ length: 8 }, () => rng.random() * 2 ** 32)
    expect(raw).toEqual([7, 34, 56623200, 188882296, 3431242869, 399395954, 785775158, 3843710725])
  })

  it('replays exactly from a seed', () => {
    const a = createRng(seedRng(20261023))
    const b = createRng(seedRng(20261023))
    for (let i = 0; i < 1000; i++) expect(a.random()).toBe(b.random())
  })

  it('carries on exactly from a saved state', () => {
    const whole = createRng(seedRng(7))
    const first = createRng(seedRng(7))
    for (let i = 0; i < 500; i++) expect(first.random()).toBe(whole.random())
    const resumed = createRng(first.state())
    for (let i = 0; i < 500; i++) expect(resumed.random()).toBe(whole.random())
  })

  it('tells apart seeds that differ only above 2^32', () => {
    expect(createRng(seedRng(5)).random()).not.toBe(createRng(seedRng(5 + 2 ** 32)).random())
  })

  it('takes four words of entropy for live play', () => {
    const seed = randomSeed()
    expect(seed).toHaveLength(4)
    expect(createRng(seedRng(seed)).random()).not.toBe(createRng(seedRng(randomSeed())).random())
  })

  it('draws every value below n equally often', () => {
    for (const n of [6, 13, 52, 312]) {
      const rng = createRng(seedRng(n))
      const draws = n * 2_000
      const counts = zeros(n)
      for (let i = 0; i < draws; i++) counts[rng.below(n)]++
      expect(fair(counts, flat(draws, n)).ok).toBe(true)
    }
  })
})

describe('the shuffle', () => {
  it('reaches every ordering of four cards equally often', () => {
    const rng = createRng(seedRng(4))
    const shuffles = 240_000
    const counts = new Map<string, number>()
    for (let i = 0; i < shuffles; i++) {
      const key = shuffle([0, 1, 2, 3], rng).join('')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect(counts.size).toBe(24)
    expect(fair([...counts.values()], flat(shuffles, 24)).ok).toBe(true)
  })

  it('puts every rank in every position of a six-deck shoe equally often', () => {
    const shoes = 2_600
    const n = 312
    const counts = zeros(13 * n)
    let shoe = createShoe(6, 0.75, 1013)
    for (let s = 0; s < shoes; s++) {
      shoe.cards.forEach((card, pos) => counts[RANKS.indexOf(card.rank) * n + pos]++)
      shoe = reshuffle(shoe, 0.75)
    }
    // Each position holds one card and each rank fills 24 slots per shoe.
    expect(fair(counts, flat(shoes * n, 13 * n), 13 + n - 1).ok).toBe(true)
  })

  it('never deals the same shoe twice in a row', () => {
    let shoe = createShoe(6, 0.75, 99)
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      seen.add(shoe.cards.map((c) => c.id).join())
      shoe = reshuffle(shoe, 0.75)
    }
    expect(seen.size).toBe(200)
  })
})

describe('the dice', () => {
  const LIMITS = limitsFor(CRAPS_TABLES[0])
  const WAYS = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]
  const ROLLS = 360_000

  function rolls(seed: number) {
    let state: CrapsState = craps.placeBet(craps.createGame(1e9, seed, LIMITS), 'passLine', 10)
    const out: Array<[number, number]> = []
    for (let i = 0; i < ROLLS; i++) {
      state = craps.rollDice(state)
      out.push([state.roll!.a, state.roll!.b])
      // Back to the felt without settling, so every throw is legal.
      state = { ...state, phase: 'betting' }
    }
    return out
  }

  const thrown = rolls(36)

  it('lands each die on each face one time in six', () => {
    for (const die of [0, 1]) {
      const counts = zeros(6)
      for (const r of thrown) counts[r[die] - 1]++
      expect(fair(counts, flat(ROLLS, 6)).ok).toBe(true)
    }
  })

  it('throws each of the 36 combinations one time in 36', () => {
    const counts = zeros(36)
    for (const [a, b] of thrown) counts[(a - 1) * 6 + (b - 1)]++
    expect(fair(counts, flat(ROLLS, 36)).ok).toBe(true)
  })

  it('totals 2 through 12 in the 1-2-3-4-5-6-5-4-3-2-1 shape', () => {
    const counts = zeros(11)
    for (const [a, b] of thrown) counts[a + b - 2]++
    expect(fair(counts, WAYS.map((w) => (w / 36) * ROLLS)).ok).toBe(true)
  })

  it('remembers nothing of the last throw', () => {
    const counts = zeros(121)
    for (let i = 1; i < ROLLS; i++) counts[(thrown[i - 1][0] + thrown[i - 1][1] - 2) * 11 + thrown[i][0] + thrown[i][1] - 2]++
    const expected = counts.map((_, k) => (WAYS[Math.floor(k / 11)] / 36) * (WAYS[k % 11] / 36) * (ROLLS - 1))
    expect(fair(counts, expected).ok).toBe(true)
  })

  it('starts fresh tables as fairly as it continues one', () => {
    const counts = zeros(36)
    const tables = 36_000
    for (let i = 0; i < tables; i++) {
      const roll = craps.rollDice(craps.placeBet(craps.createGame(1e9, i, LIMITS), 'passLine', 10)).roll!
      counts[(roll.a - 1) * 6 + (roll.b - 1)]++
    }
    expect(fair(counts, flat(tables, 36)).ok).toBe(true)
  })
})
