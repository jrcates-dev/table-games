import { describe, expect, it } from 'vitest'
import { availableActions, deal, declineInsurance, finishDealing, setBet } from './blackjack'
import { betRamp, countSnapshot, hiLoValue, runningCount, suggestedBetUnits } from './counting'
import { ARIA_DOUBLE_DECK, ARIA_MAIN_FLOOR, ARIA_SALON, ARIA_SIX_FIVE, RULE_PRESETS, SINGLE_DECK, VEGAS_STRIP } from './rules'
import {
  basicStrategy,
  CHART_COLUMNS,
  chartIsExact,
  chartPosition,
  shouldTakeInsurance,
  STRATEGY_CHART,
  strategyChart,
} from './strategy'
import { card, openingOrder, stackedGame } from './testUtils'
import type { GameState, PlayerAction, PlayerHand, RuleSet } from './types'

function situation(player: [string, string], dealerUp: string, extra: string[] = []): GameState {
  const codes = [...openingOrder(player, [dealerUp, '5D']), ...extra]
  const dealt = finishDealing(deal(setBet(stackedGame(codes), 100)))
  // An ace upcard opens the insurance decision before any playing action is
  // legal, so step past it to reach the hand the chart is actually about.
  return dealt.round.phase === 'insurance' ? declineInsurance(dealt) : dealt
}

function advise(player: [string, string], dealerUp: string): PlayerAction {
  const state = situation(player, dealerUp)
  return basicStrategy(state.round.hands[0], state.round.dealer[0], {
    rules: VEGAS_STRIP,
    legal: availableActions(state),
  })
}

describe('basic strategy — hard totals', () => {
  it('stands on hard 17 and above', () => {
    expect(advise(['10S', '7H'], '10C')).toBe('stand')
    expect(advise(['10S', '9H'], 'AC')).toBe('stand')
  })

  it('hits hard 16 against a big upcard but stands against a small one', () => {
    expect(advise(['10S', '6H'], '10C')).toBe('hit')
    expect(advise(['10S', '6H'], '6C')).toBe('stand')
  })

  it('hits 12 against a 2 or 3 but stands against 4 through 6', () => {
    expect(advise(['10S', '2H'], '2C')).toBe('hit')
    expect(advise(['10S', '2H'], '3C')).toBe('hit')
    expect(advise(['10S', '2H'], '4C')).toBe('stand')
    expect(advise(['10S', '2H'], '6C')).toBe('stand')
  })

  it('doubles 11 against everything except an ace under S17', () => {
    expect(advise(['6S', '5H'], '10C')).toBe('double')
    expect(advise(['6S', '5H'], '2C')).toBe('double')
    expect(advise(['6S', '5H'], 'AC')).toBe('hit')
  })

  it('doubles 10 except against a ten or ace', () => {
    expect(advise(['6S', '4H'], '9C')).toBe('double')
    expect(advise(['6S', '4H'], '10C')).toBe('hit')
    expect(advise(['6S', '4H'], 'AC')).toBe('hit')
  })

  it('doubles 9 only against 3 through 6', () => {
    expect(advise(['5S', '4H'], '2C')).toBe('hit')
    expect(advise(['5S', '4H'], '3C')).toBe('double')
    expect(advise(['5S', '4H'], '6C')).toBe('double')
    expect(advise(['5S', '4H'], '7C')).toBe('hit')
  })
})

