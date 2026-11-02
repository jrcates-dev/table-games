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
 * having won or lost a thing. Results only move when a bet is settled.
 *
 * Only the figures live here, so the table chrome can read them without
 * loading every table's store. Keeping them is the floor's job, in `racks.ts`.
 * Module-level like the rest of the visit: walking out to the lobby and back
 * is the same session, and closing the page ends it.
 */
export type SessionNets = Record<GameId, number>

export const useSessionNets = create<SessionNets>(() => ({
  blackjack: 0,
  craps: 0,
  baccarat: 0,
  roulette: 0,
  uth: 0,
}))

/** Every table's result this session, taken together. */
export function sessionTotal(nets: SessionNets): number {
  return cents(Object.values(nets).reduce((sum, net) => sum + net, 0))
}
