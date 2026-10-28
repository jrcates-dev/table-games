import { useMemo } from 'react'
import { create } from 'zustand'
import { play } from '../audio'
import * as craps from '../engine/craps/craps'
import {
  CRAPS_STARTING_BANKROLL,
  crapsTableById,
  limitsFor,
  type CrapsTable,
} from '../engine/craps/rules'
import type { BetKind, CrapsState } from '../engine/craps/types'
import { randomSeed } from '../engine/rng'
import {
  createCrapsProfile,
  MAX_CRAPS_HISTORY,
  type CrapsProfile,
  type CrapsSettings,
  type CrapsStats,
  type ShootRecord,
} from './crapsProfile'
import {
  LocalCrapsAdapter,
  type CrapsLeaderboardEntry,
  type CrapsStorageAdapter,
} from './crapsStorage'
import { clampStartingBankroll } from './stake'

/**
 * How long the dice are in the air.
 *
 * The engine has already decided the result before the first frame of the
 * throw — this is purely how long the renderer gets to sell it. Long enough to
 * read as a real throw against the back wall, short enough that a hot shooter
 * is not waiting on an animation.
 */
/** How many steps back the felt remembers. Far more than anyone reaches for. */
const MAX_UNDO = 50

export const ROLL_DURATION: Record<CrapsSettings['rollSpeed'], number> = {
  relaxed: 2_500,
  normal: 1_950,
  fast: 1_250,
  // A flick rather than a throw: the dice are down almost before you have let
  // go of them. For anyone playing for the numbers rather than the theatre.
  instant: 220,
}

/**
 * What a click on a box number does.
 *
 * `odds` is the odd one out: it does not make a new bet on the number, it backs
 * a come bet that has already travelled there. It belongs here anyway, because
 * on a real table all four are the same sentence — you tell the dealer which
 * one you mean and the chips go in the same box.
 */
export type NumberMode = 'place' | 'buy' | 'lay' | 'odds'

interface CrapsStore {
  game: CrapsState
  profile: CrapsProfile
  adapter: CrapsStorageAdapter
  ready: boolean
  /** Chip denomination currently in hand. */
  chip: number
  numberMode: NumberMode
  leaderboard: CrapsLeaderboardEntry[]
  /** Set briefly after a roll settles so the felt can flash the result. */
  lastNet: number | null
  /**
   * The last roll as thrown and as settled, kept until the next one lands so
   * it can be explained against the felt it actually met — not the felt after
   * the player has started betting again.
   */
  lastThrow: { before: CrapsState; after: CrapsState } | null
  /** Why the last attempted action was refused, for a transient hint. */
  notice: string | null
  /**
   * States to step back through, newest last.
   *
   * The engine never mutates, so a snapshot is just the state object we were
   * already holding — undo costs a push and a pop. It is emptied the instant
   * the dice leave the hand: stepping back over a settled roll would be undoing
   * a result, not a mistake.
   */
  undoStack: CrapsState[]

  init(): Promise<void>
  table(): CrapsTable
  setChip(value: number): void
  setNumberMode(mode: NumberMode): void
  placeAt(kind: BetKind, number?: number): void
  takeDown(id: string): void
  toggleWorking(id: string): void
  clearBets(): void
  undo(): void
  takeMaxOdds(target?: { kind: BetKind; number?: number }): void
  roll(): void
  selectTable(id: string): void
  updateSettings(patch: Partial<CrapsSettings>): void
  setDisplayName(name: string): void
  refreshLeaderboard(): Promise<void>
  rebuy(): void
  /** Choose the opening rack from the lobby, before the first roll. */
  chooseBankroll(amount: number): void
  /** Set the rack to this amount whatever is in play, closing a played run first. */
  resetRack(amount: number): void
  /**
   * Move the rack to the figure the floor shares, leaving the bets on the felt
   * where they are. Saved only when asked: while the bankroll is shared, the
   * floor keeps the figure.
   */
  matchRack(amount: number, save?: boolean): void
  dismissNotice(): void
  resetEverything(): void
}

