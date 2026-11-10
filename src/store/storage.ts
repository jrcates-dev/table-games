import { migrateSettings, PROFILE_VERSION, type Profile } from './profile'

/**
 * The blackjack profile in the browser's local storage. The game plays
 * entirely on the device: bankroll, statistics and hand history live here.
 */
const PROFILE_KEY = 'cta:profile:v1'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export class LocalStorageAdapter {
  async load(): Promise<Profile | null> {
    // Earlier builds filed finished runs to a leaderboard nothing showed.
    localStorage.removeItem('cta:leaderboard:v1')
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
}
