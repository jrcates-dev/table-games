import { CRAPS_STARTING_BANKROLL } from '../engine/craps/rules'
import type { RollLogEntry } from '../engine/craps/types'

/**
 * The craps player's record, kept entirely apart from the blackjack one.
 *
 * Separate bankrolls means separate runs, separate busts and separate
 * leaderboards. It also means nothing here has to be reconciled with a game
 * whose unit of play is a hand rather than a shoot.
 */

export interface CrapsStats {
  /** Shooters taken from the come-out through to the seven-out. */
  shoots: number
  rolls: number
  pointsMade: number
  sevenOuts: number
  naturals: number
  crapsRolled: number
  totalWagered: number
  netResult: number
  /** Best and worst single throw. */
  biggestWin: number
  biggestLoss: number
  /** Rolls held in the longest shoot — the real craps brag. */
  longestRoll: number
  mostPointsInAShoot: number
  bestShootNet: number
  fireBetsWon: number
  bonusBetsWon: number
}

export const EMPTY_CRAPS_STATS: CrapsStats = {
  shoots: 0,
  rolls: 0,
  pointsMade: 0,
  sevenOuts: 0,
  naturals: 0,
  crapsRolled: 0,
  totalWagered: 0,
  netResult: 0,
  biggestWin: 0,
  biggestLoss: 0,
  longestRoll: 0,
  mostPointsInAShoot: 0,
  bestShootNet: 0,
  fireBetsWon: 0,
  bonusBetsWon: 0,
}

/** One shooter's turn at the dice, come-out to seven-out. */
export interface ShootRecord {
  id: string
  timestamp: number
  tableId: string
  shootNumber: number
  rolls: RollLogEntry[]
  /** Distinct points made, in the order they were made. */
  pointsMade: number[]
  net: number
  bankrollAfter: number
}

export interface CrapsSettings {
  soundEnabled: boolean
  rollSpeed: 'relaxed' | 'normal' | 'fast' | 'instant'
  /** Colour every bet by how much the house keeps. */
  showEdges: boolean
  /** Print the net result of all eleven possible next totals. */
  showProjection: boolean
  /**
   * Itemise every bet the last roll touched, rather than just the headline.
   *
   * The full settlement is the most useful thing on screen while you are still
   * learning where the money went, and the most in the way once you are not.
   */
  showSettlementDetail: boolean
  /** What a buy-back-in is worth. The player's call, not the pit's. */
  startingBankroll: number
}

export const DEFAULT_CRAPS_SETTINGS: CrapsSettings = {
  soundEnabled: true,
  rollSpeed: 'normal',
  showEdges: true,
  showProjection: true,
  showSettlementDetail: true,
  startingBankroll: CRAPS_STARTING_BANKROLL,
}

export interface CrapsRun {
  id: string
  startedAt: number
  endedAt: number
  peakBankroll: number
  shoots: number
  longestRoll: number
}

export interface CrapsProfile {
  version: number
  displayName: string
  userId: string | null
  bankroll: number
  /** Highest bankroll this run; drives table unlocks. */
  peakBankroll: number
  allTimePeak: number
  tableId: string
  runStartedAt: number
  runShoots: number
  stats: CrapsStats
  settings: CrapsSettings
  history: ShootRecord[]
  runs: CrapsRun[]
}

export const CRAPS_PROFILE_VERSION = 1
export const MAX_CRAPS_HISTORY = 200

export function createCrapsProfile(startingBankroll: number): CrapsProfile {
  return {
    version: CRAPS_PROFILE_VERSION,
    displayName: 'Guest',
    userId: null,
    bankroll: startingBankroll,
    peakBankroll: startingBankroll,
    allTimePeak: startingBankroll,
    tableId: 'main',
    runStartedAt: Date.now(),
    runShoots: 0,
    stats: { ...EMPTY_CRAPS_STATS },
    // The rack you start with is also the rack you buy back in for, until you
    // say otherwise — the two numbers meaning different things by default would
    // be a surprise nobody asked for.
    settings: { ...DEFAULT_CRAPS_SETTINGS, startingBankroll },
    history: [],
    runs: [],
  }
}

/** Numbers the stats panel shows but never stores. */
export function derivedCrapsStats(stats: CrapsStats) {
  return {
    /**
     * Net result as a share of everything wagered — the realised edge, from the
     * player's side of the table, so negative means the house is ahead. Same
     * sign convention as the blackjack panel, because two statistics screens
     * that disagree about which way is up are worse than either alone.
     */
    edge: stats.totalWagered > 0 ? stats.netResult / stats.totalWagered : 0,
    rollsPerShoot: stats.shoots > 0 ? stats.rolls / stats.shoots : 0,
    pointsPerShoot: stats.shoots > 0 ? stats.pointsMade / stats.shoots : 0,
    avgWagerPerRoll: stats.rolls > 0 ? stats.totalWagered / stats.rolls : 0,
  }
}
