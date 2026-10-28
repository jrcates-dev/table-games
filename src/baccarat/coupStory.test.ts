import { describe, expect, it } from 'vitest'
import * as b from '../engine/baccarat/baccarat'
import { BACCARAT_LIMITS, BACCARAT_ORDER } from '../engine/baccarat/rules'
import type { BaccaratBets, BaccaratState } from '../engine/baccarat/types'
import { card } from '../engine/testUtils'
import { explainCoup } from './coupStory'

/** A game whose next cards off the shoe are exactly these, in deal order: Player, Banker, Player, Banker, then third cards. */
function stacked(codes: string[], seed = 7): BaccaratState {
  const g = b.createGame(100_000, seed, BACCARAT_LIMITS)
  const cards = codes.map((code, i) => card(code, 900 + i))
  return { ...g, shoe: { ...g.shoe, cards: [...g.shoe.cards.slice(0, g.shoe.pos), ...cards, ...g.shoe.cards.slice(g.shoe.pos)] } }
}

function placed(state: BaccaratState, bets: BaccaratBets): BaccaratState {
  let s = state
  for (const [kind, amount] of Object.entries(bets)) s = b.placeBet(s, kind as keyof BaccaratBets, amount!)
  return s
}

/** Deal and settle, then explain the coup the way the rail does. */
function explain(state: BaccaratState, bets: BaccaratBets) {
  const before = placed(state, bets)
  const after = b.settle(b.deal(before))
  return { before, after, story: explainCoup(after.coup!, after.resolutions, after.seq) }
}

function item(story: ReturnType<typeof explain>['story'], kind: keyof BaccaratBets) {
  return story.items.find((i) => i.kind === kind)!
}

const EVERY_BET: BaccaratBets = { banker: 25, player: 25, tie: 10, playerPair: 5, bankerPair: 5, dragonPlayer: 5, dragonBanker: 5 }

