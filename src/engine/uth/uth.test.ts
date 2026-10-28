import { describe, expect, it } from 'vitest'
import { card } from '../testUtils'
import type { DealtCard } from '../types'
import { describe as describeHand, encode, handName, namedCategory, score } from './poker'
import { SEVEN_CARD_HANDS, SEVEN_CARD_TOTAL, TRIPS_TABLES, tripsEdge, UTH_LIMITS } from './rules'
import { advise, dealerOuts, exactFlopAdvice, flopAdvice, flopEvs, preflopAdvice, preflopChart, riverAdvice, riverEvs, withinRack } from './strategy'
import type { UthState } from './types'
import * as u from './uth'

const cards = (codes: string[]) => codes.map((code, i) => card(code, i))
const codes = (list: string[]) => cards(list).map(encode)
const scoreOf = (list: string[]) => score(codes(list))

function dealt(list: string[], faceDown: boolean, from: number): DealtCard[] {
  return cards(list).map((c, i) => ({ ...c, seq: from + i, faceDown }))
}

/** A hand already dealt, with exactly these cards in it. */
function hand(player: string[], dealer: string[], board: string[], bets: { ante?: number; trips?: number } = {}, bankroll = 10_000): UthState {
  let s = u.createGame(bankroll, 7, UTH_LIMITS)
  s = u.placeAnte(s, bets.ante ?? 25)
  if (bets.trips) s = u.placeTrips(s, bets.trips)
  s = u.deal(s)
  return { ...s, player: dealt(player, false, 0), dealer: dealt(dealer, true, 2), board: dealt(board, true, 4) }
}

function res(state: UthState, kind: string) {
  return state.resolutions.find((r) => r.kind === kind)!
}

describe('the hand evaluator', () => {
  it('counts every five-card hand into the right category', () => {
    const counts: Record<string, number> = {}
    const h = new Int32Array(5)
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++)
          for (let d = c + 1; d < 52; d++)
            for (let e = d + 1; e < 52; e++) {
              h[0] = a
              h[1] = b
              h[2] = c
              h[3] = d
              h[4] = e
              const k = namedCategory(score(h, 5))
              counts[k] = (counts[k] ?? 0) + 1
            }
    expect(counts).toEqual({
      royal: 4,
      straightFlush: 36,
      quads: 624,
      fullHouse: 3_744,
      flush: 5_108,
      straight: 10_200,
      trips: 54_912,
      twoPair: 123_552,
      pair: 1_098_240,
      high: 1_302_540,
    })
  })

  it('finds the best five of seven about as often as the full count says', () => {
    // Deterministic draws from a simple LCG, so the test is the same every run.
    let x = 12345
    const next = () => (x = (Math.imul(x, 1103515245) + 12345) >>> 0)
    const seen: Record<string, number> = {}
    const deck = Array.from({ length: 52 }, (_, i) => i)
    const h = new Int32Array(7)
    const n = 200_000
    for (let t = 0; t < n; t++) {
      for (let i = 0; i < 7; i++) {
        const j = i + (next() % (52 - i))
        ;[deck[i], deck[j]] = [deck[j], deck[i]]
        h[i] = deck[i]
      }
      const k = namedCategory(score(h, 7))
      seen[k] = (seen[k] ?? 0) + 1
    }
    for (const k of ['flush', 'straight', 'trips', 'twoPair', 'pair', 'high'] as const) {
      const p = SEVEN_CARD_HANDS[k] / SEVEN_CARD_TOTAL
      const sd = Math.sqrt((p * (1 - p)) / n)
      expect(Math.abs(seen[k] / n - p), k).toBeLessThan(4 * sd)
    }
  })

  it('ranks hands the way the dealer reads them', () => {
    const ordered = [
      ['AH', 'KH', 'QH', 'JH', '10H'],
      ['9C', '8C', '7C', '6C', '5C'],
      ['5D', '4D', '3D', '2D', 'AD'],
      ['7S', '7H', '7D', '7C', '2S'],
      ['KS', 'KH', 'KD', '4C', '4S'],
      ['QS', 'QH', 'QD', 'JC', 'JS'],
      ['AS', 'JS', '9S', '4S', '2S'],
      ['AD', 'KS', 'QH', 'JC', '10S'],
      ['6D', '5S', '4H', '3C', '2S'],
      ['5D', '4S', '3H', '2C', 'AS'],
      ['8S', '8H', '8D', 'AC', 'KS'],
      ['AS', 'AH', '3D', '3C', 'KS'],
      ['AS', 'AH', '3D', '3C', '2S'],
      ['AS', 'AH', 'KD', '7C', '2S'],
      ['AS', 'QH', 'JD', '7C', '2S'],
    ].map(scoreOf)
    for (let i = 1; i < ordered.length; i++) expect(ordered[i - 1], `hand ${i}`).toBeGreaterThan(ordered[i])
  })

  it('plays the board when the board is best', () => {
    const board = ['AH', 'KH', 'QH', 'JH', '10H']
    expect(scoreOf(['2C', '3D', ...board])).toBe(scoreOf(['4S', '7C', ...board]))
    // A higher kicker counts only if it plays.
    expect(scoreOf(['AS', '2C', 'KD', 'KH', '8S', '7C', '5D'])).toBeGreaterThan(scoreOf(['QS', '2C', 'KD', 'KH', '8S', '7C', '5D']))
  })

  it('names hands in full', () => {
    expect(handName(scoreOf(['KS', 'KH', 'KD', '4C', '4S', '2D', '9H']))).toBe('Full house, kings over fours')
    expect(handName(scoreOf(['5D', '4S', '3H', '2C', 'AS', 'KD', 'KH']))).toBe('Straight, five high')
    expect(handName(scoreOf(['AH', 'KH', 'QH', 'JH', '10H', '2D', '3C']))).toBe('Royal flush')
    expect(handName(scoreOf(['AS', 'AH', '3D', '3C', 'KS', 'KD', '2C']))).toBe('Two pair, aces and kings')
    expect(handName(scoreOf(['QS', '9H', '7D', '4C', '2S']))).toBe('Queen high')
  })

  it('points at the five cards that play', () => {
    const info = describeHand(cards(['2C', '3D', 'AH', 'KH', 'QH', 'JH', '10H']))
    expect(info.category).toBe('royal')
    expect(info.best).toEqual([2, 3, 4, 5, 6])
  })
})

