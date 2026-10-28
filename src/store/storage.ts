import { STARTING_BANKROLL } from '../engine/rules'
import { createProfile, migrateSettings, PROFILE_VERSION, type Profile } from './profile'

/**
 * Persistence behind a narrow interface.
 *
 * The game plays entirely as a guest against `LocalStorageAdapter`. When
 * Supabase credentials are present the same interface is served by
 * `SupabaseAdapter`, so upgrading a guest to a real account never touches game
 * code.
 */
export interface LeaderboardEntry {
  id: string
  displayName: string
  peakBankroll: number
  roundsPlayed: number
  strategyAccuracy: number
  achievedAt: number
  /** True for the signed-in player's own row. */
  isYou?: boolean
}

export interface StorageAdapter {
  readonly kind: 'local' | 'supabase'
  load(): Promise<Profile | null>
  save(profile: Profile): Promise<void>
  submitRun(profile: Profile): Promise<void>
  leaderboard(limit?: number): Promise<LeaderboardEntry[]>
}

const PROFILE_KEY = 'cta:profile:v1'
const LEADERBOARD_KEY = 'cta:leaderboard:v1'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly kind = 'local' as const

  async load(): Promise<Profile | null> {
    const stored = safeParse<Profile>(localStorage.getItem(PROFILE_KEY))
    if (!stored) return null
    // A version bump means the shape changed; start clean rather than crash on
    // a half-migrated object.
    if (stored.version !== PROFILE_VERSION) return null
    // Settings gain fields without the profile shape changing enough to justify
    // a version bump; back-fill the defaults so an option added after this
    // profile was saved arrives at its default rather than at `undefined`.
    return { ...stored, settings: migrateSettings(stored.settings) }
  }

  async save(profile: Profile): Promise<void> {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    } catch {
      // Quota exceeded — drop the history, which is by far the largest field,
      // rather than losing the bankroll.
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ ...profile, history: profile.history.slice(0, 50) }),
      )
    }
  }

  async submitRun(profile: Profile): Promise<void> {
    const entries = safeParse<LeaderboardEntry[]>(localStorage.getItem(LEADERBOARD_KEY)) ?? []
    entries.push(toEntry(profile))
    entries.sort((a, b) => b.peakBankroll - a.peakBankroll)
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 100)))
  }

  async leaderboard(limit = 25): Promise<LeaderboardEntry[]> {
    const entries = safeParse<LeaderboardEntry[]>(localStorage.getItem(LEADERBOARD_KEY)) ?? []
    return entries.slice(0, limit)
  }
}

function toEntry(profile: Profile): LeaderboardEntry {
  const { strategyCorrect, strategyTotal } = profile.stats
  return {
    id: `${profile.userId ?? 'guest'}-${Date.now()}`,
    displayName: profile.displayName,
    peakBankroll: profile.peakBankroll,
    roundsPlayed: profile.runRounds,
    strategyAccuracy: strategyTotal > 0 ? strategyCorrect / strategyTotal : 1,
    achievedAt: Date.now(),
    isYou: true,
  }
}

export function createProfileForNewPlayer(): Profile {
  return createProfile(STARTING_BANKROLL)
}

export { toEntry as profileToLeaderboardEntry }