describe('basic strategy — soft totals', () => {
  it('doubles soft 18 against 3 through 6, stands against 7 and 8, hits against 9 up', () => {
    expect(advise(['AS', '7H'], '2C')).toBe('stand')
    expect(advise(['AS', '7H'], '3C')).toBe('double')
    expect(advise(['AS', '7H'], '6C')).toBe('double')
    expect(advise(['AS', '7H'], '7C')).toBe('stand')
    expect(advise(['AS', '7H'], '9C')).toBe('hit')
    expect(advise(['AS', '7H'], 'AC')).toBe('hit')
  })

  it('always stands on soft 19 and 20 under S17', () => {
    expect(advise(['AS', '8H'], '6C')).toBe('stand')
    expect(advise(['AS', '9H'], '6C')).toBe('stand')
  })

  it('doubles soft 13 and 14 only against 5 and 6', () => {
    expect(advise(['AS', '2H'], '4C')).toBe('hit')
    expect(advise(['AS', '2H'], '5C')).toBe('double')
    expect(advise(['AS', '3H'], '6C')).toBe('double')
    expect(advise(['AS', '3H'], '7C')).toBe('hit')
  })

  it('doubles soft 17 against 3 through 6', () => {
    expect(advise(['AS', '6H'], '2C')).toBe('hit')
    expect(advise(['AS', '6H'], '3C')).toBe('double')
    expect(advise(['AS', '6H'], '6C')).toBe('double')
  })
})

describe('basic strategy — pairs', () => {
  it('always splits aces and eights', () => {
    expect(advise(['AS', 'AH'], '10C')).toBe('split')
    expect(advise(['8S', '8H'], 'AC')).toBe('split')
    expect(advise(['8S', '8H'], '10C')).toBe('split')
  })

  it('never splits tens or fives', () => {
    expect(advise(['10S', '10H'], '6C')).toBe('stand')
    expect(advise(['KS', 'QH'], '5C')).toBe('stand')
    expect(advise(['5S', '5H'], '6C')).toBe('double')
    expect(advise(['5S', '5H'], '10C')).toBe('hit')
  })

  it('splits nines except against 7, 10 and ace', () => {
    expect(advise(['9S', '9H'], '6C')).toBe('split')
    expect(advise(['9S', '9H'], '7C')).toBe('stand')
    expect(advise(['9S', '9H'], '9C')).toBe('split')
    expect(advise(['9S', '9H'], '10C')).toBe('stand')
    expect(advise(['9S', '9H'], 'AC')).toBe('stand')
  })

  it('splits sevens against 2 through 7 only', () => {
    expect(advise(['7S', '7H'], '7C')).toBe('split')
    expect(advise(['7S', '7H'], '8C')).toBe('hit')
  })

  it('splits fours only against 5 and 6 with DAS on', () => {
    expect(advise(['4S', '4H'], '4C')).toBe('hit')
    expect(advise(['4S', '4H'], '5C')).toBe('split')
    expect(advise(['4S', '4H'], '6C')).toBe('split')
    expect(advise(['4S', '4H'], '7C')).toBe('hit')
  })

  it('splits twos and threes against 2 through 7 with DAS on', () => {
    expect(advise(['2S', '2H'], '2C')).toBe('split')
    expect(advise(['3S', '3H'], '7C')).toBe('split')
    expect(advise(['2S', '2H'], '8C')).toBe('hit')
  })

  it('falls back to playing the total when a split is illegal', () => {
    const state = situation(['9S', '9H'], '6C')
    const legal = availableActions(state).filter((a) => a !== 'split')
    // Without a split available, 18 stands.
    expect(
      basicStrategy(state.round.hands[0], state.round.dealer[0], { rules: VEGAS_STRIP, legal }),
    ).toBe('stand')
  })

  it('never recommends doubling when the engine forbids it', () => {
    const state = situation(['6S', '5H'], '9C')
    const legal = availableActions(state).filter((a) => a !== 'double')
    expect(
      basicStrategy(state.round.hands[0], state.round.dealer[0], { rules: VEGAS_STRIP, legal }),
    ).toBe('hit')
  })
})