let initialising: Promise<void> | null = null

/** Module-level so a hot reload cannot orphan a pending settle. */
let timers: ReturnType<typeof setTimeout>[] = []
function schedule(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

function newGame(profile: CrapsProfile): CrapsState {
  return craps.createGame(profile.bankroll, randomSeed(), limitsFor(crapsTableById(profile.tableId)))
}

/** Why a bet will not come down, and what to do instead. */
function contractReason(kind: BetKind): string {
  if (kind === 'passLine') return 'The line is a contract once a point is up — undo if you just placed it'
  if (kind === 'come' || kind === 'comePoint') {
    return 'A come bet is a contract and stays until it resolves — undo if you just placed it'
  }
  return 'That bet cannot come down — undo if you just placed it'
}

/** A roll worth this many table minimums gets the coin shower. */
export const BIG_WIN_MINIMUMS = 25

export const useCrapsStore = create<CrapsStore>((set, get) => {
  const persist = () => {
    const { adapter, profile } = get()
    void adapter.save(profile)
  }

  /**
   * Fold a settled roll into the profile.
   *
   * A shoot is only filed into history when it ends, which is why the engine
   * hands back `finishedShoot` on exactly the roll that ends it — reading
   * `shoot` after the fact would find it already reset for the next shooter.
   */
  const record = (before: CrapsState, after: CrapsState) => {
    const { profile } = get()
    const net = after.resolutions.reduce((sum, r) => sum + r.net, 0)
    const wagered = after.resolutions
      .filter((r) => r.effect === 'win' || r.effect === 'lose')
      .reduce((sum, r) => sum + r.stake, 0)

    const stats: CrapsStats = { ...profile.stats }
    stats.rolls += 1
    stats.totalWagered += wagered
    stats.netResult += net
    stats.biggestWin = Math.max(stats.biggestWin, net)
    stats.biggestLoss = Math.min(stats.biggestLoss, net)

    const note = after.finishedShoot
      ? after.finishedShoot.log[after.finishedShoot.log.length - 1]?.note
      : after.shoot.log[after.shoot.log.length - 1]?.note
    if (note === 'pointMade') stats.pointsMade += 1
    if (note === 'natural') stats.naturals += 1
    if (note === 'craps') stats.crapsRolled += 1

    for (const r of after.resolutions) {
      if (r.effect !== 'win') continue
      if (r.betId === 'fire') stats.fireBetsWon += 1
      if (r.betId === 'small' || r.betId === 'tall' || r.betId === 'all') stats.bonusBetsWon += 1
    }

    let history = profile.history
    const done = after.finishedShoot
    if (done) {
      stats.shoots += 1
      stats.sevenOuts += 1
      stats.longestRoll = Math.max(stats.longestRoll, done.rolls)
      stats.mostPointsInAShoot = Math.max(stats.mostPointsInAShoot, done.firePoints.length)
      const shootNet = done.log.reduce((sum, entry) => sum + entry.net, 0)
      stats.bestShootNet = Math.max(stats.bestShootNet, shootNet)

      const entry: ShootRecord = {
        id: `${Date.now()}-${before.shootNumber}`,
        timestamp: Date.now(),
        tableId: profile.tableId,
        shootNumber: before.shootNumber,
        rolls: done.log,
        pointsMade: done.firePoints,
        net: shootNet,
        bankrollAfter: after.bankroll,
      }
      history = [entry, ...history].slice(0, MAX_CRAPS_HISTORY)
    }

    // Peak counts the chips on the felt too, or laying a big don't bet would
    // read as going broke.
    const equity = after.bankroll + craps.totalAtRisk(after)
    const peak = Math.max(profile.peakBankroll, equity)

    set({
      lastNet: net,
      profile: {
        ...profile,
        bankroll: after.bankroll,
        peakBankroll: peak,
        allTimePeak: Math.max(profile.allTimePeak, peak),
        runShoots: profile.runShoots + (done ? 1 : 0),
        stats,
        history,
      },
    })

    persist()
  }

  /** Sync the bankroll back into the profile after chips move on or off the felt. */
  const syncBankroll = (game: CrapsState) => {
    const { profile } = get()
    set({ game, profile: { ...profile, bankroll: game.bankroll } })
  }

  const refuse = (reason?: string) => {
    if (reason) set({ notice: reason })
  }

  /** Remember the felt as it was, before changing it. */
  const remember = () => {
    const { undoStack, game } = get()
    set({ undoStack: [...undoStack, game].slice(-MAX_UNDO) })
  }

  return {
    game: craps.createGame(
      CRAPS_STARTING_BANKROLL,
      1,
      limitsFor(crapsTableById('main')),
    ),
    profile: createCrapsProfile(CRAPS_STARTING_BANKROLL),
    adapter: new LocalCrapsAdapter(),
    ready: false,
    chip: 5,
    numberMode: 'place',
    leaderboard: [],
    lastNet: null,
    lastThrow: null,
    notice: null,
    undoStack: [],

    async init() {
      // Once per page, so leaving for the lobby never clears the felt.
      initialising ??= (async () => {
        const adapter = new LocalCrapsAdapter()
        const stored = await adapter.load()
        const profile = stored ?? createCrapsProfile(CRAPS_STARTING_BANKROLL)
        set({ adapter, profile, ready: true, game: newGame(profile), undoStack: [] })
        void get().refreshLeaderboard()
      })()
      return initialising
    },

    table() {
      return crapsTableById(get().profile.tableId)
    },

    setChip(value) {
      play('click')
      set({ chip: value })
    },

    setNumberMode(mode) {
      play('click')
      set({ numberMode: mode })
    },

    /**
     * Put the chip in hand onto a spot.
     *
     * The engine decides whether that is legal and by how much, so the felt
     * never has to reimplement a rule — a click on a spot that will not take a
     * bet comes back with the dealer's reason, which is what gets shown.
     */
    placeAt(kind, number) {
      const { game, chip } = get()
      const check = craps.canPlace(game, kind, number)
      if (!check.ok) return refuse(check.reason)

      // A brand new bet arrives at least at its minimum, so a single click on
      // the six puts $12 up rather than a $5 chip the dealer would refuse.
      const existing = game.bets[craps.betId(kind, number)]
      const wanted = existing ? chip : Math.max(chip, craps.minFor(game, kind, number))

      const next = craps.placeBet(game, kind, wanted, number)
      if (next === game) return refuse('Not enough in the rack')
      remember()
      play('chip')
      syncBankroll({ ...next, resolutions: game.resolutions })
      set({ notice: null })
      persist()
    },

    takeDown(id) {
      const { game } = get()
      const bet = game.bets[id]
      if (!bet) return
      if (!craps.canRemove(bet, game.point)) return refuse(contractReason(bet.kind))
      remember()
      play('click')
      syncBankroll(craps.removeBet(game, id))
      persist()
    },

    toggleWorking(id) {
      const { game } = get()
      const bet = game.bets[id]
      if (!bet || !craps.canToggleWorking(bet)) return
      remember()
      play('click')
      set({ game: craps.toggleWorking(game, id) })
    },

    clearBets() {
      const { game } = get()
      remember()
      play('click')
      syncBankroll(craps.clearBets(game))
      persist()
    },

    /**
     * Back every flat bet with the most odds the table allows.
     *
     * Odds are the only wager in the building with no house edge, and taking
     * them one spot at a time is fiddly enough that new players simply never
     * do. One button is the difference between playing craps at 1.41% and
     * playing it at 0.37%.
     */
    takeMaxOdds(target) {
      const { game } = get()
      let next = game
      const behind = target ? [target] : craps.oddsTargets(game)

      for (const { kind, number } of behind) {
        // Re-checked against `next` rather than `game`: each bet placed eats
        // into the bankroll the following one has to come out of.
        const max = craps.maxFor(next, kind, number)
        if (max > 0 && craps.canPlace(next, kind, number).ok) {
          next = craps.placeBet(next, kind, max, number)
        }
      }

      if (next === game) return refuse('Nothing to back with odds yet')
      remember()
      play('chip')
      syncBankroll(next)
      persist()
    },

    /**
     * Step the felt back one action.
     *
     * Only ever reaches back through betting. A contract bet — a come bet, the
     * line once a point is up — cannot be taken down by the rules, but putting
     * one down by accident is still a mistake, and this is the honest way to
     * fix that without pretending the rule does not exist.
     */
    undo() {
      const { undoStack, profile, game } = get()
      if (undoStack.length === 0 || game.phase !== 'betting') return
      const previous = undoStack[undoStack.length - 1]
      play('click')
      set({
        undoStack: undoStack.slice(0, -1),
        game: previous,
        profile: { ...profile, bankroll: previous.bankroll },
        notice: null,
      })
      persist()
    },

    roll() {
      const { game, profile } = get()
      const check = craps.canRoll(game)
      if (!check.ok) return refuse(check.reason)

      clearTimers()
      const thrown = craps.rollDice(game)
      // Once the dice are out, everything before them is history rather than a
      // mistake to take back.
      // No sound here: the dice make their own, one per collision, from the
      // physics that throws them.
      set({ game: thrown, lastNet: null, notice: null, undoStack: [] })

      // The dice have already landed as far as the engine is concerned; this is
      // the renderer catching up.
      schedule(() => {
        const before = get().game
        const settled = craps.settle(before)
        set({ game: settled, lastThrow: { before, after: settled } })
        record(thrown, settled)
      }, ROLL_DURATION[profile.settings.rollSpeed])
    },

    selectTable(id) {
      const { game, profile } = get()
      if (Object.keys(game.bets).length > 0) return refuse('Clear the felt before changing tables')
      const table = crapsTableById(id)
      if (profile.peakBankroll < table.requiredBankroll) return
      play('click')
      set({
        profile: { ...profile, tableId: id },
        game: { ...game, limits: limitsFor(table) },
        undoStack: [],
      })
      persist()
    },

    updateSettings(patch) {
      const { profile } = get()
      const settings = { ...profile.settings, ...patch }
      // Clamped here rather than at the input, so a value typed into the field,
      // pasted in, or set by a future control can never put a rack on the felt
      // that the table would refuse to seat.
      settings.startingBankroll = clampStartingBankroll(settings.startingBankroll)
      set({ profile: { ...profile, settings } })
      persist()
    },

    setDisplayName(name) {
      const trimmed = name.trim().slice(0, 24) || 'Guest'
      set({ profile: { ...get().profile, displayName: trimmed } })
      persist()
    },

    async refreshLeaderboard() {
      try {
        set({ leaderboard: await get().adapter.leaderboard(25) })
      } catch {
        set({ leaderboard: [] })
      }
    },

    rebuy() {
      clearTimers()
      const { profile, adapter } = get()
      void adapter.submitRun(profile)

      // Whatever the player said they wanted to sit down with, not what the
      // house hands out.
      const stake = clampStartingBankroll(profile.settings.startingBankroll)
      const next: CrapsProfile = {
        ...profile,
        bankroll: stake,
        peakBankroll: stake,
        allTimePeak: Math.max(profile.allTimePeak, profile.peakBankroll),
        tableId: 'main',
        runStartedAt: Date.now(),
        runShoots: 0,
        runs: [
          {
            id: `${profile.runStartedAt}`,
            startedAt: profile.runStartedAt,
            endedAt: Date.now(),
            peakBankroll: profile.peakBankroll,
            shoots: profile.runShoots,
            longestRoll: profile.stats.longestRoll,
          },
          ...profile.runs,
        ].slice(0, 50),
      }
      set({ profile: next, game: newGame(next), lastNet: null, lastThrow: null, notice: null, undoStack: [] })
      persist()
      void get().refreshLeaderboard()
    },

    chooseBankroll(amount) {
      const state = get()
      if (!selectCanChooseCrapsBankroll(state)) return
      // The lobby field commits on blur, so leaving it untouched hands back the
      // rack as it stands; that must not end a run.
      if (amount === state.profile.bankroll) return
      get().resetRack(amount)
    },

    resetRack(amount) {
      const state = get()
      const stake = clampStartingBankroll(amount)
      if (state.profile.stats.rolls > 0) {
        // A table that has seen a roll has a run to account for. It closes the
        // way busting out does, archived with its peak, and the new run starts
        // with the amount chosen, which is also what later buy-backs hand out.
        set({ profile: { ...state.profile, settings: { ...state.profile.settings, startingBankroll: stake } } })
        get().rebuy()
        return
      }
      // Nothing has been rolled, so nothing is being rewritten: the run simply
      // starts with what the player brought, which is also what a buy-back-in
      // hands them until they say otherwise in Settings.
      const profile: CrapsProfile = {
        ...state.profile,
        bankroll: stake,
        peakBankroll: stake,
        allTimePeak: stake,
        runStartedAt: Date.now(),
        settings: { ...state.profile.settings, startingBankroll: stake },
      }
      // Anything already set out on the felt goes back in the rack first, and
      // dice still in the air never land.
      clearTimers()
      set({ profile, game: newGame(profile), lastNet: null, lastThrow: null, notice: null, undoStack: [] })
      persist()
    },

    matchRack(amount, save = false) {
      const { game, profile } = get()
      const shift = amount - game.bankroll
      if (shift !== 0) {
        // The steps back would restore racks from before the move, so they go.
        set({ game: { ...game, bankroll: amount }, profile: { ...profile, bankroll: profile.bankroll + shift }, undoStack: [] })
      }
      if (save) persist()
    },

    dismissNotice() {
      set({ notice: null })
    },

    resetEverything() {
      clearTimers()
      // Statistics, history and bankroll go; preferences are not a record of
      // anything and survive, including the stake the player chose to sit down
      // with — otherwise erasing your history silently rewrites your settings.
      const { settings } = get().profile
      const fresh = createCrapsProfile(clampStartingBankroll(settings.startingBankroll))
      const profile: CrapsProfile = { ...fresh, settings: { ...settings } }
      set({ profile, game: newGame(profile), lastNet: null, lastThrow: null, notice: null, undoStack: [] })
      persist()
    },
  }
})

/**
 * The lobby offers to set the rack whenever the dice are not in the air.
 * Before the first roll that is simply the opening stake; after it, choosing
 * again closes the current run and starts a new one.
 */
export const selectCanChooseCrapsBankroll = (s: CrapsStore) => s.ready && s.game.phase === 'betting'
/** Whether choosing a bankroll in the lobby would end a run already played. */
export const selectCrapsBankrollHasRun = (s: CrapsStore) => s.profile.stats.rolls > 0

/** Everything standing on the felt, plus what it would take to cover it. */
export function useCrapsEquity() {
  const game = useCrapsStore((s) => s.game)
  return useMemo(() => ({ atRisk: craps.totalAtRisk(game), equity: game.bankroll + craps.totalAtRisk(game) }), [game])
}

/**
 * Net result of all eleven possible next totals.
 *
 * Derived in a hook rather than a selector because it builds a fresh array on
 * every call, which a naive selector would turn into an infinite render loop —
 * the same trap the blackjack count fell into.
 */
export function useNextRoll() {
  const game = useCrapsStore((s) => s.game)
  return useMemo(() => (game.phase === 'betting' ? craps.nextRollOutcomes(game) : []), [game])
}
