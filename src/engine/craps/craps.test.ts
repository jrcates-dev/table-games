import { describe, expect, it } from 'vitest'
import * as c from './craps'
import { CRAPS_TABLES, limitsFor } from './rules'
import type { BetKind, CrapsState, DieFace } from './types'

const LIMITS = limitsFor(CRAPS_TABLES[0]) // $10 min, 3-4-5x odds

function game(bankroll = 100_000): CrapsState {
  return c.createGame(bankroll, 1, LIMITS)
}

/** Place a bet and throw a specific pair of dice. */
function throwDice(state: CrapsState, a: DieFace, b: DieFace): CrapsState {
  return c.settle(c.rollExactly(state, a, b))
}

/** Total profit and loss of the roll that just settled. */
function net(state: CrapsState): number {
  return state.resolutions.reduce((sum, r) => sum + r.net, 0)
}

function resolution(state: CrapsState, betId: string) {
  return state.resolutions.find((r) => r.betId === betId)
}

function bet(state: CrapsState, kind: BetKind, amount: number, number?: number): CrapsState {
  return c.placeBet(state, kind, amount, number)
}

/** Establish a point without any bet resolving oddly along the way. */
function withPoint(state: CrapsState, point: 4 | 5 | 6 | 8 | 9 | 10): CrapsState {
  const pairs: Record<number, [DieFace, DieFace]> = {
    4: [3, 1],
    5: [3, 2],
    6: [4, 2],
    8: [5, 3],
    9: [5, 4],
    10: [6, 4],
  }
  return throwDice(state, ...pairs[point])
}

describe('the line', () => {
  it('pays a natural on the come-out and leaves the bet up', () => {
    let s = bet(game(), 'passLine', 10)
    expect(s.bankroll).toBe(99_990)

    s = throwDice(s, 4, 3)
    expect(net(s)).toBe(10)
    // A winning line bet is paid beside itself and stays up for the next
    // come-out, so the winnings land in the rack and the stake does not.
    expect(s.bankroll).toBe(100_000)
    expect(s.bets.passLine.amount).toBe(10)
    expect(s.bankroll + c.totalAtRisk(s)).toBe(100_010)
    expect(s.point).toBeNull()
  })

  it('takes the line on craps and leaves nothing behind', () => {
    let s = bet(game(), 'passLine', 10)
    s = throwDice(s, 1, 1)
    expect(net(s)).toBe(-10)
    expect(s.bets.passLine).toBeUndefined()
  })

  it('bars the twelve against the don’t pass', () => {
    let s = bet(game(), 'dontPass', 10)
    s = throwDice(s, 6, 6)
    expect(net(s)).toBe(0)
    expect(s.bankroll).toBe(99_990)
    expect(s.bets.dontPass.amount).toBe(10)
    expect(resolution(s, 'dontPass')!.effect).toBe('push')
  })

  it('wins the don’t pass on a come-out 2 or 3, loses it on 7 or 11', () => {
    expect(net(throwDice(bet(game(), 'dontPass', 10), 1, 2))).toBe(10)
    expect(net(throwDice(bet(game(), 'dontPass', 10), 5, 6))).toBe(-10)
  })

  it('establishes a point and then pays it', () => {
    let s = bet(game(), 'passLine', 10)
    s = withPoint(s, 6)
    expect(s.point).toBe(6)
    expect(net(s)).toBe(0)
    expect(resolution(s, 'passLine')!.effect).toBe('point')

    s = throwDice(s, 5, 1)
    expect(net(s)).toBe(10)
    expect(s.point).toBeNull()
    expect(s.bets.passLine.amount).toBe(10)
  })

  it('sevens out', () => {
    let s = withPoint(bet(game(), 'passLine', 10), 8)
    s = throwDice(s, 4, 3)
    expect(net(s)).toBe(-10)
    expect(s.point).toBeNull()
    expect(s.bets.passLine).toBeUndefined()
    expect(s.shootNumber).toBe(2)
    expect(s.finishedShoot).not.toBeNull()
  })

  it('refuses a line bet once a point is up', () => {
    const s = withPoint(bet(game(), 'passLine', 10), 5)
    expect(c.canPlace(s, 'passLine').ok).toBe(false)
    expect(c.canPlace(s, 'come').ok).toBe(true)
  })

  it('locks the line as a contract once a point exists', () => {
    let s = bet(game(), 'passLine', 10)
    expect(c.canRemove(s.bets.passLine, s.point)).toBe(true)
    s = withPoint(s, 9)
    expect(c.canRemove(s.bets.passLine, s.point)).toBe(false)
    expect(c.removeBet(s, 'passLine').bets.passLine).toBeDefined()
  })
})

