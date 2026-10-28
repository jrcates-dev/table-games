import { describe, expect, it } from 'vitest'
import { allBets, betById, betTitle, houseEdge, outside, payFor } from './bets'
import * as r from './roulette'
import { ROULETTE_LIMITS } from './rules'
import type { RouletteState } from './types'
import { DOUBLE_ZERO, DOUBLE_ZERO_ORDER, pocketColor, pockets, SINGLE_ZERO_ORDER, type WheelType } from './wheel'

function game(wheel: WheelType = 'double', bankroll = 100_000): RouletteState {
  return r.createGame(bankroll, 11, ROULETTE_LIMITS[wheel], wheel)
}

describe('the wheels', () => {
  it('carry every pocket exactly once', () => {
    expect(new Set(DOUBLE_ZERO_ORDER).size).toBe(38)
    expect(new Set(SINGLE_ZERO_ORDER).size).toBe(37)
    expect([...DOUBLE_ZERO_ORDER].sort((a, b) => a - b)).toEqual(pockets('double').sort((a, b) => a - b))
  })

  it('alternate red and black round the head, with the zeros green', () => {
    for (const order of [DOUBLE_ZERO_ORDER, SINGLE_ZERO_ORDER]) {
      for (let i = 0; i < order.length; i++) {
        const a = pocketColor(order[i])
        const b = pocketColor(order[(i + 1) % order.length])
        if (a !== 'green' && b !== 'green') expect(a).not.toBe(b)
      }
    }
    expect(pocketColor(0)).toBe('green')
    expect(pocketColor(DOUBLE_ZERO)).toBe('green')
    expect(pocketColor(1)).toBe('red')
    expect(pocketColor(2)).toBe('black')
  })
})

describe('the bets', () => {
  it('price everything on a double-zero wheel at 5.26%, except the top line', () => {
    for (const def of allBets('double')) {
      const edge = houseEdge(def, 'double')
      if (def.kind === 'basket') expect(edge).toBeCloseTo(3 / 38, 10)
      else expect(edge, def.id).toBeCloseTo(2 / 38, 10)
    }
  })

  it('price everything on a single-zero wheel at 2.70%', () => {
    for (const def of allBets('single')) expect(houseEdge(def, 'single'), def.id).toBeCloseTo(1 / 37, 10)
  })

  it('lay out the inside bets a real layout takes', () => {
    const count = (wheel: WheelType, kind: string) => allBets(wheel).filter((b) => b.kind === kind).length
    expect(count('double', 'straight')).toBe(38)
    expect(count('single', 'straight')).toBe(37)
    // 33 across a row and 24 up a column, plus the five round the zeros.
    expect(count('double', 'split')).toBe(57 + 5)
    expect(count('single', 'split')).toBe(57 + 3)
    expect(count('double', 'corner')).toBe(22)
    expect(count('double', 'street')).toBe(12)
    expect(count('double', 'sixLine')).toBe(11)
    expect(new Set(allBets('double').map((b) => b.id)).size).toBe(allBets('double').length)
  })

  it('pays the standard odds', () => {
    expect(payFor(betById('double', 'straight:17')!)).toBe(35)
    expect(payFor(betById('double', 'split:17-20')!)).toBe(17)
    expect(payFor(betById('double', 'corner:17-18-20-21')!)).toBe(8)
    expect(payFor(betById('double', 'basket:0-1-2-3-37')!)).toBe(6)
    expect(payFor(betById('single', 'basket:0-1-2-3')!)).toBe(8)
    expect(payFor(outside('dozen', 2))).toBe(2)
    expect(payFor(outside('red'))).toBe(1)
  })

  it('names bets the way the dealer calls them', () => {
    expect(betTitle(betById('double', 'split:17-20')!)).toBe('Split 17 / 20')
    expect(betTitle(betById('double', 'basket:0-1-2-3-37')!)).toBe('Top Line 0-00-1-2-3')
    expect(betTitle(betById('double', 'straight:37')!)).toBe('Straight up 00')
    expect(betTitle(outside('column', 3))).toBe('3rd Column')
  })
})

