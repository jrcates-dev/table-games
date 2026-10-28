import type { SupabaseClient } from '@supabase/supabase-js'
import { migrateSettings, PROFILE_VERSION, type Profile } from './profile'
import {
  LocalStorageAdapter,
  profileToLeaderboardEntry,
  type LeaderboardEntry,
  type StorageAdapter,
} from './storage'

/**
 * Supabase wiring.
 *
 * Credentials are optional: with none configured the app runs entirely as a
 * guest on local storage and every account affordance is hidden. Drop a
 * `.env.local` with the two variables below and sign-in, cloud saves and the
 * global leaderboard light up without any other change.
 *
 * Schema lives in `supabase/schema.sql`.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

let client: Promise<SupabaseClient> | null = null

/**
 * The client, loaded on first use. The library is sizeable and most players
 * never configure an account, so it is fetched only when there is one to talk
 * to rather than riding along in every page load.
 */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured) return null
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url!, anonKey!))
  return client
}

/**
 * Cloud-backed persistence. Local storage stays the write-through cache so the
 * table never stalls on a network round trip mid-hand — the bankroll on screen
 * is always the local one, and the cloud catches up in the background.
 */
/**
 * Which game's rows this adapter owns.
 *
 * Every row in `profiles` and `runs` is keyed by game, so a blackjack hand and
 * a craps shoot can never end up averaged into the same leaderboard. Craps does
 * not use this adapter yet — see `crapsStorage.ts`.
 */
const GAME = 'blackjack'

export class SupabaseAdapter implements StorageAdapter {
  readonly kind = 'supabase' as const
  private local = new LocalStorageAdapter()
  private readonly db: SupabaseClient
  private readonly userId: string

  constructor(db: SupabaseClient, userId: string) {
    this.db = db
    this.userId = userId
  }

  async load(): Promise<Profile | null> {
    const { data, error } = await this.db
      .from('profiles')
      .select('payload')
      .eq('user_id', this.userId)
      .eq('game', GAME)
      .maybeSingle()

    if (error || !data?.payload) return this.local.load()

    const payload = data.payload as Profile
    if (payload.version !== PROFILE_VERSION) return this.local.load()
    // Same back-fill the local adapter does: a payload written before a setting
    // existed must not come back with that setting undefined.
    return {
      ...payload,
      userId: this.userId,
      settings: migrateSettings(payload.settings),
    }
  }

  async save(profile: Profile): Promise<void> {
    await this.local.save(profile)
    // History can be large and is not needed server-side for leaderboards; keep
    // the synced payload lean.
    const payload: Profile = { ...profile, history: profile.history.slice(0, 100) }
    await this.db
      .from('profiles')
      .upsert(
        {
          user_id: this.userId,
          game: GAME,
          display_name: profile.displayName,
          payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,game' },
      )
  }

  async submitRun(profile: Profile): Promise<void> {
    await this.local.submitRun(profile)
    const { strategyCorrect, strategyTotal } = profile.stats
    await this.db.from('runs').insert({
      user_id: this.userId,
      game: GAME,
      display_name: profile.displayName,
      peak_bankroll: Math.round(profile.peakBankroll),
      rounds_played: profile.runRounds,
      strategy_accuracy: strategyTotal > 0 ? strategyCorrect / strategyTotal : 1,
      started_at: new Date(profile.runStartedAt).toISOString(),
    })
  }

  async leaderboard(limit = 25): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.db
      .from('runs')
      .select('id, user_id, display_name, peak_bankroll, rounds_played, strategy_accuracy, created_at')
      .eq('game', GAME)
      .order('peak_bankroll', { ascending: false })
      .limit(limit)

    if (error || !data) return this.local.leaderboard(limit)

    return data.map((row) => ({
      id: String(row.id),
      displayName: row.display_name ?? 'Anonymous',
      peakBankroll: Number(row.peak_bankroll),
      roundsPlayed: Number(row.rounds_played),
      strategyAccuracy: Number(row.strategy_accuracy),
      achievedAt: new Date(row.created_at).getTime(),
      isYou: row.user_id === this.userId,
    }))
  }
}

/** Pick the right adapter for the current session. */
export async function resolveAdapter(): Promise<StorageAdapter> {
  const db = await getSupabase()
  if (!db) return new LocalStorageAdapter()
  const { data } = await db.auth.getUser()
  if (!data.user) return new LocalStorageAdapter()
  return new SupabaseAdapter(db, data.user.id)
}

export { profileToLeaderboardEntry }