describe('odds', () => {
  it('caps the take side at 3-4-5x and pays true odds', () => {
    let s = withPoint(bet(game(), 'passLine', 10), 6)
    // Five times the line on the six.
    expect(c.maxFor(s, 'passOdds')).toBe(50)
    s = bet(s, 'passOdds', 500)
    expect(s.bets.passOdds.amount).toBe(50)

    s = throwDice(s, 4, 2)
    // 6:5 on $50 is $60, and the odds come down with the point.
    expect(resolution(s, 'passOdds')!.net).toBe(60)
    expect(s.bets.passOdds).toBeUndefined()
    expect(net(s)).toBe(70)
  })

  it('caps every point at a six-times-the-line payout', () => {
    for (const [point, odds] of [
      [4, 30],
      [5, 40],
      [6, 50],
    ] as const) {
      const s = bet(withPoint(bet(game(), 'passLine', 10), point), 'passOdds', 10_000)
      expect(c.maxFor(s, 'passOdds')).toBe(0)
      expect(s.bets.passOdds.amount).toBe(odds)
    }
  })

  it('lets the don’t side lay six times the line', () => {
    // Under 3-4-5x the don’t side may risk 6x the line: $60 against the six wins $50.
    let s = bet(withPoint(bet(game(), 'dontPass', 10), 6), 'dontPassOdds', 10_000)
    expect(s.bets.dontPassOdds.amount).toBe(60)

    s = throwDice(s, 4, 3)
    expect(resolution(s, 'dontPassOdds')!.net).toBe(50)
    expect(net(s)).toBe(60)
  })

  it('takes no house edge on either side', () => {
    expect(c.maxFor(game(), 'passOdds')).toBe(0) // nothing to ride behind
  })

  /**
   * `oddsTargets` is what lights the Max odds control and what that control
   * then acts on. It once existed only in the second of those two places, and
   * the button was re-derived by hand from the pass side alone — so a don't
   * player had it greyed out with a perfectly good bet sitting behind them.
   */
  describe('what can be backed with odds', () => {
    const kinds = (s: CrapsState) => c.oddsTargets(s).map((t) => c.betId(t.kind, t.number)).sort()

    it('offers nothing on a bare come-out', () => {
      expect(kinds(bet(game(), 'passLine', 10))).toEqual([])
    })

    it('offers the pass line once a point is up', () => {
      expect(kinds(withPoint(bet(game(), 'passLine', 10), 6))).toEqual(['passOdds'])
    })

    it('offers the don’t pass just the same', () => {
      expect(kinds(withPoint(bet(game(), 'dontPass', 10), 6))).toEqual(['dontPassOdds'])
    })

    it('offers a travelled come bet, on either side', () => {
      let s = withPoint(bet(game(), 'passLine', 10), 8)
      s = throwDice(bet(s, 'come', 10), 3, 2)
      expect(kinds(s)).toEqual(['comeOdds-5', 'passOdds'])

      let t = withPoint(bet(game(), 'dontPass', 10), 8)
      t = throwDice(bet(t, 'dontCome', 10), 3, 2)
      expect(kinds(t)).toEqual(['dontComeOdds-5', 'dontPassOdds'])
    })

    it('stops offering a spot once it is maxed out', () => {
      const s = bet(withPoint(bet(game(), 'dontPass', 10), 6), 'dontPassOdds', 10_000)
      expect(s.bets.dontPassOdds.amount).toBe(60)
      expect(kinds(s)).toEqual([])
    })
  })
})

describe('come and don’t come', () => {
  it('wins in the box on 7 or 11 and loses on craps', () => {
    const s = withPoint(bet(game(), 'passLine', 10), 8)
    expect(net(throwDice(bet(s, 'come', 10), 6, 5))).toBe(10)
    expect(net(throwDice(bet(s, 'come', 10), 1, 2))).toBe(-10)
  })

  it('travels to a number and then wins there', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'come', 10)
    s = throwDice(s, 3, 2) // a five
    expect(resolution(s, 'come')!.effect).toBe('move')
    expect(s.bets['comePoint-5'].amount).toBe(10)
    expect(s.bets.come).toBeUndefined()

    s = bet(s, 'comeOdds', 40, 5)
    s = throwDice(s, 4, 1)
    expect(resolution(s, 'comePoint-5')!.net).toBe(10)
    // 3:2 on $40.
    expect(resolution(s, 'comeOdds-5')!.net).toBe(60)
  })

  it('bars the twelve in the don’t come box', () => {
    const s = throwDice(bet(withPoint(bet(game(), 'dontPass', 10), 8), 'dontCome', 10), 6, 6)
    expect(resolution(s, 'dontCome')!.effect).toBe('push')
    expect(net(s)).toBe(0)
  })

  it('merges a second come bet onto the same number', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'come', 10)
    s = throwDice(s, 3, 2)
    s = bet(s, 'come', 25)
    s = throwDice(s, 4, 1)
    expect(s.bets['comePoint-5'].amount).toBe(25)
  })
})

describe('come odds on the come-out', () => {
  it('returns odds that were not working instead of taking them', () => {
    // Come bet on the 9, odds behind it, then the point is made — which puts
    // the next roll on a come-out, where those odds sit off.
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'come', 10)
    s = throwDice(s, 5, 4) // come bet travels to the 9
    s = bet(s, 'comeOdds', 40, 9)
    s = throwDice(s, 4, 4) // point made, back to a come-out
    expect(s.point).toBeNull()

    const before = s.bankroll
    s = throwDice(s, 3, 4) // come-out seven
    // The flat come bet is lost. The odds were off, so they come back.
    expect(resolution(s, 'comePoint-9')!.net).toBe(-10)
    expect(resolution(s, 'comeOdds-9')!.effect).toBe('push')
    expect(s.bankroll).toBe(before + 40 + 10) // odds returned, plus the line win
  })

  it('returns odds that were not working when the come number rolls, rather than paying them', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'come', 10)
    s = throwDice(s, 5, 4) // come bet travels to the 9
    s = bet(s, 'comeOdds', 40, 9)
    s = throwDice(s, 4, 4) // point made, back to a come-out
    s = throwDice(s, 5, 4) // come-out nine
    expect(resolution(s, 'comePoint-9')!.net).toBe(10)
    expect(resolution(s, 'comeOdds-9')!.effect).toBe('push')
    expect(resolution(s, 'comeOdds-9')!.net).toBe(0)
  })

  it('takes the odds too when the player calls them on', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'come', 10)
    s = throwDice(s, 5, 4)
    s = bet(s, 'comeOdds', 40, 9)
    s = throwDice(s, 4, 4)
    s = c.setWorking(s, 'comeOdds-9', 'on')
    s = throwDice(s, 3, 4)
    expect(resolution(s, 'comeOdds-9')!.net).toBe(-40)
  })
})

