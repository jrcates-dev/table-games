import { describe, expect, it } from 'vitest'
import { card } from '../testUtils'
import type { Card } from '../types'
import * as b from './baccarat'
import { bestBet, coupOdds, fullShoeRanks, houseEdges, remainingRanks } from './odds'
import { BACCARAT_BETS, BACCARAT_LIMITS } from './rules'
import { bankerDraws, bankerDrawsAgainst, handTotal, tableauSquare } from './tableau'
import type { BaccaratBetKind, BaccaratState } from './types'

function game(bankroll = 100_000): BaccaratState {
  return b.createGame(bankroll, 7, BACCARAT_LIMITS)
}

/** A game whose next cards off the shoe are exactly these, in deal order. */
function stacked(codes: string[], bankroll = 100_000): BaccaratState {
  const g = game(bankroll)
  const cards = codes.map((code, i) => card(code, 900 + i))
  const rest = g.shoe.cards.slice(g.shoe.pos)
  return { ...g, shoe: { ...g.shoe, cards: [...g.shoe.cards.slice(0, g.shoe.pos), ...cards, ...rest] } }
}

function bet(state: BaccaratState, bets: Partial<Record<BaccaratBetKind, number>>): BaccaratState {
  let s = state
  for (const [kind, amount] of Object.entries(bets)) s = b.placeBet(s, kind as BaccaratBetKind, amount!)
  return s
}

/** Deal order: Player, Banker, Player, Banker, then third cards. */
function play(codes: string[], bets: Partial<Record<BaccaratBetKind, number>>) {
  const dealt = b.deal(bet(stacked(codes), bets))
  return b.settle(dealt)
}

function res(state: BaccaratState, kind: BaccaratBetKind) {
  return state.resolutions.find((r) => r.kind === kind)!
}

