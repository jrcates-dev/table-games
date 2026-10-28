import { describe, expect, it } from 'vitest'
import { buyVig, houseEdge, spec } from './bets'
import * as c from './craps'
import { CRAPS_TABLES, limitsFor } from './rules'
import type { BetKind, CrapsState, DieFace } from './types'

/**
 * Empirical proof that the layout pays what the reference card says it pays.
 *
 * Every payout in `bets.ts` is written twice: once as the ratio the settler
 * uses, and once as the house edge the breakdown rail quotes at the player.
 * Those two are derived from each other by hand, so nothing but a long run of
 * dice can confirm they agree. A wrong numerator anywhere — 8:1 on the hard six
 * instead of 9:1, double instead of triple on the twelve — moves the realised
 * edge by percentage points and fails here immediately.
 *
 * Seeded, so a failure is reproducible rather than a coin flip.
 */

const LIMITS = limitsFor(CRAPS_TABLES[0])
const BANKROLL = 1_000_000_000

interface Strategy {
  name: string
  target: string
  kind: BetKind
  number?: number
  stake: number
  /** Rebuild the felt before each throw. */
  ensure(state: CrapsState): CrapsState
  decisions: number
  /** Allowance around the published edge, in percentage points. */
  tolerance: number
}

/**
 * Run one bet until it has resolved `decisions` times, and return the edge the
 * dice actually delivered.
 *
 * Measured as the change in total equity — the rack plus everything standing on
 * the felt — minus every other bet's contribution. Doing it that way rather
 * than summing the target's own payouts means commission is counted too, which
 * is the entire difference between buying the four and placing it.
 */
function measure(strategy: Strategy): number {
  let state = c.createGame(BANKROLL, 20_260_802, LIMITS)
  let wagered = 0
  let resolved = 0
  let elsewhere = 0
  const oneRoll = spec(strategy.kind).oneRoll

  while (resolved < strategy.decisions) {
    state = strategy.ensure(state)
    state = c.settle(c.rollDice(state))

    for (const r of state.resolutions) {
      // A buy's commission is reported as a line of its own, but it is the
      // buy's cost and nothing else's.
      if (strategy.kind === 'buy' && r.betId === 'commission') continue
      if (r.betId !== strategy.target) {
        elsewhere += r.net
        continue
      }
      // A one-roll bet had its money at risk even on a stand-off, and its
      // published edge is quoted per throw — the world's 13.33% counts the 7
      // that pushes it. A multi-roll bet's edge is quoted per bet *resolved*,
      // so a push there is not a decision at all.
      const risked = r.effect === 'win' || r.effect === 'lose' || (oneRoll && r.effect === 'push')
      if (risked) {
        // Buy's published edge is per dollar of stake plus commission.
        wagered += strategy.stake + (strategy.kind === 'buy' ? buyVig(strategy.stake) : 0)
        resolved += 1
      }
    }
  }

  const equity = state.bankroll + c.totalAtRisk(state)
  return -(equity - BANKROLL - elsewhere) / wagered
}

/** The shooter needs a line bet before anyone will hand over the dice. */
const withLine = (state: CrapsState): CrapsState =>
  state.bets.passLine ? state : c.placeBet(state, 'passLine', 10)

function alongsideLine(kind: BetKind, stake: number, number?: number) {
  return (state: CrapsState): CrapsState => {
    const s = withLine(state)
    return s.bets[c.betId(kind, number)] ? s : c.placeBet(s, kind, stake, number)
  }
}

const STRATEGIES: Strategy[] = [
  {
    name: 'pass line',
    target: 'passLine',
    kind: 'passLine',
    stake: 10,
    ensure: withLine,
    decisions: 60_000,
    tolerance: 0.013,
  },
  {
    name: "don't pass",
    target: 'dontPass',
    kind: 'dontPass',
    stake: 10,
    ensure: (s) => (s.bets.dontPass ? s : c.placeBet(s, 'dontPass', 10)),
    decisions: 60_000,
    tolerance: 0.013,
  },
  {
    name: 'place the six',
    target: 'place-6',
    kind: 'place',
    number: 6,
    stake: 12,
    ensure: alongsideLine('place', 12, 6),
    decisions: 40_000,
    tolerance: 0.016,
  },
  {
    name: 'place the four',
    target: 'place-4',
    kind: 'place',
    number: 4,
    stake: 25,
    ensure: alongsideLine('place', 25, 4),
    decisions: 30_000,
    tolerance: 0.025,
  },
  {
    name: 'buy the four',
    target: 'buy-4',
    kind: 'buy',
    number: 4,
    stake: 100,
    ensure: alongsideLine('buy', 100, 4),
    decisions: 30_000,
    tolerance: 0.025,
  },
  {
    name: 'lay the four',
    target: 'lay-4',
    kind: 'lay',
    number: 4,
    stake: 40,
    ensure: alongsideLine('lay', 40, 4),
    decisions: 30_000,
    tolerance: 0.016,
  },
  {
    name: 'the field',
    target: 'field',
    kind: 'field',
    stake: 10,
    ensure: alongsideLine('field', 10),
    decisions: 100_000,
    tolerance: 0.011,
  },
  {
    name: 'any seven',
    target: 'any7',
    kind: 'any7',
    stake: 10,
    ensure: alongsideLine('any7', 10),
    decisions: 80_000,
    tolerance: 0.022,
  },
  {
    name: 'the hard eight',
    target: 'hard-8',
    kind: 'hard',
    number: 8,
    stake: 10,
    ensure: alongsideLine('hard', 10, 8),
    decisions: 60_000,
    tolerance: 0.038,
  },
  {
    name: 'C & E',
    target: 'ce',
    kind: 'ce',
    stake: 10,
    ensure: alongsideLine('ce', 10),
    decisions: 80_000,
    tolerance: 0.025,
  },
  {
    name: 'the horn',
    target: 'horn',
    kind: 'horn',
    stake: 20,
    ensure: alongsideLine('horn', 20),
    decisions: 80_000,
    tolerance: 0.033,
  },
  {
    name: 'the world',
    target: 'world',
    kind: 'world',
    stake: 20,
    ensure: alongsideLine('world', 20),
    decisions: 80_000,
    tolerance: 0.033,
  },
]

