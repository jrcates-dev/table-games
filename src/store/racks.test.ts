import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The lobby's one figure for every rack: each table ends up holding it, a
 * played run is filed rather than overwritten, and nothing left in play
 * survives the reset. And the choice under it, of one bankroll carried between
 * the tables: every rack moves together, and the floor remembers the figure.
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

/** The floor as a page load finds it; pass the storage of an earlier load to open the page again. */
async function freshFloor(local = storage()) {
  vi.resetModules()
  vi.stubGlobal('localStorage', local)
  const { useGameStore } = await import('./gameStore')
  const { useCrapsStore } = await import('./crapsStore')
  const { useBaccaratStore } = await import('./baccaratStore')
  const { useRouletteStore } = await import('./rouletteStore')
  const { useUthStore } = await import('./uthStore')
  const { useAppStore } = await import('./appStore')
  const { resetAllRacks, setSharedBankroll } = await import('./racks')
  const { useSharedBankroll } = await import('./sharedBankroll')
  await Promise.all([
    useGameStore.getState().init(),
    useCrapsStore.getState().init(),
    useBaccaratStore.getState().init(),
    useRouletteStore.getState().init(),
    useUthStore.getState().init(),
  ])
  const stores = [useGameStore, useCrapsStore, useBaccaratStore, useRouletteStore, useUthStore] as const
  return {
    useGameStore,
    useCrapsStore,
    useBaccaratStore,
    useRouletteStore,
    useUthStore,
    useAppStore,
    useSharedBankroll,
    setSharedBankroll,
    resetAllRacks,
    stores,
  }
}

describe('resetting every rack from the lobby', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens every table with $1,000 on a first visit', async () => {
    const { stores } = await freshFloor()
    for (const store of stores) {
      const { profile, game } = store.getState()
      expect(profile.bankroll).toBe(1_000)
      expect(profile.settings.startingBankroll).toBe(1_000)
      expect(game.bankroll).toBe(1_000)
    }
  })

  it('puts the same amount in every rack, and makes it the buy-back-in everywhere', async () => {
    const { resetAllRacks, stores } = await freshFloor()
    resetAllRacks(2_500)
    for (const store of stores) {
      const { profile, game } = store.getState()
      expect(profile.bankroll).toBe(2_500)
      expect(profile.peakBankroll).toBe(2_500)
      expect(profile.settings.startingBankroll).toBe(2_500)
      expect(game.bankroll).toBe(2_500)
    }
  })

  it('keeps the amount within the stake limits', async () => {
    const { resetAllRacks, stores } = await freshFloor()
    resetAllRacks(40)
    for (const store of stores) expect(store.getState().profile.bankroll).toBe(100)
  })

  it('files a played run before starting a fresh one, and leaves unplayed tables without one', async () => {
    const { useGameStore, useRouletteStore, useBaccaratStore, resetAllRacks } = await freshFloor()
    const bj = useGameStore.getState().profile
    useGameStore.setState({
      profile: { ...bj, bankroll: 3_400, peakBankroll: 4_100, allTimePeak: 4_100, runRounds: 12, stats: { ...bj.stats, roundsPlayed: 12 } },
    })
    const ro = useRouletteStore.getState().profile
    useRouletteStore.setState({
      profile: { ...ro, bankroll: 7_000, peakBankroll: 12_000, allTimePeak: 12_000, runRounds: 30, stats: { ...ro.stats, spins: 30 } },
    })

    resetAllRacks(2_500)

    const bjNext = useGameStore.getState().profile
    expect(bjNext.bankroll).toBe(2_500)
    expect(bjNext.allTimePeak).toBe(4_100)
    expect(bjNext.runRounds).toBe(0)
    expect(bjNext.runs[0]).toMatchObject({ peakBankroll: 4_100, roundsPlayed: 12 })

    const roNext = useRouletteStore.getState().profile
    expect(roNext.bankroll).toBe(2_500)
    expect(roNext.allTimePeak).toBe(12_000)
    expect(roNext.runs[0]).toMatchObject({ peakBankroll: 12_000, rounds: 30 })

    expect(useBaccaratStore.getState().profile.runs).toHaveLength(0)
  })

  it('sweeps off a hand left in play rather than waiting for it', async () => {
    const { useGameStore, useUthStore, resetAllRacks } = await freshFloor()
    const { game } = useGameStore.getState()
    useGameStore.setState({ game: { ...game, round: { ...game.round, phase: 'playerTurn' } }, animating: true })
    const uth = useUthStore.getState().game
    useUthStore.setState({ game: { ...uth, phase: 'preflop', bets: { ante: 25, blind: 25, trips: 0, play: 0 } }, boardShown: 3 })

    resetAllRacks(2_500)

    const bj = useGameStore.getState()
    expect(bj.game.round.phase).toBe('betting')
    expect(bj.animating).toBe(false)
    expect(bj.game.bankroll).toBe(2_500)

    const next = useUthStore.getState()
    expect(next.game.phase).toBe('betting')
    expect(next.game.bets).toEqual({ ante: 0, blind: 0, trips: 0, play: 0 })
    expect(next.boardShown).toBe(0)
    expect(next.profile.bankroll).toBe(2_500)
  })

  it('returns chips on the felt even when the rack already reads the amount', async () => {
    const { useCrapsStore, resetAllRacks } = await freshFloor()
    const rack = useCrapsStore.getState().profile.bankroll
    useCrapsStore.getState().placeAt('passLine')
    expect(useCrapsStore.getState().game.bankroll).toBeLessThan(rack)

    resetAllRacks(rack)
    const { game } = useCrapsStore.getState()
    expect(Object.keys(game.bets)).toHaveLength(0)
    expect(game.bankroll).toBe(rack)
  })
})

