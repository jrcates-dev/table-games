import {
  ALL_NUMBERS,
  buyVig,
  FIELD_PAYS,
  FIRE_PAYS,
  HARD_ODDS,
  LAY_ODDS,
  losingTotals,
  PLACE_ODDS,
  ratioText,
  SMALL_NUMBERS,
  TALL_NUMBERS,
  TRUE_ODDS,
  winningTotals,
  type HardNumber,
} from '../engine/craps/bets'
import * as craps from '../engine/craps/craps'
import type { Bet, CrapsState, DieFace, PointNumber, Resolution, RollLogEntry } from '../engine/craps/types'
import { money } from '../lib/format'
import { describeBet, loseCondition, winCondition } from './betInfo'
import { stickmanCall } from './calls'

/**
 * "What happened last roll", in sentences.
 *
 * The settler already records what each bet did; this says *why*, against the
 * felt exactly as the dice met it. That is the question a new player is asking
 * when chips vanish from one box and get paid in another: not "what was the
 * net" but "why did the field lose on an 8 when the place 8 got paid?"
 *
 * It reads the state the dice were thrown from as well as the one they
 * settled into, because the felt changes the moment the player starts betting
 * again — and a bet put down after the roll was never part of it.
 */
export type RollOutcome = 'won' | 'lost' | 'push' | 'off' | 'point' | 'moved' | 'waiting'

export interface RollItem {
  id: string
  label: string
  outcome: RollOutcome
  /** Profit or loss for won and lost; the stake for everything else. */
  amount: number
  why: string
  /** Where the chips went, when that is not obvious from the outcome. */
  fate?: string
}

export interface RollStory {
  seq: number
  a: DieFace
  b: DieFace
  total: number
  /** The roll in the stickman's words: "Seven out", "Easy 8". */
  headline: string
  /** What the roll did to the game as a whole — the line, the puck, the dice. */
  summary: string
  /** Every bet the dice met, decided ones first; `waiting` ones are last. */
  items: RollItem[]
  /** Heading for the bets the roll left alone: "Not decided by a 5". */
  waitingLabel: string
  net: number
}

interface Ctx {
  total: number
  a: DieFace
  b: DieFace
  /** The point in force as the dice were thrown; null on a come-out. */
  point: PointNumber | null
  note: RollLogEntry['note']
  /** Distinct points this shoot has made, this roll included. */
  firePoints: number
}

const ORDER: Record<RollOutcome, number> = { won: 0, lost: 1, push: 2, off: 3, point: 4, moved: 5, waiting: 6 }

/** "a 5", "an 8", "an 11". */
function a(total: number): string {
  return total === 8 || total === 11 ? `an ${total}` : `a ${total}`
}

