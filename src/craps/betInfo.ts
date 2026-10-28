import {
  ARIA_ODDS_MULTIPLE,
  ATS_PAYS,
  buyVig,
  edgeBand,
  FIRE_PAYS,
  HARD_ODDS,
  houseEdge,
  LAY_ODDS,
  layVig,
  losingTotals,
  pay,
  payoutText,
  PLACE_ODDS,
  spec,
  TRUE_ODDS,
  winningTotals,
  type EdgeBand,
  type HardNumber,
} from '../engine/craps/bets'
import * as craps from '../engine/craps/craps'
import type { Bet, BetKind, CrapsState, PointNumber, Resolution } from '../engine/craps/types'
import { money } from '../lib/format'

/**
 * One place that turns a bet into English.
 *
 * The felt tooltip and the breakdown rail both need to say what a bet is, what
 * it needs, what it pays and what it costs. Deriving all four from the same
 * catalogue keeps the hover and the rail from ever disagreeing — and keeps both
 * honest to what the settler actually does.
 */
export interface BetInfo {
  title: string
  payout: string
  wins: number[]
  loses: number[]
  edge: number
  band: EdgeBand
  blurb: string
  oneRoll: boolean
}

export function describeBet(
  kind: BetKind,
  number?: number,
  point: PointNumber | null = null,
): BetInfo {
  const s = spec(kind)
  const edge = houseEdge(kind, number)
  return {
    title: number === undefined ? s.title : `${s.title} ${number}`,
    payout: payoutText(kind, number),
    wins: winningTotals(kind, number, point),
    loses: losingTotals(kind, number, point),
    edge,
    band: edgeBand(edge),
    blurb: s.blurb,
    oneRoll: s.oneRoll,
  }
}

/**
 * "6" · "7 or 11" · "2, 3 or 12" — read the way a dealer would say it.
 *
 * The field wins on exactly seven numbers, and collapsing that to a count
 * produced "wins 7 numbers" — which reads as *wins on the seven*, the one
 * number the field most emphatically loses to. Seven still lists out in full,
 * and anything longer says "different numbers" so the count can never be
 * mistaken for a total.
 */
export function totalsText(totals: number[]): string {
  if (totals.length === 0) return '—'
  if (totals.length === 1) return String(totals[0])
  if (totals.length > 7) return `${totals.length} different numbers`
  const head = totals.slice(0, -1).join(', ')
  return `${head} or ${totals[totals.length - 1]}`
}

export function edgeText(edge: number): string {
  return edge === 0 ? 'no house edge' : `${(edge * 100).toFixed(2)}% edge`
}

/**
 * What became of the chips, which is a separate question from whether the bet
 * won — and the one a player is actually asking when the rack does not match
 * the number they were shown.
 *
 * A winning pass line is paid and its stake stays on the felt. A winning come
 * bet is paid and comes down. A place bet asleep on a come-out is returned
 * rather than lost. Three different things happen to the money, and "won $10"
 * describes none of them.
 */
export function chipFate(r: Resolution): string {
  switch (r.effect) {
    case 'win':
      return r.remaining > 0
        ? `${money(r.stake)} stays up`
        : `plus ${money(r.stake)} back`
    case 'lose':
      return `${money(r.stake)} taken`
    case 'push':
      return r.remaining > 0 ? 'still up' : `${money(r.stake)} returned`
    case 'move':
    case 'point':
      return `${money(r.stake)} still riding`
    case 'sevenOut':
      return ''
  }
}

/**
 * Resolutions grouped the way the eye reads them: what won, what lost, and what
 * merely moved. Sorted by size within each group, so the roll's biggest event
 * is the first thing in view.
 */
export function groupResolutions(resolutions: readonly Resolution[]) {
  const by = (effect: Resolution['effect'][]) =>
    resolutions
      .filter((r) => effect.includes(r.effect))
      .slice()
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || b.stake - a.stake)

  return {
    won: by(['win']),
    lost: by(['lose']),
    // Pushes, travelled come bets and the roll that sets the point: no money
    // changed hands, but chips visibly moved, which is its own kind of
    // "where did that go".
    moved: by(['push', 'move', 'point', 'sevenOut']),
  }
}

export const ODDS_KINDS: readonly BetKind[] = [
  'passOdds',
  'dontPassOdds',
  'comeOdds',
  'dontComeOdds',
]

export function isOddsKind(kind: BetKind): boolean {
  return ODDS_KINDS.includes(kind)
}

/**
 * The ceiling on an odds bet, said the way the table would say it.
 *
 * Every other limit here is posted on a placard. This one is computed: it moves
 * with the point, with the size of the bet underneath it, and again depending
 * on which side of the line you are on — so "maximum odds" comes to a different
 * number every time it is offered, and a player who has only heard the phrase
 * has no way to work out what it means for the bet in front of them.
 *
 * Aria runs 3-4-5x. On the take side that is a rule about the *payout*:
 * whatever the point, full odds wins six times the line, which is why the
 * multiple changes with the number. The lay side may risk six times the line on
 * any point, and so wins 3x, 4x or 5x. Both are worth saying out loud.
 */
