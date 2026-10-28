import { describe, expect, it } from 'vitest'
import {
  availableActions,
  createGame,
  deal,
  dealerStep,
  declineInsurance,
  double,
  finishDealing,
  hit,
  nextRound,
  setBet,
  split,
  stand,
  surrender,
  takeInsurance,
} from './blackjack'
import { countSnapshot } from './counting'
import { ARIA_SALON, ARIA_SIX_FIVE, VEGAS_STRIP } from './rules'
import { basicStrategy, shouldTakeInsurance } from './strategy'
import type { GameState, RuleSet } from './types'

/**
 * End-to-end simulation.
 *
 * A player using perfect basic strategy against six-deck S17 gives up about
 * 0.4% of the initial bet, a little less per dollar wagered. If the engine mishandled naturals, splits,
 * doubles or the dealer's draw the realised edge would drift well outside that
 * band, so this doubles as a correctness check on the whole rule set — the kind
 * of bug a unit test on a single hand will not catch.
 */
function playRound(state: GameState, bet: number): GameState {
  let s = deal(setBet(state, bet))
  s = finishDealing(s)

  if (s.round.phase === 'insurance') {
    const count = countSnapshot(s)
    s = shouldTakeInsurance(count.true) ? takeInsurance(s) : declineInsurance(s)
  }

  let guard = 0
  while (s.round.phase === 'playerTurn' && guard++ < 60) {
    const hand = s.round.hands[s.round.activeHandIndex]
    const legal = availableActions(s)
    if (legal.length === 0) break
    const action = basicStrategy(hand, s.round.dealer[0], { rules: s.rules, legal })
    switch (action) {
      case 'hit':
        s = hit(s)
        break
      case 'stand':
        s = stand(s)
        break
      case 'double':
        s = double(s)
        break
      case 'split':
        s = split(s)
        break
      case 'surrender':
        s = surrender(s)
        break
      default:
        s = stand(s)
    }
  }

  guard = 0
  while (s.round.phase === 'dealerTurn' && guard++ < 25) s = dealerStep(s)

  return s
}

describe('basic strategy simulation', () => {
  it('lands the house edge near 0.5% over 200k hands', () => {
    const rounds = 200_000
    const bet = 10
    // Bankroll starts high enough that doubles and splits are never refused for
    // lack of funds, which would bias the result.
    let state = createGame(VEGAS_STRIP, 100_000_000, 20260731)

    let wagered = 0
    let net = 0

    for (let i = 0; i < rounds; i++) {
      const before = state.bankroll
      state = playRound(state, bet)
      const staked =
        state.round.hands.reduce((sum, h) => sum + h.bet, 0) + state.round.insuranceBet
      wagered += staked
      net += state.bankroll - before
      state = nextRound(state)
    }

    const edge = -net / wagered
    console.log(`house edge over ${rounds} hands: ${(edge * 100).toFixed(3)}%`)
    // Exact figure for 6D/S17/DAS/no-surrender is 0.41% of the initial bet;
    // this measures per dollar wagered, which runs about an eighth lower.
    expect(edge).toBeGreaterThan(-0.002)
    expect(edge).toBeLessThan(0.012)
  })

  /**
   * The Aria presets, end to end. Late surrender and resplitting aces are
   * exercised here for real — a surrender that refunded the wrong half, or a
   * resplit that dealt one card too many, moves this number.
   */
  function realisedEdge(rules: RuleSet, rounds: number, seed: number): number {
    let state = createGame(rules, 100_000_000, seed)
    let wagered = 0
    let net = 0
    for (let i = 0; i < rounds; i++) {
      const before = state.bankroll
      state = playRound(state, 10)
      wagered += state.round.hands.reduce((sum, h) => sum + h.bet, 0) + state.round.insuranceBet
      net += state.bankroll - before
      state = nextRound(state)
    }
    return -net / wagered
  }

  it("lands Aria's high-limit shoe near its published quarter of a percent", () => {
    const edge = realisedEdge(ARIA_SALON, 150_000, 20260925)
    console.log(`Aria S17 edge: ${(edge * 100).toFixed(3)}%`)
    // Exact: 0.27% of the initial bet for 6D/S17/DAS/LS/RSA. Wide band: one standard
    // error over this sample is roughly a quarter of a percent.
    expect(edge).toBeGreaterThan(-0.006)
    expect(edge).toBeLessThan(0.011)
  })

  it('charges a player about two percent at a 6:5 table', () => {
    const edge = realisedEdge(ARIA_SIX_FIVE, 150_000, 6520260925)
    console.log(`Aria 6:5 edge: ${(edge * 100).toFixed(3)}%`)
    // Exact: 1.98% of the initial bet for 6D/H17/DAS at 6:5 — the point of offering it.
    expect(edge).toBeGreaterThan(0.009)
    expect(edge).toBeLessThan(0.032)
  })

  it('never lets the bankroll or a wager go negative', () => {
    let state = createGame(VEGAS_STRIP, 5_000, 4242)
    for (let i = 0; i < 5_000; i++) {
      state = playRound(state, Math.min(25, state.bankroll))
      expect(state.bankroll).toBeGreaterThanOrEqual(0)
      expect(state.round.hands.every((h) => h.bet > 0)).toBe(true)
      state = nextRound(state)
      if (state.bankroll < 25) state = { ...state, bankroll: 5_000 }
    }
  })

  it('always reaches a terminal phase', () => {
    let state = createGame(VEGAS_STRIP, 1_000_000, 8888)
    for (let i = 0; i < 20_000; i++) {
      state = playRound(state, 10)
      expect(state.round.phase).toBe('roundOver')
      expect(state.round.hands.every((h) => h.outcome !== undefined)).toBe(true)
      state = nextRound(state)
    }
  })
})
