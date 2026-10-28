import { clampStartingBankroll } from './stake'

/**
 * A seat at one of the newer tables: baccarat, roulette and Ultimate Texas
 * Hold'em.
 *
 * Each keeps its own bankroll, runs and statistics, for the same reason
 * blackjack and craps do — a roulette session and a baccarat shoe are not the
 * same game and should never be averaged into one number. What they share is
 * the bookkeeping around the rack: a run starts when you sit down with a stake,
 * ends when you buy back in or choose a new one, and is filed with its peak.
 * That much is written once, here.
 */

export interface SeatSettingsBase {
  /** What a buy-back-in is worth. The player's call, not the pit's. */
  startingBankroll: number
}

export interface SeatRun {
  id: string
  startedAt: number
  endedAt: number
  peakBankroll: number
  rounds: number
}

export interface SeatProfile<Stats, Settings extends SeatSettingsBase, Entry> {
  version: number
  displayName: string
  bankroll: number
  /** Highest the rack has stood this run, chips on the felt included. */
  peakBankroll: number
  allTimePeak: number
  runStartedAt: number
  /** Coups, spins or hands played this run. */
  runRounds: number
  stats: Stats
  settings: Settings
  history: Entry[]
  runs: SeatRun[]
}

// The helpers below only touch the fields every seat has, so they accept any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySeat = SeatProfile<any, SeatSettingsBase, any>

export function createSeatProfile<Stats, Settings extends SeatSettingsBase, Entry>(
  version: number,
  startingBankroll: number,
  stats: Stats,
  settings: Settings,
): SeatProfile<Stats, Settings, Entry> {
  return {
    version,
    displayName: 'Guest',
    bankroll: startingBankroll,
    peakBankroll: startingBankroll,
    allTimePeak: startingBankroll,
    runStartedAt: Date.now(),
    runRounds: 0,
    stats: { ...stats },
    // The rack you start with is also the rack you buy back in for, until you
    // say otherwise.
    settings: { ...settings, startingBankroll },
    history: [],
    runs: [],
  }
}

/** After a round: the rack as it now stands, and the peak it may have set. */
export function afterRound<P extends AnySeat>(profile: P, bankroll: number, equity = bankroll): P {
  const peak = Math.max(profile.peakBankroll, equity)
  return { ...profile, bankroll, peakBankroll: peak, allTimePeak: Math.max(profile.allTimePeak, peak), runRounds: profile.runRounds + 1 }
}

/** Close the run under way, filed with its peak, and start another with the chosen buy-in. */
export function restartRun<P extends AnySeat>(profile: P): P {
  const stake = clampStartingBankroll(profile.settings.startingBankroll)
  return {
    ...profile,
    bankroll: stake,
    peakBankroll: stake,
    allTimePeak: Math.max(profile.allTimePeak, profile.peakBankroll),
    runStartedAt: Date.now(),
    runRounds: 0,
    runs: [
      {
        id: `${profile.runStartedAt}`,
        startedAt: profile.runStartedAt,
        endedAt: Date.now(),
        peakBankroll: profile.peakBankroll,
        rounds: profile.runRounds,
      },
      ...profile.runs,
    ].slice(0, 50),
  }
}

/**
 * The lobby's buy-in, before anything has been played: nothing is being
 * rewritten, so the run simply starts with what the player brought — which is
 * also what a buy-back-in hands them until they say otherwise.
 */
export function openingStake<P extends AnySeat>(profile: P, amount: number): P {
  const stake = clampStartingBankroll(amount)
  return {
    ...profile,
    bankroll: stake,
    peakBankroll: stake,
    allTimePeak: stake,
    runStartedAt: Date.now(),
    settings: { ...profile.settings, startingBankroll: stake },
  }
}

export function withSettings<P extends AnySeat>(profile: P, patch: Partial<P['settings']>): P {
  const settings = { ...profile.settings, ...patch }
  // Clamped here rather than at the input, so nothing can seat a rack the
  // table would refuse.
  settings.startingBankroll = clampStartingBankroll(settings.startingBankroll)
  return { ...profile, settings }
}

export function withName<P extends AnySeat>(profile: P, name: string): P {
  return { ...profile, displayName: name.trim().slice(0, 24) || 'Guest' }
}

/**
 * Erase the record and keep the preferences — including the stake the player
 * chose to sit down with, or erasing your history would rewrite your settings.
 */
export function erased<P extends AnySeat>(profile: P, fresh: (startingBankroll: number) => P): P {
  const { settings } = profile
  return { ...fresh(clampStartingBankroll(settings.startingBankroll)), settings: { ...settings }, displayName: profile.displayName }
}

/**
 * The seat's profile in local storage. A version bump means the shape changed,
 * so an old profile starts clean rather than crash half-migrated; settings
 * added since a profile was saved come back at their defaults.
 */
export class SeatStorage<P extends AnySeat> {
  private readonly key: string
  private readonly version: number
  private readonly defaults: P['settings']

  constructor(key: string, version: number, defaults: P['settings']) {
    this.key = key
    this.version = version
    this.defaults = defaults
  }

  load(): P | null {
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return null
      const stored = JSON.parse(raw) as P
      if (stored.version !== this.version) return null
      return { ...stored, settings: { ...this.defaults, ...stored.settings } }
    } catch {
      return null
    }
  }

  save(profile: P): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(profile))
    } catch {
      // History is by far the biggest field. Losing it beats losing the bankroll.
      try {
        localStorage.setItem(this.key, JSON.stringify({ ...profile, history: profile.history.slice(0, 25) }))
      } catch {
        // Storage is blocked or full; the table plays on regardless.
      }
    }
  }
}

/** Timers for one table, at module level so a hot reload cannot orphan a pending settle. */
export function timerSet() {
  let timers: ReturnType<typeof setTimeout>[] = []
  return {
    schedule(fn: () => void, ms: number) {
      timers.push(setTimeout(fn, ms))
    },
    clear() {
      timers.forEach(clearTimeout)
      timers = []
    },
  }
}
