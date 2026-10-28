import { describe, expect, it } from 'vitest'
import { ARIA_ODDS_MULTIPLE, LAY_ODDS, pay, TRUE_ODDS } from './bets'
import * as c from './craps'
import { CRAPS_TABLES, limitsFor } from './rules'
import { POINT_NUMBERS, type BetKind, type CrapsState, type DieFace, type PointNumber } from './types'

/**
 * What the table will and will not take, in every state it can be in.
 *
 * The individual rule tests check that a bet *resolves* correctly. This checks
 * the gate in front of it: that the come box shuts on a come-out, that odds
 * cannot exist without something to ride behind, that the side bets close once
 * the shooter has thrown, and that nothing at all can be placed while the dice
 * are in the air.
 *
 * Written as a matrix rather than as cases, because the failures worth catching
 * are the combinations nobody thought to write a case for.
 */

const LIMITS = limitsFor(CRAPS_TABLES[0])
const fresh = () => c.createGame(100_000, 1, LIMITS)

const bet = (s: CrapsState, kind: BetKind, amount: number, number?: number) =>
  c.placeBet(s, kind, amount, number)
const roll = (s: CrapsState, a: DieFace, b: DieFace) => c.settle(c.rollExactly(s, a, b))

/** Every spot the interface can ask about, as it would ask. */
const SPOTS: Array<[string, BetKind, number?]> = [
  ['pass line', 'passLine'],
  ['don’t pass', 'dontPass'],
  ['pass odds', 'passOdds'],
  ['don’t pass odds', 'dontPassOdds'],
  ['come', 'come'],
  ['don’t come', 'dontCome'],
  ['come odds on the 5', 'comeOdds', 5],
  ['don’t come odds on the 5', 'dontComeOdds', 5],
  ['place the 6', 'place', 6],
  ['buy the 4', 'buy', 4],
  ['lay the 4', 'lay', 4],
  ['field', 'field'],
  ['hard 8', 'hard', 8],
  ['any seven', 'any7'],
  ['fire bet', 'fire'],
  ['small', 'small'],
]

/** The set of spots a state will accept, as a sorted list of names. */
function accepted(state: CrapsState): string[] {
  return SPOTS.filter(([, kind, number]) => c.canPlace(state, kind, number).ok).map(([name]) => name)
}

// --- The states a craps table can be in -------------------------------------

/** Nothing on the felt, nobody has thrown. */
const openingComeOut = () => fresh()

/** A line bet up, still on the come-out. */
const comeOutWithLine = () => bet(fresh(), 'passLine', 10)

/** Point 6 established. */
const onAPoint = () => roll(bet(fresh(), 'passLine', 10), 4, 2)

/** Point 6, with a come bet travelled to the 5. */
const withComePoint = () => roll(bet(onAPoint(), 'come', 10), 3, 2)

/**
 * The situation that prompted this: the point has just been made, so the table
 * is back on a come-out — but a come bet is still sitting out on the 5.
 */
const comeOutAfterPointMade = () => roll(withComePoint(), 4, 2)

/** Dice in the air. */
const midThrow = () => c.rollDice(bet(fresh(), 'passLine', 10))

describe('what the table will take, and when', () => {
  it('opens with the line, the outside bets and the side bets', () => {
    expect(accepted(openingComeOut())).toEqual([
      'pass line',
      'don’t pass',
      'place the 6',
      'buy the 4',
      'lay the 4',
      'field',
      'hard 8',
      'any seven',
      'fire bet',
      'small',
    ])
  })

  it('shuts the Fire Bet once the shooter has thrown, and keeps the rest', () => {
    // One come-out craps: no point, but the dice have been out.
    const thrown = roll(comeOutWithLine(), 1, 1)
    expect(thrown.point).toBeNull()
    expect(accepted(thrown)).not.toContain('fire bet')
    expect(accepted(thrown)).toContain('pass line')
  })

  it('opens the come box and the odds only once a point exists', () => {
    expect(accepted(comeOutWithLine())).not.toContain('come')
    expect(accepted(comeOutWithLine())).not.toContain('don’t come')
    expect(accepted(comeOutWithLine())).not.toContain('pass odds')

    const live = accepted(onAPoint())
    expect(live).toContain('come')
    expect(live).toContain('don’t come')
    expect(live).toContain('pass odds')
  })

  it('closes the line once a point exists', () => {
    const live = accepted(onAPoint())
    expect(live).not.toContain('pass line')
    expect(live).not.toContain('don’t pass')
  })

  it('will not take odds with nothing to ride behind', () => {
    // A point is up, but there is no don't pass bet and no come point.
    const live = accepted(onAPoint())
    expect(live).not.toContain('don’t pass odds')
    expect(live).not.toContain('come odds on the 5')
    expect(live).not.toContain('don’t come odds on the 5')

    expect(accepted(withComePoint())).toContain('come odds on the 5')
  })

  it('closes All/Tall/Small the moment a number is on the board', () => {
    expect(accepted(openingComeOut())).toContain('small')
    // A come-out three: no point, but the 3 is now recorded.
    const marked = roll(comeOutWithLine(), 1, 2)
    expect(marked.point).toBeNull()
    expect(accepted(marked)).not.toContain('small')
  })

  it('takes nothing at all while the dice are in the air', () => {
    expect(accepted(midThrow())).toEqual([])
    expect(c.canPlace(midThrow(), 'field').reason).toBe('Dice are in the air')
  })
})

