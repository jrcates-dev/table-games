import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The book keeps the hand just played lit after it is over: the stores hold on
 * to it from the decision that settled it until the next hand is dealt.
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

describe('blackjack: the last decision', () => {
  it('is kept once the round is over, through a new bet, and dropped when the next hand is dealt', async () => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', storage())
    const { useGameStore } = await import('./gameStore')
    const store = useGameStore
    await store.getState().init()
    store.getState().addChip(store.getState().table().minBet)

    // Deal until a hand waits on the player; naturals settle with nothing to decide.
    for (let tries = 0; tries < 50; tries++) {
      store.getState().dealRound()
      await vi.runAllTimersAsync()
      if (store.getState().game.round.phase === 'insurance') store.getState().act('declineInsurance')
      if (store.getState().game.round.phase === 'playerTurn') break
      expect(store.getState().lastDecision).toBeNull()
      store.getState().nextRound()
    }
    expect(store.getState().game.round.phase).toBe('playerTurn')

    const before = store.getState().game
    store.getState().act('stand', true)
    await vi.runAllTimersAsync()
    expect(store.getState().game.round.phase).toBe('roundOver')
    expect(store.getState().lastDecision).toBe(before)

    store.getState().nextRound()
    expect(store.getState().game.round.phase).toBe('betting')
    expect(store.getState().lastDecision).toBe(before)

    store.getState().dealRound()
    expect(store.getState().lastDecision).toBeNull()
  })
})

describe("hold'em: the last hand", () => {
  async function table() {
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', storage())
    const { useUthStore, holeName } = await import('./uthStore')
    await useUthStore.getState().init()
    useUthStore.getState().placeAt('ante')
    useUthStore.getState().deal()
    expect(useUthStore.getState().game.phase).toBe('preflop')
    return { store: useUthStore, holeName }
  }

  it('holds the hand raised before the flop until the next is dealt', async () => {
    const { store, holeName } = await table()
    const hole = holeName(store.getState().game.player)
    expect(store.getState().lastHand).toBeNull()

    store.getState().decide('bet4')
    await vi.runAllTimersAsync()
    expect(store.getState().game.phase).toBe('showdown')
    expect(store.getState().lastHand).toEqual({ hole, street: 'preflop' })

    // Chips for the next hand clear the felt but not the book.
    store.getState().placeAt('ante')
    expect(store.getState().game.phase).toBe('betting')
    expect(store.getState().lastHand).toEqual({ hole, street: 'preflop' })

    store.getState().deal()
    expect(store.getState().lastHand).toBeNull()
  })

  it('names the river when the hand is checked down and folded', async () => {
    const { store, holeName } = await table()
    const hole = holeName(store.getState().game.player)
    store.getState().decide('check')
    store.getState().decide('check')
    expect(store.getState().lastHand).toBeNull()
    store.getState().decide('fold')
    expect(store.getState().lastHand).toEqual({ hole, street: 'river' })
  })
})
