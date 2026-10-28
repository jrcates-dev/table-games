import { create } from 'zustand'
import { play } from '../audio'
import { betById, betTitle } from '../engine/roulette/bets'
import * as rl from '../engine/roulette/roulette'
import { ROULETTE_LIMITS, ROULETTE_STARTING_BANKROLL, WHEEL_NAME } from '../engine/roulette/rules'
import type { RouletteState } from '../engine/roulette/types'
import { pocketColor, type Pocket, type WheelType } from '../engine/roulette/wheel'
import { randomSeed } from '../engine/rng'
import {
  afterRound,
  createSeatProfile,
  erased,
  openingStake,
  restartRun,
  SeatStorage,
  timerSet,
  withName,
  withSettings,
  type SeatProfile,
  type SeatSettingsBase,
} from './seat'

export interface RouletteStats {
  spins: number
  /** Spins that paid something back. */
  winningSpins: number
  straightUpHits: number
  reds: number
  blacks: number
  zeros: number
  totalWagered: number
  netResult: number
  biggestWin: number
  biggestLoss: number
}

const EMPTY_STATS: RouletteStats = {
  spins: 0,
  winningSpins: 0,
  straightUpHits: 0,
  reds: 0,
  blacks: 0,
  zeros: 0,
  totalWagered: 0,
  netResult: 0,
  biggestWin: 0,
  biggestLoss: 0,
}

export interface RouletteSettings extends SeatSettingsBase {
  spinSpeed: 'relaxed' | 'normal' | 'fast'
  wheel: WheelType
  showEdges: boolean
}

export const DEFAULT_ROULETTE_SETTINGS: RouletteSettings = {
  spinSpeed: 'normal',
  wheel: 'double',
  showEdges: true,
  startingBankroll: ROULETTE_STARTING_BANKROLL,
}

export interface SpinRecord {
  id: string
  timestamp: number
  wheel: WheelType
  result: Pocket
  bets: Array<{ id: string; amount: number; net: number }>
  staked: number
  net: number
}

export type RouletteProfile = SeatProfile<RouletteStats, RouletteSettings, SpinRecord>

const VERSION = 1
const MAX_HISTORY = 200
const storage = new SeatStorage<RouletteProfile>('cta:roulette:profile:v1', VERSION, DEFAULT_ROULETTE_SETTINGS)
const timers = timerSet()

/** Seconds from the ball leaving the dealer's hand to the ball at rest. */
export const SPIN_SECONDS: Record<RouletteSettings['spinSpeed'], number> = { relaxed: 7, normal: 5, fast: 2.8 }

/** The share of a spin the ball spends on the track before it drops. */
export const DROP_AT = 0.62

function freshProfile(startingBankroll: number): RouletteProfile {
  return createSeatProfile(VERSION, startingBankroll, EMPTY_STATS, DEFAULT_ROULETTE_SETTINGS)
}

function newGame(profile: RouletteProfile): RouletteState {
  const wheel = profile.settings.wheel
  return rl.createGame(profile.bankroll, randomSeed(), ROULETTE_LIMITS[wheel], wheel)
}

interface RouletteStore {
  game: RouletteState
  profile: RouletteProfile
  ready: boolean
  chip: number
  notice: string | null
  lastNet: number | null
  /** When the ball was launched, by the wall clock, and how long it runs. */
  spinStartedAt: number
  spinSeconds: number

  init(): Promise<void>
  setChip(value: number): void
  placeAt(id: string): void
  takeDown(id: string): void
  clearBets(): void
  doubleBets(): void
  rebet(): void
  spin(): void
  rebetAndSpin(): void
  setWheel(wheel: WheelType): void
  updateSettings(patch: Partial<RouletteSettings>): void
  setDisplayName(name: string): void
  rebuy(): void
  chooseBankroll(amount: number): void
  /** Set the rack to this amount whatever is in play, closing a played run first. */
  resetRack(amount: number): void
  /**
   * Move the rack to the figure the floor shares, leaving whatever is in play
   * where it is. Saved only when asked: while the bankroll is shared, the floor
   * keeps the figure.
   */
  matchRack(amount: number, save?: boolean): void
  dismissNotice(): void
  resetEverything(): void
}

let initialising: Promise<void> | null = null