function summaryFor(ctx: Ctx): string {
  const { total, point, note } = ctx
  switch (note) {
    case 'natural':
      return `${total} on the come-out is a natural: the Pass Line wins and Don’t Pass loses. The next roll is another come-out.`
    case 'craps':
      return total === 12
        ? '12 on the come-out is craps: the Pass Line loses, and Don’t Pass is barred on the 12, so it pushes. The next roll is another come-out.'
        : `${total} on the come-out is craps: the Pass Line loses and Don’t Pass wins. The next roll is another come-out.`
    case 'pointSet':
      return `${total} on the come-out becomes the point. The Pass Line now needs another ${total} before a 7; Don’t Pass wants the 7 first.`
    case 'pointMade':
      return `The shooter made the point (${total}) before a 7: the Pass Line wins and Don’t Pass loses. Same shooter, and the next roll is a new come-out.`
    case 'sevenOut':
      return `A 7 before the point (${point}) is a seven-out: the Pass Line and every working number lose, the don’ts win, and the dice pass to the next shooter.`
  }
  return `The point is ${point}, so only ${a(point as number)} or a 7 settles the line. ${capital(a(total))} only decides the bets that ride on it.`
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Why one bet did what it did. Written per bet because the reasons really are
 * per bet: the same 7 is a natural for the line, a loss for a place bet and,
 * on a come-out, nothing at all for a hardway.
 */
function why(bet: Bet | undefined, r: Resolution, ctx: Ctx): string {
  const { total, point, note } = ctx
  if (r.betId === 'commission') return 'The 5% commission on buy bets made since the last roll is counted against this roll.'
  if (!bet) return r.detail

  const n = bet.number as PointNumber
  const won = r.effect === 'win'
  const lost = r.effect === 'lose'

  switch (bet.kind) {
    case 'passLine':
      if (r.effect === 'point') return `${total} became the point. Now it needs another ${total} before a 7.`
      if (won) return note === 'natural' ? `${total} on the come-out is a natural. Pays even money.` : `The point ${point} came back before a 7. Pays even money.`
      return note === 'craps' ? `${total} on the come-out is craps.` : `A 7 came before the point ${point}.`
    case 'dontPass':
      if (r.effect === 'point') return `${total} became the point. Now it needs a 7 before another ${total}.`
      if (r.effect === 'push') return '12 is barred on the come-out, so it is a stand-off: nothing won or lost.'
      if (won) return note === 'craps' ? `${total} on the come-out is craps, which wins Don’t Pass. Pays even money.` : `The 7 came before the point ${point}. Pays even money.`
      return note === 'natural' ? `${total} on the come-out is a natural, which loses Don’t Pass.` : `The shooter made the point ${point}.`
    case 'passOdds':
      if (r.effect === 'push') {
        return total === 7 ? 'You had the odds turned off, so the seven-out could not take them.' : 'You had the odds turned off, so they come back with the line instead of being paid.'
      }
      return won
        ? `The point ${point} was made. Odds pay true odds, ${ratioText(TRUE_ODDS[point as PointNumber])}, with no house edge.`
        : 'Seven out: the odds go with the line.'
    case 'dontPassOdds':
      if (r.effect === 'push') {
        return total === 7 ? 'You had the odds turned off, so they come back instead of being paid.' : `You had the odds turned off, so the ${point} could not take them.`
      }
      return won
        ? `Seven out. Laid odds pay true odds, ${ratioText(LAY_ODDS[point as PointNumber])}.`
        : `The point ${point} was made, so the laid odds go with Don’t Pass.`
    case 'come':
      if (r.effect === 'move') return `${total} is a point number, so the bet moves to the ${total}. From now on it wins on another ${total} and loses on a 7.`
      return won
        ? `${total} on a come bet’s first roll wins, just like a natural on the line. Pays even money.`
        : `${total} on a come bet’s first roll is craps.`
    case 'dontCome':
      if (r.effect === 'move') return `${total} is a point number, so the bet moves behind the ${total}. From now on it wins on a 7 and loses on another ${total}.`
      if (r.effect === 'push') return '12 is barred for Don’t Come, so it is a stand-off: nothing won or lost.'
      return won ? `${total} on its first roll is craps, which wins Don’t Come.` : `${total} on its first roll loses Don’t Come.`
    case 'comePoint':
      if (won) return `The ${n} came back before a 7. Pays even money.`
      return point === null ? `A 7 came before the ${n}. Come bets on a number work on the come-out too.` : `A 7 came before the ${n}.`
    case 'comeOdds':
      if (r.effect === 'push') {
        const off = point === null ? 'Come odds are off on the come-out' : 'You had the odds turned off'
        return total === 7 ? `${off}, so the 7 could not take them.` : `${off}, so they come back with the come bet instead of being paid.`
      }
      return won ? `The ${n} came back. Odds pay true odds, ${ratioText(TRUE_ODDS[n])}.` : 'A 7: the odds go with the come bet.'
    case 'dontComePoint':
      return won ? `A 7 came before the ${n}. Pays even money.` : `The ${n} came before a 7.`
    case 'dontComeOdds':
      if (r.effect === 'push') {
        return total === 7 ? 'You had the odds turned off, so they come back with the Don’t Come bet instead of being paid.' : `You had the odds turned off, so the ${n} could not take them.`
      }
      return won ? `A 7 came before the ${n}. Laid odds pay true odds, ${ratioText(LAY_ODDS[n])}.` : `The ${n} came before a 7.`
    case 'place':
    case 'buy':
      if (r.effect === 'push') {
        const off = point === null ? `${bet.kind === 'place' ? 'Place' : 'Buy'} bets are off on the come-out` : 'You had it turned off'
        return total === 7 ? `${off}, so the 7 did not take it.` : `${off}, so this ${n} did not pay.`
      }
      if (lost) return `A 7 takes every working ${bet.kind} bet.`
      return bet.kind === 'place'
        ? `The ${n} was rolled. Place ${n} pays ${ratioText(PLACE_ODDS[n])}.`
        : `The ${n} was rolled. Buy pays true odds, ${ratioText(TRUE_ODDS[n])}, less ${money(buyVig(bet.amount))} commission.`
    case 'lay':
      if (r.effect === 'push') return `The lay was off this roll, so the ${total} did not count.`
      return won ? `A 7 came before the ${n}. Lay pays ${ratioText(LAY_ODDS[n])}, less 5% of the win.` : `The ${n} came before a 7.`
    case 'field': {
      const mult = FIELD_PAYS[total]
      if (!won) return 'The field loses on 5, 6, 7 and 8.'
      return mult === 1 ? `${total} is a field number. Pays even money.` : `${total} is a field number, and it pays ${mult === 2 ? 'double' : 'triple'}.`
    }
    case 'hard':
      if (won) return `${n} the hard way (${ctx.a} and ${ctx.b}). Pays ${ratioText(HARD_ODDS[n as HardNumber])}.`
      return total === 7 ? 'A 7 takes the hardways.' : `${n} came easy (${ctx.a} and ${ctx.b}). A hardway only wins as a pair.`
    case 'any7':
      return won ? 'A 7. Any Seven pays 4:1.' : `One roll on a 7, and this was ${a(total)}.`
    case 'anyCraps':
      return won ? `${total} is craps. Any Craps pays 7:1.` : `One roll on 2, 3 or 12, and this was ${a(total)}.`
    case 'ce':
      if (won) return total === 11 ? '11 wins the E half, which nets 7:1 on the whole bet.' : `${total} is craps, which wins the C half and nets 3:1 on the whole bet.`
      return `One roll on craps or 11, and this was ${a(total)}.`
    case 'horn':
      if (won) return `${total} is a horn number. The quarter on it pays ${total === 2 || total === 12 ? '30:1' : '15:1'}; the other three quarters lose.`
      return `One roll on 2, 3, 11 or 12, and this was ${a(total)}.`
    case 'world':
      if (r.effect === 'push') return 'A 7. The fifth on the 7 wins exactly what the other four fifths lose, so it is a push.'
      if (won) return `${total} is a World number. The fifth on it pays ${total === 2 || total === 12 ? '30:1' : '15:1'}; the other four fifths lose.`
      return `One roll on 2, 3, 11 or 12 (a 7 pushes), and this was ${a(total)}.`
    case 'two':
    case 'three':
    case 'eleven':
    case 'twelve': {
      const target = { two: 2, three: 3, eleven: 11, twelve: 12 }[bet.kind]
      return won ? `${target} rolled. Pays ${target === 2 || target === 12 ? '30:1' : '15:1'}.` : `One roll on the ${target}, and this was ${a(total)}.`
    }
    case 'fire': {
      const made = ctx.firePoints
      if (!won) return `The shooter sevened out with ${made === 0 ? 'no points' : `only ${made} point${made === 1 ? '' : 's'}`} made. The Fire Bet needs 4 different points.`
      return `${made} different points made this shoot. Pays ${ratioText(FIRE_PAYS[Math.min(6, made)])}.`
    }
    case 'small':
    case 'tall':
    case 'all': {
      const set = bet.kind === 'small' ? SMALL_NUMBERS : bet.kind === 'tall' ? TALL_NUMBERS : ALL_NUMBERS
      return won ? `Every one of ${set.join(', ')} rolled before a 7.` : 'A 7 came before the set was complete.'
    }
  }
}

/** Where the chips went, said the way a dealer would. */
function fate(r: Resolution): string | undefined {
  switch (r.effect) {
    case 'win':
      return r.remaining > 0 ? `Your ${money(r.remaining)} stays up.` : `Your ${money(r.stake)} comes back with it.`
    case 'push':
      return r.remaining > 0 ? `Your ${money(r.remaining)} stays up.` : `Your ${money(r.stake)} comes back.`
    default:
      return undefined
  }
}

const OUTCOME: Record<Resolution['effect'], RollOutcome> = {
  win: 'won',
  lose: 'lost',
  push: 'push',
  move: 'moved',
  point: 'point',
  sevenOut: 'lost',
}

/**
 * A bet the roll did not decide, and why not — which is most of the felt on
 * most rolls, and exactly what someone counting their chips wants confirmed.
 */
function waiting(bet: Bet, ctx: Ctx, after: CrapsState): RollItem {
  const { total, point } = ctx
  const item = { id: bet.id, label: describeBet(bet.kind, bet.number).title, outcome: 'waiting' as const, amount: bet.amount }

  // Both line bets up on a point-setting roll: the settler reports the point
  // once, against the Pass Line, but Don't Pass changed just as much.
  if (bet.kind === 'dontPass' && ctx.note === 'pointSet') {
    return { ...item, outcome: 'point', why: `${total} became the point. Now it needs a 7 before another ${total}.` }
  }

  const live = craps.isWorking(bet, point)
  const counts = winningTotals(bet.kind, bet.number, point).includes(total) || losingTotals(bet.kind, bet.number, point).includes(total)
  if (!live && counts) {
    return { ...item, why: `${point === null ? 'Off on the come-out' : 'Turned off'}, so the ${total} did not count.` }
  }

  switch (bet.kind) {
    case 'fire': {
      const made = after.shoot.firePoints.length
      return { ...item, why: `${made === 0 ? 'No points' : `${made} point${made === 1 ? '' : 's'}`} made so far. Pays if the shooter makes 4 or more.` }
    }
    case 'small':
    case 'tall':
    case 'all': {
      const set = bet.kind === 'small' ? SMALL_NUMBERS : bet.kind === 'tall' ? TALL_NUMBERS : ALL_NUMBERS
      const missing = set.filter((n) => !after.shoot.numbersHit.includes(n))
      return { ...item, why: `Still needs ${missing.slice(0, -1).join(', ')}${missing.length > 1 ? ' and ' : ''}${missing[missing.length - 1]} before a 7.` }
    }
  }

  // Read against the point as it stands now: that is what the bet needs next.
  const now = after.point
  const needs = `Wins on ${winCondition(bet.kind, bet.number, now)}, loses on ${loseCondition(bet.kind, bet.number, now)}.`
  return { ...item, why: craps.isWorking(bet, now) ? needs : `${needs} Off for the come-out.` }
}

export function explainRoll(before: CrapsState, after: CrapsState): RollStory | null {
  const roll = after.roll
  if (!roll || after.phase !== 'betting') return null

  // On the roll that ends a shoot the live log has already been reset for the
  // next shooter; the throw that did it is on the finished one.
  const shoot = after.finishedShoot ?? after.shoot
  const entry = shoot.log[shoot.log.length - 1]
  const point = before.point
  const ctx: Ctx = {
    total: roll.total,
    a: roll.a,
    b: roll.b,
    point,
    note: entry?.note,
    firePoints: shoot.firePoints.length,
  }

  const items: RollItem[] = after.resolutions.map((r) => {
    const bet = before.bets[r.betId]
    // A stand-off and a bet that sat the roll out are both pushes to the
    // settler; to a player they are different things.
    const outcome = r.effect === 'push' && bet && !craps.isWorking(bet, point) ? 'off' : OUTCOME[r.effect]
    return {
      id: r.betId,
      label: r.label,
      outcome,
      amount: r.effect === 'win' || r.effect === 'lose' ? r.net : r.stake,
      why: why(bet, r, ctx),
      fate: fate(r),
    }
  })

  const settled = new Set(after.resolutions.map((r) => r.betId))
  for (const bet of Object.values(before.bets)) {
    if (!settled.has(bet.id)) items.push(waiting(bet, ctx, after))
  }

  items.sort((x, y) => ORDER[x.outcome] - ORDER[y.outcome] || Math.abs(y.amount) - Math.abs(x.amount))

  return {
    seq: after.seq,
    a: roll.a,
    b: roll.b,
    total: roll.total,
    headline: stickmanCall(roll, entry, after.seq).title,
    summary: summaryFor(ctx),
    items,
    waitingLabel: `Not decided by ${a(roll.total)}`,
    net: after.resolutions.reduce((sum, r) => sum + r.net, 0),
  }
}