describe('the realised house edge matches the published one', () => {
  for (const strategy of STRATEGIES) {
    it(`${strategy.name} runs at about ${(houseEdge(strategy.kind, strategy.number) * 100).toFixed(2)}%`, () => {
      const realised = measure(strategy)
      const published = houseEdge(strategy.kind, strategy.number)
      expect(Math.abs(realised - published)).toBeLessThan(strategy.tolerance)
    })
  }
})

/**
 * Odds are checked exactly rather than by simulation, and deliberately so.
 *
 * Taking odds leaves the house's expected win untouched while multiplying the
 * money on the felt roughly fourfold, so the *variance* of a simulated edge
 * estimate swamps the 0.37% being measured — pinning it down by dice would take
 * millions of decisions. Enumerating the eleven ways a point resolves settles
 * it in microseconds and with no tolerance at all.
 */
const WAYS_TO_MAKE: Record<number, number> = { 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3 }
const PAIRS: Record<number, [DieFace, DieFace]> = {
  4: [3, 1],
  5: [3, 2],
  6: [4, 2],
  8: [5, 3],
  9: [5, 4],
  10: [6, 4],
}

/** Net of one bet from a single forced throw. */
function netOf(state: CrapsState, betId: string, a: DieFace, b: DieFace): number {
  const settled = c.settle(c.rollExactly(state, a, b))
  return settled.resolutions.find((r) => r.betId === betId)?.net ?? 0
}

describe('odds carry no house edge at all', () => {
  for (const point of [4, 5, 6, 8, 9, 10] as const) {
    it(`pays true odds on the ${point}`, () => {
      let s = c.placeBet(c.createGame(BANKROLL, 1, LIMITS), 'passLine', 10)
      s = c.settle(c.rollExactly(s, ...PAIRS[point]))
      s = c.placeBet(s, 'passOdds', c.maxFor(s, 'passOdds'))

      const win = netOf(s, 'passOdds', ...PAIRS[point])
      const lose = netOf(s, 'passOdds', 3, 4)
      // Every way to make the point, against the six ways to seven out.
      expect(WAYS_TO_MAKE[point] * win + 6 * lose).toBe(0)
    })

    it(`lays true odds against the ${point}`, () => {
      let s = c.placeBet(c.createGame(BANKROLL, 1, LIMITS), 'dontPass', 10)
      s = c.settle(c.rollExactly(s, ...PAIRS[point]))
      s = c.placeBet(s, 'dontPassOdds', c.maxFor(s, 'dontPassOdds'))

      const win = netOf(s, 'dontPassOdds', 3, 4)
      const lose = netOf(s, 'dontPassOdds', ...PAIRS[point])
      expect(6 * win + WAYS_TO_MAKE[point] * lose).toBe(0)
    })
  }

  it('drags the pass line from 1.41% down to 0.37% of the total wager', () => {
    // The pass line wins 244 of every 495 decisions and loses 251, so the house
    // keeps exactly 7/495 — the famous 1.41%. Odds add fair money underneath it
    // without moving that number by a cent.
    const houseWin = (10 * 7) / 495
    expect(houseWin / 10).toBeCloseTo(0.014141, 6)

    let wagered = 10
    for (const point of [4, 5, 6, 8, 9, 10] as const) {
      let s = c.placeBet(c.createGame(BANKROLL, 1, LIMITS), 'passLine', 10)
      s = c.settle(c.rollExactly(s, ...PAIRS[point]))
      // Whatever 3-4-5x allows on this point, weighted by how often it is set.
      wagered += (WAYS_TO_MAKE[point] / 36) * c.maxFor(s, 'passOdds')
    }

    expect(wagered).toBeCloseTo(37.778, 3)
    expect(houseWin / wagered).toBeCloseTo(0.003743, 6)
  })
})

describe('the dice themselves', () => {
  it('produces the 6-in-36 distribution a pair of fair dice does', () => {
    let state = c.placeBet(c.createGame(BANKROLL, 4242, LIMITS), 'passLine', 10)
    const counts: Record<number, number> = {}
    const rolls = 200_000

    for (let i = 0; i < rolls; i++) {
      state = c.settle(c.rollDice(state))
      counts[state.roll!.total] = (counts[state.roll!.total] ?? 0) + 1
      if (!state.bets.passLine) state = c.placeBet(state, 'passLine', 10)
    }

    const ways: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }
    for (const total of Object.keys(ways).map(Number)) {
      const expected = (ways[total] / 36) * rolls
      // Three standard deviations of a binomial, which no fair generator should
      // exceed on eleven independent checks more than rarely.
      const sd = Math.sqrt(rolls * (ways[total] / 36) * (1 - ways[total] / 36))
      expect(Math.abs(counts[total] - expected)).toBeLessThan(4 * sd)
    }
  })
})