/**
 * The whole sequence a player meets after the shooter makes the point: the line
 * is paid, its odds come down, and come bets with odds behind them ride into a
 * brand new come-out where those odds sit off unless called on.
 */
describe('a new come-out after the point is made', () => {
  /** Line with odds on the 8, come bets with full odds on the 5 and 9, then the 8 made. */
  function afterPointMade(): CrapsState {
    let s = withPoint(bet(game(), 'passLine', 10), 8)
    s = bet(s, 'passOdds', 50)
    s = throwDice(bet(s, 'come', 10), 3, 2) // to the 5
    s = bet(s, 'comeOdds', 40, 5)
    s = throwDice(bet(s, 'come', 10), 5, 4) // to the 9
    s = bet(s, 'comeOdds', 40, 9)
    return throwDice(s, 4, 4) // the 8, made
  }

  it('pays the line and its odds, and carries the come bets and odds into the come-out', () => {
    const s = afterPointMade()
    expect(s.point).toBeNull()
    expect(resolution(s, 'passLine')!.net).toBe(10)
    expect(resolution(s, 'passOdds')!.net).toBe(60) // 6:5 on $50
    expect(resolution(s, 'passOdds')!.remaining).toBe(0)
    expect(Object.keys(s.bets).sort()).toEqual(['comeOdds-5', 'comeOdds-9', 'comePoint-5', 'comePoint-9', 'passLine'])
    expect(s.bankroll).toBe(100_000 - 10 - 20 - 80 + 10 + 60)

    // The flat come bets keep working; the odds behind them do not.
    expect(c.isWorking(s.bets['comePoint-5'], s.point)).toBe(true)
    expect(c.isWorking(s.bets['comePoint-9'], s.point)).toBe(true)
    expect(c.isWorking(s.bets['comeOdds-5'], s.point)).toBe(false)
    expect(c.isWorking(s.bets['comeOdds-9'], s.point)).toBe(false)
  })

  it('on a come-out 7 with the odds off, takes the come bets and hands every odds bet back', () => {
    let s = afterPointMade()
    const before = s.bankroll
    s = throwDice(s, 3, 4)

    expect(resolution(s, 'passLine')).toMatchObject({ effect: 'win', net: 10, remaining: 10 })
    expect(resolution(s, 'comePoint-5')).toMatchObject({ effect: 'lose', net: -10 })
    expect(resolution(s, 'comePoint-9')).toMatchObject({ effect: 'lose', net: -10 })
    expect(resolution(s, 'comeOdds-5')).toMatchObject({ effect: 'push', net: 0, stake: 40, remaining: 0 })
    expect(resolution(s, 'comeOdds-9')).toMatchObject({ effect: 'push', net: 0, stake: 40, remaining: 0 })

    expect(net(s)).toBe(-10)
    expect(s.bankroll).toBe(before + 10 + 80) // the natural, and both odds returned
    expect(Object.keys(s.bets)).toEqual(['passLine'])
    // A natural on the come-out is not a seven-out: same shooter, new come-out.
    expect(s.point).toBeNull()
    expect(s.shootNumber).toBe(1)
  })

  it('projects the come-out 7 exactly as it then settles', () => {
    const s = afterPointMade()
    const seven = c.nextRollOutcomes(s).find((o) => o.total === 7)!
    expect(seven.net).toBe(net(throwDice(s, 3, 4)))
    expect(seven.net).toBe(-10)
  })

  it('takes the odds with the come bets when they were called on', () => {
    let s = afterPointMade()
    s = c.toggleWorking(c.toggleWorking(s, 'comeOdds-5'), 'comeOdds-9')
    expect(s.bets['comeOdds-5'].working).toBe('on')
    const before = s.bankroll
    s = throwDice(s, 3, 4)

    expect(resolution(s, 'comeOdds-5')).toMatchObject({ effect: 'lose', net: -40 })
    expect(resolution(s, 'comeOdds-9')).toMatchObject({ effect: 'lose', net: -40 })
    expect(net(s)).toBe(-90)
    expect(s.bankroll).toBe(before + 10)
  })

  it('can call one number’s odds on and leave the other off', () => {
    let s = c.toggleWorking(afterPointMade(), 'comeOdds-9')
    s = throwDice(s, 3, 4)
    expect(resolution(s, 'comeOdds-5')!.effect).toBe('push')
    expect(resolution(s, 'comeOdds-9')!.net).toBe(-40)
  })

  it('pays only the flat bet when the come number rolls with the odds off', () => {
    let s = afterPointMade()
    const before = s.bankroll
    s = throwDice(s, 5, 4) // a 9: the come bet wins, and it is the new point

    expect(resolution(s, 'comePoint-9')).toMatchObject({ effect: 'win', net: 10, remaining: 0 })
    expect(resolution(s, 'comeOdds-9')).toMatchObject({ effect: 'push', net: 0, remaining: 0 })
    expect(s.bankroll).toBe(before + 10 + 10 + 40)
    expect(s.point).toBe(9)
    // The 5 was not decided, and with a point up its odds are working again.
    expect(resolution(s, 'comePoint-5')).toBeUndefined()
    expect(resolution(s, 'comeOdds-5')).toBeUndefined()
    expect(c.isWorking(s.bets['comeOdds-5'], s.point)).toBe(true)
  })

  it('pays the odds at true odds when the come number rolls with them on', () => {
    let s = c.toggleWorking(afterPointMade(), 'comeOdds-9')
    s = throwDice(s, 5, 4)
    expect(resolution(s, 'comeOdds-9')).toMatchObject({ effect: 'win', net: 60, remaining: 0 }) // 3:2 on $40
  })

  it('leaves the come bets alone on a come-out 11, 2, 3 or 12', () => {
    for (const [a, b] of [[5, 6], [1, 1], [1, 2], [6, 6]] as Array<[DieFace, DieFace]>) {
      const s = throwDice(afterPointMade(), a, b)
      for (const id of ['comePoint-5', 'comeOdds-5', 'comePoint-9', 'comeOdds-9']) {
        expect(resolution(s, id)).toBeUndefined()
        expect(s.bets[id]).toBeDefined()
      }
    }
  })

  it('puts the odds back to work once the come-out sets a new point', () => {
    let s = throwDice(afterPointMade(), 4, 2) // come-out 6: the new point
    expect(s.point).toBe(6)
    expect(resolution(s, 'comeOdds-5')).toBeUndefined()
    expect(c.isWorking(s.bets['comeOdds-5'], s.point)).toBe(true)
    expect(c.isWorking(s.bets['comeOdds-9'], s.point)).toBe(true)

    s = throwDice(s, 3, 4) // seven out
    expect(resolution(s, 'comeOdds-5')!.net).toBe(-40)
    expect(resolution(s, 'comeOdds-9')!.net).toBe(-40)
    expect(net(s)).toBe(-10 - 20 - 80)
  })

  it('lets odds go up behind a come bet on the come-out, off like the rest', () => {
    // A come bet that travels on the roll that makes the point arrives on the
    // come-out with nothing behind it. Odds taken then sit off too.
    let s = withPoint(bet(game(), 'passLine', 10), 8)
    s = throwDice(bet(s, 'come', 10), 4, 4) // makes the 8, and the come bet travels to it
    expect(s.point).toBeNull()
    expect(s.bets['comePoint-8'].amount).toBe(10)

    s = bet(s, 'comeOdds', 50, 8)
    expect(s.bets['comeOdds-8'].amount).toBe(50)
    expect(c.isWorking(s.bets['comeOdds-8'], s.point)).toBe(false)
    s = throwDice(s, 3, 4)
    expect(resolution(s, 'comePoint-8')!.net).toBe(-10)
    expect(resolution(s, 'comeOdds-8')!.effect).toBe('push')
  })
})

