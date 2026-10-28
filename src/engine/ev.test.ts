import { describe, expect, it } from 'vitest'
import { availableActions, deal, declineInsurance, finishDealing, setBet, split } from './blackjack'
import { sameSplitValue } from './cards'
import { bestDecision, currentDecisionEvs, dealerOdds, decisionEvs, type Decision, type DecisionEvs } from './ev'
import { ARIA_SALON, RULE_PRESETS, SINGLE_DECK, VEGAS_STRIP } from './rules'
import { basicStrategy } from './strategy'
import { card, openingOrder, stackedGame } from './testUtils'
import type { GameState, PlayerAction, RuleSet } from './types'

const EVERY: PlayerAction[] = ['hit', 'stand', 'double', 'split', 'surrender']

/** Every play the hand could make, as if the table allowed them all; a split only for a pair. */
function evs(player: string[], up: string, rules: RuleSet, extra: Partial<Parameters<typeof decisionEvs>[0]> = {}): DecisionEvs {
  const cards = player.map((code, i) => card(code, i))
  const pair = cards.length === 2 && sameSplitValue(cards[0].rank, cards[1].rank)
  const legal = EVERY.filter((action) => action !== 'split' || pair)
  return decisionEvs({ cards, upcard: card(up, 9), rules, legal, ...extra })
}

/** Deal `player` against `up`, step past insurance, and stop at the first decision. */
function seated(player: [string, string], up: string, rules: RuleSet, extra: string[] = []): GameState {
  // A hole card that cannot make the dealer a natural, so there is a hand to play.
  const hole = ['A', '10'].includes(up.slice(0, -1)) ? '9C' : '10C'
  const dealt = finishDealing(deal(setBet(stackedGame([...openingOrder(player, [up, hole]), ...extra], rules), 100)))
  return dealt.round.phase === 'insurance' ? declineInsurance(dealt) : dealt
}

// Wizard of Odds, blackjack appendix 9: six decks, dealer hits soft 17, double
// after split, resplit to four hands except aces, one card to split aces. The
// figures there are for the exact two cards held, as these are.
const SIX_DECK_H17: RuleSet = { ...ARIA_SALON, dealerHitsSoft17: true, resplitAces: false, surrender: 'none' }

// Wizard of Odds, expected returns in infinite-deck blackjack: stands on soft
// 17, double after split, split to four hands. Twenty thousand decks is close
// enough to infinite that no figure moves in the sixth place.
const INFINITE: RuleSet = { ...ARIA_SALON, decks: 20_000, resplitAces: false, surrender: 'none' }

describe('decision values — against published tables', () => {
  it('matches the six-deck H17 figures for standing, hitting and doubling exactly', () => {
    const table: Array<[string[], string, number, number, number]> = [
      // cards, upcard, stand, hit, double
      [['10S', '6H'], '10D', -0.540954, -0.534676, -1.069351],
      [['9S', '7H'], '10D', -0.536809, -0.535392, -1.070784],
      [['10S', '6H'], '9D', -0.542505, -0.504547, -1.009094],
      [['10S', '2H'], '4D', -0.205906, -0.210664, -0.421329],
      [['7S', '5H'], '3D', -0.240505, -0.232183, -0.464366],
      [['6S', '5H'], '6D', -0.117876, 0.339933, 0.679865],
      [['9S', '2H'], 'AD', -0.596905, 0.107036, 0.115609],
      [['6S', '4H'], '10D', -0.542043, 0.026796, -0.005603],
      [['5S', '4H'], '2D', -0.283253, 0.075786, 0.068039],
      [['AS', '7H'], '2D', 0.11311, 0.060441, 0.116262],
      [['AS', '7H'], '9D', -0.18264, -0.098469, -0.284825],
      [['10S', '10H'], '6D', 0.67659, -0.852918, -1.705836],
    ]
    for (const [player, up, stand, hit, double] of table) {
      const ev = evs(player, up, SIX_DECK_H17)
      expect(ev.stand).toBeCloseTo(stand, 5)
      expect(ev.hit).toBeCloseTo(hit, 5)
      expect(ev.double).toBeCloseTo(double, 5)
    }
  })

  it('prices six-deck splits within a twentieth of a percent of the exact figures', () => {
    const table: Array<[string[], string, number]> = [
      [['8S', '8H'], 'AD', -0.514318],
      [['9S', '9H'], '7D', 0.36418],
      [['2S', '2H'], '2D', -0.07828],
      [['AS', 'AH'], '6D', 0.679649],
      [['10S', '10H'], '6D', 0.44859],
    ]
    for (const [player, up, value] of table) {
      expect(Math.abs((evs(player, up, SIX_DECK_H17).split as number) - value)).toBeLessThan(0.0005)
    }
  })

  it('matches the infinite-deck figures, splits included', () => {
    const table: Array<[string[], string, Partial<Record<Decision, number>>]> = [
      [['10S', '6H'], '10D', { stand: -0.54043, hit: -0.539826, double: -1.079653 }],
      [['10S', '6H'], '7D', { stand: -0.475375, hit: -0.414779 }],
      [['10S', '2H'], '4D', { stand: -0.211063, hit: -0.213537 }],
      [['6S', '5H'], '6D', { hit: 0.33369, double: 0.66738 }],
      [['6S', '5H'], 'AD', { stand: -0.666951, hit: 0.143001, double: 0.109061 }],
      [['AS', '7H'], '2D', { stand: 0.121742, hit: 0.062905, double: 0.11975 }],
      [['8S', '8H'], '10D', { split: -0.480686 }],
      [['9S', '9H'], '7D', { stand: 0.399554, split: 0.364837 }],
      [['10S', '10H'], 'AD', { stand: 0.65547 }],
    ]
    for (const [player, up, expected] of table) {
      const ev = evs(player, up, INFINITE)
      for (const [action, value] of Object.entries(expected)) {
        expect(ev[action as Decision]).toBeCloseTo(value, 4)
      }
    }
  })
})