describe('basic strategy — dealer hits soft 17', () => {
  function adviseUnder(rules: RuleSet, player: [string, string], dealerUp: string): PlayerAction {
    const codes = openingOrder(player, [dealerUp, '5D'])
    const dealt = finishDealing(deal(setBet(stackedGame(codes, rules), 100)))
    const state = dealt.round.phase === 'insurance' ? declineInsurance(dealt) : dealt
    return basicStrategy(state.round.hands[0], state.round.dealer[0], { rules, legal: availableActions(state) })
  }

  it('changes exactly the six squares hitting soft 17 changes', () => {
    // With surrender on, as at Aria's main floor.
    expect(adviseUnder(ARIA_MAIN_FLOOR, ['6S', '5H'], 'AC')).toBe('double')
    expect(adviseUnder(ARIA_MAIN_FLOOR, ['7S', '8H'], 'AC')).toBe('surrender')
    expect(adviseUnder(ARIA_MAIN_FLOOR, ['8S', '9H'], 'AC')).toBe('surrender')
    expect(adviseUnder(ARIA_MAIN_FLOOR, ['AS', '7H'], '2C')).toBe('double')
    expect(adviseUnder(ARIA_MAIN_FLOOR, ['AS', '8H'], '6C')).toBe('double')
    expect(adviseUnder(ARIA_MAIN_FLOOR, ['8S', '8H'], 'AC')).toBe('surrender')
  })

  it('leaves those squares alone when the dealer stands on soft 17', () => {
    expect(adviseUnder(ARIA_SALON, ['6S', '5H'], 'AC')).toBe('hit')
    expect(adviseUnder(ARIA_SALON, ['7S', '8H'], 'AC')).toBe('hit')
    expect(adviseUnder(ARIA_SALON, ['8S', '9H'], 'AC')).toBe('stand')
    expect(adviseUnder(ARIA_SALON, ['AS', '7H'], '2C')).toBe('stand')
    expect(adviseUnder(ARIA_SALON, ['AS', '8H'], '6C')).toBe('stand')
    expect(adviseUnder(ARIA_SALON, ['8S', '8H'], 'AC')).toBe('split')
  })

  it('falls back to standing, splitting and hitting where surrender is not offered', () => {
    // The 6:5 tables hit soft 17 but offer no surrender.
    expect(adviseUnder(ARIA_SIX_FIVE, ['8S', '9H'], 'AC')).toBe('stand')
    expect(adviseUnder(ARIA_SIX_FIVE, ['8S', '8H'], 'AC')).toBe('split')
    expect(adviseUnder(ARIA_SIX_FIVE, ['7S', '8H'], 'AC')).toBe('hit')
  })

  it('prints 17 on its own row, apart from 18 and up', () => {
    const labels = strategyChart(ARIA_MAIN_FLOOR)[0].rows.map((row) => row.label)
    expect(labels).toContain('17')
    expect(labels).toContain('18+')
    expect(labels).not.toContain('17+')
  })

  it('matches the engine lookup in every square of the H17 card', () => {
    const hard: Record<number, string[]> = {
      5: ['2S', '3H'], 6: ['2S', '4H'], 7: ['2S', '5H'], 8: ['2S', '6H'], 9: ['4S', '5H'],
      10: ['4S', '6H'], 11: ['5S', '6H'], 12: ['4S', '8H'], 13: ['5S', '8H'], 14: ['6S', '8H'],
      15: ['7S', '8H'], 16: ['7S', '9H'], 17: ['8S', '9H'], 18: ['8S', '10H'], 19: ['9S', '10H'],
      20: ['2S', '8H', '10D'], 21: ['2S', '9H', '10D'],
    }
    const handOf = (codes: string[]): PlayerHand => ({
      id: 'chart',
      cards: codes.map((code, i) => ({ ...card(code, i), seq: i, faceDown: false })),
      bet: 100,
      fromSplit: false,
      splitAces: false,
      doubled: false,
      surrendered: false,
      resolved: false,
    })
    for (const section of strategyChart(ARIA_MAIN_FLOOR)) {
      for (const row of section.rows) {
        for (const key of row.keys) {
          const hand =
            row.section === 'hard'
              ? handOf(hard[key])
              : row.section === 'soft'
                ? handOf(['AS', `${key}H`])
                : handOf(key === 11 ? ['AS', 'AH'] : [`${key}S`, `${key}H`])
          for (const [col, label] of CHART_COLUMNS.entries()) {
            const found = chartPosition(hand, card(`${label}S`), ARIA_MAIN_FLOOR)
            expect({ section: found.section, key: found.key, cell: found.cell }, `${row.label} vs ${label}`).toEqual({
              section: row.section,
              key,
              cell: row.cells[col],
            })
          }
        }
      }
    }
  })
})