describe('turning bets on and off', () => {
  it('clears the call when odds are turned on and back off on a come-out', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'come', 10)
    s = throwDice(s, 5, 4)
    s = throwDice(bet(s, 'comeOdds', 40, 9), 4, 4) // point made
    s = c.toggleWorking(s, 'comeOdds-9')
    expect(s.bets['comeOdds-9'].working).toBe('on')
    s = c.toggleWorking(s, 'comeOdds-9')
    // Back to what the dealer assumes, not a standing "off" that would leave
    // the odds dead through the point that follows.
    expect(s.bets['comeOdds-9'].working).toBe('auto')

    s = throwDice(s, 3, 2) // come-out 5: the point
    expect(c.isWorking(s.bets['comeOdds-9'], s.point)).toBe(true)
    s = throwDice(s, 5, 4)
    expect(resolution(s, 'comeOdds-9')!.net).toBe(60)
  })

  it('clears the call when a place bet is turned off and back on during a point', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'place', 12, 6)
    s = c.toggleWorking(s, 'place-6')
    expect(s.bets['place-6'].working).toBe('off')
    s = c.toggleWorking(s, 'place-6')
    expect(s.bets['place-6'].working).toBe('auto')
    // So it sits out the next come-out as usual, rather than being stuck on.
    s = throwDice(s, 4, 4)
    expect(c.isWorking(s.bets['place-6'], s.point)).toBe(false)
  })

  it('keeps come odds turned off during a point off for the seven-out, and returns them', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'come', 10)
    s = throwDice(s, 5, 4)
    s = c.toggleWorking(bet(s, 'comeOdds', 40, 9), 'comeOdds-9')
    expect(s.bets['comeOdds-9'].working).toBe('off')
    const before = s.bankroll
    s = throwDice(s, 3, 4)
    expect(resolution(s, 'comePoint-9')!.net).toBe(-10)
    expect(resolution(s, 'comeOdds-9')).toMatchObject({ effect: 'push', remaining: 0 })
    expect(s.bankroll).toBe(before + 40)
  })

  it('will not turn a flat don’t bet off, and ignores an old save that did', () => {
    let s = bet(bet(game(), 'passLine', 10), 'dontPass', 10)
    s = withPoint(s, 5)
    s = throwDice(bet(s, 'dontCome', 10), 4, 2) // don't come behind the 6
    s = bet(s, 'dontCome', 10)
    for (const id of ['dontPass', 'dontComePoint-6', 'dontCome']) {
      expect(c.canToggleWorking(s.bets[id])).toBe(false)
      expect(c.toggleWorking(s, id)).toBe(s)
      expect(c.isWorking({ ...s.bets[id], working: 'off' }, s.point)).toBe(true)
    }
  })

  it('lets every odds bet be turned off', () => {
    let s = bet(withPoint(bet(bet(game(), 'passLine', 10), 'dontPass', 10), 5), 'passOdds', 40)
    s = bet(s, 'dontPassOdds', 60)
    s = throwDice(bet(bet(s, 'come', 10), 'dontCome', 10), 4, 2)
    s = bet(bet(s, 'comeOdds', 50, 6), 'dontComeOdds', 60, 6)
    for (const id of ['passOdds', 'dontPassOdds', 'comeOdds-6', 'dontComeOdds-6']) {
      expect(c.canToggleWorking(s.bets[id])).toBe(true)
      expect(c.isWorking(c.toggleWorking(s, id).bets[id], s.point)).toBe(false)
    }
  })
})

