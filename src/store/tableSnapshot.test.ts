import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Closing the app with chips on the felt. Every table comes back as it was
 * left, with the rack beside it what it held; anything already decided when
 * the app closed (dice thrown, a coup dealt, a ball spinning, a hold'em hand
 * raised or folded) is paid on the spot, once and only once; and opening the
 * app again after a hand is paid never pays it a second time.
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

/** The floor as a page load finds it; pass the storage of an earlier load to open the app again. */
async function open(local = storage()) {
  vi.resetModules()
  vi.stubGlobal('localStorage', local)
  const { useGameStore } = await import('./gameStore')
  const { useCrapsStore } = await import('./crapsStore')
  const { useBaccaratStore } = await import('./baccaratStore')
  const { useRouletteStore } = await import('./rouletteStore')
  const { useUthStore } = await import('./uthStore')
  const { setSharedBankroll } = await import('./racks')
  await Promise.all([
    useGameStore.getState().init(),
    useCrapsStore.getState().init(),
    useBaccaratStore.getState().init(),
    useRouletteStore.getState().init(),
    useUthStore.getState().init(),
  ])
  return { local, useGameStore, useCrapsStore, useBaccaratStore, useRouletteStore, useUthStore, setSharedBankroll }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the snapshot itself', () => {
  it('belongs to one run and one shape of the state', async () => {
    vi.stubGlobal('localStorage', storage())
    const { tableSnapshot } = await import('./tableSnapshot')
    const felt = tableSnapshot<{ chips: number }>('test:felt', 2)
    felt.save(100, { chips: 25 })
    expect(felt.load(100)).toEqual({ chips: 25 })
    expect(felt.load(200)).toBeNull()
    expect(tableSnapshot('test:felt', 1).load(100)).toBeNull()
  })

  it('reads nothing from a missing or garbled entry', async () => {
    const local = storage()
    vi.stubGlobal('localStorage', local)
    const { tableSnapshot } = await import('./tableSnapshot')
    const felt = tableSnapshot('test:felt', 1)
    expect(felt.load(1)).toBeNull()
    local.setItem('test:felt', '{not json')
    expect(felt.load(1)).toBeNull()
  })

  it('drops the old snapshot rather than keep one that trails the table', async () => {
    const local = storage()
    vi.stubGlobal('localStorage', local)
    const { tableSnapshot } = await import('./tableSnapshot')
    const felt = tableSnapshot<{ chips: number }>('test:felt', 1)
    felt.save(1, { chips: 25 })
    local.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    felt.save(1, { chips: 50 })
    expect(felt.load(1)).toBeNull()
  })
})

describe('craps: closing with chips down', () => {
  it('keeps a bet that has not been rolled on', async () => {
    const first = await open()
    first.useCrapsStore.getState().placeAt('passLine')
    const amount = first.useCrapsStore.getState().game.bets.passLine.amount
    expect(amount).toBeGreaterThan(0)

    const { useCrapsStore } = await open(first.local)
    const { game, profile } = useCrapsStore.getState()
    expect(game.bets.passLine?.amount).toBe(amount)
    expect(game.bankroll).toBe(1_000 - amount)
    expect(profile.bankroll).toBe(1_000 - amount)
  })

  it('keeps the point, the puck and the pass line once a point is up', async () => {
    const first = await open()
    const craps = first.useCrapsStore
    for (let i = 0; i < 100 && craps.getState().game.point === null; i++) {
      if (!craps.getState().game.bets.passLine) craps.getState().placeAt('passLine')
      craps.getState().roll()
      vi.runAllTimers()
    }
    const before = craps.getState()
    expect(before.game.point).not.toBeNull()

    const { useCrapsStore } = await open(first.local)
    const after = useCrapsStore.getState()
    expect(after.game.point).toBe(before.game.point)
    expect(after.game.bets).toEqual(before.game.bets)
    expect(after.game.bankroll).toBe(before.game.bankroll)
    expect(after.profile.stats.rolls).toBe(before.profile.stats.rolls)
  })

  it('settles dice thrown before the close, once', async () => {
    const first = await open()
    first.useCrapsStore.getState().placeAt('passLine')
    first.useCrapsStore.getState().roll()
    expect(first.useCrapsStore.getState().game.phase).toBe('rolling')

    const second = await open(first.local)
    const settled = second.useCrapsStore.getState()
    expect(settled.game.phase).toBe('betting')
    expect(settled.profile.stats.rolls).toBe(1)
    expect(settled.lastThrow).not.toBeNull()

    const third = await open(first.local)
    const again = third.useCrapsStore.getState()
    expect(again.profile.stats.rolls).toBe(1)
    expect(again.game.bankroll).toBe(settled.game.bankroll)
    expect(again.game.bets).toEqual(settled.game.bets)
  })
})