describe('the deal', () => {
  it('takes chips in pairs for the Ante and Blind', () => {
    const s = u.placeAnte(u.createGame(1_000, 1, UTH_LIMITS), 25)
    expect(s.bets).toEqual({ ante: 25, blind: 25, trips: 0, play: 0 })
    expect(s.bankroll).toBe(950)
    // A first chip under the minimum is lifted to it.
    expect(u.placeAnte(u.createGame(1_000, 1, UTH_LIMITS), 5).bets.ante).toBe(15)
  })

  it('deals two each and a full board, all of it hidden but your cards', () => {
    const s = u.deal(u.placeAnte(u.createGame(1_000, 1, UTH_LIMITS), 25))
    expect(s.phase).toBe('preflop')
    expect(s.player.every((c) => !c.faceDown)).toBe(true)
    expect([...s.dealer, ...s.board].every((c) => c.faceDown)).toBe(true)
    expect(new Set([...s.player, ...s.dealer, ...s.board].map((c) => c.id)).size).toBe(9)
    expect(u.visibleBoard(s)).toEqual([])
  })

  it('will not deal a hand you could not call on the river', () => {
    const s = u.placeAnte(u.createGame(60, 1, UTH_LIMITS), 25)
    expect(s.bankroll).toBe(10)
    expect(u.canDeal(s).ok).toBe(false)
    expect(u.canDeal(u.placeAnte(u.createGame(75, 1, UTH_LIMITS), 25)).ok).toBe(true)
  })

  it('offers only the raises the rack covers', () => {
    const s = u.deal(u.placeAnte(u.createGame(130, 1, UTH_LIMITS), 25))
    expect(s.bankroll).toBe(80)
    expect(u.legalDecisions(s)).toEqual(['check', 'bet3'])
  })

  it('walks the streets: check, check, then call or fold', () => {
    let s = hand(['2C', '7D'], ['AS', 'AH'], ['KH', 'QD', '9C', '4C', '3H'])
    s = u.decide(s, 'check')
    expect(s.phase).toBe('flop')
    expect(u.visibleBoard(s).map((c) => c.rank)).toEqual(['K', 'Q', '9'])
    expect(u.legalDecisions(s)).toEqual(['check', 'bet2'])
    s = u.decide(s, 'check')
    expect(s.phase).toBe('river')
    expect(u.legalDecisions(s)).toEqual(['fold', 'bet1'])
    // No 4x after the flop.
    expect(u.decide(s, 'bet4')).toBe(s)
  })
})