/**
 * The exact sequence the question came from — a point made while a come bet was
 * still working — checked spot by spot.
 */
describe('a point made with a come bet still out on a number', () => {
  const state = comeOutAfterPointMade()

  it('is back on a come-out with the come bet still standing', () => {
    expect(state.point).toBeNull()
    expect(state.bets['comePoint-5'].amount).toBe(10)
    expect(state.bets.passLine.amount).toBe(10)
  })

  it('shuts the come and don’t come boxes', () => {
    expect(c.canPlace(state, 'come').ok).toBe(false)
    expect(c.canPlace(state, 'come').reason).toBe('Only once a point is established')
    expect(c.canPlace(state, 'dontCome').ok).toBe(false)
  })

  it('shuts the line odds, because there is no point to take them on', () => {
    expect(c.canPlace(state, 'passOdds').ok).toBe(false)
    expect(c.canPlace(state, 'dontPassOdds').ok).toBe(false)
  })

  it('reopens the line itself for the new come-out', () => {
    expect(c.canPlace(state, 'passLine').ok).toBe(true)
    expect(c.canPlace(state, 'dontPass').ok).toBe(true)
  })

  /**
   * Still allowed, and correctly so — odds may be added to a travelled come bet
   * at any time. They simply sit off for the come-out, which is why a come-out
   * seven returns them instead of taking them.
   */
  it('still allows odds on the come bet that is out there', () => {
    expect(c.canPlace(state, 'comeOdds', 5).ok).toBe(true)
    const backed = bet(state, 'comeOdds', 40, 5)
    expect(c.isWorking(backed.bets['comeOdds-5'], backed.point)).toBe(false)

    const sevened = roll(backed, 3, 4)
    expect(sevened.resolutions.find((r) => r.betId === 'comeOdds-5')?.effect).toBe('push')
    expect(sevened.resolutions.find((r) => r.betId === 'comePoint-5')?.net).toBe(-10)
  })

  it('refuses don’t come odds, because there is no don’t come bet out there', () => {
    expect(c.canPlace(state, 'dontComeOdds', 5).ok).toBe(false)
    expect(c.canPlace(state, 'dontComeOdds', 5).reason).toBe('No don’t come bet on the 5 to back')
  })
})

describe('odds can never outrun the bet they ride behind', () => {
  it('caps at the 3-4-5x maximum however many times it is clicked', () => {
    let s = bet(roll(bet(fresh(), 'passLine', 10), 4, 2), 'passOdds', 10)
    for (let i = 0; i < 20; i++) s = bet(s, 'passOdds', 25)
    expect(s.bets.passOdds.amount).toBe(50)
  })

  it('comes down with the bet it was riding behind', () => {
    let s = roll(bet(fresh(), 'dontPass', 10), 4, 2)
    s = bet(s, 'dontPassOdds', 72)
    expect(s.bets.dontPassOdds).toBeDefined()
    // The don't side may come down whenever it likes; the odds go with it.
    s = c.removeBet(s, 'dontPass')
    expect(s.bets.dontPass).toBeUndefined()
    expect(s.bets.dontPassOdds).toBeUndefined()
    expect(s.bankroll).toBe(100_000)
  })

  it('will not let a contract bet be pulled', () => {
    const s = roll(bet(bet(fresh(), 'passLine', 10), 'fire', 5), 4, 2)
    expect(c.removeBet(s, 'passLine').bets.passLine).toBeDefined()
    expect(c.removeBet(s, 'fire').bets.fire).toBeDefined()
  })
})

/**
 * Aria runs 3-4-5x. The rule is stated as a multiple of the line, but what it
 * actually fixes is the payout: whatever the point, full odds wins exactly six
 * times the line. Both sides are checked against that invariant rather than
 * against a table of expected multiples, so the test cannot drift into agreeing
 * with a mistake in the same table the code reads.
 */