describe('basic strategy — single and double deck', () => {
  function adviseUnder(rules: RuleSet, player: [string, string], dealerUp: string): PlayerAction {
    const codes = openingOrder(player, [dealerUp, '5D'])
    const dealt = finishDealing(deal(setBet(stackedGame(codes, rules), 100)))
    const state = dealt.round.phase === 'insurance' ? declineInsurance(dealt) : dealt
    return basicStrategy(state.round.hands[0], state.round.dealer[0], { rules, legal: availableActions(state) })
  }
  const DOUBLE_H17: RuleSet = { ...ARIA_DOUBLE_DECK, dealerHitsSoft17: true, surrender: 'late' }
  // Single deck with every option on, so the doubling and DAS squares show.
  const SINGLE_FULL: RuleSet = { ...SINGLE_DECK, doubleOn: 'any', doubleAfterSplit: true, surrender: 'late' }
  const SINGLE_H17: RuleSet = { ...SINGLE_FULL, dealerHitsSoft17: true }

  it('doubles and splits a little more with two decks', () => {
    expect(adviseUnder(ARIA_DOUBLE_DECK, ['4S', '5H'], '2C')).toBe('double')
    expect(adviseUnder(ARIA_DOUBLE_DECK, ['6S', '5H'], 'AC')).toBe('double')
    expect(adviseUnder(ARIA_DOUBLE_DECK, ['6S', '6H'], '7C')).toBe('split')
    expect(adviseUnder(ARIA_DOUBLE_DECK, ['7S', '7H'], '8C')).toBe('split')
    // The same hands in a six-deck shoe.
    expect(adviseUnder(ARIA_SALON, ['4S', '5H'], '2C')).toBe('hit')
    expect(adviseUnder(ARIA_SALON, ['6S', '6H'], '7C')).toBe('hit')
    expect(adviseUnder(ARIA_SALON, ['7S', '7H'], '8C')).toBe('hit')
  })

  it('hits 16 against a 9 instead of surrendering with two decks', () => {
    expect(adviseUnder({ ...ARIA_DOUBLE_DECK, surrender: 'late' }, ['10S', '6H'], '9C')).toBe('hit')
    expect(adviseUnder(ARIA_SALON, ['10S', '6H'], '9C')).toBe('surrender')
  })

  it('splits 8s against an ace in a two-deck H17 game only with DAS', () => {
    expect(adviseUnder(DOUBLE_H17, ['8S', '8H'], 'AC')).toBe('split')
    expect(adviseUnder({ ...DOUBLE_H17, doubleAfterSplit: false }, ['8S', '8H'], 'AC')).toBe('surrender')
  })

  it('plays the single-deck squares', () => {
    expect(adviseUnder(SINGLE_FULL, ['5S', '3H'], '6C')).toBe('double')
    expect(adviseUnder(SINGLE_FULL, ['AS', '6H'], '2C')).toBe('double')
    expect(adviseUnder(SINGLE_FULL, ['AS', '2H'], '4C')).toBe('double')
    expect(adviseUnder(SINGLE_FULL, ['4S', '4H'], '4C')).toBe('split')
    expect(adviseUnder(SINGLE_FULL, ['3S', '3H'], '8C')).toBe('split')
    expect(adviseUnder(SINGLE_FULL, ['7S', '7H'], '10C')).toBe('surrender')
    expect(adviseUnder(SINGLE_FULL, ['10S', '5H'], '10C')).toBe('hit')
    expect(adviseUnder(SINGLE_FULL, ['AS', '7H'], 'AC')).toBe('stand')
  })

  it('plays the single-deck H17 squares', () => {
    expect(adviseUnder(SINGLE_H17, ['8S', '8H'], 'AC')).toBe('split')
    expect(adviseUnder(SINGLE_H17, ['7S', '7H'], 'AC')).toBe('surrender')
    expect(adviseUnder(SINGLE_H17, ['AS', '7H'], '2C')).toBe('stand')
  })

  it('reduces correctly at the classic single-deck table', () => {
    // No double after split, doubles on 10 and 11 only, no surrender.
    expect(adviseUnder(SINGLE_DECK, ['2S', '2H'], '3C')).toBe('split')
    expect(adviseUnder(SINGLE_DECK, ['6S', '6H'], '2C')).toBe('split')
    expect(adviseUnder(SINGLE_DECK, ['3S', '3H'], '8C')).toBe('hit')
    expect(adviseUnder(SINGLE_DECK, ['7S', '7H'], '10C')).toBe('stand')
    expect(adviseUnder(SINGLE_DECK, ['5S', '3H'], '6C')).toBe('hit')
    expect(adviseUnder(SINGLE_DECK, ['6S', '5H'], 'AC')).toBe('double')
  })

  it('prints hard 8 on its own row when it doubles', () => {
    const labels = strategyChart(SINGLE_DECK)[0].rows.map((row) => row.label)
    expect(labels).toContain('5–7')
    expect(labels).toContain('8')
    expect(strategyChart(ARIA_DOUBLE_DECK)[0].rows.map((row) => row.label)).toContain('5–8')
  })

  it('matches the engine lookup in every square of every small-deck card', () => {
    const hard: Record<number, string[]> = {
      5: ['2S', '3H'], 6: ['2S', '4H'], 7: ['2S', '5H'], 8: ['2S', '6H'], 9: ['4S', '5H'],
      10: ['4S', '6H'], 11: ['5S', '6H'], 12: ['4S', '8H'], 13: ['5S', '8H'], 14: ['6S', '8H'],
      15: ['7S', '8H'], 16: ['7S', '9H'], 17: ['8S', '9H'], 18: ['8S', '10H'], 19: ['9S', '10H'],
      20: ['2S', '8H', '10D'], 21: ['2S', '9H', '10D'],
    }
    const handOf = (codes: string[]): PlayerHand => ({
      id: 'chart',
      cards: codes.map((code, i) => ({ ...card(code, i), seq: i, faceDown: false })),
      bet: 100,
      fromSplit: false,
      splitAces: false,
      doubled: false,
      surrendered: false,
      resolved: false,
    })
    for (const rules of [SINGLE_FULL, SINGLE_H17, ARIA_DOUBLE_DECK, DOUBLE_H17]) {
      for (const section of strategyChart(rules)) {
        for (const row of section.rows) {
          for (const key of row.keys) {
            const hand =
              row.section === 'hard'
                ? handOf(hard[key])
                : row.section === 'soft'
                  ? handOf(['AS', `${key}H`])
                  : handOf(key === 11 ? ['AS', 'AH'] : [`${key}S`, `${key}H`])
            for (const [col, label] of CHART_COLUMNS.entries()) {
              expect(chartPosition(hand, card(`${label}S`), rules).cell, `${row.label} vs ${label}`).toBe(row.cells[col])
            }
          }
        }
      }
    }
  })

  it('calls the card exact at every preset table', () => {
    for (const { rules } of Object.values(RULE_PRESETS)) expect(chartIsExact(rules)).toBe(true)
  })
})

