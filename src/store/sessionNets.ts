import { create } from 'zustand'
import { cents } from '../engine/edge'
import type { GameId } from './appStore'

/**
 * What each table has won or lost since this visit to the building began.
 *
 * Counted from each table's own results — the net of every hand, roll, coup
 * and spin it settles — rather than from its rack. With the bankroll shared
 * every rack moves with every other table's play, so a rack cannot say what
 * its own table did; and a buy-back or a top-up moves a rack without anyone
 * having won or lost a thing. Results only move when a bet is settled, and
 * the count starts again when you reset a bankroll — at a table, or from the
 * lobby — since that is a fresh start rather than a top-up.
 *
 * Only the figures live here, so the table chrome can read them without
 * loading every table's store. Keeping them is the floor's job, in `racks.ts`.
 * Module-level like the rest of the visit: walking out to the lobby and back
 * is the same session, and closing the page ends it.
 */
export type SessionNets = Record<GameId, number>

const NOTHING: SessionNets = { blackjack: 0, craps: 0, baccarat: 0, roulette: 0, uth: 0, paigow: 0 }

export const useSessionNets = create<SessionNets>(() => ({ ...NOTHING }))

/** Start the count again at one table, or at every table, as its bankroll is reset. */
export function clearSessionNets(id?: GameId): void {
  useSessionNets.setState(id ? { [id]: 0 } : { ...NOTHING })
}

/** Every table's result this session, taken together. */
export function sessionTotal(nets: SessionNets): number {
  return cents(Object.values(nets).reduce((sum, net) => sum + net, 0))
}
