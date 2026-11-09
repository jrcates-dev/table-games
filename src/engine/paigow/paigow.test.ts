import { describe, expect, it } from 'vitest'
import { evaluate, sampleDealer, setEv } from './ev'
import { FORTUNE_COUNTS, FORTUNE_ORDER, FORTUNE_PAYS, FORTUNE_TOTAL, fortuneEdge, fortuneHand } from './fortune'
import { FIVE_ACES_SCORE, handName, JOKER, namedCategory, parseCard, score2, score5 } from './hands'
import { analyse, HOUSE_WAY, houseWay } from './houseWay'
import * as pg from './paigow'
import { DEFAULT_PAIGOW_RULES, PAIGOW_EDGE, PAIGOW_LIMITS, type PaiGowRules } from './rules'
import { allSets, setHand } from './split'
import type { PaiGowState } from './types'

const codes = (text: string) => text.split(' ').map(parseCard)
const s5 = (text: string, rules = DEFAULT_PAIGOW_RULES) => score5(codes(text), rules)
const name5 = (text: string) => handName(s5(text), 5)
const name2 = (text: string) => {
  const [a, b] = codes(text)
  return handName(score2(a, b), 2)
}

/** The two cards the house way puts in the low hand, as text, highest first. */
function houseLow(text: string): string {
  const cards = pg.sortCodes(codes(text))
  const { set } = houseWay(cards)
  expect(set.legal).toBe(true)
  return set.low
    .map((i) => cards[i])
    .map((c) => (c === JOKER ? 'JK' : text.split(' ')[codes(text).indexOf(c)]))
    .sort()
    .join(' ')
}

/** The same two cards, in the order `houseLow` prints them. */
const low = (text: string) => text.split(' ').sort().join(' ')

function ruleFor(text: string): string {
  return houseWay(pg.sortCodes(codes(text))).rule.id
}

/** A deterministic stream for the long tests. */
function lcg(seed: number) {
  let x = seed >>> 0
  return (n: number) => {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0
    return (x >>> 8) % n
  }
}