describe('line and don’t odds called off', () => {
  function lineWithOdds(): CrapsState {
    let s = withPoint(bet(bet(game(), 'passLine', 10), 'dontPass', 10), 5)
    s = bet(bet(s, 'passOdds', 40), 'dontPassOdds', 60)
    return c.toggleWorking(c.toggleWorking(s, 'passOdds'), 'dontPassOdds')
  }

  it('hands both back on a seven-out instead of taking or paying them', () => {
    const start = lineWithOdds()
    const s = throwDice(start, 3, 4)
    expect(resolution(s, 'passOdds')).toMatchObject({ effect: 'push', net: 0, remaining: 0 })
    expect(resolution(s, 'dontPassOdds')).toMatchObject({ effect: 'push', net: 0, remaining: 0 })
    expect(net(s)).toBe(0) // the line lost $10, the don't won $10
    expect(s.bankroll).toBe(start.bankroll + 40 + 60 + 10)
  })

  it('hands both back when the point is made', () => {
    const start = lineWithOdds()
    const s = throwDice(start, 3, 2)
    expect(resolution(s, 'passOdds')).toMatchObject({ effect: 'push', net: 0, remaining: 0 })
    expect(resolution(s, 'dontPassOdds')).toMatchObject({ effect: 'push', net: 0, remaining: 0 })
    expect(s.bets.passOdds).toBeUndefined()
    expect(s.bets.dontPassOdds).toBeUndefined()
    expect(s.bankroll).toBe(start.bankroll + 40 + 60 + 10)
  })

  it('works don’t come odds on the come-out by default, and hands them back when called off', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'dontCome', 10)
    s = throwDice(s, 5, 4) // behind the 9
    s = throwDice(bet(s, 'dontComeOdds', 60, 9), 4, 4) // point made
    expect(c.isWorking(s.bets['dontComeOdds-9'], s.point)).toBe(true)
    expect(resolution(throwDice(s, 3, 4), 'dontComeOdds-9')!.net).toBe(40) // 2:3 on $60

    s = c.toggleWorking(s, 'dontComeOdds-9')
    const seven = throwDice(s, 3, 4)
    expect(resolution(seven, 'dontComePoint-9')!.net).toBe(10)
    expect(resolution(seven, 'dontComeOdds-9')).toMatchObject({ effect: 'push', net: 0, remaining: 0 })
    const nine = throwDice(s, 5, 4)
    expect(resolution(nine, 'dontComePoint-9')!.net).toBe(-10)
    expect(resolution(nine, 'dontComeOdds-9')).toMatchObject({ effect: 'push', net: 0, remaining: 0 })
  })
})