describe('settlement', () => {
  it('pays the Play and Ante even money, and the Blind on a straight', () => {
    let s = u.decide(hand(['JS', '10D'], ['AS', '4H'], ['KH', 'QD', '9C', '4C', '2H']), 'bet4')
    expect(s.result!.outcome).toBe('win')
    s = u.settle(s)
    expect(res(s, 'play').net).toBe(100)
    expect(res(s, 'ante').net).toBe(25)
    expect(res(s, 'blind').net).toBe(25)
    expect(s.bankroll).toBe(10_000 + 150)
  })

  it('pushes the Ante when the dealer does not open, and pays a flush 3 to 2 on the Blind', () => {
    let s = u.decide(u.decide(hand(['AH', '7H'], ['KS', 'QC'], ['9H', '5H', '2H', 'JD', '3C']), 'check'), 'bet2')
    s = u.settle(s)
    expect(s.result!.dealerQualifies).toBe(false)
    expect(res(s, 'ante').effect).toBe('push')
    expect(res(s, 'play').net).toBe(50)
    expect(res(s, 'blind').net).toBe(37.5)
    expect(u.handNet(s)).toBe(87.5)
  })

  it('pushes the Blind on a win below a straight', () => {
    const s = u.settle(u.decide(hand(['AS', 'AD'], ['KS', 'QC'], ['AH', '9D', '7C', '4S', '2H']), 'bet4'))
    expect(res(s, 'blind').effect).toBe('push')
  })

  it('still pushes the Ante on a loss when the dealer does not open', () => {
    let s = hand(['KS', '7D'], ['AS', '8H'], ['QD', '9C', '5H', '3C', '2D'])
    s = u.settle(u.decide(u.decide(u.decide(s, 'check'), 'check'), 'bet1'))
    expect(s.result!.outcome).toBe('lose')
    expect(res(s, 'ante').effect).toBe('push')
    expect(res(s, 'play').net).toBe(-25)
    expect(res(s, 'blind').net).toBe(-25)
  })

  it('pushes everything on a tie', () => {
    const board = ['AH', 'KH', 'QH', 'JH', '10H']
    const s = u.settle(u.decide(hand(['2C', '3D'], ['4S', '7C'], board), 'bet4'))
    expect(s.result!.outcome).toBe('tie')
    expect(s.resolutions.every((r) => r.effect === 'push')).toBe(true)
    expect(s.bankroll).toBe(10_000)
  })

  it('pays Trips on your hand even when you fold it', () => {
    let s = hand(['8S', '8D'], ['AS', 'AH'], ['8H', 'KD', '4C', 'AD', '2S'], { trips: 10 })
    s = u.settle(u.decide(u.decide(u.decide(s, 'check'), 'check'), 'fold'))
    expect(res(s, 'ante').net).toBe(-25)
    expect(res(s, 'blind').net).toBe(-25)
    expect(res(s, 'trips').net).toBe(30)
  })

  it('pays a royal 500 to 1 on the Blind and 50 to 1 on Trips', () => {
    const s = u.settle(u.decide(hand(['AH', 'KH'], ['2S', '2C'], ['QH', 'JH', '10H', '4C', '3D'], { trips: 5 }), 'bet4'))
    expect(res(s, 'blind').net).toBe(12_500)
    expect(res(s, 'trips').net).toBe(250)
  })

  it('prices Trips exactly from the seven-card count', () => {
    expect(tripsEdge(TRIPS_TABLES.standard)).toBeCloseTo(0.019040, 6)
    expect(tripsEdge(TRIPS_TABLES.generous)).toBeCloseTo(0.009018, 6)
    expect(tripsEdge(TRIPS_TABLES.tight)).toBeCloseTo(0.034979, 6)
    expect(Object.values(SEVEN_CARD_HANDS).reduce((a, b) => a + b, 0)).toBe(SEVEN_CARD_TOTAL)
  })

  it('rebets the last Ante and Trips', () => {
    let s = u.settle(u.decide(hand(['JS', '10D'], ['AS', '4H'], ['KH', 'QD', '9C', '4C', '2H'], { trips: 10 }), 'bet4'))
    s = u.rebet(s)
    expect(s.phase).toBe('betting')
    expect(s.bets).toEqual({ ante: 25, blind: 25, trips: 10, play: 0 })
  })
})