export function oddsLimitText(
  state: CrapsState,
  kind: BetKind,
  number?: number,
): string | null {
  if (!isOddsKind(kind)) return null
  const n = craps.oddsPointFor(state, kind, number)
  const cap = craps.capFor(state, kind, number)
  if (!n || cap <= 0) return null

  // "Full odds" rather than "pays", because this line describes the ceiling and
  // stays put once a partial bet is down — where "pays $60" would read as a
  // promise about the chips actually standing there.
  const taking = kind === 'passOdds' || kind === 'comeOdds'
  const wins = pay(cap, taking ? TRUE_ODDS[n] : LAY_ODDS[n])
  // The multiple is off the bet underneath, which is the come bet rather than
  // the line whenever this is a come point — and those are routinely different
  // sizes, so naming the wrong one would quote a ceiling that does not match
  // the number beside it.
  const base = kind === 'passOdds' ? 'your line' : 'your come bet'
  return taking
    ? `3-4-5x — full odds on the ${n} is ${ARIA_ODDS_MULTIPLE[n]}× ${base}: ${money(cap)} wins ${money(wins)}`
    : `3-4-5x — full odds against the ${n}: lay ${money(cap)} to win ${money(wins)}`
}

/** How bad a bet is, in one word, for the colour-coded pill — the same words at every table. */
export { EDGE_LABEL as BAND_LABEL } from '../engine/edge'

/**
 * What this bet pays, in dollars, if it hits.
 *
 * Bets whose payout depends on which number arrives — the field, the horn, the
 * Fire Bet — report their best case, and the rail labels it "up to". Everything
 * else has exactly one answer.
 */
export function potentialWin(bet: Bet, point: PointNumber | null): { amount: number; upTo: boolean } {
  const n = (bet.number ?? point) as PointNumber | undefined
  const flat = { amount: bet.amount, upTo: false }

  switch (bet.kind) {
    case 'passLine':
    case 'dontPass':
    case 'come':
    case 'dontCome':
    case 'comePoint':
    case 'dontComePoint':
      return flat
    case 'passOdds':
    case 'comeOdds':
      return n ? { amount: pay(bet.amount, TRUE_ODDS[n]), upTo: false } : flat
    case 'buy':
      // Paid at true odds, less the commission that keeps it working.
      return n ? { amount: pay(bet.amount, TRUE_ODDS[n]) - buyVig(bet.amount), upTo: false } : flat
    case 'dontPassOdds':
    case 'dontComeOdds':
      return n ? { amount: pay(bet.amount, LAY_ODDS[n]), upTo: false } : flat
    case 'lay':
      return n
        ? { amount: pay(bet.amount, LAY_ODDS[n]) - layVig(bet.amount, n), upTo: false }
        : flat
    case 'place':
      return n ? { amount: pay(bet.amount, PLACE_ODDS[n]), upTo: false } : flat
    case 'hard':
      return n ? { amount: pay(bet.amount, HARD_ODDS[n as HardNumber]), upTo: false } : flat
    case 'field':
      // Triple on the twelve is the best the field ever does.
      return { amount: bet.amount * 3, upTo: true }
    case 'any7':
      return { amount: bet.amount * 4, upTo: false }
    case 'anyCraps':
      return { amount: bet.amount * 7, upTo: false }
    case 'ce':
      return { amount: bet.amount * 7, upTo: true }
    case 'horn':
      return { amount: (bet.amount / 4) * 27, upTo: true }
    case 'world':
      return { amount: (bet.amount / 5) * 26, upTo: true }
    case 'two':
    case 'twelve':
      return { amount: bet.amount * 30, upTo: false }
    case 'three':
    case 'eleven':
      return { amount: bet.amount * 15, upTo: false }
    case 'fire':
      return { amount: pay(bet.amount, FIRE_PAYS[6]), upTo: true }
    case 'small':
    case 'tall':
    case 'all':
      return { amount: pay(bet.amount, ATS_PAYS[bet.kind]), upTo: false }
  }
}

/**
 * The hardways and any bet riding on a pair need saying out loud, because
 * "wins on 8" is true of a place bet and badly misleading for a hard 8.
 */
export function winCondition(kind: BetKind, number?: number, point: PointNumber | null = null): string {
  if (kind === 'hard' && number) return `${number} as ${number / 2}-${number / 2}`
  if (kind === 'passLine' && !point) return '7 or 11 now, or your point later'
  if (kind === 'dontPass' && !point) return '2 or 3 now, or a 7 before the point'
  return totalsText(winningTotals(kind, number, point))
}

/**
 * What takes the bet away — the half of every wager the felt never prints.
 *
 * Worth saying out loud for the same reason the win condition is: "wins on 8"
 * is true of both a place bet and a hard 8, and only the losing side tells you
 * they are completely different bets.
 */
export function loseCondition(
  kind: BetKind,
  number?: number,
  point: PointNumber | null = null,
): string {
  switch (kind) {
    case 'hard':
      return number ? `7, or the ${number} any other way` : '7'
    case 'passLine':
      return point ? '7' : '2, 3 or 12 now, or a 7 after'
    case 'dontPass':
      return point ? String(point) : '7 or 11 now, or the point after'
    case 'world':
      // Its own case because the 7 neither wins nor loses it.
      return '4, 5, 6, 8, 9 or 10 — the 7 is a push'
    case 'fire':
      return 'sevening out with fewer than four points'
    case 'small':
    case 'tall':
    case 'all':
      return 'any 7 before the set is complete'
    default: {
      const totals = losingTotals(kind, number, point)
      if (totals.length === 0) return '—'
      // A one-roll bet loses to everything it does not win on. Listing nine
      // numbers is noise where "anything else" is the actual rule.
      if (spec(kind).oneRoll && totals.length > 4) return 'any other roll'
      return totalsText(totals)
    }
  }
}