describe('the tableau', () => {
  it('scores hands by the last digit', () => {
    expect(handTotal(['K', '9'])).toBe(9)
    expect(handTotal(['7', '8'])).toBe(5)
    expect(handTotal(['A', '10', 'Q'])).toBe(1)
    expect(handTotal(['9', '9', '9'])).toBe(7)
  })

  it('draws the Banker exactly as the printed tableau says', () => {
    // Banker total → the Player third cards it draws against.
    expect(bankerDrawsAgainst(0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(bankerDrawsAgainst(2)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(bankerDrawsAgainst(3)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 9])
    expect(bankerDrawsAgainst(4)).toEqual([2, 3, 4, 5, 6, 7])
    expect(bankerDrawsAgainst(5)).toEqual([4, 5, 6, 7])
    expect(bankerDrawsAgainst(6)).toEqual([6, 7])
    expect(bankerDrawsAgainst(7)).toEqual([])
  })

  it('has the Banker play like the Player when the Player stands', () => {
    expect(bankerDraws(5, null)).toBe(true)
    expect(bankerDraws(6, null)).toBe(false)
  })

  it('finds the square each coup was decided on', () => {
    expect(tableauSquare(play(['8S', '3H', 'KD', '4C'], { player: 100 }).coup!)).toBeNull()
    expect(tableauSquare(play(['6S', '2H', 'KD', '3C', '4H'], { banker: 100 }).coup!)).toEqual({
      total: 5,
      playerThird: null,
      draws: true,
    })
    expect(tableauSquare(play(['2S', 'AH', '3D', '2C', 'KH', '5D'], { player: 100 }).coup!)).toEqual({
      total: 3,
      playerThird: 0,
      draws: true,
    })
    expect(tableauSquare(play(['AS', '3H', '2D', '3C', '5H'], { player: 100 }).coup!)).toEqual({
      total: 6,
      playerThird: 5,
      draws: false,
    })
  })

  it('lights the square that matches what the Banker actually did', () => {
    let s = b.createGame(1_000_000, 11, BACCARAT_LIMITS)
    for (let i = 0; i < 400; i++) {
      s = b.settle(b.deal(b.placeBet(s, 'player', 25)))
      const square = tableauSquare(s.coup!)
      if (square) expect(square.draws).toBe(s.coup!.banker.length === 3)
      else expect(s.coup!.natural).toBe(true)
      s = b.nextCoup(s)
    }
  })
})

describe('dealing a coup', () => {
  it('stops both hands on a natural', () => {
    const s = play(['8S', '3H', 'KD', '4C'], { player: 100 })
    expect(s.coup!.player).toHaveLength(2)
    expect(s.coup!.banker).toHaveLength(2)
    expect(s.coup!.natural).toBe(true)
    expect(s.coup!.winner).toBe('player')
  })

  it('draws the Player on 5 and the Banker on 3 unless the Player drew an 8', () => {
    const drew8 = play(['2S', 'AH', '3D', '2C', '8H'], { player: 100 })
    expect(drew8.coup!.player).toHaveLength(3)
    expect(drew8.coup!.banker).toHaveLength(2)
    expect(drew8.coup!.player[2].third).toBe(true)

    const drew9 = play(['2S', 'AH', '3D', '2C', '9H', '5D'], { player: 100 })
    expect(drew9.coup!.banker).toHaveLength(3)
    expect(drew9.coup!.bankerTotal).toBe(8)
  })

  it('stands the Player on 6 and draws the Banker on 5', () => {
    const s = play(['6S', '2H', 'KD', '3C', '4H'], { banker: 100 })
    expect(s.coup!.player).toHaveLength(2)
    expect(s.coup!.banker).toHaveLength(3)
    expect(s.coup!.bankerTotal).toBe(9)
    expect(s.coup!.winner).toBe('banker')
  })

  it('draws the Banker on 6 only against a Player third card of 6 or 7', () => {
    expect(play(['AS', '3H', '2D', '3C', '6H', '2D'], { player: 100 }).coup!.banker).toHaveLength(3)
    expect(play(['AS', '3H', '2D', '3C', '5H', '2D'], { player: 100 }).coup!.banker).toHaveLength(2)
  })

  it('turns the burn card up and burns that many, ten for a face card', () => {
    for (let seed = 1; seed < 40; seed++) {
      const g = b.createGame(1000, seed, BACCARAT_LIMITS)
      const value = g.burnCard!.rank === 'A' ? 1 : Number(g.burnCard!.rank) || 10
      expect(g.burned).toBe(value)
      expect(g.shoe.pos).toBe(value + 1)
    }
  })
})

describe('paying the coup', () => {
  it('pays the Banker 95 cents on the dollar, to the cent', () => {
    const s = play(['6S', '2H', 'KD', '3C', '4H'], { banker: 25 })
    expect(res(s, 'banker').net).toBe(23.75)
    expect(s.bankroll).toBe(100_000 + 23.75)
  })

  it('pushes Player and Banker on a tie and pays the tie 8 to 1', () => {
    const s = play(['7S', '7H', 'KD', 'QC'], { player: 100, banker: 100, tie: 10 })
    expect(s.coup!.winner).toBe('tie')
    expect(res(s, 'player').effect).toBe('push')
    expect(res(s, 'banker').effect).toBe('push')
    expect(res(s, 'tie').net).toBe(80)
    expect(b.coupNet(s)).toBe(80)
  })

  it('pays a pair in the first two cards 11 to 1, by rank not by value', () => {
    const pair = play(['9S', '3H', '9D', '4C'], { player: 25, playerPair: 10, bankerPair: 10 })
    expect(res(pair, 'playerPair').net).toBe(110)
    expect(res(pair, 'bankerPair').effect).toBe('lose')
    // A king and a ten are both worth nothing, and are not a pair.
    const notPair = play(['KS', '3H', '10D', '4C', '2C'], { player: 25, playerPair: 10 })
    expect(res(notPair, 'playerPair').effect).toBe('lose')
  })

  it('pays the Dragon on margin, even money on a natural, and pushes a natural tie', () => {
    // Player 9 on three cards against Banker 0: by nine.
    const nine = play(['2S', 'KH', '3D', 'QC', '4H', 'JD'], { player: 25, dragonPlayer: 10 })
    expect(nine.coup!.playerTotal).toBe(9)
    expect(nine.coup!.bankerTotal).toBe(0)
    expect(res(nine, 'dragonPlayer').net).toBe(300)

    const natural = play(['9S', 'KH', 'KD', '2C'], { player: 25, dragonPlayer: 10 })
    expect(res(natural, 'dragonPlayer').net).toBe(10)

    const naturalTie = play(['8S', '8H', 'KD', 'QC'], { player: 25, dragonPlayer: 10, dragonBanker: 10 })
    expect(res(naturalTie, 'dragonPlayer').effect).toBe('push')
    expect(res(naturalTie, 'dragonBanker').effect).toBe('push')

    const smallWin = play(['7S', '6H', 'KD', 'QC'], { player: 25, dragonPlayer: 10 })
    expect(smallWin.coup!.playerTotal).toBe(7)
    expect(smallWin.coup!.bankerTotal).toBe(6)
    expect(res(smallWin, 'dragonPlayer').effect).toBe('lose')
  })
})

describe('the felt', () => {
  it('lifts a first bet to the table minimum and stops at the maximum and the rack', () => {
    let s = b.placeBet(game(), 'banker', 5)
    expect(s.bets.banker).toBe(25)
    s = b.placeBet(s, 'tie', 1)
    expect(s.bets.tie).toBe(5)
    s = b.placeBet(s, 'tie', 10_000)
    expect(s.bets.tie).toBe(BACCARAT_LIMITS.maxSide)
    const poor = b.placeBet(game(30), 'player', 100)
    expect(poor.bets.player).toBe(30)
    expect(poor.bankroll).toBe(0)
  })

  it('takes chips off the rack and gives them back when cleared', () => {
    const s = bet(game(1000), { player: 100, tie: 10 })
    expect(s.bankroll).toBe(890)
    expect(b.clearBets(s).bankroll).toBe(1000)
  })

  it('remembers the last coup for a rebet', () => {
    const s = b.nextCoup(play(['8S', '3H', 'KD', '4C'], { player: 100, playerPair: 5 }))
    expect(s.bets).toEqual({})
    const again = b.rebet(s)
    expect(again.bets).toEqual({ player: 100, playerPair: 5 })
  })

  it('will not deal without a bet', () => {
    expect(b.canDeal(game()).ok).toBe(false)
    expect(b.deal(game())).toEqual(game())
  })

  it('starts a new shoe, and a clean scoreboard, once the cut card is out', () => {
    let s = bet(game(), { banker: 25 })
    s = { ...s, shoe: { ...s.shoe, pos: s.shoe.cutIndex } }
    s = b.settle(b.deal(s))
    expect(s.scores).toHaveLength(1)
    const next = b.nextCoup(s)
    expect(next.shoe.shuffleCount).toBe(1)
    expect(next.scores).toHaveLength(0)
    expect(next.shoe.pos).toBe(next.burned + 1)
  })
})

describe('exact odds', () => {
  const full = fullShoeRanks(8)

  it('match the published eight-deck probabilities', () => {
    const o = coupOdds(full)
    expect(o.banker).toBeCloseTo(0.458597, 6)
    expect(o.player).toBeCloseTo(0.446247, 6)
    expect(o.tie).toBeCloseTo(0.095156, 6)
    expect(o.player + o.banker + o.tie).toBeCloseTo(1, 10)
  })

  it('hold the reference card to every edge it quotes', () => {
    const edges = houseEdges(full)
    for (const spec of Object.values(BACCARAT_BETS)) {
      expect(edges[spec.kind], spec.kind).toBeCloseTo(spec.edge, 6)
    }
    expect(bestBet(edges)).toBe('banker')
  })

  it('follow the shoe as it is dealt', () => {
    // Strip out every small card and the naturals dominate: ties of 8 and 9
    // get likelier, and the Dragon's natural wins get commoner.
    const seen: Card[] = []
    for (const rank of ['A', '2', '3', '4', '5', '6'] as const) {
      for (let i = 0; i < 28; i++) seen.push(card(`${rank}S`, i))
    }
    const ranks = remainingRanks(8, seen)
    const o = coupOdds(ranks)
    expect(o.player + o.banker + o.tie).toBeCloseTo(1, 10)
    expect(houseEdges(ranks).tie).toBeLessThan(BACCARAT_BETS.tie.edge)
  })
})

describe('a long shoe', () => {
  it('deals Banker, Player and Tie at the rates the enumeration predicts', () => {
    let s = b.createGame(10_000_000, 2024, BACCARAT_LIMITS)
    const wins = { player: 0, banker: 0, tie: 0 }
    const coups = 60_000
    for (let i = 0; i < coups; i++) {
      s = b.settle(b.deal(b.placeBet(s, 'banker', 25)))
      wins[s.coup!.winner]++
      s = b.nextCoup(s)
    }
    // Three standard errors at 60,000 coups is about 0.6 percentage points.
    expect(wins.banker / coups).toBeCloseTo(0.4586, 2)
    expect(wins.player / coups).toBeCloseTo(0.4462, 2)
    expect(wins.tie / coups).toBeCloseTo(0.0952, 2)
  })
})
