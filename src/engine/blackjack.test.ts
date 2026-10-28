import { describe, expect, it } from 'vitest'
import {
  availableActions,
  createGame,
  deal,
  dealerHasMoreToDraw,
  dealerMustHit,
  dealerStep,
  declineInsurance,
  double,
  finishDealing,
  hit,
  nextRound,
  roundNet,
  setBet,
  shuffleUp,
  split,
  stand,
  surrender,
  takeInsurance,
} from './blackjack'
import { evaluate, isNatural } from './hand'
import { VEGAS_STRIP } from './rules'
import { openingOrder, stackedGame } from './testUtils'
import type { GameState } from './types'

/** Bet, deal, and run the opening resolution in one step. */
function open(codes: string[], bet = 100, overrides = {}, bankroll = 10_000): GameState {
  return finishDealing(deal(setBet(stackedGame(codes, overrides, bankroll), bet)))
}

/** Run the dealer to completion. */
function finishDealer(state: GameState): GameState {
  let next = state
  let guard = 0
  while (next.round.phase === 'dealerTurn' && guard++ < 25) next = dealerStep(next)
  return next
}

describe('hand evaluation', () => {
  it('counts an ace as 11 until the hand would bust', () => {
    expect(evaluate([{ id: '1', rank: 'A', suit: 'S' }, { id: '2', rank: '6', suit: 'H' }]))
      .toMatchObject({ total: 17, soft: true, busted: false })
  })

  it('demotes aces one at a time', () => {
    const cards = [
      { id: '1', rank: 'A', suit: 'S' },
      { id: '2', rank: 'A', suit: 'H' },
      { id: '3', rank: '9', suit: 'D' },
    ] as const
    expect(evaluate(cards)).toMatchObject({ total: 21, soft: true })
  })

  it('reports a bust when every ace is already hard', () => {
    const cards = [
      { id: '1', rank: 'K', suit: 'S' },
      { id: '2', rank: 'Q', suit: 'H' },
      { id: '3', rank: '5', suit: 'D' },
    ] as const
    expect(evaluate(cards)).toMatchObject({ total: 25, busted: true, soft: false })
  })
})

describe('naturals', () => {
  it('pays 3:2 on a player blackjack', () => {
    const state = open(openingOrder(['A', 'K'].map((r) => r + 'S') as [string, string], ['9H', '7D']))
    expect(state.round.phase).toBe('roundOver')
    expect(state.round.hands[0].outcome).toBe('blackjack')
    expect(state.round.hands[0].payout).toBe(250) // 100 stake + 150 win
    expect(state.bankroll).toBe(10_150)
  })

  it('pushes blackjack against blackjack', () => {
    // Dealer shows the ten, not the ace, so no insurance decision intervenes.
    const state = open(openingOrder(['AS', 'KS'], ['KH', 'AH']))
    expect(state.round.hands[0].outcome).toBe('push')
    expect(state.bankroll).toBe(10_000)
    expect(roundNet(state)).toBe(0)
  })

  it('ends the round immediately when the dealer peeks into a natural', () => {
    const state = open(openingOrder(['10S', '9S'], ['KH', 'AH']))
    expect(state.round.phase).toBe('roundOver')
    expect(state.round.hands[0].outcome).toBe('dealerBlackjack')
    expect(state.round.dealer.every((c) => !c.faceDown)).toBe(true)
    expect(state.bankroll).toBe(9_900)
  })

  it('does not treat a split 21 as a natural', () => {
    // Split aces, each drawing a ten: two 21s, but both pay even money.
    const state = open([...openingOrder(['AS', 'AH'], ['9H', '7D']), '10C', '10D'])
    const after = split(state)
    expect(after.round.hands).toHaveLength(2)
    expect(after.round.hands.every((h) => evaluate(h.cards).total === 21)).toBe(true)
    expect(after.round.hands.every((h) => !isNatural(h))).toBe(true)
    const done = finishDealer(after)
    expect(done.round.hands[0].outcome).toBe('win')
    expect(done.round.hands[0].payout).toBe(200) // even money, not 3:2
  })
})