describe('the 3-4-5x ceiling', () => {
  const DICE: Record<PointNumber, [DieFace, DieFace]> = {
    4: [2, 2],
    5: [3, 2],
    6: [4, 2],
    8: [4, 4],
    9: [5, 4],
    10: [5, 5],
  }
  const LINE = 10
  /** A point to run the come bet under that is not the number being tested. */
  const tablePoint = (target: PointNumber): PointNumber => (target === 4 ? 10 : 4)

  const onPoint = (n: PointNumber, kind: 'passLine' | 'dontPass' = 'passLine') =>
    roll(bet(fresh(), kind, LINE), ...DICE[n])

  it.each(POINT_NUMBERS)('takes %i× the line behind the point and pays 6x', (n) => {
    const cap = c.capFor(onPoint(n), 'passOdds')
    expect(cap).toBe(LINE * ARIA_ODDS_MULTIPLE[n])
    expect(pay(cap, TRUE_ODDS[n])).toBe(LINE * 6)
  })

  it.each(POINT_NUMBERS)('lays six times the line against the %i, winning the take side’s multiple', (n) => {
    const cap = c.capFor(onPoint(n, 'dontPass'), 'dontPassOdds')
    expect(cap).toBe(LINE * 6)
    expect(pay(cap, LAY_ODDS[n])).toBe(LINE * ARIA_ODDS_MULTIPLE[n])
  })

  it('quotes the lay ceilings the way a dealer would', () => {
    // Worth pinning literally: these are the numbers on the tooltip. The lay
    // side risks 6x the line on every point and wins 3x, 4x or 5x.
    const capAgainst = (n: PointNumber) => c.capFor(onPoint(n, 'dontPass'), 'dontPassOdds')
    for (const n of POINT_NUMBERS) expect(capAgainst(n)).toBe(60)
    expect(pay(capAgainst(4), LAY_ODDS[4])).toBe(30)
    expect(pay(capAgainst(5), LAY_ODDS[5])).toBe(40)
    expect(pay(capAgainst(6), LAY_ODDS[6])).toBe(50)
  })

  it.each(POINT_NUMBERS)('sizes come odds off the come bet, not the line, on the %i', (n) => {
    // A $10 line with a $25 come bet: the ceiling must follow the $25.
    const travelled = roll(bet(onPoint(tablePoint(n)), 'come', 25), ...DICE[n])
    expect(travelled.bets[c.betId('comePoint', n)].amount).toBe(25)
    expect(c.capFor(travelled, 'comeOdds', n)).toBe(25 * ARIA_ODDS_MULTIPLE[n])

    const dark = roll(bet(onPoint(tablePoint(n)), 'dontCome', 25), ...DICE[n])
    expect(c.capFor(dark, 'dontComeOdds', n)).toBe(25 * 6)
  })

  it('separates what the rule allows from what is still free', () => {
    const s = bet(onPoint(6), 'passOdds', 20)
    // The ceiling does not move when chips go down; the room left does.
    expect(c.capFor(s, 'passOdds')).toBe(50)
    expect(c.maxFor(s, 'passOdds')).toBe(30)
  })

  it('reports the rule ceiling even when the rack cannot cover it', () => {
    const broke = { ...onPoint(4), bankroll: 15 }
    expect(c.capFor(broke, 'passOdds')).toBe(30)
    expect(c.maxFor(broke, 'passOdds')).toBe(15)
  })

  it('quotes nothing where there is no bet to ride behind', () => {
    expect(c.capFor(onPoint(6), 'comeOdds', 5)).toBe(0)
    expect(c.capFor(fresh(), 'passOdds')).toBe(0)
  })
})

describe('one wager per box number', () => {
  it('refuses to place a number that is already bought, and the reverse', () => {
    const placed = bet(onAPoint(), 'place', 12, 6)
    expect(c.canPlace(placed, 'buy', 6).ok).toBe(false)
    expect(c.canPlace(placed, 'lay', 6).ok).toBe(false)

    const bought = bet(onAPoint(), 'buy', 25, 4)
    expect(c.canPlace(bought, 'place', 4).ok).toBe(false)
  })

  it('still allows a come bet to travel onto a number you have placed', () => {
    // These are genuinely different bets that happen to share a box, and a real
    // dealer keeps them apart with the chips' position.
    const s = roll(bet(bet(onAPoint(), 'place', 25, 5), 'come', 10), 3, 2)
    expect(s.bets['place-5'].amount).toBe(25)
    expect(s.bets['comePoint-5'].amount).toBe(10)
  })
})