describe('baccarat: closing with chips down', () => {
  it('keeps a bet that has not been dealt on', async () => {
    const first = await open()
    first.useBaccaratStore.getState().placeAt('banker')
    const amount = first.useBaccaratStore.getState().game.bets.banker ?? 0
    expect(amount).toBeGreaterThan(0)

    const { useBaccaratStore } = await open(first.local)
    const { game, profile } = useBaccaratStore.getState()
    expect(game.bets.banker).toBe(amount)
    expect(game.bankroll).toBe(1_000 - amount)
    expect(profile.bankroll).toBe(1_000 - amount)
  })

  it('pays a coup dealt before the close, once', async () => {
    const first = await open()
    first.useBaccaratStore.getState().placeAt('banker')
    first.useBaccaratStore.getState().deal()
    const dealt = first.useBaccaratStore.getState().game
    expect(dealt.phase).toBe('dealt')

    const second = await open(first.local)
    const paid = second.useBaccaratStore.getState()
    expect(paid.game.phase).toBe('settled')
    expect(paid.game.coup).toEqual(dealt.coup)
    expect(paid.profile.stats.coups).toBe(1)
    expect(paid.profile.bankroll).toBe(paid.game.bankroll)
    expect(paid.profile.bankroll).toBe(dealt.bankroll + paid.game.resolutions.reduce((sum, r) => sum + (r.effect === 'lose' ? 0 : r.stake + r.net), 0))

    const third = await open(first.local)
    expect(third.useBaccaratStore.getState().profile.stats.coups).toBe(1)
    expect(third.useBaccaratStore.getState().game.bankroll).toBe(paid.game.bankroll)
  })
})

describe('roulette: closing with chips down', () => {
  it('keeps the layout as it was bet', async () => {
    const first = await open()
    first.useRouletteStore.getState().placeAt('red')
    first.useRouletteStore.getState().placeAt('dozen:2')
    const before = first.useRouletteStore.getState().game

    const { useRouletteStore } = await open(first.local)
    const { game, profile } = useRouletteStore.getState()
    expect(game.bets).toEqual(before.bets)
    expect(game.bankroll).toBe(before.bankroll)
    expect(profile.bankroll).toBe(before.bankroll)
  })

  it('brings a spinning ball to rest, once', async () => {
    const first = await open()
    first.useRouletteStore.getState().placeAt('red')
    first.useRouletteStore.getState().spin()
    expect(first.useRouletteStore.getState().game.phase).toBe('spinning')

    const second = await open(first.local)
    const paid = second.useRouletteStore.getState()
    expect(paid.game.phase).toBe('settled')
    expect(paid.profile.stats.spins).toBe(1)
    expect(paid.profile.bankroll).toBe(paid.game.bankroll)

    const third = await open(first.local)
    expect(third.useRouletteStore.getState().profile.stats.spins).toBe(1)
    expect(third.useRouletteStore.getState().game.bankroll).toBe(paid.game.bankroll)
  })
})

describe("hold'em: closing mid-hand", () => {
  async function dealt() {
    const first = await open()
    first.useUthStore.getState().placeAt('ante')
    first.useUthStore.getState().deal()
    expect(first.useUthStore.getState().game.phase).toBe('preflop')
    return first
  }

  it('brings back the hand as dealt, cards and circles', async () => {
    const first = await dealt()
    const before = first.useUthStore.getState().game

    const { useUthStore } = await open(first.local)
    const { game, profile, boardShown } = useUthStore.getState()
    expect(game.phase).toBe('preflop')
    expect(game.player).toEqual(before.player)
    expect(game.board).toEqual(before.board)
    expect(game.bets).toEqual(before.bets)
    expect(profile.bankroll).toBe(before.bankroll)
    expect(boardShown).toBe(0)
  })

  it('keeps the flop face up after a check', async () => {
    const first = await dealt()
    first.useUthStore.getState().decide('check')

    const { useUthStore } = await open(first.local)
    expect(useUthStore.getState().game.phase).toBe('flop')
    expect(useUthStore.getState().boardShown).toBe(3)
    expect(useUthStore.getState().calls).toHaveLength(1)
  })

  it('pays a hand raised before the close, once, with its decisions graded', async () => {
    const first = await dealt()
    first.useUthStore.getState().decide('bet4')
    const raised = first.useUthStore.getState().game
    expect(raised.phase).toBe('reveal')

    const second = await open(first.local)
    const paid = second.useUthStore.getState()
    expect(paid.game.phase).toBe('showdown')
    expect(paid.profile.stats.hands).toBe(1)
    expect(paid.profile.stats.raisedPreflop).toBe(1)
    expect(paid.profile.stats.decisions).toBe(1)
    expect(paid.profile.bankroll).toBe(paid.game.bankroll)
    expect(paid.lastHand?.street).toBe('preflop')
    expect(paid.boardShown).toBe(5)
    expect(paid.dealerShown).toBe(true)

    const third = await open(first.local)
    expect(third.useUthStore.getState().profile.stats.hands).toBe(1)
    expect(third.useUthStore.getState().game.bankroll).toBe(paid.game.bankroll)
  })
})