describe('a spin', () => {
  it('pays a straight up 35 to 1 and returns the stake', () => {
    let s = r.placeBet(game(), 'straight:17', 15)
    s = r.placeBet(s, 'red', 15)
    expect(s.bankroll).toBe(100_000 - 30)
    s = r.settle(r.spinTo(s, 17))
    // Seventeen is black, so the red bet goes.
    expect(r.spinNet(s)).toBe(525 - 15)
    expect(s.bankroll).toBe(100_000 + 510)
    expect(s.history[0]).toBe(17)
  })

  it('loses every outside bet to the zeros', () => {
    let s = game()
    for (const id of ['red', 'black', 'odd', 'even', 'low', 'high', 'dozen:1', 'column:1']) s = r.placeBet(s, id, 15)
    s = r.settle(r.spinTo(s, DOUBLE_ZERO))
    expect(s.resolutions.every((x) => x.effect === 'lose')).toBe(true)
  })

  it('lifts a first outside bet to the table minimum, and holds inside bets to it as a total', () => {
    const s = r.placeBet(game(), 'red', 5)
    expect(s.bets.red.amount).toBe(15)
    const inside = r.placeBet(game(), 'straight:5', 5)
    expect(inside.bets['straight:5'].amount).toBe(5)
    expect(r.canSpin(inside).ok).toBe(false)
    expect(r.canSpin(r.placeBet(inside, 'split:5-8', 10)).ok).toBe(true)
  })

  it('caps inside bets by what they cover', () => {
    let s = r.placeBet(game(), 'straight:5', 10_000)
    expect(s.bets['straight:5'].amount).toBe(500)
    s = r.placeBet(s, 'split:5-8', 10_000)
    expect(s.bets['split:5-8'].amount).toBe(1000)
  })

  it('clears for the next spin and rebets the last layout', () => {
    let s = r.placeBet(r.placeBet(game(), 'straight:9', 25), 'black', 50)
    s = r.settle(r.spinTo(s, 2))
    // Clicking the layout after a spin starts the next one.
    const fresh = r.placeBet(s, 'red', 15)
    expect(Object.keys(fresh.bets)).toEqual(['red'])
    const again = r.rebet(s)
    expect(Object.keys(again.bets).sort()).toEqual(['black', 'straight:9'])
    expect(again.phase).toBe('betting')
  })

  it('refuses bets while the ball is in the air', () => {
    const spinning = r.spin(r.placeBet(game(), 'red', 15))
    expect(spinning.phase).toBe('spinning')
    expect(r.canPlace(spinning, 'black').ok).toBe(false)
    expect(r.placeBet(spinning, 'black', 15)).toBe(spinning)
  })

  it('moves to the other wheel with the chips back in the rack', () => {
    const s = r.setWheel(r.placeBet(game(), 'red', 100), 'single', ROULETTE_LIMITS.single)
    expect(s.wheel).toBe('single')
    expect(s.bankroll).toBe(100_000)
    expect(s.limits.tableMin).toBe(100)
  })

  it('summarises the layout against every pocket', () => {
    const s = r.placeBet(r.placeBet(game(), 'straight:17', 10), 'red', 15)
    const summary = r.layoutSummary(s)
    expect(summary.staked).toBe(25)
    // Red's eighteen, and the 17, which is black.
    expect(summary.covered).toBe(19)
    expect(summary.edge).toBeCloseTo(2 / 38, 10)
  })
})

describe('the wheel over a long session', () => {
  it('lands every pocket about equally often', () => {
    // A seed of its own: a fair generator still lands one seed in a thousand
    // past the 99.9% line, and this test is not about any particular seed.
    let s = r.createGame(1e9, 2026, ROULETTE_LIMITS.double, 'double')
    const counts = new Map<number, number>()
    const spins = 76_000
    for (let i = 0; i < spins; i++) {
      s = r.settle(r.spin(r.placeBet(s, 'red', 15)))
      counts.set(s.result!, (counts.get(s.result!) ?? 0) + 1)
      s = r.clearForNextSpin(s)
    }
    expect(counts.size).toBe(38)
    // Chi-square with 37 degrees of freedom: 99.9% of fair wheels land under 69.
    const expected = spins / 38
    let chi = 0
    for (const c of counts.values()) chi += (c - expected) ** 2 / expected
    expect(chi).toBeLessThan(69)
  })
})