describe('one bankroll for every table', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps a rack at each table until asked to share one', async () => {
    const { useCrapsStore, useSharedBankroll, stores } = await freshFloor()
    expect(useSharedBankroll.getState().shared).toBe(false)
    useCrapsStore.getState().placeAt('passLine')
    expect(useCrapsStore.getState().game.bankroll).toBeLessThan(1_000)
    for (const store of stores) if (store !== useCrapsStore) expect(store.getState().game.bankroll).toBe(1_000)
  })

  it('carries the rack from the table you were last at to every other table', async () => {
    const { setSharedBankroll, useRouletteStore, useAppStore, useSharedBankroll, stores } = await freshFloor()
    useRouletteStore.getState().resetRack(3_000)
    useAppStore.setState({ lastGame: 'roulette' })

    setSharedBankroll(true)

    expect(useSharedBankroll.getState().bankroll).toBe(3_000)
    for (const store of stores) {
      expect(store.getState().game.bankroll).toBe(3_000)
      expect(store.getState().profile.bankroll).toBe(3_000)
    }
  })

  it('moves every rack together when chips go down at any table, and leaves the felts as they were', async () => {
    const { setSharedBankroll, useCrapsStore, useRouletteStore, useSharedBankroll, stores } = await freshFloor()
    setSharedBankroll(true)
    useCrapsStore.getState().placeAt('passLine')
    useRouletteStore.getState().setChip(25)
    useRouletteStore.getState().placeAt('red')

    const rack = useRouletteStore.getState().game.bankroll
    expect(rack).toBe(1_000 - 25 - useCrapsStore.getState().game.bets.passLine.amount)
    expect(useSharedBankroll.getState().bankroll).toBe(rack)
    for (const store of stores) {
      expect(store.getState().game.bankroll).toBe(rack)
      expect(store.getState().profile.bankroll).toBe(rack)
    }
    expect(Object.keys(useCrapsStore.getState().game.bets)).toEqual(['passLine'])
    expect(Object.keys(useRouletteStore.getState().game.bets)).toEqual(['red'])
  })

  it('makes a reset at one table the new figure everywhere', async () => {
    const { setSharedBankroll, useUthStore, useSharedBankroll, stores } = await freshFloor()
    setSharedBankroll(true)
    useUthStore.getState().resetRack(4_000)
    expect(useSharedBankroll.getState().bankroll).toBe(4_000)
    for (const store of stores) expect(store.getState().game.bankroll).toBe(4_000)
  })

  it('resets the one bankroll from the lobby', async () => {
    const { setSharedBankroll, useCrapsStore, useSharedBankroll, resetAllRacks, stores } = await freshFloor()
    setSharedBankroll(true)
    useCrapsStore.getState().placeAt('passLine')

    resetAllRacks(2_500)

    expect(useSharedBankroll.getState().bankroll).toBe(2_500)
    expect(Object.keys(useCrapsStore.getState().game.bets)).toHaveLength(0)
    for (const store of stores) expect(store.getState().game.bankroll).toBe(2_500)
  })

  it('remembers the choice and the figure when the page is opened again', async () => {
    const local = storage()
    const first = await freshFloor(local)
    first.setSharedBankroll(true)
    first.useCrapsStore.getState().placeAt('passLine')
    const rack = first.useCrapsStore.getState().game.bankroll

    const { useSharedBankroll, stores } = await freshFloor(local)
    expect(useSharedBankroll.getState().shared).toBe(true)
    for (const store of stores) expect(store.getState().game.bankroll).toBe(rack)
  })

  it('leaves every table its own rack at the shared figure once turned off', async () => {
    const local = storage()
    const first = await freshFloor(local)
    first.setSharedBankroll(true)
    first.useCrapsStore.getState().placeAt('passLine')
    const rack = first.useCrapsStore.getState().game.bankroll

    first.setSharedBankroll(false)
    first.useCrapsStore.getState().takeDown('passLine')
    expect(first.useCrapsStore.getState().game.bankroll).toBe(1_000)
    for (const store of first.stores) if (store !== first.useCrapsStore) expect(store.getState().game.bankroll).toBe(rack)

    const { useSharedBankroll, useCrapsStore, stores } = await freshFloor(local)
    expect(useSharedBankroll.getState().shared).toBe(false)
    expect(useCrapsStore.getState().game.bankroll).toBe(1_000)
    for (const store of stores) if (store !== useCrapsStore) expect(store.getState().game.bankroll).toBe(rack)
  })

  it('settles a blackjack hand against what it staked, whatever moves the rack meanwhile', async () => {
    vi.useFakeTimers()
    const { setSharedBankroll, useGameStore, useCrapsStore } = await freshFloor()
    setSharedBankroll(true)
    const bet = useGameStore.getState().table().minBet
    useGameStore.getState().addChip(bet)
    useGameStore.getState().dealRound()

    // Chips go down at the craps table while the cards are still being dealt.
    useCrapsStore.getState().placeAt('passLine')
    const elsewhere = useCrapsStore.getState().game.bets.passLine.amount

    for (let i = 0; i < 20 && useGameStore.getState().game.round.phase !== 'roundOver'; i++) {
      const { phase } = useGameStore.getState().game.round
      if (phase === 'insurance') useGameStore.getState().act('declineInsurance')
      if (phase === 'playerTurn') useGameStore.getState().act('stand', true)
      vi.runAllTimers()
    }

    const { game, profile } = useGameStore.getState()
    expect(game.round.phase).toBe('roundOver')
    const net = profile.history[0].net
    expect([-bet, 0, bet, bet * 1.5]).toContain(net)
    expect(profile.stats.netResult).toBe(net)
    expect(game.bankroll).toBe(1_000 - elsewhere + net)
    expect(useCrapsStore.getState().game.bankroll).toBe(game.bankroll)
  })
})