describe('insurance advice', () => {
  it('declines insurance at a neutral count', () => {
    expect(shouldTakeInsurance(0)).toBe(false)
    expect(shouldTakeInsurance(2.9)).toBe(false)
  })

  it('takes insurance at a true count of +3 or better', () => {
    expect(shouldTakeInsurance(3)).toBe(true)
  })

  it('never takes insurance for a player who is not counting', () => {
    expect(shouldTakeInsurance(5, false)).toBe(false)
  })
})

describe('bet spread', () => {
  it('flat-bets until the count beats a typical shoe, then ramps', () => {
    expect(suggestedBetUnits(0)).toBe(1)
    expect(suggestedBetUnits(0.9)).toBe(1)
    expect(suggestedBetUnits(1)).toBe(2)
    expect(suggestedBetUnits(3)).toBe(6)
    expect(suggestedBetUnits(10)).toBe(12)
  })

  it('waits for a higher count at a worse table', () => {
    const sixFive = RULE_PRESETS.ariaSixFive.houseEdge
    // At +2 a 6:5 game still favours the house by about 1%.
    expect(suggestedBetUnits(2, sixFive)).toBe(1)
    expect(suggestedBetUnits(3.5, sixFive)).toBe(1)
    expect(suggestedBetUnits(4, sixFive)).toBe(2)
  })

  it('starts a little sooner at a better table', () => {
    const salon = RULE_PRESETS.ariaSalon.houseEdge
    expect(suggestedBetUnits(0.5, salon)).toBe(1)
    expect(suggestedBetUnits(0.6, salon)).toBe(2)
  })

  it('lays out the same spread it suggests, step by step', () => {
    for (const { houseEdge } of Object.values(RULE_PRESETS)) {
      const ramp = betRamp(houseEdge)
      expect(ramp.map((step) => step.units)).toEqual([1, 2, 4, 6, 8, 10, 12])
      for (const [i, step] of ramp.entries()) {
        if (step.from === null) continue
        expect(suggestedBetUnits(step.from + 1e-9, houseEdge)).toBe(step.units)
        expect(suggestedBetUnits(step.from - 0.01, houseEdge)).toBe(ramp[i - 1].units)
      }
    }
  })

  it('knows every preset’s house edge, and that 6:5 is by far the worst', () => {
    const edges = Object.values(RULE_PRESETS).map((preset) => preset.houseEdge)
    for (const edge of edges) expect(edge).toBeGreaterThan(0)
    expect(Math.max(...edges)).toBe(RULE_PRESETS.ariaSixFive.houseEdge)
  })
})