describe('dealer drawing rules', () => {
  it('stands on soft 17 under S17', () => {
    expect(dealerMustHit(
      [
        { id: '1', rank: 'A', suit: 'S', seq: 0, faceDown: false },
        { id: '2', rank: '6', suit: 'H', seq: 1, faceDown: false },
      ],
      VEGAS_STRIP,
    )).toBe(false)
  })

  it('hits soft 17 under H17', () => {
    expect(dealerMustHit(
      [
        { id: '1', rank: 'A', suit: 'S', seq: 0, faceDown: false },
        { id: '2', rank: '6', suit: 'H', seq: 1, faceDown: false },
      ],
      { ...VEGAS_STRIP, dealerHitsSoft17: true },
    )).toBe(true)
  })

  it('draws until reaching at least 17', () => {
    const state = stand(open(openingOrder(['10S', '9S'], ['5H', '5D'])))
    const done = finishDealer(state)
    expect(evaluate(done.round.dealer).total).toBeGreaterThanOrEqual(17)
  })

  it('does not draw when every player hand has busted', () => {
    let state = open([...openingOrder(['10S', '6S'], ['5H', '5D']), 'KC'])
    state = hit(state) // 26, bust
    expect(state.round.phase).toBe('dealerTurn')
    expect(dealerHasMoreToDraw(state)).toBe(false)
    const done = dealerStep(state)
    expect(done.round.dealer).toHaveLength(2)
    expect(done.round.hands[0].outcome).toBe('bust')
  })
})

describe('doubling', () => {
  it('doubles the wager, draws exactly one card, and ends the hand', () => {
    const state = open([...openingOrder(['6S', '5S'], ['9H', '7D']), '10C'])
    const after = double(state)
    expect(after.round.hands[0].bet).toBe(200)
    expect(after.round.hands[0].cards).toHaveLength(3)
    expect(after.round.hands[0].resolved).toBe(true)
    expect(after.bankroll).toBe(9_800)
    const done = finishDealer(after)
    expect(done.round.hands[0].outcome).toBe('win')
    expect(done.bankroll).toBe(10_200) // 400 returned on a 200 wager
  })

  it('is unavailable after a third card arrives', () => {
    let state = open([...openingOrder(['5S', '3S'], ['9H', '7D']), '2C'])
    state = hit(state)
    expect(availableActions(state)).not.toContain('double')
  })

  it('respects a 10-11 only rule', () => {
    const state = open(openingOrder(['6S', '3S'], ['9H', '7D']), 100, { doubleOn: '10-11' })
    expect(availableActions(state)).not.toContain('double')
  })

  it('is blocked when the bankroll cannot cover the extra wager', () => {
    const state = open(openingOrder(['6S', '5S'], ['9H', '7D']), 100, {}, 150)
    expect(availableActions(state)).not.toContain('double')
  })
})