export const useRouletteStore = create<RouletteStore>((set, get) => {
  const persist = () => storage.save(get().profile)
  const refuse = (reason?: string) => {
    if (reason) set({ notice: reason })
  }
  const sync = (game: RouletteState) => set({ game, profile: { ...get().profile, bankroll: game.bankroll } })

  const record = (settled: RouletteState) => {
    const { profile } = get()
    const result = settled.result!
    const net = rl.spinNet(settled)
    const staked = settled.resolutions.reduce((sum, r) => sum + r.stake, 0)
    const colour = pocketColor(result)
    const stats: RouletteStats = {
      ...profile.stats,
      spins: profile.stats.spins + 1,
      winningSpins: profile.stats.winningSpins + (settled.resolutions.some((r) => r.effect === 'win') ? 1 : 0),
      straightUpHits: profile.stats.straightUpHits + settled.resolutions.filter((r) => r.effect === 'win' && r.betId.startsWith('straight:')).length,
      reds: profile.stats.reds + (colour === 'red' ? 1 : 0),
      blacks: profile.stats.blacks + (colour === 'black' ? 1 : 0),
      zeros: profile.stats.zeros + (colour === 'green' ? 1 : 0),
      totalWagered: profile.stats.totalWagered + staked,
      netResult: profile.stats.netResult + net,
      biggestWin: Math.max(profile.stats.biggestWin, net),
      biggestLoss: Math.min(profile.stats.biggestLoss, net),
    }
    const entry: SpinRecord = {
      id: `${Date.now()}-${settled.seq}`,
      timestamp: Date.now(),
      wheel: settled.wheel,
      result,
      bets: settled.resolutions.map((r) => ({ id: r.betId, amount: r.stake, net: r.net })),
      staked,
      net,
    }
    set({
      lastNet: net,
      profile: { ...afterRound(profile, settled.bankroll), stats, history: [entry, ...profile.history].slice(0, MAX_HISTORY) },
    })
    persist()
  }

  return {
    game: rl.createGame(ROULETTE_STARTING_BANKROLL, 1, ROULETTE_LIMITS.double),
    profile: freshProfile(ROULETTE_STARTING_BANKROLL),
    ready: false,
    chip: 5,
    notice: null,
    lastNet: null,
    spinStartedAt: 0,
    spinSeconds: SPIN_SECONDS.normal,

    async init() {
      initialising ??= (async () => {
        const profile = storage.load() ?? freshProfile(ROULETTE_STARTING_BANKROLL)
        set({ profile, ready: true, game: newGame(profile), chip: profile.settings.wheel === 'single' ? 25 : 5 })
      })()
      return initialising
    },

    setChip(value) {
      play('click')
      set({ chip: value })
    },

    placeAt(id) {
      const { game, chip } = get()
      const check = rl.canPlace(game.phase === 'settled' ? rl.clearForNextSpin(game) : game, id)
      if (!check.ok) return refuse(check.reason)
      const next = rl.placeBet(game, id, chip)
      if (next === game) {
        const def = betById(game.wheel, id)
        return refuse(def && game.bankroll < game.limits.tableMin ? 'Not enough in the rack' : `Outside bets start at the $${game.limits.tableMin} minimum`)
      }
      play('chip')
      set({ notice: null, lastNet: null })
      sync(next)
      persist()
    },

    takeDown(id) {
      const { game } = get()
      if (game.phase === 'spinning') return refuse('No more bets — the ball is spinning')
      if (game.phase !== 'betting' || !game.bets[id]) return
      play('click')
      sync(rl.removeBet(game, id))
      persist()
    },

    /** Take everything back; once a spin is paid, clear the layout for new bets instead. */
    clearBets() {
      const { game } = get()
      const settled = game.phase === 'settled'
      if (!settled && (game.phase !== 'betting' || rl.totalOnLayout(game) === 0)) return
      play('chipSlide')
      if (settled) set({ notice: null, lastNet: null })
      sync(rl.clearBets(rl.clearForNextSpin(game)))
      persist()
    },

    doubleBets() {
      const { game } = get()
      if (game.phase !== 'betting' || rl.totalOnLayout(game) === 0) return
      const next = rl.doubleBets(game)
      if (next === game) return refuse('Not enough in the rack to double up')
      play('chipStack', { count: 5 })
      sync(next)
      persist()
    },

    rebet() {
      const { game } = get()
      const next = rl.rebet(game)
      if (next === game) return refuse(Object.keys(game.lastBets).length === 0 ? 'Nothing to rebet yet' : 'Not enough in the rack to rebet')
      play('chipStack', { count: 5 })
      set({ lastNet: null })
      sync(next)
      persist()
    },

    spin() {
      const { game, profile } = get()
      if (game.phase === 'settled') return get().rebetAndSpin()
      const check = rl.canSpin(game)
      if (!check.ok) return refuse(check.reason)
      timers.clear()
      const seconds = SPIN_SECONDS[profile.settings.spinSpeed]
      const spun = rl.spin(game)
      set({ game: spun, notice: null, lastNet: null, spinStartedAt: Date.now(), spinSeconds: seconds })
      play('ballRoll', { duration: seconds * DROP_AT })
      play('ballDrop', { at: seconds * DROP_AT, duration: seconds * (0.94 - DROP_AT) })
      timers.schedule(() => {
        const settled = rl.settle(get().game)
        play('puck')
        set({ game: settled })
        record(settled)
      }, seconds * 1000 + 250)
    },

    rebetAndSpin() {
      const { game } = get()
      if (game.phase !== 'settled') return
      const next = rl.rebet(game)
      if (next === game) return refuse('Not enough in the rack to rebet')
      play('chipStack', { count: 5 })
      sync(next)
      get().spin()
    },

    setWheel(wheel) {
      const { game, profile } = get()
      if (game.phase === 'spinning') return refuse('Wait for the ball to drop')
      if (wheel === game.wheel) return
      timers.clear()
      const next = rl.setWheel(game, wheel, ROULETTE_LIMITS[wheel])
      play('chipSlide')
      set({
        profile: withSettings(profile, { wheel }),
        chip: wheel === 'single' ? 25 : 5,
        lastNet: null,
        notice: `${WHEEL_NAME[wheel]} wheel — $${ROULETTE_LIMITS[wheel].tableMin} minimum`,
      })
      sync(next)
      persist()
    },

    updateSettings(patch) {
      if (patch.wheel && patch.wheel !== get().game.wheel) get().setWheel(patch.wheel)
      set({ profile: withSettings(get().profile, patch) })
      persist()
    },

    setDisplayName(name) {
      set({ profile: withName(get().profile, name) })
      persist()
    },

    rebuy() {
      timers.clear()
      const profile = restartRun(get().profile)
      set({ profile, game: newGame(profile), lastNet: null, notice: null })
      persist()
    },

    chooseBankroll(amount) {
      const state = get()
      if (!selectCanChooseRouletteBankroll(state) || amount === state.profile.bankroll) return
      get().resetRack(amount)
    },

    resetRack(amount) {
      const state = get()
      if (selectRouletteHasRun(state)) {
        set({ profile: withSettings(state.profile, { startingBankroll: amount }) })
        get().rebuy()
        return
      }
      timers.clear()
      const profile = openingStake(state.profile, amount)
      set({ profile, game: newGame(profile), lastNet: null, notice: null })
      persist()
    },

    matchRack(amount, save = false) {
      const { game, profile } = get()
      if (amount !== game.bankroll) {
        set({ game: { ...game, bankroll: amount }, profile: { ...profile, bankroll: profile.bankroll + amount - game.bankroll } })
      }
      if (save) persist()
    },

    dismissNotice() {
      set({ notice: null })
    },

    resetEverything() {
      timers.clear()
      const profile = erased(get().profile, freshProfile)
      set({ profile, game: newGame(profile), lastNet: null, notice: null })
      persist()
    },
  }
})

export const selectCanChooseRouletteBankroll = (s: RouletteStore) => s.ready && s.game.phase !== 'spinning'
export const selectRouletteHasRun = (s: RouletteStore) => s.profile.stats.spins > 0

/** Chips on the layout that are still the player's to lose. */
export function rouletteAtRisk(game: RouletteState): number {
  return game.phase === 'settled' ? 0 : rl.totalOnLayout(game)
}

/** "Split 17 / 20" for an id from the history, on whichever wheel it was bet. */
export function recordTitle(wheel: WheelType, id: string): string {
  const def = betById(wheel, id)
  return def ? betTitle(def) : id
}