describe('place, buy and lay', () => {
  it('pays the six at 7:6 and leaves the bet standing', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'place', 12, 6)
    const before = s.bankroll
    s = throwDice(s, 4, 2)
    expect(resolution(s, 'place-6')!.net).toBe(14)
    expect(s.bankroll).toBe(before + 14)
    expect(s.bets['place-6'].amount).toBe(12)
  })

  it('snaps the six to a stake the dealer can pay', () => {
    // 7:6 on $5 pays $5 — the seventh dollar simply evaporates, so a dealer
    // will not take it. $17 becomes $12, and the odd $5 stays in the rack.
    const s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'place', 17, 6)
    expect(s.bets['place-6'].amount).toBe(12)
    expect(s.bankroll).toBe(99_990 - 12)
  })

  it('pays the four at 9:5 and the nine at 7:5', () => {
    const four = throwDice(bet(withPoint(bet(game(), 'passLine', 10), 8), 'place', 25, 4), 3, 1)
    expect(resolution(four, 'place-4')!.net).toBe(45)
    const nine = throwDice(bet(withPoint(bet(game(), 'passLine', 10), 8), 'place', 25, 9), 5, 4)
    expect(resolution(nine, 'place-9')!.net).toBe(35)
  })

  it('sits off on the come-out, so a come-out seven leaves it up rather than taking it', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'place', 12, 6)
    s = throwDice(s, 4, 4) // point made — next roll is a come-out
    const before = s.bankroll
    s = throwDice(s, 3, 4)
    expect(resolution(s, 'place-6')!.effect).toBe('push')
    expect(resolution(s, 'place-6')!.remaining).toBe(12)
    expect(s.bets['place-6'].amount).toBe(12)
    expect(s.bankroll).toBe(before + 10) // only the line's natural
  })

  it('takes the place bet on a come-out seven when it is called on', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'place', 12, 6)
    s = throwDice(s, 4, 4)
    s = c.setWorking(s, 'place-6', 'on')
    s = throwDice(s, 3, 4)
    expect(resolution(s, 'place-6')!.net).toBe(-12)
  })

  it('buys the four at true odds for five per cent up front', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'buy', 100, 4)
    // $5 commission handed over on placement.
    expect(s.bankroll).toBe(99_990 - 105)
    s = throwDice(s, 3, 1)
    // 2:1 rather than the 9:5 a place bet gets, less the next $5 to keep it working.
    expect(resolution(s, 'buy-4')!.net).toBe(195)
    // The commission paid at the window is reported with that roll.
    expect(resolution(s, 'commission')!.net).toBe(-5)
  })

  it('charges the buy commission again on every win', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'buy', 20, 4)
    for (let i = 0; i < 3; i++) {
      s = throwDice(s, 3, 1)
      expect(resolution(s, 'buy-4')!.net).toBe(39)
      expect(s.bets['buy-4'].amount).toBe(20)
    }
  })

  it('charges at least $1 to lay, however small the win', () => {
    for (const [n, stake] of [[4, 20], [5, 15], [6, 12]] as const) {
      let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'lay', stake, n)
      s = throwDice(s, 3, 4)
      expect(resolution(s, `lay-${n}`)!.net).toBe(9)
    }
  })

  it('lays the four and takes the commission out of the win', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'lay', 40, 4)
    expect(s.bankroll).toBe(99_990 - 40)
    s = throwDice(s, 3, 4)
    // Wins $20 at 1:2, less $1 of vig on the win.
    expect(resolution(s, 'lay-4')!.net).toBe(19)
  })

  it('will not let the same number be placed and bought at once', () => {
    const s = bet(withPoint(bet(game(), 'passLine', 10), 8), 'place', 12, 6)
    expect(c.canPlace(s, 'buy', 6).ok).toBe(false)
    expect(c.canPlace(s, 'buy', 6).reason).toContain('place')
  })
})

describe('the field', () => {
  const field = (a: DieFace, b: DieFace) =>
    net(throwDice(bet(game(), 'field', 10), a, b))

  it('pays even money on its middle numbers', () => {
    expect(field(2, 1)).toBe(10) // 3
    expect(field(5, 4)).toBe(10) // 9
  })

  it('doubles the two and triples the twelve, as Aria does', () => {
    expect(field(1, 1)).toBe(20)
    expect(field(6, 6)).toBe(30)
  })

  it('loses on the four numbers in the middle', () => {
    for (const [a, b] of [[3, 2], [4, 2], [4, 3], [5, 3]] as const) {
      expect(field(a, b)).toBe(-10)
    }
  })

  it('stays in the field after a win', () => {
    const s = throwDice(bet(game(), 'field', 10), 1, 1)
    expect(s.bets.field.amount).toBe(10)
  })
})

describe('hardways', () => {
  it('pays the hard eight at 9:1 only on a pair', () => {
    const s = throwDice(bet(withPoint(bet(game(), 'passLine', 10), 6), 'hard', 10, 8), 4, 4)
    expect(resolution(s, 'hard-8')!.net).toBe(90)
    expect(s.bets['hard-8'].amount).toBe(10)
  })

  it('loses when the number comes easy', () => {
    const s = throwDice(bet(withPoint(bet(game(), 'passLine', 10), 6), 'hard', 10, 8), 5, 3)
    expect(resolution(s, 'hard-8')!.net).toBe(-10)
    expect(resolution(s, 'hard-8')!.detail).toContain('easy')
  })

  it('loses on a seven', () => {
    const s = throwDice(bet(withPoint(bet(game(), 'passLine', 10), 6), 'hard', 10, 8), 3, 4)
    expect(resolution(s, 'hard-8')!.net).toBe(-10)
  })

  it('pays the hard four at 7:1', () => {
    const s = throwDice(bet(withPoint(bet(game(), 'passLine', 10), 6), 'hard', 10, 4), 2, 2)
    expect(resolution(s, 'hard-4')!.net).toBe(70)
  })
})

describe('centre props', () => {
  const prop = (kind: BetKind, amount: number, a: DieFace, b: DieFace) =>
    net(throwDice(bet(game(), kind, amount), a, b))

  it('pays the one-roll numbers at their board price', () => {
    expect(prop('any7', 10, 3, 4)).toBe(40)
    expect(prop('anyCraps', 10, 1, 1)).toBe(70)
    expect(prop('two', 10, 1, 1)).toBe(300)
    expect(prop('twelve', 10, 6, 6)).toBe(300)
    expect(prop('three', 10, 1, 2)).toBe(150)
    expect(prop('eleven', 10, 5, 6)).toBe(150)
  })

  it('splits the C & E between craps and the yo', () => {
    expect(prop('ce', 10, 1, 1)).toBe(30)
    expect(prop('ce', 10, 5, 6)).toBe(70)
    expect(prop('ce', 10, 4, 3)).toBe(-10)
  })

  it('quotes the horn net of the three quarters that lose', () => {
    // $4 horn: a 2 pays 30:1 on one unit and loses the other three.
    expect(prop('horn', 4, 1, 1)).toBe(27)
    expect(prop('horn', 4, 1, 2)).toBe(12)
    expect(prop('horn', 4, 4, 3)).toBe(-4)
  })

  it('pushes the world on a seven', () => {
    // The fifth riding on the 7 wins exactly what the other four lose.
    expect(prop('world', 5, 3, 4)).toBe(0)
    expect(prop('world', 5, 6, 6)).toBe(26)
    expect(prop('world', 5, 5, 6)).toBe(11)
  })
})

