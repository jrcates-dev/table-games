import { afterEach, describe, expect, it, vi } from 'vitest'
import { RULE_PRESETS } from '../engine/rules'

/**
 * The game a table deals can change between hands, and only between them:
 * once a hand is paid, whatever is still lying on the felt.
 */

function storage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('blackjack: house rules', () => {
  it('change once a hand is paid, clearing it off the felt and keeping the wager', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', storage())
    const { useGameStore } = await import('./gameStore')
    const store = useGameStore
    await store.getState().init()
    const bet = store.getState().table().minBet
    store.getState().addChip(bet)

    // Play a hand out to its payout.
    store.getState().dealRound()
    for (let steps = 0; steps < 20 && store.getState().game.round.phase !== 'roundOver'; steps++) {
      await vi.runAllTimersAsync()
      const { phase } = store.getState().game.round
      if (phase === 'insurance') store.getState().act('declineInsurance')
      if (phase === 'playerTurn') store.getState().act('stand')
    }
    expect(store.getState().game.round.phase).toBe('roundOver')
    expect(store.getState().game.rules.blackjackPayout).toBe(1.5)

    store.getState().updateSettings({ rulePreset: 'ariaSixFive' })

    const { game, profile } = store.getState()
    expect(profile.settings.rulePreset).toBe('ariaSixFive')
    expect(game.round.phase).toBe('betting')
    expect(game.rules).toEqual(RULE_PRESETS.ariaSixFive.rules)
    expect(game.pendingBet).toBe(bet)
    expect(game.bankroll).toBe(profile.bankroll)

    // And the next hand is dealt under them.
    store.getState().dealRound()
    expect(store.getState().game.rules.blackjackPayout).toBe(1.2)
  })

  it('wait for a hand being played to finish', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', storage())
    const { useGameStore } = await import('./gameStore')
    const store = useGameStore
    await store.getState().init()
    store.getState().addChip(store.getState().table().minBet)

    for (let tries = 0; tries < 50; tries++) {
      store.getState().dealRound()
      await vi.runAllTimersAsync()
      if (store.getState().game.round.phase === 'insurance') store.getState().act('declineInsurance')
      if (store.getState().game.round.phase === 'playerTurn') break
      store.getState().nextRound()
    }
    expect(store.getState().game.round.phase).toBe('playerTurn')

    const before = store.getState().game
    store.getState().updateSettings({ rulePreset: 'ariaSixFive' })
    expect(store.getState().game).toBe(before)
  })
})

describe('Ultimate Texas Hold’em: the Trips pay table', () => {
  it('refused mid-hand is not saved as the table’s', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const local = storage()
    vi.stubGlobal('localStorage', local)
    const { useUthStore } = await import('./uthStore')
    const store = useUthStore
    await store.getState().init()
    store.getState().placeAt('ante')
    store.getState().deal()
    expect(store.getState().game.phase).not.toBe('betting')

    store.getState().updateSettings({ tripsTable: 'generous' })

    expect(store.getState().game.tripsTable).toBe('standard')
    expect(store.getState().profile.settings.tripsTable).toBe('standard')
    expect(local.getItem('cta:uth:profile:v1') ?? '').not.toContain('generous')
  })

  it('changes between hands', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', storage())
    const { useUthStore } = await import('./uthStore')
    const store = useUthStore
    await store.getState().init()

    store.getState().updateSettings({ tripsTable: 'generous' })

    expect(store.getState().game.tripsTable).toBe('generous')
    expect(store.getState().profile.settings.tripsTable).toBe('generous')
  })
})
