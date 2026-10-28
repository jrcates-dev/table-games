import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openingOrder, stackedGame } from '../engine/testUtils'
import { DEFAULT_SETTINGS, migrateSettings } from './profile'

/**
 * Two choices that belong to the player before the house gets a say: what to
 * sit down with, chosen in the lobby whenever nothing is in play, and whether
 * to be asked about insurance at all.
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

async function freshStores() {
  vi.resetModules()
  vi.stubGlobal('localStorage', storage())
  const blackjack = await import('./gameStore')
  const craps = await import('./crapsStore')
  await blackjack.useGameStore.getState().init()
  await craps.useCrapsStore.getState().init()
  return { ...blackjack, ...craps }
}

describe('choosing a bankroll in the lobby', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets the blackjack rack, its peak and the buy-back-in before the first hand', async () => {
    const { useGameStore, selectCanChooseBankroll } = await freshStores()
    expect(selectCanChooseBankroll(useGameStore.getState())).toBe(true)

    useGameStore.getState().chooseBankroll(2_500)
    const { profile, game } = useGameStore.getState()
    expect(profile.bankroll).toBe(2_500)
    expect(profile.peakBankroll).toBe(2_500)
    expect(profile.allTimePeak).toBe(2_500)
    expect(profile.settings.startingBankroll).toBe(2_500)
    expect(game.bankroll).toBe(2_500)
  })

  it('keeps a typed blackjack bankroll within the stake limits', async () => {
    const { useGameStore } = await freshStores()
    useGameStore.getState().chooseBankroll(40)
    expect(useGameStore.getState().profile.bankroll).toBe(100)
  })

  it('closes a played blackjack run and starts a new one at the chosen amount', async () => {
    const { useGameStore, selectCanChooseBankroll, selectBankrollHasRun } = await freshStores()
    const { profile } = useGameStore.getState()
    const startedAt = profile.runStartedAt
    useGameStore.setState({
      profile: {
        ...profile,
        bankroll: 3_400,
        peakBankroll: 4_100,
        allTimePeak: 4_100,
        runRounds: 12,
        stats: { ...profile.stats, roundsPlayed: 12 },
      },
    })
    expect(selectCanChooseBankroll(useGameStore.getState())).toBe(true)
    expect(selectBankrollHasRun(useGameStore.getState())).toBe(true)

    useGameStore.getState().chooseBankroll(2_500)
    const { profile: next, game } = useGameStore.getState()
    expect(next.bankroll).toBe(2_500)
    expect(next.peakBankroll).toBe(2_500)
    expect(next.allTimePeak).toBe(4_100)
    expect(next.runRounds).toBe(0)
    expect(next.settings.startingBankroll).toBe(2_500)
    expect(game.bankroll).toBe(2_500)
    expect(next.runs[0]).toMatchObject({ startedAt, peakBankroll: 4_100, roundsPlayed: 12 })
  })

  it('leaves a played blackjack run alone when the rack is handed back unchanged', async () => {
    const { useGameStore } = await freshStores()
    const { profile } = useGameStore.getState()
    useGameStore.setState({ profile: { ...profile, bankroll: 3_400, runRounds: 12, stats: { ...profile.stats, roundsPlayed: 12 } } })

    useGameStore.getState().chooseBankroll(3_400)
    const next = useGameStore.getState().profile
    expect(next.bankroll).toBe(3_400)
    expect(next.runRounds).toBe(12)
    expect(next.runs).toHaveLength(0)
  })

  it('does not offer the blackjack choice with a hand in play', async () => {
    const { useGameStore, selectCanChooseBankroll } = await freshStores()
    const { game } = useGameStore.getState()
    useGameStore.setState({ game: { ...game, round: { ...game.round, phase: 'playerTurn' } } })

    expect(selectCanChooseBankroll(useGameStore.getState())).toBe(false)
    useGameStore.getState().chooseBankroll(2_500)
    expect(useGameStore.getState().profile.bankroll).not.toBe(2_500)
  })

  it('sets the craps rack and returns anything already on the felt', async () => {
    const { useCrapsStore, selectCanChooseCrapsBankroll } = await freshStores()
    useCrapsStore.getState().placeAt('passLine')
    expect(Object.keys(useCrapsStore.getState().game.bets)).toHaveLength(1)
    expect(selectCanChooseCrapsBankroll(useCrapsStore.getState())).toBe(true)

    useCrapsStore.getState().chooseBankroll(750)
    const { profile, game } = useCrapsStore.getState()
    expect(profile.bankroll).toBe(750)
    expect(profile.settings.startingBankroll).toBe(750)
    expect(game.bankroll).toBe(750)
    expect(Object.keys(game.bets)).toHaveLength(0)
  })

  it('closes a played craps run and starts a new one at the chosen amount', async () => {
    const { useCrapsStore, selectCanChooseCrapsBankroll, selectCrapsBankrollHasRun } = await freshStores()
    const { profile } = useCrapsStore.getState()
    const startedAt = profile.runStartedAt
    useCrapsStore.setState({
      profile: {
        ...profile,
        bankroll: 1_900,
        peakBankroll: 2_600,
        allTimePeak: 2_600,
        runShoots: 4,
        stats: { ...profile.stats, rolls: 60 },
      },
    })
    expect(selectCanChooseCrapsBankroll(useCrapsStore.getState())).toBe(true)
    expect(selectCrapsBankrollHasRun(useCrapsStore.getState())).toBe(true)

    useCrapsStore.getState().chooseBankroll(750)
    const { profile: next, game } = useCrapsStore.getState()
    expect(next.bankroll).toBe(750)
    expect(next.peakBankroll).toBe(750)
    expect(next.allTimePeak).toBe(2_600)
    expect(next.runShoots).toBe(0)
    expect(next.settings.startingBankroll).toBe(750)
    expect(game.bankroll).toBe(750)
    expect(next.runs[0]).toMatchObject({ startedAt, peakBankroll: 2_600, shoots: 4 })
  })

  it('leaves a played craps run alone when the rack is handed back unchanged', async () => {
    const { useCrapsStore } = await freshStores()
    const { profile } = useCrapsStore.getState()
    useCrapsStore.setState({ profile: { ...profile, bankroll: 1_900, stats: { ...profile.stats, rolls: 60 } } })

    useCrapsStore.getState().chooseBankroll(1_900)
    const next = useCrapsStore.getState().profile
    expect(next.bankroll).toBe(1_900)
    expect(next.runs).toHaveLength(0)
  })

  it('does not offer the craps choice while the dice are in the air', async () => {
    const { useCrapsStore, selectCanChooseCrapsBankroll } = await freshStores()
    const { game } = useCrapsStore.getState()
    useCrapsStore.setState({ game: { ...game, phase: 'rolling' } })

    expect(selectCanChooseCrapsBankroll(useCrapsStore.getState())).toBe(false)
  })
})

describe('never being offered insurance', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function dealAgainstAnAce(offerInsurance: boolean) {
    const { useGameStore } = await freshStores()
    const store = useGameStore.getState()
    store.updateSettings({ offerInsurance })
    // Dealer ace over a seven: no natural, so the hand plays on after the peek.
    useGameStore.setState({ game: stackedGame(openingOrder(['10S', '6H'], ['AD', '7C'])) })
    useGameStore.getState().addChip(25)
    useGameStore.getState().dealRound()
    await vi.runAllTimersAsync()
    return useGameStore.getState().game
  }

  it('asks when the dealer shows an ace, by default', async () => {
    expect(DEFAULT_SETTINGS.offerInsurance).toBe(true)
    const game = await dealAgainstAnAce(true)
    expect(game.round.phase).toBe('insurance')
  })

  it('declines without asking when the player has said never to', async () => {
    const game = await dealAgainstAnAce(false)
    expect(game.round.phase).toBe('playerTurn')
    expect(game.round.insuranceBet).toBe(0)
    expect(game.round.insuranceSettled).toBe(true)
  })

  it('arrives switched on for a profile saved before the option existed', () => {
    const { offerInsurance: _, ...old } = DEFAULT_SETTINGS
    expect(migrateSettings(old).offerInsurance).toBe(true)
  })
})
