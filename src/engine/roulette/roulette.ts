import { createRng, seedRng, type Seed } from '../rng'
import { betById, betTitle, isInside, payFor, type BetDef } from './bets'
import type { RouletteBet, RouletteLimits, RouletteResolution, RouletteState } from './types'
import { pocketCount, pockets, type Pocket, type WheelType } from './wheel'

/**
 * The game around the wheel: chips on, chips off, the spin, and the pay.
 *
 * The ball's number is drawn from the seeded generator the moment the dealer
 * spins. Everything the renderer then does — the wheel slowing, the ball
 * dropping off the track and rattling into its pocket — is played back to land
 * on a number the engine has already settled.
 */

export const MAX_HISTORY = 200

export function createGame(bankroll: number, seed: Seed, limits: RouletteLimits, wheel: WheelType = 'double'): RouletteState {
  return {
    wheel,
    bankroll,
    bets: {},
    phase: 'betting',
    result: null,
    history: [],
    resolutions: [],
    lastBets: {},
    rng: seedRng(seed),
    limits,
    seq: 0,
  }
}

export function totalOnLayout(state: RouletteState): number {
  return Object.values(state.bets).reduce((sum, b) => sum + b.amount, 0)
}

export function insideTotal(state: RouletteState): number {
  return Object.values(state.bets).reduce((sum, b) => sum + (isInside(b.kind) ? b.amount : 0), 0)
}

/** The ceiling on one bet. Inside bets pay the same at the maximum whatever they cover. */
export function maxFor(limits: RouletteLimits, def: BetDef): number {
  return isInside(def.kind) ? limits.maxStraight * def.numbers.length : limits.maxOutside
}

export interface Check {
  ok: boolean
  reason?: string
}

export function canPlace(state: RouletteState, id: string): Check {
  if (state.phase === 'spinning') return { ok: false, reason: 'No more bets — the ball is spinning' }
  const def = betById(state.wheel, id)
  if (!def) return { ok: false, reason: 'That is not a bet on this layout' }
  const on = state.bets[id]?.amount ?? 0
  if (on >= maxFor(state.limits, def)) return { ok: false, reason: `${betTitle(def)} is at the table maximum` }
  return { ok: true }
}

/**
 * Put chips on a bet. Outside bets start at the table minimum; inside bets take
 * any chip, because the minimum there is on their total.
 */
export function placeBet(state: RouletteState, id: string, amount: number): RouletteState {
  const base = state.phase === 'settled' ? clearForNextSpin(state) : state
  if (!canPlace(base, id).ok || amount <= 0) return state
  const def = betById(base.wheel, id)!
  const on = base.bets[id]?.amount ?? 0
  const wanted = on === 0 && !isInside(def.kind) ? Math.max(amount, base.limits.tableMin) : amount
  const add = Math.min(wanted, maxFor(base.limits, def) - on, Math.floor(base.bankroll))
  if (add <= 0) return state
  if (on === 0 && !isInside(def.kind) && add < base.limits.tableMin) return state
  return {
    ...base,
    bets: { ...base.bets, [id]: { ...def, amount: on + add } },
    bankroll: base.bankroll - add,
  }
}

/** Take a bet back. Right-click on the layout, or the rail's button. */
export function removeBet(state: RouletteState, id: string, amount?: number): RouletteState {
  if (state.phase !== 'betting') return state
  const bet = state.bets[id]
  if (!bet) return state
  const take = amount === undefined ? bet.amount : Math.min(amount, bet.amount)
  const bets = { ...state.bets }
  if (take >= bet.amount) delete bets[id]
  else bets[id] = { ...bet, amount: bet.amount - take }
  return { ...state, bets, bankroll: state.bankroll + take }
}

export function clearBets(state: RouletteState): RouletteState {
  if (state.phase !== 'betting') return state
  return { ...state, bets: {}, bankroll: state.bankroll + totalOnLayout(state) }
}

/** Every bet doubled, as far as the limits and the rack allow. */
export function doubleBets(state: RouletteState): RouletteState {
  let next = state
  for (const bet of Object.values(state.bets)) next = placeBet(next, bet.id, bet.amount)
  return next
}

export function rebet(state: RouletteState): RouletteState {
  const base = state.phase === 'settled' ? clearForNextSpin(state) : state
  if (base.phase !== 'betting') return state
  const wanted = Object.values(base.lastBets).reduce((sum, b) => sum + b.amount, 0)
  const cleared = clearBets(base)
  if (wanted === 0 || wanted > cleared.bankroll) return state
  return { ...cleared, bets: { ...base.lastBets }, bankroll: cleared.bankroll - wanted }
}