describe('the coach', () => {
  const pre = (list: string[]) => preflopAdvice(cards(list)).decision

  it('raises 4x before the flop on the chart hands, and never 3x', () => {
    expect(pre(['3S', '3H'])).toBe('bet4')
    expect(pre(['2S', '2H'])).toBe('check')
    expect(pre(['AS', '2H'])).toBe('bet4')
    expect(pre(['KS', '2S'])).toBe('bet4')
    expect(pre(['KS', '4H'])).toBe('check')
    expect(pre(['KS', '5H'])).toBe('bet4')
    expect(pre(['QS', '6S'])).toBe('bet4')
    expect(pre(['QS', '5S'])).toBe('check')
    expect(pre(['QS', '8H'])).toBe('bet4')
    expect(pre(['QS', '7H'])).toBe('check')
    expect(pre(['JS', '8S'])).toBe('bet4')
    expect(pre(['JS', '9H'])).toBe('check')
    expect(pre(['JS', '10H'])).toBe('bet4')
    expect(pre(['10S', '9S'])).toBe('check')
    const chart = preflopChart().flat()
    expect(chart).toHaveLength(169)
    expect(chart.filter((c) => c.decision === 'bet4')).toHaveLength(69)
  })

  it('bets 2x on the flop with a real hand or a strong flush draw', () => {
    const flop = (hole: string[], board: string[]) => flopAdvice(cards(hole), cards(board)).decision
    expect(flop(['KS', '7D'], ['KH', '9C', '2D'])).toBe('bet2')
    expect(flop(['5S', '5D'], ['KH', '9C', '2D'])).toBe('bet2')
    expect(flop(['2S', '2D'], ['KH', '9C', '4D'])).toBe('check')
    expect(flop(['AD', '4H'], ['KH', '9H', '2H'])).toBe('check')
    expect(flop(['AH', '4D'], ['KH', '9H', '2H'])).toBe('bet2')
    expect(flop(['10H', '4H'], ['KH', '9H', '2S'])).toBe('bet2')
    expect(flop(['9H', '4H'], ['KH', '8H', '2S'])).toBe('check')
    expect(flop(['AS', 'QD'], ['7H', '7C', '2S'])).toBe('check')
    expect(flop(['5S', '6D'], ['7H', '8C', '9S'])).toBe('bet2')
    // Deuces and a board pair is two pair in name only; deuces that make trips still bet.
    expect(flop(['2S', '2D'], ['7H', '7C', 'KS'])).toBe('check')
    expect(flop(['2S', '2D'], ['2H', '7C', 'KS'])).toBe('bet2')
  })

  it('makes the exact flop call, in the rule’s words where the two agree', () => {
    // Four to a flush with a hidden ten: the rule bets, but the board is one card from a straight flush against you.
    const tenHigh = { hole: cards(['10S', '2H']), flop: cards(['5S', '6S', '7S']) }
    expect(flopAdvice(tenHigh.hole, tenHigh.flop).decision).toBe('bet2')
    const exactTen = advise(tenHigh.hole, tenHigh.flop, flopEvs(tenHigh.hole, tenHigh.flop))!
    expect(exactTen.decision).toBe('check')
    expect(exactTen.reason).toMatch(/simple rule bets/)
    // Four to a straight flush with nothing higher than a nine: the rule checks, the count bets.
    const draw = { hole: cards(['9S', '8S']), flop: cards(['7S', '10S', '10H']) }
    expect(flopAdvice(draw.hole, draw.flop).decision).toBe('check')
    expect(advise(draw.hole, draw.flop, flopEvs(draw.hole, draw.flop))!.decision).toBe('bet2')
    // Where they agree, the rule's reason stands and the EVs ride along.
    const pair = { hole: cards(['KS', '7D']), flop: cards(['KH', '9C', '2D']) }
    const agreed = exactFlopAdvice(pair.hole, pair.flop, { bet2: 1.2, check: 0.8 })
    expect(agreed.reason).toBe(flopAdvice(pair.hole, pair.flop).reason)
    expect(agreed.evs).toEqual({ bet2: 1.2, check: 0.8 })
  })

  it('keeps to what the rack can cover', () => {
    const short = ['check', 'bet3'] as const
    const aceKing = cards(['AS', 'KD'])
    expect(withinRack(preflopAdvice(aceKing), short, aceKing).decision).toBe('bet3')
    const kingDeuce = cards(['KS', '2S'])
    expect(withinRack(preflopAdvice(kingDeuce), short, kingDeuce).decision).toBe('check')
    expect(withinRack(preflopAdvice(aceKing), ['check'], aceKing).decision).toBe('check')
    // 3x is still worth it on 58 of the 69 raising hands; the thinnest raises check instead.
    const cells = preflopChart().flat().filter((c) => c.decision === 'bet4')
    const threeX = cells.filter((c) => {
      const [hi, lo, kind] = [c.label[0], c.label[1], c.label[2]]
      const rank = (r: string) => (r === 'T' ? '10' : r)
      const hole = cards([`${rank(hi)}S`, `${rank(lo)}${kind === 's' ? 'S' : 'H'}`])
      return withinRack(preflopAdvice(hole), short, hole).decision === 'bet3'
    })
    expect(threeX).toHaveLength(58)
    const flop = { hole: cards(['5S', '5D']), board: cards(['KH', '9C', '2D']) }
    expect(withinRack(flopAdvice(flop.hole, flop.board), ['check'], flop.hole).decision).toBe('check')
    const river = { hole: cards(['KS', '2D']), board: cards(['KH', 'QD', '9C', '4C', '3H']) }
    expect(withinRack(riverAdvice(river.hole, river.board), ['fold'], river.hole).decision).toBe('fold')
    // The table offers 3x but not 4x with three Antes left in the rack.
    expect(u.legalDecisions(hand(['AS', 'KD'], ['2S', '2C'], ['QH', 'JH', '10H', '4C', '3D'], { ante: 25 }, 125))).toEqual(['check', 'bet3'])
  })

  it('works out the river exactly, and the table agrees with it', () => {
    const player = ['AS', '2D']
    const board = ['KH', 'QD', '9C', '4C', '3H']
    const known = new Set([...player, ...board])
    const deck = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'].flatMap((r) => ['S', 'H', 'D', 'C'].map((s) => r + s)).filter((c) => !known.has(c))
    let total = 0
    let hands = 0
    for (let i = 0; i < deck.length; i++)
      for (let j = i + 1; j < deck.length; j++) {
        const s = u.settle(u.decide(u.decide(u.decide(hand(player, [deck[i], deck[j]], board), 'check'), 'check'), 'bet1'))
        total += u.handNet(s) / 25
        hands++
      }
    expect(hands).toBe(990)
    expect(riverEvs(cards(player), cards(board)).bet1).toBeCloseTo(total / hands, 10)
  })

  it('calls on the river with few dealer outs and folds with many', () => {
    const river = (hole: string[], board: string[]) => riverAdvice(cards(hole), cards(board))
    const aceHigh = river(['AS', '2D'], ['KH', 'QD', '9C', '4C', '3H'])
    expect(aceHigh.decision).toBe('bet1')
    expect(aceHigh.outs).toBe(15)
    const junk = river(['7S', '2D'], ['KH', 'QD', '9C', '4C', '3H'])
    expect(junk.decision).toBe('fold')
    expect(junk.evs!.bet1).toBeLessThan(-2)
    // A royal on the board can only tie.
    expect(river(['7S', '2D'], ['AH', 'KH', 'QH', 'JH', '10H']).evs!.bet1).toBe(0)
    expect(dealerOuts(cards(['KS', '2D']), cards(['KH', 'QD', '9C', '4C', '3H']))).toBe(0)
  })

  it('prices the flop raise against checking', () => {
    const aces = flopEvs(cards(['AS', 'AD']), cards(['KH', 'QD', '9C']))
    expect(aces.bet2).toBeGreaterThan(aces.check)
    const junk = flopEvs(cards(['7S', '2D']), cards(['KH', 'QD', '9C']))
    expect(junk.check).toBeGreaterThan(junk.bet2)
    // Checking can always fold later, so it never costs more than the Ante and Blind.
    expect(junk.check).toBeGreaterThanOrEqual(-2)
  })

  it('advises by street from what is face up', () => {
    const s = hand(['AS', 'KD'], ['2S', '2C'], ['QH', 'JH', '10H', '4C', '3D'])
    expect(advise(s.player, u.visibleBoard(s))!.street).toBe('preflop')
    const flop = u.decide(s, 'check')
    expect(advise(flop.player, u.visibleBoard(flop))!.decision).toBe('bet2')
  })
})

describe('a long session following the coach', () => {
  it('moves every chip it says it does', () => {
    let s = u.createGame(1_000_000, 99, UTH_LIMITS)
    let net = 0
    let antes = 0
    for (let i = 0; i < 1_500; i++) {
      s = u.deal(u.placeTrips(u.placeAnte(s, 25), 5))
      while (s.phase === 'preflop' || s.phase === 'flop' || s.phase === 'river') {
        s = u.decide(s, advise(s.player, u.visibleBoard(s))!.decision)
      }
      s = u.settle(s)
      net += u.handNet(s)
      antes += 25
    }
    expect(s.bankroll).toBeCloseTo(1_000_000 + net, 6)
    // Fifteen hundred hands are far too few to measure a 2% edge, but a
    // broken settlement shows up as a wild result.
    expect(Math.abs(net / antes)).toBeLessThan(0.3)
  })
})