describe('dealer odds', () => {
  it('matches the published single-deck S17 table, after the peek', () => {
    const rules = { ...VEGAS_STRIP, decks: 1 }
    const table: Array<[string, number[], number]> = [
      ['AS', [0.183786, 0.19089, 0.18868, 0.191692, 0.075137], 0.169815],
      ['2S', [0.138976, 0.131762, 0.131815, 0.123948, 0.120526], 0.352973],
      ['6S', [0.166948, 0.106454, 0.107192, 0.100705, 0.097879], 0.420823],
      ['10S', [0.124156, 0.122486, 0.124421, 0.356869, 0.03957], 0.232499],
    ]
    for (const [up, totals, bust] of table) {
      const odds = dealerOdds(card(up), rules)
      totals.forEach((p, i) => expect(odds.totals[i]).toBeCloseTo(p, 5))
      expect(odds.bust).toBeCloseTo(bust, 5)
      expect(odds.natural).toBe(0)
    }
  })

  it('keeps the natural in play when the dealer does not peek', () => {
    const odds = dealerOdds(card('10S'), { ...VEGAS_STRIP, decks: 1, dealerPeek: false })
    // Four aces among the 51 cards left.
    expect(odds.natural).toBeCloseTo(4 / 51, 10)
    expect(odds.totals.reduce((a, b) => a + b, 0) + odds.bust + odds.natural).toBeCloseTo(1, 10)
  })
})

describe('decision values — table rules', () => {
  it('gives only the plays the engine allows a figure', () => {
    const ev = decisionEvs({ cards: [card('10S'), card('6H'), card('2C')], upcard: card('9D'), rules: ARIA_SALON, legal: ['hit', 'stand'] })
    expect(Object.keys(ev).sort()).toEqual(['hit', 'stand'])
  })

  it('always prices surrender at half the bet', () => {
    expect(evs(['10S', '6H'], '10D', ARIA_SALON).surrender).toBe(-0.5)
    expect(evs(['10S', '6H'], 'AD', { ...ARIA_SALON, dealerPeek: false }).surrender).toBe(-0.5)
  })

  it('values room to resplit, and resplitting aces only where the table allows it', () => {
    const roomy = evs(['8S', '8H'], '6D', ARIA_SALON).split as number
    const last = evs(['8S', '8H'], '6D', ARIA_SALON, { boxes: 3 }).split as number
    expect(roomy).toBeGreaterThan(last)

    const resplit = evs(['AS', 'AH'], '6D', ARIA_SALON).split as number
    const once = evs(['AS', 'AH'], '6D', { ...ARIA_SALON, resplitAces: false }).split as number
    expect(resplit).toBeGreaterThan(once)
  })

  it('charges a double the whole doubled bet when an unchecked dealer turns over a natural', () => {
    const peek = evs(['6S', '5H'], '10D', ARIA_SALON).double as number
    const blind = evs(['6S', '5H'], '10D', { ...ARIA_SALON, dealerPeek: false }).double as number
    // The hole card is an ace with the chance one ace has among what is left.
    const natural = 24 / (312 - 3)
    expect(blind).toBeCloseTo((1 - natural) * peek - 2 * natural, 9)
  })

  it('works the cards dealt to other boxes out of the shoe', () => {
    let game = seated(['8S', '8H'], '6D', ARIA_SALON, ['3C', '10C'])
    game = split(game)
    const hand = game.round.hands[0]
    const live = currentDecisionEvs(game)
    expect(live).toEqual(
      decisionEvs({
        cards: hand.cards,
        upcard: game.round.dealer[0],
        rules: ARIA_SALON,
        legal: availableActions(game),
        seen: game.round.hands[1].cards,
        boxes: 2,
      }),
    )
    expect(live?.double).toBeDefined()
  })

  it('has nothing to price outside the player’s turn', () => {
    expect(currentDecisionEvs(stackedGame([], ARIA_SALON))).toBeNull()
  })
})

describe('decision values — against the book', () => {
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10']

  it.each([
    ['ariaSalon', 0.001],
    ['singleDeck', 0.02],
  ])('finds the book play best, or a hair from it, on every opening hand at %s', (preset, slack) => {
    const { rules } = RULE_PRESETS[preset]
    for (let i = 0; i < RANKS.length; i++) {
      for (let j = i; j < RANKS.length; j++) {
        for (const up of RANKS) {
          const game = seated([`${RANKS[i]}S`, `${RANKS[j]}H`], `${up}D`, rules)
          if (game.round.phase !== 'playerTurn') continue
          const ev = currentDecisionEvs(game) as DecisionEvs
          const book = basicStrategy(game.round.hands[0], game.round.dealer[0], { rules, legal: availableActions(game) }) as Decision
          const best = bestDecision(ev) as Decision
          // The chart plays totals; the figures play the exact cards, so a
          // handful of hands differ, and only by a sliver.
          expect((ev[best] as number) - (ev[book] as number)).toBeLessThan(slack)
        }
      }
    }
  }, 30_000)

  it('plays the cards, not the total: in single deck 10,2 hits a 4 where 7,5 stands', () => {
    const ev = evs(['10S', '2H'], '4D', SINGLE_DECK)
    expect(bestDecision(ev)).toBe('hit')
    expect(evs(['7S', '5H'], '4D', SINGLE_DECK).stand).toBeGreaterThan(evs(['7S', '5H'], '4D', SINGLE_DECK).hit as number)
  })
})