describe('the Fire Bet', () => {
  const makePoints = (state: CrapsState, points: Array<4 | 5 | 6 | 8 | 9 | 10>) => {
    let s = state
    const pairs: Record<number, [DieFace, DieFace]> = {
      4: [3, 1],
      5: [3, 2],
      6: [4, 2],
      8: [5, 3],
      9: [5, 4],
      10: [6, 4],
    }
    for (const p of points) {
      if (!s.bets.passLine) s = bet(s, 'passLine', 10)
      s = throwDice(s, ...pairs[p]) // establish
      s = throwDice(s, ...pairs[p]) // make it
    }
    return s
  }

  it('can only be made before the shooter’s first roll', () => {
    const fresh = game()
    expect(c.canPlace(fresh, 'fire').ok).toBe(true)
    const rolled = throwDice(bet(fresh, 'passLine', 10), 4, 3)
    expect(c.canPlace(rolled, 'fire').ok).toBe(false)
  })

  it('pays nothing for three points and 24:1 for four', () => {
    let s = bet(bet(game(), 'fire', 5), 'passLine', 10)
    s = makePoints(s, [4, 5, 6])
    s = bet(s, 'passLine', 10)
    s = withPoint(s, 8)
    s = throwDice(s, 3, 4) // seven out on three points
    expect(resolution(s, 'fire')!.net).toBe(-5)

    let t = bet(bet(game(), 'fire', 5), 'passLine', 10)
    t = makePoints(t, [4, 5, 6, 8])
    t = bet(t, 'passLine', 10)
    t = withPoint(t, 9)
    t = throwDice(t, 3, 4)
    expect(resolution(t, 'fire')!.net).toBe(120)
  })

  it('counts each point only once', () => {
    let s = bet(bet(game(), 'fire', 5), 'passLine', 10)
    s = makePoints(s, [6, 6, 6, 6])
    expect(s.shoot.firePoints).toEqual([6])
  })

  it('pays out the moment all six are made', () => {
    let s = bet(bet(game(), 'fire', 5), 'passLine', 10)
    s = makePoints(s, [4, 5, 6, 8, 9, 10])
    expect(resolution(s, 'fire')!.net).toBe(4_995)
    expect(s.bets.fire).toBeUndefined()
  })
})

describe('All, Tall and Small', () => {
  it('pays the small when 2 through 6 are all rolled before a seven', () => {
    let s = bet(bet(game(), 'small', 5), 'passLine', 10)
    for (const [a, b] of [[1, 1], [1, 2], [3, 1], [3, 2], [4, 2]] as const) {
      s = throwDice(s, a, b)
      if (!s.bets.passLine) s = bet(s, 'passLine', 10)
    }
    expect(resolution(s, 'small')!.net).toBe(150)
  })

  it('loses on any seven, including a come-out natural', () => {
    let s = bet(bet(game(), 'all', 5), 'passLine', 10)
    s = throwDice(s, 1, 1)
    s = throwDice(s, 3, 4)
    expect(resolution(s, 'all')!.net).toBe(-5)
    expect(s.shoot.numbersHit).toEqual([])
  })

  it('can be re-bet once a seven has cleared the board', () => {
    let s = bet(bet(game(), 'small', 5), 'passLine', 10)
    s = throwDice(s, 1, 1)
    expect(c.canPlace(s, 'small').ok).toBe(false)
    s = throwDice(s, 3, 4)
    expect(c.canPlace(s, 'small').ok).toBe(true)
  })
})

describe('taking the dice', () => {
  it('requires a line bet', () => {
    expect(c.canRoll(game()).ok).toBe(false)
    expect(c.canRoll(game()).reason).toContain('line bet')
    expect(c.canRoll(bet(game(), 'passLine', 10)).ok).toBe(true)
  })

  it('refuses while a bet is under the table minimum', () => {
    const s = bet(bet(game(), 'passLine', 10), 'field', 5)
    expect(c.canRoll(s).ok).toBe(false)
    expect(c.canRoll(s).reason).toContain('Field')
  })
})

describe('the next-roll projection', () => {
  it('reports exactly what the table then pays', () => {
    let s = bet(withPoint(bet(game(), 'passLine', 10), 6), 'passOdds', 50)
    s = bet(s, 'place', 12, 8)
    s = bet(s, 'hard', 5, 8)
    s = bet(s, 'field', 10)

    for (const outcome of c.nextRollOutcomes(s)) {
      // Find a real pair of dice that makes this total the easy way, throw it,
      // and check the projection was telling the truth.
      const pair = ([[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]] as const)
        .find(([a, b]) => a + b === outcome.total)!
      expect(net(throwDice(s, pair[0], pair[1]))).toBe(outcome.net)
    }
  })

  it('separates the hard way where it changes the answer', () => {
    const s = bet(bet(withPoint(bet(game(), 'passLine', 10), 6), 'hard', 10, 8), 'place', 12, 8)
    const eight = c.nextRollOutcomes(s).find((o) => o.total === 8)!
    expect(eight.net).toBe(14 - 10) // place pays, hardway lost the easy way
    expect(eight.hardNet).toBe(14 + 90)
  })
})

