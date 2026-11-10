import {
  CRAPS_PROFILE_VERSION,
  DEFAULT_CRAPS_SETTINGS,
  type CrapsProfile,
} from './crapsProfile'

/** The craps profile in the browser's local storage, kept apart from the blackjack one. */
const PROFILE_KEY = 'cta:craps:profile:v1'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export class LocalCrapsAdapter {
  async load(): Promise<CrapsProfile | null> {
    // Earlier builds filed finished runs to a leaderboard nothing showed.
    localStorage.removeItem('cta:craps:leaderboard:v1')
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
}
