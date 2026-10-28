import {
  createCrapsProfile,
  CRAPS_PROFILE_VERSION,
  DEFAULT_CRAPS_SETTINGS,
  type CrapsProfile,
} from './crapsProfile'

/**
 * Craps persistence, behind the same narrow interface blackjack uses.
 *
 * Local only for now. The cloud adapter in `supabase.ts` is shaped around a
 * blackjack profile — hands, strategy accuracy — and `runs` has no column
 * saying which game a row came from, so wiring craps to it would silently mix
 * two incomparable leaderboards. The schema change is in `supabase/schema.sql`;
 * until it is applied against a real project, craps stays on the device.
 */

export interface CrapsLeaderboardEntry {
  id: string
  displayName: string
  peakBankroll: number
  shoots: number
  /** Most rolls held in a single shoot — what craps players actually brag about. */
  longestRoll: number
  achievedAt: number
  isYou?: boolean
}

export interface CrapsStorageAdapter {
  readonly kind: 'local'
  load(): Promise<CrapsProfile | null>
  save(profile: CrapsProfile): Promise<void>
  submitRun(profile: CrapsProfile): Promise<void>
  leaderboard(limit?: number): Promise<CrapsLeaderboardEntry[]>
}

const PROFILE_KEY = 'cta:craps:profile:v1'
const LEADERBOARD_KEY = 'cta:craps:leaderboard:v1'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export class LocalCrapsAdapter implements CrapsStorageAdapter {
  readonly kind = 'local' as const

  async load(): Promise<CrapsProfile | null> {
    const stored = safeParse<CrapsProfile>(localStorage.getItem(PROFILE_KEY))
    if (!stored) return null
    // A version bump means the shape changed; start clean rather than crash on
    // a half-migrated object.
    if (stored.version !== CRAPS_PROFILE_VERSION) return null
    // Settings gain fields between releases without the shape changing enough
    // to justify a version bump. Back-filling the defaults means a profile
    // saved before a toggle existed comes back with that toggle at its default
    // rather than at `undefined`, which reads as "off" for every new option.
    return { ...stored, settings: { ...DEFAULT_CRAPS_SETTINGS, ...stored.settings } }
  }

  async save(profile: CrapsProfile): Promise<void> {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    } catch {
      // A long session's roll-by-roll history is by far the biggest field.
      // Losing it beats losing the bankroll.
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ ...profile, history: profile.history.slice(0, 25) }),
      )
    }
  }

  async submitRun(profile: CrapsProfile): Promise<void> {
    const entries = safeParse<CrapsLeaderboardEntry[]>(localStorage.getItem(LEADERBOARD_KEY)) ?? []
    entries.push(crapsProfileToEntry(profile))
    entries.sort((a, b) => b.peakBankroll - a.peakBankroll)
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 100)))
  }

  async leaderboard(limit = 25): Promise<CrapsLeaderboardEntry[]> {
    const entries = safeParse<CrapsLeaderboardEntry[]>(localStorage.getItem(LEADERBOARD_KEY)) ?? []
    return entries.slice(0, limit)
  }
}

export function crapsProfileToEntry(profile: CrapsProfile): CrapsLeaderboardEntry {
  return {
    id: `${profile.userId ?? 'guest'}-${Date.now()}`,
    displayName: profile.displayName,
    peakBankroll: profile.peakBankroll,
    shoots: profile.runShoots,
    longestRoll: profile.stats.longestRoll,
    achievedAt: Date.now(),
    isYou: true,
  }
}

export function createCrapsProfileForNewPlayer(startingBankroll: number): CrapsProfile {
  return createCrapsProfile(startingBankroll)
}