describe('blackjack: closing mid-hand', () => {
  type Floor = Awaited<ReturnType<typeof open>>

  async function dealt() {
    const first = await open()
    const bet = first.useGameStore.getState().table().minBet
    first.useGameStore.getState().addChip(bet)
    first.useGameStore.getState().dealRound()
    return { first, bet }
  }

  /** A hand dealt and waiting on the player, dealing again past any natural. */
  async function awaitingPlayer() {
    for (let i = 0; i < 30; i++) {
      const { first, bet } = await dealt()
      vi.runAllTimers()
      const store = first.useGameStore
      if (store.getState().game.round.phase === 'insurance') {
        store.getState().act('declineInsurance')
        vi.runAllTimers()
      }
      if (store.getState().game.round.phase === 'playerTurn') return { first, bet }
    }
    throw new Error('Thirty deals without a hand to play')
  }

  /** Answer insurance and stand until the hand is paid. */
  function standOut(store: Floor['useGameStore']) {
    for (let i = 0; i < 20 && store.getState().game.round.phase !== 'roundOver'; i++) {
      const { phase } = store.getState().game.round
      if (phase === 'insurance') store.getState().act('declineInsurance')
      if (phase === 'playerTurn') store.getState().act('stand', true)
      vi.runAllTimers()
    }
    expect(store.getState().game.round.phase).toBe('roundOver')
  }

  it('no longer hands the wager back: the hand comes back as dealt', async () => {
    const { first, bet } = await awaitingPlayer()
    const before = first.useGameStore.getState().game

    const { useGameStore } = await open(first.local)
    const { game, profile } = useGameStore.getState()
    expect(game.round.phase).toBe('playerTurn')
    expect(game.round.hands).toEqual(before.round.hands)
    expect(game.round.dealer).toEqual(before.round.dealer)
    expect(game.bankroll).toBe(1_000 - bet)
    // The profile holds the rack from before the deal all through a hand, as it does in play.
    expect(profile.bankroll).toBe(1_000)

    standOut(useGameStore)
    const paid = useGameStore.getState().profile
    expect(paid.stats.roundsPlayed).toBe(1)
    expect(paid.history[0].net).toBe(paid.bankroll - 1_000)
  })

  it('finishes a deal cut short by the close, and pays the hand against what it staked', async () => {
    const { first, bet } = await dealt()
    expect(first.useGameStore.getState().game.round.phase).toBe('dealing')

    const { useGameStore } = await open(first.local)
    expect(useGameStore.getState().game.round.phase).not.toBe('dealing')
    standOut(useGameStore)
    const { profile } = useGameStore.getState()
    expect(profile.stats.roundsPlayed).toBe(1)
    expect(profile.history[0].net).toBe(profile.bankroll - 1_000)
    expect(Math.abs(profile.history[0].net)).toBeLessThanOrEqual(bet * 2)
  })

  it('does not pay a finished hand again', async () => {
    const { first } = await dealt()
    standOut(first.useGameStore)
    const paid = first.useGameStore.getState().profile

    const { useGameStore } = await open(first.local)
    expect(useGameStore.getState().game.round.phase).toBe('betting')
    expect(useGameStore.getState().profile.stats.roundsPlayed).toBe(paid.stats.roundsPlayed)
    expect(useGameStore.getState().game.bankroll).toBe(paid.bankroll)
  })

  it('splits a restored hand without reusing a hand id', async () => {
    const { first } = await awaitingPlayer()

    const { useGameStore } = await open(first.local)
    const restored = useGameStore.getState().game
    // A pair in the hand, whatever was dealt, so it can be split.
    const [card] = restored.round.hands[0].cards
    const hand = { ...restored.round.hands[0], cards: [card, { ...card, id: `${card.id}-twin` }] }
    useGameStore.setState({ game: { ...restored, round: { ...restored.round, hands: [hand] } } })
    useGameStore.getState().act('split', true)

    const ids = useGameStore.getState().game.round.hands.map((h) => h.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('one bankroll for every table', () => {
  it('keeps the bet and the shared figure in step across a close', async () => {
    const first = await open()
    first.setSharedBankroll(true)
    first.useRouletteStore.getState().placeAt('red')
    const rack = first.useRouletteStore.getState().game.bankroll

    const second = await open(first.local)
    expect(second.useRouletteStore.getState().game.bets).toEqual(first.useRouletteStore.getState().game.bets)
    for (const store of [second.useGameStore, second.useCrapsStore, second.useBaccaratStore, second.useRouletteStore, second.useUthStore]) {
      expect(store.getState().game.bankroll).toBe(rack)
    }
  })
})
