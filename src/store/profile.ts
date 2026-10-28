import { DEFAULT_RULE_PRESET, STARTING_BANKROLL } from '../engine/rules'
import type { Outcome, PlayerAction, Rank, Suit } from '../engine/types'

export interface Stats {
  handsPlayed: number
  handsWon: number
  handsLost: number
  handsPushed: number
  blackjacks: number
  busts: number
  doubles: number
  splits: number
  surrenders: number
  insuranceTaken: number
  totalWagered: number
  netResult: number
  biggestWin: number
  biggestLoss: number
  currentStreak: number
  bestStreak: number
  /** Decisions matching basic strategy, and decisions graded. */
  strategyCorrect: number
  strategyTotal: number
  roundsPlayed: number
}

export const EMPTY_STATS: Stats = {
  handsPlayed: 0,
  handsWon: 0,
  handsLost: 0,
  handsPushed: 0,
  blackjacks: 0,
  busts: 0,
  doubles: 0,
  splits: 0,
  surrenders: 0,
  insuranceTaken: 0,
  totalWagered: 0,
  netResult: 0,
  biggestWin: 0,
  biggestLoss: 0,
  currentStreak: 0,
  bestStreak: 0,
  strategyCorrect: 0,
  strategyTotal: 0,
  roundsPlayed: 0,
}

export interface RecordedCard {
  rank: Rank
  suit: Suit
}

export interface RecordedHand {
  cards: RecordedCard[]
  bet: number
  outcome: Outcome
  doubled: boolean
  fromSplit: boolean
}

/** One completed round, kept for the history panel and replay. */
export interface HandRecord {
  id: string
  timestamp: number
  tableId: string
  dealer: RecordedCard[]
  hands: RecordedHand[]
  insuranceBet: number
  net: number
  bankrollAfter: number
  /** True count at the moment the round was dealt. */
  trueCount: number
  mistakes: StrategyMistake[]
}

export interface StrategyMistake {
  played: PlayerAction
  correct: PlayerAction
  playerTotal: string
  dealerUpcard: Rank
}

export interface Settings {
  showCoach: boolean
  /** Block a play that deviates from basic strategy until confirmed. */
  coachStrict: boolean
  showCount: boolean
  showTotals: boolean
  soundEnabled: boolean
  dealSpeed: 'relaxed' | 'normal' | 'fast' | 'instant'
  /**
   * Ask about insurance when the dealer shows an ace. Off, the question is
   * never put: insurance is declined and the dealer peeks straight away.
   */
  offerInsurance: boolean
  rulePreset: string
  /** What a buy-back-in is worth. The player's call, not the house's. */
  startingBankroll: number
  /**
   * Which generation of rule presets these settings were saved under. The
   * default moved from the generic Strip game to Aria's; a profile that was
   * simply sitting on the old default follows it, one that chose a table on
   * purpose keeps it.
   */
  rulesRevision?: number
}

export const RULES_REVISION = 2

export const DEFAULT_SETTINGS: Settings = {
  showCoach: false,
  coachStrict: false,
  showCount: false,
  showTotals: true,
  soundEnabled: true,
  dealSpeed: 'normal',
  offerInsurance: true,
  rulePreset: DEFAULT_RULE_PRESET,
  startingBankroll: STARTING_BANKROLL,
  rulesRevision: RULES_REVISION,
}

/**
 * Settings as stored, brought up to date: missing fields back-filled from the
 * defaults, and a profile still on the pre-Aria default moved to the new one.
 */
export function migrateSettings(stored: Partial<Settings> | undefined): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...stored }
  if ((stored?.rulesRevision ?? 1) < RULES_REVISION && stored?.rulePreset === 'vegasStrip') {
    settings.rulePreset = DEFAULT_RULE_PRESET
  }
  settings.rulesRevision = RULES_REVISION
  return settings
}

/** A completed bankroll run, ended by busting out and buying back in. */
export interface CompletedRun {
  id: string
  startedAt: number
  endedAt: number
  peakBankroll: number
  roundsPlayed: number
}

export interface Profile {
  version: number
  displayName: string
  /** Supabase user id once the guest upgrades to a real account. */
  userId: string | null
  bankroll: number
  /** Highest bankroll reached in the current run; drives table unlocks. */
  peakBankroll: number
  /** Highest bankroll ever reached, across every run. */
  allTimePeak: number
  tableId: string
  runStartedAt: number
  runRounds: number
  stats: Stats
  settings: Settings
  history: HandRecord[]
  runs: CompletedRun[]
}

export const PROFILE_VERSION = 1

export function createProfile(startingBankroll: number): Profile {
  return {
    version: PROFILE_VERSION,
    displayName: 'Guest',
    userId: null,
    bankroll: startingBankroll,
    peakBankroll: startingBankroll,
    allTimePeak: startingBankroll,
    tableId: 'bronze',
    runStartedAt: Date.now(),
    runRounds: 0,
    stats: { ...EMPTY_STATS },
    // What you sit down with is what you buy back in for, until you say
    // otherwise.
    settings: { ...DEFAULT_SETTINGS, startingBankroll },
    history: [],
    runs: [],
  }
}

export const MAX_HISTORY = 500

/** Derived numbers the stats panel shows. Kept out of storage. */
export function derivedStats(stats: Stats) {
  const decided = stats.handsWon + stats.handsLost
  return {
    winRate: decided > 0 ? stats.handsWon / decided : 0,
    /**
     * Net result as a fraction of everything wagered, doubles, splits and
     * insurance included. Published house edges are per initial bet, which
     * reads about an eighth higher for the same play.
     */
    edge: stats.totalWagered > 0 ? stats.netResult / stats.totalWagered : 0,
    strategyAccuracy: stats.strategyTotal > 0 ? stats.strategyCorrect / stats.strategyTotal : 1,
    avgBet: stats.handsPlayed > 0 ? stats.totalWagered / stats.handsPlayed : 0,
    blackjackRate: stats.handsPlayed > 0 ? stats.blackjacks / stats.handsPlayed : 0,
  }
}
