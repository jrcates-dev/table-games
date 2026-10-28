import { tableDenominations } from '../components/chips'
import type { TipContent } from '../components/tip'
import { betById, betTitle, houseEdge, isInside, payFor, payText, winProbability, type BetDef } from '../engine/roulette/bets'
import * as rl from '../engine/roulette/roulette'
import type { RouletteState } from '../engine/roulette/types'
import { DOUBLE_ZERO, pocketColor, pocketCount, pocketLabel, type WheelType } from '../engine/roulette/wheel'
import { money, percent } from '../lib/format'

/** The rack runs from dollar chips on the main floor; the salon starts at reds. */
export function rouletteDenominations(game: Pick<RouletteState, 'limits'>) {
  return tableDenominations(game.limits.tableMin >= 100 ? 5 : 1, game.limits.maxOutside)
}

/** The bet a hovered target stands for: a spot on the layout, or its row on the rail. */
export function spotId(id: string): string {
  return id.startsWith('rail:') ? id.slice(5) : id
}

/** "17, 20" — or, for the big outside bets, what they are called. */
export function coverText(def: BetDef): string {
  if (def.numbers.length <= 6) return def.numbers.map(pocketLabel).join(', ')
  return `${def.numbers.length} numbers`
}

/** "1 in 19.0" — the honest way to say a win probability. */
export function chanceText(def: BetDef, wheel: WheelType): string {
  const p = winProbability(def, wheel)
  return `${percent(p, 1)} · 1 in ${(1 / p).toFixed(1)}`
}

/** Why one bet costs more than the rest: the only thing worth saying about price at a roulette table. */
export function edgeNote(def: BetDef, wheel: WheelType): string | undefined {
  if (def.kind === 'basket' && def.numbers.length === 5) return 'pays 6 to 1 where 6.6 would be fair'
  const n = pocketCount(wheel)
  return `pays as if the wheel had ${n - (wheel === 'double' ? 2 : 1)} numbers`
}

/** The hover card for a spot on the layout. */
export function tipFor(game: RouletteState, id: string, showEdges: boolean): TipContent | null {
  const def = betById(game.wheel, id)
  if (!def) return null
  const open = game.phase === 'settled' ? rl.clearForNextSpin(game) : game
  const check = rl.canPlace(open, id)
  const on = game.phase === 'betting' ? (game.bets[id]?.amount ?? 0) : 0
  const max = rl.maxFor(game.limits, def)
  const others = pocketCount(game.wheel) - def.numbers.length
  const minText = isInside(def.kind) ? `any chip · $${game.limits.tableMin} inside in total` : `${money(game.limits.tableMin)} minimum`
  return {
    title: betTitle(def),
    pays: payText(def),
    wins: `${coverText(def)} · ${chanceText(def, game.wheel)}`,
    loses: `the other ${others}`,
    edge: showEdges ? houseEdge(def, game.wheel) : undefined,
    edgeNote: showEdges ? edgeNote(def, game.wheel) : undefined,
    hint: on > 0 ? `${money(on)} down · wins ${money(on * payFor(def))} · right-click takes it back` : `${minText} · up to ${money(max)}`,
    reason: check.ok ? undefined : check.reason,
  }
}

/** "17 red · odd · low" — what the dealer calls. */
export function callText(pocket: number): string {
  if (pocket === 0 || pocket === DOUBLE_ZERO) return `${pocketLabel(pocket)} · green`
  return [`${pocket} ${pocketColor(pocket)}`, pocket % 2 ? 'odd' : 'even', pocket <= 18 ? 'low' : 'high'].join(' · ')
}