describe('splitting', () => {
  it('creates a second box and deals the first hand a replacement card', () => {
    const state = open([...openingOrder(['8S', '8H'], ['9H', '7D']), '3C', '4D'])
    const after = split(state)
    expect(after.round.hands).toHaveLength(2)
    expect(after.round.hands[0].cards.map((c) => c.rank)).toEqual(['8', '3'])
    expect(after.bankroll).toBe(9_800)
    expect(after.round.activeHandIndex).toBe(0)
    // The second box is still waiting for its card until play reaches it.
    expect(after.round.hands[1].cards).toHaveLength(1)
  })

  it('deals the second box its card when play advances to it', () => {
    let state = open([...openingOrder(['8S', '8H'], ['9H', '7D']), '3C', '4D'])
    state = split(state)
    state = stand(state)
    expect(state.round.activeHandIndex).toBe(1)
    expect(state.round.hands[1].cards.map((c) => c.rank)).toEqual(['8', '4'])
  })

  it('splits tens of different ranks', () => {
    const state = open([...openingOrder(['KS', 'QH'], ['9H', '7D']), '3C', '4D'])
    expect(availableActions(state)).toContain('split')
  })

  it('gives split aces exactly one card each and no further action', () => {
    const state = open([...openingOrder(['AS', 'AH'], ['9H', '7D']), '5C', '6D'])
    const after = split(state)
    expect(after.round.phase).toBe('dealerTurn')
    expect(after.round.hands.every((h) => h.resolved && h.cards.length === 2)).toBe(true)
  })

  it('refuses to resplit aces when the rules forbid it', () => {
    const state = open([...openingOrder(['AS', 'AH'], ['9H', '7D']), 'AC', 'AD'])
    const after = split(state)
    expect(after.round.hands).toHaveLength(2)
    expect(after.round.phase).toBe('dealerTurn')
  })

  it('lets split aces be re-split when the rules allow it', () => {
    let state = open(
      [...openingOrder(['AS', 'AH'], ['9H', '7D']), 'AC', '5C', '6D', '7C'],
      100,
      { resplitAces: true, maxSplitHands: 4 },
    )
    state = split(state)
    expect(state.round.phase).toBe('playerTurn')
    expect(state.round.activeHandIndex).toBe(0)
    expect(availableActions(state)).toEqual(['stand', 'split'])
    state = split(state)
    expect(state.round.hands).toHaveLength(3)
    expect(state.round.hands.map((h) => h.cards.map((c) => c.rank))).toEqual([
      ['A', '5'],
      ['A', '6'],
      ['A', '7'],
    ])
    expect(state.round.phase).toBe('dealerTurn')
  })

  it('freezes a re-dealt ace pair once the table is out of boxes', () => {
    const state = open(
      [...openingOrder(['AS', 'AH'], ['9H', '7D']), 'AC', 'AD'],
      100,
      { resplitAces: true, maxSplitHands: 2 },
    )
    const after = split(state)
    expect(after.round.hands).toHaveLength(2)
    expect(after.round.phase).toBe('dealerTurn')
  })

  it('caps the table at maxSplitHands boxes', () => {
    let state = open([
      ...openingOrder(['8S', '8H'], ['9H', '7D']),
      '8C', '8D', '8S', '8H', '3C', '4D', '5C', '6D',
    ])
    state = split(state) // 2 boxes
    state = split(state) // 3 boxes
    state = split(state) // 4 boxes
    expect(state.round.hands).toHaveLength(4)
    expect(availableActions(state)).not.toContain('split')
  })

  it('blocks double-after-split when the rules forbid it', () => {
    let state = open(
      [...openingOrder(['8S', '8H'], ['9H', '7D']), '3C', '4D'],
      100,
      { doubleAfterSplit: false },
    )
    state = split(state)
    expect(availableActions(state)).not.toContain('double')
  })
})

describe('insurance', () => {
  it('is offered only against an ace upcard', () => {
    const state = open(openingOrder(['10S', '9S'], ['9H', '7D']))
    expect(state.round.phase).toBe('playerTurn')
  })

  it('pays 2:1 and the main bet loses when the dealer has a natural', () => {
    let state = open(openingOrder(['10S', '9S'], ['AH', 'KH']))
    expect(state.round.phase).toBe('insurance')
    state = takeInsurance(state)
    expect(state.round.phase).toBe('roundOver')
    expect(state.round.insuranceOutcome).toBe('win')
    // -100 main, -50 insurance, +150 insurance payout = net zero.
    expect(state.bankroll).toBe(10_000)
    expect(roundNet(state)).toBe(0)
  })

  it('loses the side bet when the dealer has no natural', () => {
    // Dealer holds soft 18 and stands under S17; the player's 19 wins.
    let state = open(openingOrder(['10S', '9S'], ['AH', '7H']))
    state = takeInsurance(state)
    expect(state.round.insuranceOutcome).toBe('lose')
    expect(state.round.phase).toBe('playerTurn')
    state = finishDealer(stand(state))
    expect(state.round.hands[0].outcome).toBe('win')
    expect(state.bankroll).toBe(10_050) // +100 on the main hand, -50 insurance
  })

  it('continues to the player turn when insurance is declined', () => {
    const state = declineInsurance(open(openingOrder(['10S', '9S'], ['AH', '5H'])))
    expect(state.round.phase).toBe('playerTurn')
    expect(state.round.insuranceBet).toBe(0)
  })
})