describe('money never leaks', () => {
  it('conserves the bankroll plus everything on the felt', () => {
    let s = game(10_000)
    const equity = (state: CrapsState) => state.bankroll + c.totalAtRisk(state)

    s = bet(s, 'passLine', 10)
    s = bet(s, 'field', 10)
    // Placing chips only moves money between the rack and the felt.
    expect(equity(s)).toBe(10_000)

    s = c.removeBet(s, 'field')
    expect(equity(s)).toBe(10_000)

    let running = 10_000
    const script: Array<[DieFace, DieFace]> = [
      [4, 2], [3, 1], [5, 4], [4, 2], [3, 4], [1, 1], [5, 6], [6, 4], [3, 4],
    ]
    for (const [a, b] of script) {
      if (!s.bets.passLine && s.point === null) s = bet(s, 'passLine', 10)
      s = throwDice(s, a, b)
      running += net(s)
      expect(equity(s)).toBe(running)
    }
  })
})

/**
 * The settlement panel is built entirely on `summariseRoll`, so what it can say
 * is only as trustworthy as this. The claim being checked is the one a player
 * makes when they count their chips: the rack moved by exactly this much.
 */
describe('where the money went', () => {
  it('matches the rack, roll after roll, across a full shoot', () => {
    let s = game(10_000)
    const script: Array<[DieFace, DieFace]> = [
      [4, 2], [3, 2], [5, 4], [4, 2], [1, 1], [6, 5], [3, 4],
      [5, 5], [2, 2], [6, 6], [3, 4], [4, 3],
    ]

    for (const [a, b] of script) {
      // Keep a mixed felt up: contract bets, bets that come down when they win,
      // and one-roll props, because those three settle in different ways.
      if (s.point === null && !s.bets.passLine) s = bet(s, 'passLine', 10)
      if (s.point !== null) {
        s = bet(s, 'passOdds', 20)
        s = bet(s, 'come', 10)
        s = bet(s, 'place', 12, 6)
      }
      s = bet(s, 'field', 5)
      s = bet(s, 'hard', 5, 8)

      const before = s.bankroll
      s = throwDice(s, a, b)
      expect(c.summariseRoll(s.resolutions).bankroll).toBe(s.bankroll - before)
    }
  })

  it('separates profit from what came back to the rack', () => {
    // A come bet on the 5 wins: paid $10, and the $10 stake comes down with it.
    // Profit is $10; the rack sees $20. Conflating those is the whole problem.
    let s = withPoint(bet(game(), 'passLine', 10), 6)
    s = bet(s, 'come', 10)
    s = throwDice(s, 3, 2) // come bet travels to the 5
    const before = s.bankroll
    s = throwDice(s, 3, 2) // and is paid

    const ledger = c.summariseRoll(s.resolutions)
    expect(ledger.paid).toBe(10)
    expect(ledger.returned).toBe(10)
    expect(ledger.net).toBe(10)
    expect(ledger.bankroll).toBe(20)
    expect(s.bankroll - before).toBe(20)
  })

  it('counts a bet that was off as returned, not lost', () => {
    // Come odds sleep on the come-out, so a seven hands them back.
    let s = bet(withPoint(bet(game(), 'passLine', 10), 6), 'come', 10)
    s = throwDice(s, 5, 4) // come bet travels to the 9
    s = bet(s, 'comeOdds', 40, 9)
    s = throwDice(s, 3, 3) // point made, back to a come-out
    const before = s.bankroll
    s = throwDice(s, 3, 4) // come-out seven

    const ledger = c.summariseRoll(s.resolutions)
    expect(ledger.taken).toBe(10) // the flat come bet
    expect(ledger.returned).toBe(40) // the odds; the line is paid and stays up
    expect(s.bankroll - before).toBe(ledger.bankroll)
  })
})

/**
 * Odds pay true odds, so over the 36 ways the next roll can land they are
 * worth exactly nothing — working or not. An off bet that could still win but
 * not lose would show up here as free money.
 */
describe('odds are never free money', () => {
  const allRolls = (s: CrapsState, id: string) => {
    let sum = 0
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) sum += resolution(throwDice(s, a as DieFace, b as DieFace), id)?.net ?? 0
    }
    return sum
  }

  for (const [n, dice] of [[4, [3, 1]], [5, [3, 2]], [6, [4, 2]], [8, [5, 3]], [9, [5, 4]], [10, [6, 4]]] as const) {
    it(`come odds on the ${n} are worth zero on a come-out, off or on`, () => {
      const table = n === 8 ? 6 : 8
      let s = bet(withPoint(bet(game(), 'passLine', 10), table), 'come', 10)
      s = throwDice(s, dice[0], dice[1]) // come bet travels to n
      s = bet(s, 'comeOdds', 60, n)
      s = throwDice(s, (table / 2) as DieFace, (table / 2) as DieFace) // point made the hard way, back to a come-out
      expect(s.point).toBeNull()
      expect(allRolls(s, `comeOdds-${n}`)).toBe(0)
      expect(allRolls(c.setWorking(s, `comeOdds-${n}`, 'on'), `comeOdds-${n}`)).toBe(0)
    })
  }
})