describe('printed strategy card', () => {
  /** A throwaway hand built from card shorthand, for chart lookups. */
  function handOf(codes: string[]): PlayerHand {
    return {
      id: 'chart',
      cards: codes.map((code, i) => ({ ...card(code, i), seq: i, faceDown: false })),
      bet: 100,
      fromSplit: false,
      splitAces: false,
      doubled: false,
      surrendered: false,
      resolved: false,
    }
  }

  /**
   * Two-card hands for each hard total, chosen so none of them is a pair (which
   * would route the lookup to the pairs table instead) and none contains an ace.
   */
  const HARD_HANDS: Record<number, string[]> = {
    5: ['2S', '3H'], 6: ['2S', '4H'], 7: ['2S', '5H'], 8: ['2S', '6H'],
    9: ['4S', '5H'], 10: ['4S', '6H'], 11: ['5S', '6H'], 12: ['4S', '8H'],
    13: ['5S', '8H'], 14: ['6S', '8H'], 15: ['7S', '8H'], 16: ['7S', '9H'],
    17: ['8S', '9H'], 18: ['8S', '10H'], 19: ['9S', '10H'],
    20: ['2S', '8H', '10D'], 21: ['2S', '9H', '10D'],
  }

  function handFor(section: string, key: number): PlayerHand {
    if (section === 'hard') return handOf(HARD_HANDS[key])
    if (section === 'soft') return handOf(['AS', `${key}H`])
    return handOf(key === 11 ? ['AS', 'AH'] : [`${key}S`, `${key}H`])
  }

  it('covers all ten dealer upcards in every row', () => {
    for (const section of STRATEGY_CHART) {
      for (const row of section.rows) {
        expect(row.cells).toHaveLength(CHART_COLUMNS.length)
      }
    }
  })

  it('lays out every hard total, soft total and pair exactly once', () => {
    // Hard and soft share one printed block, so group by each row's own origin
    // rather than by the block it is rendered in.
    const rows = STRATEGY_CHART.flatMap((section) => section.rows)
    const keysFor = (id: string) =>
      rows.filter((r) => r.section === id).flatMap((r) => r.keys)
    expect(keysFor('hard')).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21])
    expect(keysFor('soft')).toEqual([2, 3, 4, 5, 6, 7, 8, 9])
    expect(keysFor('pairs')).toEqual([11, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('prints hard and soft totals as one block, with pairs separate', () => {
    expect(STRATEGY_CHART.map((s) => s.id)).toEqual(['totals', 'pairs'])
  })

  /**
   * The card collapses rows that read identically — hard 5 through 8, hard 17
   * and up. This walks every square of the rendered card and asserts it matches
   * what the engine's own lookup returns for that exact situation, so a
   * collapsed row can never quietly disagree with the coach grading your play.
   */
  it('matches the engine lookup in every square', () => {
    for (const section of STRATEGY_CHART) {
      for (const row of section.rows) {
        for (const key of row.keys) {
          const hand = handFor(row.section, key)
          for (const [col, label] of CHART_COLUMNS.entries()) {
            const upcard = card(`${label}S`)
            const found = chartPosition(hand, upcard, VEGAS_STRIP)
            expect(
              { section: found.section, key: found.key, cell: found.cell },
              `${row.section} ${row.label} vs ${label}`,
            ).toEqual({ section: row.section, key, cell: row.cells[col] })
          }
        }
      }
    }
  })

  it('points at the square the coach actually plays', () => {
    const state = situation(['7S', '7H'], '4C')
    const position = chartPosition(state.round.hands[0], state.round.dealer[0], VEGAS_STRIP)
    expect(position).toMatchObject({ section: 'pairs', key: 7, column: 2, cell: 'P' })
    expect(
      basicStrategy(state.round.hands[0], state.round.dealer[0], {
        rules: VEGAS_STRIP,
        legal: availableActions(state),
      }),
    ).toBe('split')
  })
})

describe('hi-lo counting', () => {
  it('assigns the standard tag values', () => {
    expect(hiLoValue('2')).toBe(1)
    expect(hiLoValue('6')).toBe(1)
    expect(hiLoValue('7')).toBe(0)
    expect(hiLoValue('9')).toBe(0)
    expect(hiLoValue('10')).toBe(-1)
    expect(hiLoValue('K')).toBe(-1)
    expect(hiLoValue('A')).toBe(-1)
  })

  it('excludes the dealer hole card until it is exposed', () => {
    // Player 5,6 (+2), dealer up 4 (+1), hole King (-1, hidden).
    const state = situation(['5S', '6H'], '4C')
    const stateWithKingHole = {
      ...state,
      round: {
        ...state.round,
        dealer: [
          state.round.dealer[0],
          { ...state.round.dealer[1], rank: 'K' as const, faceDown: true },
        ],
      },
      shoe: {
        ...state.shoe,
        cards: state.shoe.cards.map((c, i) =>
          i === 3 ? { ...c, rank: 'K' as const } : c,
        ),
      },
    }
    expect(countSnapshot(stateWithKingHole).running).toBe(3)
  })

  it('returns to zero on a fresh shoe', () => {
    const state = stackedGame([])
    expect(runningCount(state.shoe)).toBe(0)
  })

  it('counts a full shoe to exactly zero', () => {
    const state = stackedGame([])
    const full = { ...state.shoe, pos: state.shoe.cards.length }
    expect(runningCount(full)).toBe(0)
  })
})
