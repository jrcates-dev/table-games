/**
 * The felt as it stands, kept in local storage so closing the app never costs
 * the player what was on it.
 *
 * Each table's profile is saved when something settles, but the hand or roll
 * in play lived only in memory: close the app with chips down and they were
 * gone (or, at blackjack, a hand already dealt was quietly called off with its
 * wager back). So every table also keeps a snapshot of its engine state, the
 * pure data the rules run on, written whenever it changes. Opening the app
 * again puts the table back exactly as it was left, and anything that was
 * already decided (dice in the air, a ball on the wheel, a coup being turned
 * over) is settled on the spot, as it would have been.
 *
 * A snapshot belongs to one run of one table. A buy-back, a reset or an erase
 * starts a new run, and a snapshot from another run, or from an older shape of
 * the state, is ignored in favour of a fresh table. So bump a table's version
 * only with care: a felt saved by the old build is given up, chips and all.
 * (The update pill waits for empty felts for the same reason: see UpdatePill.)
 */

interface Stored<T> {
  version: number
  /** The run the felt belongs to: the profile's `runStartedAt`. */
  run: number
  data: T
}

export interface TableSnapshot<T> {
  /** The felt saved for this run, or null when there is none to restore. */
  load(run: number): T | null
  save(run: number, data: T): void
}

export function tableSnapshot<T>(key: string, version: number): TableSnapshot<T> {
  return {
    load(run) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const stored = JSON.parse(raw) as Stored<T>
        if (stored.version !== version || stored.run !== run || !stored.data) return null
        return stored.data
      } catch {
        return null
      }
    },
    save(run, data) {
      try {
        localStorage.setItem(key, JSON.stringify({ version, run, data } satisfies Stored<T>))
      } catch {
        // Full storage: drop the old snapshot rather than leave one that trails
        // the table, which could bring back a hand that has since been paid.
        // The table plays on; only a close mid-hand can cost anything.
        try {
          localStorage.removeItem(key)
        } catch {
          // Blocked storage keeps nothing at all, stale or otherwise.
        }
      }
    },
  }
}
