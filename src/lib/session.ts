import { useEffect, useState } from 'react'

/**
 * Where each game's rack stood when this visit to the building began, so the
 * top bar can say how tonight is going rather than how the whole profile is.
 * Module-level on purpose: walking out to the lobby and back is the same
 * session. A new run — buying back in, or a reset — starts the count again,
 * because a fresh rack measured against the old one is not a loss.
 */
const starts: Record<string, { bankroll: number; run: number } | undefined> = {}

export function useSessionNet(game: string, bankroll: number, ready: boolean, run: number): number {
  const [start, setStart] = useState(() => starts[game])
  useEffect(() => {
    if (!ready) return
    const current = starts[game]
    if (current && current.run === run) return
    starts[game] = { bankroll, run }
    setStart(starts[game])
  }, [game, bankroll, ready, run])
  return start === undefined || start.run !== run ? 0 : bankroll - start.bankroll
}
