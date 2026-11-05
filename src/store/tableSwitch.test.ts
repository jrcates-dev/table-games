import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARIA_DOUBLE_DECK, ARIA_SALON, ARIA_SIX_FIVE } from '../engine/rules'
import { card, openingOrder } from '../engine/testUtils'

/**
 * Changing tables in Settings never waits on the player to clear the felt.
 * Between hands it is immediate and the wager moves across; a hand already out
 * plays to the end under the table it was dealt at, and the new table deals
 * the next one.
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

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubGlobal('localStorage', storage())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function blackjack() {
  const mod = await import('./gameStore')
  await mod.useGameStore.getState().init()
  return mod
}

/** Stack the top of the shoe so the deal is known: a hard 16 against a dealer 7, nothing to peek at. */
function stack(store: Awaited<ReturnType<typeof blackjack>>['useGameStore']) {
  const { game } = store.getState()
  const top = openingOrder(['10S', '6H'], ['7D', '10C']).map((code, i) => card(code, i))
  store.setState({ game: { ...game, shoe: { ...game.shoe, cards: [...top, ...game.shoe.cards] } } })
}

describe('blackjack: changing tables', () => {
  it('moves the wager in the circle to the new table', async () => {
    const { useGameStore } = await blackjack()
    useGameStore.getState().addChip(50)
    useGameStore.getState().updateSettings({ rulePreset: 'ariaSixFive' })

    const { game } = useGameStore.getState()
    expect(game.rules).toEqual(ARIA_SIX_FIVE)
    expect(game.round.phase).toBe('betting')
    expect(game.pendingBet).toBe(50)
  })

  it('clears a paid hand off the felt and carries the wager across', async () => {
    const { useGameStore } = await blackjack()
    stack(useGameStore)
    useGameStore.getState().addChip(50)
    useGameStore.getState().dealRound()
    await vi.runAllTimersAsync()
    useGameStore.getState().act('stand', true)
    await vi.runAllTimersAsync()
    expect(useGameStore.getState().game.round.phase).toBe('roundOver')
    const bankroll = useGameStore.getState().profile.bankroll

    useGameStore.getState().updateSettings({ rulePreset: 'ariaDoubleDeck' })
    const { game, profile } = useGameStore.getState()
    expect(game.round.phase).toBe('betting')
    expect(game.rules).toEqual(ARIA_DOUBLE_DECK)
    expect(game.shoe.cards.length).toBe(2 * 52)
    expect(game.shoe.pos).toBe(0)
    expect(game.pendingBet).toBe(50)
    expect(game.bankroll).toBe(bankroll)
    expect(profile.settings.rulePreset).toBe('ariaDoubleDeck')
  })

  it('lets a hand already out play to the end before the new table deals', async () => {
    const { useGameStore, selectDealtPreset } = await blackjack()
    stack(useGameStore)
    useGameStore.getState().addChip(50)
    useGameStore.getState().dealRound()
    await vi.runAllTimersAsync()
    const before = useGameStore.getState().game
    expect(before.round.phase).toBe('playerTurn')

    useGameStore.getState().updateSettings({ rulePreset: 'ariaSixFive' })
    // Chosen, but the hand on the felt is untouched and still priced as dealt.
    expect(useGameStore.getState().profile.settings.rulePreset).toBe('ariaSixFive')
    expect(useGameStore.getState().game).toBe(before)
    expect(selectDealtPreset(useGameStore.getState()).rules).toEqual(ARIA_SALON)

    useGameStore.getState().act('stand', true)
    await vi.runAllTimersAsync()
    expect(useGameStore.getState().game.round.phase).toBe('roundOver')
    expect(useGameStore.getState().game.rules).toEqual(ARIA_SALON)

    useGameStore.getState().nextRound()
    const { game } = useGameStore.getState()
    expect(game.round.phase).toBe('betting')
    expect(game.rules).toEqual(ARIA_SIX_FIVE)
    expect(game.pendingBet).toBe(50)
    expect(selectDealtPreset(useGameStore.getState()).rules).toEqual(ARIA_SIX_FIVE)
  })

  it('keeps the shoe when nothing changed', async () => {
    const { useGameStore } = await blackjack()
    useGameStore.getState().addChip(25)
    useGameStore.getState().dealRound()
    await vi.runAllTimersAsync()
    if (useGameStore.getState().game.round.phase === 'insurance') useGameStore.getState().act('declineInsurance')
    if (useGameStore.getState().game.round.phase === 'playerTurn') useGameStore.getState().act('stand', true)
    await vi.runAllTimersAsync()
    const pos = useGameStore.getState().game.shoe.pos
    useGameStore.getState().nextRound()
    expect(useGameStore.getState().game.shoe.pos).toBe(pos)
  })
})

describe("hold'em: changing the Trips pay table", () => {
  it('takes a change mid-hand and pays this hand at the table it was bet at', async () => {
    const { useUthStore } = await import('./uthStore')
    await useUthStore.getState().init()
    useUthStore.getState().placeAt('ante')
    useUthStore.getState().placeAt('trips')
    useUthStore.getState().deal()
    expect(useUthStore.getState().game.phase).toBe('preflop')

    useUthStore.getState().updateSettings({ tripsTable: 'generous' })
    expect(useUthStore.getState().profile.settings.tripsTable).toBe('generous')
    expect(useUthStore.getState().game.tripsTable).toBe('standard')

    useUthStore.getState().decide('bet4')
    await vi.runAllTimersAsync()
    expect(useUthStore.getState().game.phase).toBe('showdown')
    expect(useUthStore.getState().game.tripsTable).toBe('generous')
  })
})