describe('surrender', () => {
  it('returns half the wager when enabled', () => {
    const state = surrender(
      open(openingOrder(['10S', '6S'], ['9H', '7D']), 100, { surrender: 'late' }),
    )
    // The dealer still turns the hole card over, but draws no cards for a hand
    // that has already conceded.
    expect(dealerHasMoreToDraw(state)).toBe(false)
    const done = finishDealer(state)
    expect(done.round.hands[0].outcome).toBe('surrender')
    expect(done.bankroll).toBe(9_950)
  })

  it('is unavailable under the default Vegas Strip rules', () => {
    const state = open(openingOrder(['10S', '6S'], ['9H', '7D']))
    expect(availableActions(state)).not.toContain('surrender')
  })

  it('is unavailable once the hand has been split', () => {
    let state = open(
      [...openingOrder(['8S', '8H'], ['9H', '7D']), '3C', '4D'],
      100,
      { surrender: 'late' },
    )
    state = split(state)
    expect(availableActions(state)).not.toContain('surrender')
  })
})

describe('round flow', () => {
  it('auto-stands the player on 21', () => {
    let state = open([...openingOrder(['7S', '4S'], ['9H', '7D']), 'KC'])
    state = hit(state)
    expect(state.round.hands[0].resolved).toBe(true)
    expect(state.round.phase).toBe('dealerTurn')
  })

  it('pushes on an equal total', () => {
    const state = finishDealer(stand(open(openingOrder(['10S', '9S'], ['10H', '9D']))))
    expect(state.round.hands[0].outcome).toBe('push')
    expect(state.bankroll).toBe(10_000)
  })

  it('keeps the hole card hidden until the dealer turn', () => {
    const state = open(openingOrder(['10S', '6S'], ['9H', '7D']))
    expect(state.round.dealer[1].faceDown).toBe(true)
    expect(stand(state).round.dealer[1].faceDown).toBe(false)
  })

  it('carries the previous wager into the next round', () => {
    const state = nextRound(finishDealer(stand(open(openingOrder(['10S', '9S'], ['10H', '9D'])))))
    expect(state.round.phase).toBe('betting')
    expect(state.pendingBet).toBe(100)
    expect(state.round.hands).toHaveLength(0)
  })

  it('rejects a deal with no wager', () => {
    const state = stackedGame([])
    expect(deal(state).round.phase).toBe('betting')
  })

  it('rejects a wager larger than the bankroll', () => {
    const state = setBet(stackedGame([], {}, 500), 900)
    expect(state.pendingBet).toBe(500)
  })
})

describe('shoe', () => {
  it('reshuffles once the cut card is passed', () => {
    let state = createGame(VEGAS_STRIP, 10_000, 99)
    state = { ...state, shoe: { ...state.shoe, pos: state.shoe.cutIndex + 1 } }
    state = setBet(state, 100)
    state = finishDealer(stand(finishDealing(deal(state))))
    const before = state.shoe.shuffleCount
    state = nextRound(state)
    expect(state.shoe.shuffleCount).toBe(before + 1)
    expect(state.shoe.pos).toBe(0)
  })

  it('shuffles up early between rounds, keeping the wager', () => {
    let state = setBet(createGame(VEGAS_STRIP, 10_000, 99), 100)
    state = { ...state, shoe: { ...state.shoe, pos: 40 } }
    const next = shuffleUp(state)
    expect(next.shoe.shuffleCount).toBe(state.shoe.shuffleCount + 1)
    expect(next.shoe.pos).toBe(0)
    expect(next.shoe.cards).toHaveLength(312)
    expect(next.pendingBet).toBe(100)
    expect(next.bankroll).toBe(10_000)
  })

  it('will not shuffle up with a round on the felt', () => {
    const state = open(openingOrder(['10S', '6S'], ['9H', '7D']))
    expect(shuffleUp(state)).toBe(state)
  })

  it('deals 312 unique cards from a six-deck shoe', () => {
    const state = createGame(VEGAS_STRIP, 10_000, 7)
    expect(state.shoe.cards).toHaveLength(312)
    expect(new Set(state.shoe.cards.map((c) => c.id)).size).toBe(312)
  })
})
