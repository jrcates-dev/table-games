import type { SetEv } from '../engine/paigow/ev'
import { handName } from '../engine/paigow/hands'
import { houseWay, type HouseWayRule } from '../engine/paigow/houseWay'
import * as pg from '../engine/paigow/paigow'
import { sameLow, setHand, type SetHand } from '../engine/paigow/split'
import type { PaiGowState } from '../engine/paigow/types'
import { sameSet } from '../store/paigowStore'

/**
 * The coach's read of the hand being set: the house way, your set as it lies,
 * and — once the numbers are in — what each is worth, and the best set of all
 * by the numbers when that is not the house way.
 */
export interface CoachRead {
  house: SetHand
  rule: HouseWayRule
  houseName: string
  mine: SetHand | null
  matches: boolean
  houseEv: number | null
  mineEv: number | null
  /** The best set by the numbers, only when it beats the house way by enough to mention. */
  best: { set: SetHand; ev: number; name: string } | null
}

/** Less than this apart, two sets are the same to the coach: the sample cannot tell them apart. */
export const EV_NOISE = 0.005

const describe = (s: SetHand) => `${handName(s.highScore, 5)} high · ${handName(s.lowScore, 2)} low`

export function coachRead(game: PaiGowState, low: readonly number[], evs: SetEv[] | null): CoachRead | null {
  if (game.player.length !== 7) return null
  const cards = pg.playerCodes(game)
  const { set: house, rule } = houseWay(cards, game.rules)
  const mine = low.length === 2 ? setHand(cards, low, game.rules) : null
  const of = (s: SetHand) => evs?.find((e) => sameLow(e.low, s.low))?.ev ?? null
  let best: CoachRead['best'] = null
  const houseEv = of(house)
  if (evs && houseEv !== null) {
    const top = evs.filter((e) => e.legal).sort((a, b) => b.ev - a.ev)[0]
    if (top && top.ev > houseEv + EV_NOISE) {
      const set = setHand(cards, top.low, game.rules)
      if (!sameSet(set, house)) best = { set, ev: top.ev, name: describe(set) }
    }
  }
  return {
    house,
    rule,
    houseName: describe(house),
    mine,
    matches: mine !== null && sameSet(mine, house),
    houseEv,
    mineEv: mine ? of(mine) : null,
    best,
  }
}