function randomSeven(next: (n: number) => number): number[] {
  const deck = Array.from({ length: 53 }, (_, i) => i)
  for (let i = 0; i < 7; i++) {
    const j = i + next(53 - i)
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck.slice(0, 7)
}

describe('the joker', () => {
  it('makes five aces, the best hand there is', () => {
    expect(s5('AS AH AD AC JK')).toBe(FIVE_ACES_SCORE)
    expect(s5('AS AH AD AC JK')).toBeGreaterThan(s5('AS KS QS JS 10S'))
    expect(name5('JK AS AH AD AC')).toBe('Five aces')
  })

  it('completes straights, flushes and straight flushes', () => {
    expect(name5('JK KS QS JS 10S')).toBe('Royal flush')
    expect(name5('JK AH KH QH 10H')).toBe('Royal flush')
    expect(name5('JK 9D 8D 6D 5D')).toBe('Straight flush, nine high')
    expect(name5('JK 5C 4H 3D 2S')).toBe('Straight, six high')
    expect(name5('JK 9C 8H 6D 5S')).toBe('Straight, nine high')
    expect(name5('JK QH 9H 6H 3H')).toBe('Flush, ace high')
    // With the ace of the suit already there, the joker is the highest card the flush is missing.
    expect(s5('JK AH 9H 6H 3H')).toBe(s5('AH KH 9H 6H 3H'))
  })

  it('is otherwise only ever an ace', () => {
    expect(name5('JK 7S 7H 3D 2C')).toBe('Pair of sevens')
    expect(s5('JK 7S 7H 3D 2C')).toBeGreaterThan(s5('7S 7H KD QC JC'))
    expect(name5('JK 9S 9H 9D 2C')).toBe('Three nines')
    expect(name5('JK KS KH QD QC')).toBe('Two pair, kings and queens')
    expect(name5('JK AS AH KD KC')).toBe('Full house, aces over kings')
    expect(name5('JK AS QH 8D 4C')).toBe('Pair of aces')
    expect(name5('JK KS QH 8D 4C')).toBe('Ace high')
  })

  it('is an ace in the low hand', () => {
    expect(name2('JK KS')).toBe('Ace-king')
    expect(name2('JK AH')).toBe('Pair of aces')
    expect(score2(JOKER, parseCard('KS'))).toBe(score2(parseCard('AD'), parseCard('KH')))
  })

  it('makes the right number of each hand from a 53-card deck', () => {
    const counts: Record<string, number> = {}
    const h = [0, 0, 0, 0, 0]
    for (let a = 0; a < 53; a++)
      for (let b = a + 1; b < 53; b++)
        for (let c = b + 1; c < 53; c++)
          for (let d = c + 1; d < 53; d++)
            for (let e = d + 1; e < 53; e++) {
              h[0] = a
              h[1] = b
              h[2] = c
              h[3] = d
              h[4] = e
              const k = namedCategory(score5(h))
              counts[k] = (counts[k] ?? 0) + 1
            }
    expect(Object.values(counts).reduce((x, y) => x + y, 0)).toBe(2_869_685)
    expect(counts).toEqual(FIVE_CARD_COUNTS)
  })
})

/**
 * Every five-card hand a deck with a semi-wild joker holds: the 2,598,960
 * natural hands, and the 270,725 with the joker, each played its best way.
 */
const FIVE_CARD_COUNTS = {
  fiveAces: 1,
  royal: 24,
  straightFlush: 180,
  quads: 828,
  fullHouse: 4_368,
  flush: 7_804,
  straight: 20_532,
  trips: 63_360,
  twoPair: 138_600,
  pair: 1_215_024,
  high: 1_418_964,
}

describe('the wheel', () => {
  it('is the lowest straight by default', () => {
    expect(s5('AS 2H 3D 4C 5S')).toBeLessThan(s5('2H 3D 4C 5S 6H'))
  })

  it('is the second-highest straight when the table says so', () => {
    const rules: PaiGowRules = { ...DEFAULT_PAIGOW_RULES, wheelSecond: true }
    const wheel = s5('AS 2H 3D 4C 5S', rules)
    expect(wheel).toBeGreaterThan(s5('KH QD JC 10S 9H', rules))
    expect(wheel).toBeLessThan(s5('AH KD QC JS 10H', rules))
    expect(handName(wheel)).toBe('Straight, five high')
    expect(s5('AS 2S 3S 4S 5S', rules)).toBeGreaterThan(s5('KH QH JH 10H 9H', rules))
  })
})

describe('setting a hand', () => {
  it('offers 21 sets and calls a low hand over the high a foul', () => {
    const cards = codes('KS KH 9D 7C 5S 4H 2D')
    const sets = allSets(cards)
    expect(sets).toHaveLength(21)
    // Kings in the low hand leave nothing better than nine-high behind them.
    expect(setHand(cards, [0, 1]).legal).toBe(false)
    expect(setHand(cards, [2, 3]).legal).toBe(true)
  })

  it('lets equal pairs stand when the high hand has the kickers', () => {
    const cards = codes('JS JH JD JC 7S 4H 2D')
    expect(setHand(cards, [2, 3]).legal).toBe(true)
  })
})

describe('the house way', () => {
  it('sets a pai gow hand with the top card high and the next two low', () => {
    expect(houseLow('AS KH 9D 7C 5S 3H 2D')).toBe(low('KH 9D'))
    expect(ruleFor('AS KH 9D 7C 5S 3H 2D')).toBe('pai-gow')
  })

  it('keeps one pair high with the two best cards in front', () => {
    expect(houseLow('8S 8H AD KC 6S 4H 2D')).toBe(low('AD KC'))
  })

  it('splits two pair by the book', () => {
    expect(houseLow('KS KH 4D 4C AS 9H 3D')).toBe(low('4D 4C'))
    expect(houseLow('9S 9H 5D 5C AS 7H 3D')).toBe(low('AS 7H'))
    expect(houseLow('9S 9H 5D 5C KS 7H 3D')).toBe(low('5D 5C'))
    expect(houseLow('6S 6H 3D 3C KS 9H 2D')).toBe(low('KS 9H'))
    expect(houseLow('6S 6H 3D 3C QS 9H 2D')).toBe(low('3D 3C'))
    expect(houseLow('AS AH 3D 3C KS 9H 2D')).toBe(low('3D 3C'))
  })

  it('plays three pair with the top pair in front', () => {
    expect(houseLow('QS QH 8D 8C 4S 4H AD')).toBe(low('QS QH'))
  })

  it('keeps three of a kind together, except aces', () => {
    expect(houseLow('7S 7H 7D AC KS 4H 2D')).toBe(low('AC KS'))
    expect(houseLow('AS AH AD KC 9S 6H 2D')).toBe(low('AD KC'))
    expect(houseLow('QS QH QD 8C 8S 8H 2D')).toBe(low('QD QH'))
  })

  it('splits a full house, but for deuces with ace-king', () => {
    expect(houseLow('KS KH KD 5C 5S AH 9D')).toBe(low('5C 5S'))
    expect(houseLow('8S 8H 8D 2C 2S AH KD')).toBe(low('AH KD'))
    expect(houseLow('8S 8H 8D 2C 2S AH QD')).toBe(low('2C 2S'))
    expect(houseLow('8S 8H 8D 5C 5S 3H 3D')).toBe(low('5C 5S'))
  })

  it('splits four of a kind by rank', () => {
    expect(houseLow('4S 4H 4D 4C AS KH 9D')).toBe(low('AS KH'))
    expect(houseLow('9S 9H 9D 9C KS 7H 3D')).toBe(low('KS 7H'))
    expect(houseLow('9S 9H 9D 9C QS 7H 3D')).toBe(low('9C 9D'))
    expect(houseLow('JS JH JD JC AS 5H 3D')).toBe(low('AS 5H'))
    expect(houseLow('JS JH JD JC KS 5H 3D')).toBe(low('JC JD'))
    expect(houseLow('AS AH AD AC KS QH 3D')).toBe(low('AC AD'))
    expect(houseLow('6S 6H 6D 6C 9S 9H 3D')).toBe(low('9S 9H'))
  })

  it('splits five aces unless kings can go in front', () => {
    expect(houseLow('AS AH AD AC JK 9H 3D')).toBe(low('AC AD'))
    expect(houseLow('AS AH AD AC JK KH KD')).toBe(low('KH KD'))
  })

  it('plays a straight or flush high, leaving the best low', () => {
    expect(houseLow('9S 8H 7D 6C 5S AH KD')).toBe(low('AH KD'))
    // Six to a straight: playing the nine-high leaves ace-ten in front.
    expect(houseLow('10S 9H 8D 7C 6S 5H AD')).toBe(low('AD 10S'))
    expect(houseLow('AH 9H 7H 4H 2H KS KD')).toBe(low('KS KD'))
    expect(houseLow('JK 5S 4H 3D 2C KS QH')).toBe(low('KS QH'))
    expect(ruleFor('JK 5S 4H 3D 2C KS QH')).toBe('sf')
  })

  it('puts a pair in front of a straight when it can', () => {
    expect(houseLow('9S 8H 7D 6C 5S QH QD')).toBe(low('QH QD'))
    expect(ruleFor('9S 8H 7D 6C 5S QH QD')).toBe('pair-sf')
  })

  it('reads the joker as an ace when it is not needed for a straight', () => {
    expect(houseLow('JK KS 9H 7D 5C 3S 2H')).toBe(low('KS 9H'))
    expect(houseLow('JK AS 9H 7D 5C 3S 2H')).toBe(low('9H 7D'))
  })

  it('never fouls, and every rule in the book is reached', () => {
    const next = lcg(2024)
    const used = new Set<string>()
    for (let n = 0; n < 60_000; n++) {
      const cards = pg.sortCodes(randomSeven(next))
      const { set, rule } = houseWay(cards)
      expect(set.legal).toBe(true)
      // The rule's own choice is legal: the fallback is never needed.
      expect(setHand(cards, rule.low(analyse(cards))).legal).toBe(true)
      used.add(rule.id)
    }
    // The rarest (five aces, quads with a pair) are covered by the examples above.
    const rare = new Set(['five-aces', 'quads-plus', 'quad-aces', 'quads-high', 'quads-mid', 'quads-low', 'two-trips', 'trips-two-pair'])
    for (const rule of HOUSE_WAY) if (!rare.has(rule.id)) expect(used, rule.id).toContain(rule.id)
  })
})

describe('Fortune', () => {
  const f = (text: string) => fortuneHand(codes(text))

  it('names every paying hand', () => {
    expect(f('2H 3H 4H 5H 6H 7H 8H')).toBe('natural7SF')
    expect(f('AH 2H 3H 4H 5H 6H 7H')).toBe('natural7SF')
    expect(f('AS KS QS JS 10S KH QH')).toBe('royalMatch')
    expect(f('AS KS QS JK 10S KH QH')).toBe('royalMatch')
    expect(f('2H 3H 4H JK 6H 7H 8H')).toBe('joker7SF')
    expect(f('AS AH AD AC JK 9H 3D')).toBe('fiveAces')
    expect(f('AS KS QS JS 10S 4H 2D')).toBe('royal')
    expect(f('9D 8D 7D 6D 5D AH 2C')).toBe('straightFlush')
    expect(f('9S 9H 9D 9C KS 7H 3D')).toBe('quads')
    expect(f('KS KH KD 5C 5S AH 9D')).toBe('fullHouse')
    expect(f('AH 9H 7H 4H 2H KS KD')).toBe('flush')
    expect(f('7S 7H 7D AC KS 4H 2D')).toBe('trips')
    expect(f('9S 8H 7D 6C 5S AH KD')).toBe('straight')
    expect(f('JK 9S 8H 7D 6C AH KD')).toBe('straight')
    expect(f('AS AH KD KC 9S 6H 2D')).toBeNull()
    // A royal whose other two are a king and queen of different suits is just a royal.
    expect(f('AS KS QS JS 10S KH QD')).toBe('royal')
  })

  it('pays on the counted odds, at a 7.9% edge', () => {
    // Nearly one hand in five pays something.
    expect(FORTUNE_ORDER.reduce((sum, k) => sum + FORTUNE_COUNTS[k], 0) / FORTUNE_TOTAL).toBeCloseTo(0.1919, 4)
    expect(fortuneEdge()).toBeCloseTo(0.07897, 5)
  })

  it('turns up about as often as the full count says', () => {
    const next = lcg(77)
    const seen: Record<string, number> = {}
    const n = 120_000
    for (let i = 0; i < n; i++) {
      const k = fortuneHand(randomSeven(next))
      if (k) seen[k] = (seen[k] ?? 0) + 1
    }
    for (const k of ['flush', 'straight', 'trips', 'fullHouse'] as const) {
      const p = FORTUNE_COUNTS[k] / FORTUNE_TOTAL
      expect(Math.abs((seen[k] ?? 0) / n - p)).toBeLessThan(5 * Math.sqrt((p * (1 - p)) / n))
    }
  })
})

/** A hand dealt from exactly these cards: player's seven, then the dealer's. */
function hand(player: string, dealer: string, bets: { wager?: number; fortune?: number } = {}, rules: Partial<PaiGowRules> = {}): PaiGowState {
  let s = pg.createGame(10_000, 7, PAIGOW_LIMITS, { ...DEFAULT_PAIGOW_RULES, ...rules })
  s = pg.placeWager(s, bets.wager ?? 100)
  if (bets.fortune) s = pg.placeFortune(s, bets.fortune)
  const p = codes(player)
  const d = codes(dealer)
  const order: number[] = []
  for (let i = 0; i < 7; i++) order.push(p[i], d[i])
  return pg.dealFrom(s, order)
}

/** Set the player's hand with these two cards low, and pay it. */
function play(state: PaiGowState, low: string): PaiGowState {
  const want = codes(low)
  const idx = want.map((c) => state.player.findIndex((p) => p.code === c))
  return pg.settle(pg.setPlayerHand(state, idx))
}

const wager = (s: PaiGowState) => s.resolutions.find((r) => r.kind === 'wager')!
const fortune = (s: PaiGowState) => s.resolutions.find((r) => r.kind === 'fortune')!

describe('a hand at the table', () => {
  const dealer = 'KS 9H 8D 6C 4S 3H 2D' // King high, nine-eight in front.

  it('pays a win on both hands even money less 5%', () => {
    const s = play(hand('AS AH KD QC 7S 5H 3D', dealer), 'KD QC')
    expect(s.result!.outcome).toBe('win')
    expect(wager(s).net).toBe(95)
    expect(s.bankroll).toBe(10_000 + 95)
  })

  it('pushes when each side takes one', () => {
    // Pair of aces high wins; jack-ten low loses to the dealer's nine-eight? No: it wins. Put the 5-3 low instead.
    const s = play(hand('AS AH KD QC 7S 5H 3D', dealer), '5H 3D')
    expect(s.result!.high).toBe('win')
    expect(s.result!.low).toBe('lose')
    expect(s.result!.outcome).toBe('push')
    expect(s.bankroll).toBe(10_000)
  })

  it('gives copies to the dealer', () => {
    // Same king-high high hand to the card, and the same nine-eight low.
    const s = play(hand('KH 9S 8C 6D 4H 3C 2S', dealer), '9S 8C')
    expect(s.result!.high).toBe('copy')
    expect(s.result!.low).toBe('copy')
    expect(s.result!.outcome).toBe('lose')
    expect(s.bankroll).toBe(10_000 - 100)
  })

  it('loses a foul, and pays Fortune on the seven anyway', () => {
    const s = play(hand('AS AH AD KC 7S 5H 3D', dealer, { fortune: 10 }), 'KC 7S')
    expect(s.result!.foul).toBe(false)
    const foul = play(hand('KS KH 9D 7C 5S 4H 2D', 'AC QH 8C 6D 4D 3S 2H', { fortune: 10 }), 'KS KH')
    expect(foul.result!.outcome).toBe('foul')
    expect(wager(foul).net).toBe(-100)
    expect(fortune(s).net).toBe(30)
  })

  it('pays Fortune by the table', () => {
    const s = play(hand('9D 8D 7D 6D 5D AH 2C', dealer, { fortune: 5 }), 'AH 2C')
    expect(fortune(s).net).toBe(5 * FORTUNE_PAYS.straightFlush)
    const none = play(hand('AS AH KD QC 7S 5H 3D', dealer, { fortune: 5 }), 'KD QC')
    expect(fortune(none).net).toBe(-5)
  })

  it('without commission, pushes a win over a queen-high pai gow', () => {
    const queenHigh = 'QS 9H 8D 6C 4S 3H 2D'
    const s = play(hand('AS AH KD QC 7S 5H 3D', queenHigh, {}, { commissionFree: true }), 'KD QC')
    expect(s.result!.queenHighPush).toBe(true)
    expect(s.result!.outcome).toBe('push')
    expect(wager(s).net).toBe(0)
    const king = play(hand('AS AH KD QC 7S 5H 3D', dealer, {}, { commissionFree: true }), 'KD QC')
    expect(wager(king).net).toBe(100)
  })

  it('sets the dealer the house way and reads both sides', () => {
    const s = pg.setPlayerHand(hand('AS AH KD QC 7S 5H 3D', 'KS KH 4D 4C AD 9H 3S'), [2, 3])
    expect(s.phase).toBe('reveal')
    expect(s.result!.dealerRule).toBe('two-pair-high')
    expect(s.result!.dealer.lowName).toBe('Pair of fours')
    expect(s.result!.player.highName).toBe('Pair of aces')
    expect(s.dealer.every((c) => !c.faceDown)).toBe(true)
  })
})

describe('the betting', () => {
  it('takes a bet within the limits and gives it back', () => {
    let s = pg.createGame(1_000, 1, PAIGOW_LIMITS)
    s = pg.placeWager(s, 5)
    expect(s.bets.wager).toBe(PAIGOW_LIMITS.minBet)
    s = pg.placeFortune(s, 1)
    expect(s.bets.fortune).toBe(PAIGOW_LIMITS.minFortune)
    expect(s.bankroll).toBe(1_000 - 30)
    s = pg.clearBets(s)
    expect(s.bankroll).toBe(1_000)
    expect(pg.canDeal(s).ok).toBe(false)
  })

  it('deals seven each from one deck with the joker, and rebets', () => {
    let s = pg.placeWager(pg.createGame(1_000, 3, PAIGOW_LIMITS), 25)
    s = pg.deal(s)
    expect(s.phase).toBe('setting')
    expect(s.player).toHaveLength(7)
    expect(s.dealer).toHaveLength(7)
    expect(new Set([...s.player, ...s.dealer].map((c) => c.code)).size).toBe(14)
    expect(s.dealer.every((c) => c.faceDown)).toBe(true)
    s = pg.settle(pg.setPlayerHand(s, houseWay(pg.playerCodes(s)).set.low))
    expect(s.phase).toBe('showdown')
    const after = s.bankroll
    s = pg.rebet(s)
    expect(s.phase).toBe('betting')
    expect(s.bets.wager).toBe(25)
    expect(s.bankroll).toBe(after - 25)
  })

  it('deals a joker about once in seven and a half hands', () => {
    let s = pg.createGame(1_000_000, 11, PAIGOW_LIMITS)
    let jokers = 0
    const n = 4_000
    for (let i = 0; i < n; i++) {
      s = pg.deal(pg.placeWager(s, 25))
      if (s.player.some((c) => c.joker)) jokers++
      s = pg.nextHand(pg.settle(pg.setPlayerHand(s, [5, 6])))
    }
    expect(Math.abs(jokers / n - 7 / 53)).toBeLessThan(0.02)
  })
})

describe('the coach', () => {
  it('values a foul at a whole bet and the house way above a bad set', () => {
    const player = pg.sortCodes(codes('AS AH KD QC 7S 5H 3D'))
    const samples = sampleDealer(player, 5, DEFAULT_PAIGOW_RULES, 1_500)
    const house = houseWay(player).set
    const reversed = setHand(player, [5, 6])
    expect(setEv(setHand(player, [0, 1]), samples, DEFAULT_PAIGOW_RULES)).toBeLessThan(setEv(house, samples, DEFAULT_PAIGOW_RULES))
    expect(setEv(reversed, samples, DEFAULT_PAIGOW_RULES)).toBeLessThan(setEv(house, samples, DEFAULT_PAIGOW_RULES))
    // A pair of aces with king-queen in front is a strong favourite.
    expect(setEv(house, samples, DEFAULT_PAIGOW_RULES)).toBeGreaterThan(0.15)
    const foul = setHand(pg.sortCodes(codes('KS KH 9D 7C 5S 4H 2D')), [0, 1])
    expect(setEv(foul, samples, DEFAULT_PAIGOW_RULES)).toBe(-1)
  })

  it('values all 21 sets', () => {
    const evs = evaluate({ player: pg.sortCodes(codes('9S 9H 5D 5C KS 7H 3D')), seed: 1, rules: DEFAULT_PAIGOW_RULES })
    expect(evs).toHaveLength(21)
    expect(evs.filter((e) => !e.legal).every((e) => e.ev === -1)).toBe(true)
  })
})

describe('the long run', () => {
  it('keeps about 2.7% of every bet when both sides play the house way', () => {
    let s = pg.createGame(10_000_000, 99, PAIGOW_LIMITS)
    const n = 40_000
    let net = 0
    for (let i = 0; i < n; i++) {
      s = pg.deal(pg.placeWager(s, 100))
      s = pg.settle(pg.setPlayerHand(s, houseWay(pg.playerCodes(s)).set.low))
      net += pg.handNet(s)
      s = pg.nextHand(s)
    }
    const edge = -net / (100 * n)
    // One hand's result has a standard deviation of about 0.75 bets.
    expect(Math.abs(edge - PAIGOW_EDGE)).toBeLessThan(4 * (0.75 / Math.sqrt(n)))
  })
})