export function canSpin(state: RouletteState): Check {
  if (state.phase === 'spinning') return { ok: false, reason: 'The ball is already spinning' }
  const bets = Object.values(state.bets)
  if (bets.length === 0) return { ok: false, reason: 'Put some chips on the layout' }
  const inside = insideTotal(state)
  if (inside > 0 && inside < state.limits.tableMin) {
    return { ok: false, reason: `Inside bets need $${state.limits.tableMin} between them — $${inside} is down` }
  }
  return { ok: true }
}

/** The dealer spins: the number is decided now. */
export function spin(state: RouletteState): RouletteState {
  if (!canSpin(state).ok) return state
  const rng = createRng(state.rng)
  const all = pockets(state.wheel)
  const result = all[rng.below(pocketCount(state.wheel))]
  return { ...state, phase: 'spinning', result, rng: rng.state(), resolutions: [], seq: state.seq + 1 }
}

/** For tests and walkthroughs: spin to a chosen number. */
export function spinTo(state: RouletteState, result: Pocket): RouletteState {
  if (!canSpin(state).ok) return state
  return { ...state, phase: 'spinning', result, resolutions: [], seq: state.seq + 1 }
}

export function resolveBet(bet: RouletteBet, result: Pocket): RouletteResolution {
  const won = bet.numbers.includes(result)
  return { betId: bet.id, stake: bet.amount, net: won ? bet.amount * payFor(bet) : -bet.amount, effect: won ? 'win' : 'lose' }
}

/**
 * Sweep the losers, pay the winners. A winning bet's stake comes back with its
 * winnings, so the layout is clear for the next spin — and remembered, so one
 * button puts it all back.
 */
export function settle(state: RouletteState): RouletteState {
  if (state.phase !== 'spinning' || state.result === null) return state
  const result = state.result
  const resolutions = Object.values(state.bets).map((b) => resolveBet(b, result))
  const returned = resolutions.reduce((sum, r) => sum + (r.effect === 'win' ? r.stake + r.net : 0), 0)
  return {
    ...state,
    phase: 'settled',
    bankroll: state.bankroll + returned,
    resolutions,
    lastBets: { ...state.bets },
    history: [result, ...state.history].slice(0, MAX_HISTORY),
  }
}

/** The marker comes off the number and the layout is open again. */
export function clearForNextSpin(state: RouletteState): RouletteState {
  if (state.phase !== 'settled') return state
  return { ...state, phase: 'betting', bets: {}, resolutions: [] }
}

export function spinNet(state: RouletteState): number {
  return state.resolutions.reduce((sum, r) => sum + r.net, 0)
}

/**
 * Walk to the other wheel between spins. The chips come back to the rack —
 * the two layouts do not have the same bets — and the history starts again,
 * because it is a different wheel.
 */
export function setWheel(state: RouletteState, wheel: WheelType, limits: RouletteLimits): RouletteState {
  if (state.phase === 'spinning' || state.wheel === wheel) return state
  const base = clearBets(state.phase === 'settled' ? clearForNextSpin(state) : state)
  return { ...base, wheel, limits, lastBets: {}, history: [], result: null }
}

/**
 * What the layout as it stands is worth: the chance of winning something, the
 * expected loss, and the net of every possible number — the roulette version of
 * the craps rail's "if the next roll is…".
 */
export function layoutSummary(state: RouletteState) {
  const bets = Object.values(state.bets)
  const all = pockets(state.wheel)
  const n = all.length
  const outcomes = all.map((p) => ({ pocket: p, net: bets.reduce((sum, b) => sum + resolveBet(b, p).net, 0) }))
  const staked = totalOnLayout(state)
  const expected = outcomes.reduce((sum, o) => sum + o.net, 0) / n
  const covered = outcomes.filter((o) => bets.some((b) => b.numbers.includes(o.pocket))).length
  return {
    staked,
    covered,
    /** Pockets where the layout as a whole comes out ahead. */
    ahead: outcomes.filter((o) => o.net > 0).length,
    expected,
    edge: staked > 0 ? -expected / staked : 0,
    outcomes,
    best: outcomes.reduce((m, o) => Math.max(m, o.net), -Infinity),
  }
}