describe('what happened last coup', () => {
  it('accounts for every bet once and adds up to what the rack saw', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { before, after, story } = explain(b.createGame(100_000, seed, BACCARAT_LIMITS), EVERY_BET)
      expect(story.items.map((i) => i.kind).sort()).toEqual([...BACCARAT_ORDER].sort())
      expect(story.staked).toBe(b.totalOnFelt(before))
      expect(story.net).toBe(b.coupNet(after))
      // Returned is exactly what went back to the rack.
      expect(story.returned).toBeCloseTo(after.bankroll - before.bankroll, 2)
      expect(story.returned).toBeCloseTo(story.staked + story.net, 2)
      expect(story.items.reduce((sum, i) => sum + i.returned, 0)).toBeCloseTo(story.returned, 2)
      expect(story.steps.length).toBeGreaterThanOrEqual(3)
      expect(story.steps.length).toBeLessThanOrEqual(4)
      for (const i of story.items) expect(i.why.length).toBeGreaterThan(0)
    }
  })

  it('shows the commission inside a Banker win and what came back', () => {
    // Player 2 3 = 5 draws a king and stays on 5; Banker 4 3 = 7 always stands.
    const { story } = explain(stacked(['2S', '4D', '3H', '3C', 'KC']), { banker: 25, tie: 25, playerPair: 5, dragonBanker: 5 })

    expect(story.headline).toBe('Banker 7 over 5')
    expect(story.steps).toEqual([
      'Player 2♠ 3♥: 5.',
      'Banker 4♦ 3♣: 7.',
      'Player draws on 5 (0 to 5 draws): a K♣, which counts 0, makes 5.',
      'Banker stands on 7 (7 always stands).',
    ])
    expect(item(story, 'banker')).toMatchObject({ outcome: 'won', net: 23.75, returned: 48.75 })
    expect(item(story, 'banker').why).toBe('The Banker’s 7 beat the Player’s 5. Pays even money less the 5% commission, $1.25 here.')
    expect(item(story, 'tie')).toMatchObject({ outcome: 'lost', net: -25, returned: 0, why: 'The Banker’s 7 beat the Player’s 5, so no tie.' })
    expect(item(story, 'playerPair').why).toBe('The Player’s first two cards were 2♠ and 3♥, not a pair.')
    expect(item(story, 'dragonBanker').why).toContain('won by only 2 without a natural')
    expect(story.items[0].kind).toBe('banker')
    expect(story).toMatchObject({ staked: 60, stakesBack: 25, winnings: 23.75, returned: 48.75, commission: 1.25, net: -11.25 })
  })

  it('reads the Banker’s row of the tableau against the Player’s third card', () => {
    // Player A 4 = 5 draws an 8 for 3; a Banker 3 stands only against an 8. 3–3.
    const { story } = explain(stacked(['AS', 'KD', '4H', '3C', '8S']), { player: 25, dragonPlayer: 5 })

    expect(story.steps.slice(1)).toEqual([
      'Banker K♦ 3♣: 3 (tens and face cards count 0).',
      'Player draws on 5 (0 to 5 draws): an 8♠ makes 3.',
      'A Banker 3 draws unless the Player’s third card is an 8. It counted 8, so the Banker stands.',
    ])
    expect(item(story, 'player')).toMatchObject({ outcome: 'push', returned: 25, fate: 'Your $25 comes back.' })
    expect(item(story, 'dragonPlayer').why).toBe('A tie without naturals loses the Dragon Bonus. Only a tie on naturals pushes.')
    expect(story).toMatchObject({ returned: 25, net: -5 })
  })

  it('has the Banker play the Player’s rule when the Player stands', () => {
    const { story } = explain(stacked(['6S', '2H', 'KD', '3C', '4H']), { banker: 25 })
    expect(story.steps.slice(2)).toEqual([
      'Player stands on 6 (6 or 7 stands).',
      'Player stood, so the Banker plays by the same rule and draws on 5: a 4♥ makes 9.',
    ])
  })

  it('stops at a natural and says so', () => {
    const { story } = explain(stacked(['8S', '3H', 'KD', '4C']), { player: 25, dragonPlayer: 10 })
    expect(story.natural).toBe(true)
    expect(story.steps).toEqual(['Player 8♠ K♦: 8 (tens and face cards count 0).', 'Banker 3♥ 4♣: 7.', 'The Player’s 8 is a natural, so neither side draws.'])
    expect(item(story, 'dragonPlayer')).toMatchObject({ outcome: 'won', net: 10, why: 'The Player won with a natural 8. Pays even money.' })
    expect(item(story, 'player').fate).toBe('Your $25 comes back with it: $50 to the rack.')
  })

  it('pushes the Dragon on a tie of naturals', () => {
    const { story } = explain(stacked(['9S', '9H', 'KD', 'KC']), { banker: 25, dragonBanker: 5 })
    expect(story.steps[2]).toBe('Both hands are naturals, so neither side draws.')
    expect(item(story, 'dragonBanker')).toMatchObject({ outcome: 'push', why: 'A tie on naturals: the Dragon Bonus pushes.' })
    expect(item(story, 'banker').why).toBe('A tie on 9: Banker bets come back, nothing won or lost.')
    expect(story).toMatchObject({ net: 0, returned: 30 })
  })

  it('shows the arithmetic and names the pair', () => {
    // Player K K = 0, Banker 5 5 = 0: both draw.
    const { story } = explain(stacked(['KS', '5H', 'KD', '5C', '2S', '3D']), { playerPair: 5, bankerPair: 5 })
    expect(story.steps).toEqual([
      'Player K♠ K♦: 0 (tens and face cards count 0).',
      'Banker 5♥ 5♣: 0 (5 + 5 is 10, and only the last digit counts).',
      'Player draws on 0 (0 to 5 draws): a 2♠ makes 2.',
      'Banker draws on 0 (0 to 2 always draws): a 3♦ makes 3.',
    ])
    expect(item(story, 'playerPair')).toMatchObject({ outcome: 'won', net: 55, why: 'The Player’s first two cards were both kings. Pays 11 to 1.' })
    expect(item(story, 'bankerPair').why).toBe('The Banker’s first two cards were both 5s. Pays 11 to 1.')
  })

  it('pays the Dragon by the margin', () => {
    // Player 2 4 = 6 stands; the Banker draws on 0 and stays on 0. Player by 6.
    const { story } = explain(stacked(['2S', 'KD', '4H', 'QC', '10S']), { dragonPlayer: 5 })
    expect(item(story, 'dragonPlayer')).toMatchObject({ outcome: 'won', net: 20, why: 'The Player won by 6 without a natural. A win by 6 pays 4 to 1.' })
  })
})
