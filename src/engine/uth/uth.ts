import { createShoe, draw, reshuffle } from '../cards'
import { cents } from '../edge'
import type { Seed } from '../rng'
import type { DealtCard } from '../types'
import { CATEGORY_LABEL, describe, PAIR, categoryOf } from './poker'
import { BLIND_PAYS, TRIPS_TABLES, type TripsTableId, type UthLimits } from './rules'
import type { UthBets, UthDecision, UthResolution, UthResult, UthState } from './types'

/**
 * Ultimate Texas Hold'em, one hand at a time.
 *
 * The whole hand — both hole cards each and all five on the board — is dealt
 * from a freshly shuffled deck the moment the Ante goes in, the way the
 * shuffler hands the dealer a finished packet. What the player sees is gated
 * by `revealed`, and nothing the coach computes ever reads a card that is not
 * face up.
 */

const EMPTY_BETS: UthBets = { ante: 0, blind: 0, trips: 0, play: 0 }

export function createGame(bankroll: number, seed: Seed, limits: UthLimits, tripsTable: TripsTableId = 'standard'): UthState {
  return {
    deck: createShoe(1, 1, seed),
    bankroll,
    bets: { ...EMPTY_BETS },
    phase: 'betting',
    player: [],
    dealer: [],
    board: [],
    revealed: 0,
    raisedOn: null,
    raise: 0,
    result: null,
    resolutions: [],
    lastBets: { ante: 0, trips: 0 },
    tripsTable,
    limits,
    seq: 0,
  }
}

export function totalOnFelt(state: UthState): number {
  const { ante, blind, trips, play } = state.bets
  return ante + blind + trips + play
}

export interface Check {
  ok: boolean
  reason?: string
}

/** A new hand starts fresh from a settled one: chips home, cards off. */
function open(state: UthState): UthState {
  return state.phase === 'showdown' ? nextHand(state) : state
}

/** The Ante takes chips in pairs: whatever goes on the Ante goes on the Blind beside it. */
export function placeAnte(state: UthState, amount: number): UthState {
  const s = open(state)
  if (s.phase !== 'betting' || amount <= 0) return state
  const { ante } = s.bets
  const wanted = ante === 0 ? Math.max(amount, s.limits.minAnte) : amount
  const add = Math.min(wanted, s.limits.maxAnte - ante, Math.floor(s.bankroll / 2))
  if (add <= 0 || (ante === 0 && add < s.limits.minAnte)) return state
  return { ...s, bets: { ...s.bets, ante: ante + add, blind: ante + add }, bankroll: cents(s.bankroll - 2 * add) }
}

export function placeTrips(state: UthState, amount: number): UthState {
  const s = open(state)
  if (s.phase !== 'betting' || amount <= 0) return state
  const { trips } = s.bets
  const wanted = trips === 0 ? Math.max(amount, s.limits.minTrips) : amount
  const add = Math.min(wanted, s.limits.maxTrips - trips, Math.floor(s.bankroll))
  if (add <= 0 || (trips === 0 && add < s.limits.minTrips)) return state
  return { ...s, bets: { ...s.bets, trips: trips + add }, bankroll: cents(s.bankroll - add) }
}

export function removeBet(state: UthState, kind: 'ante' | 'trips'): UthState {
  if (state.phase !== 'betting') return state
  if (kind === 'trips') return { ...state, bets: { ...state.bets, trips: 0 }, bankroll: cents(state.bankroll + state.bets.trips) }
  const back = state.bets.ante + state.bets.blind
  return { ...state, bets: { ...state.bets, ante: 0, blind: 0 }, bankroll: cents(state.bankroll + back) }
}

export function clearBets(state: UthState): UthState {
  if (state.phase !== 'betting') return state
  return { ...state, bets: { ...EMPTY_BETS }, bankroll: cents(state.bankroll + totalOnFelt(state)) }
}

/** The last hand's Ante and Trips again. */
export function rebet(state: UthState): UthState {
  const s = clearBets(open(state))
  if (s.phase !== 'betting') return state
  const { ante, trips } = s.lastBets
  if (ante === 0 || 2 * ante + trips > s.bankroll) return state
  return { ...s, bets: { ante, blind: ante, trips, play: 0 }, bankroll: cents(s.bankroll - 2 * ante - trips) }
}

export function canDeal(state: UthState): Check {
  if (state.phase !== 'betting') return { ok: false, reason: 'The hand is already out' }
  if (state.bets.ante < state.limits.minAnte) return { ok: false, reason: `The Ante needs at least $${state.limits.minAnte}` }
  // Never deal a hand the player could be forced to fold: the river call is
  // always one more Ante.
  if (state.bankroll < state.bets.ante) return { ok: false, reason: 'Keep one more Ante in the rack — you need it to call on the river' }
  return { ok: true }
}

export function deal(state: UthState): UthState {
  if (!canDeal(state).ok) return state
  let deck = reshuffle(state.deck, 1)
  let seq = 0
  const take = (faceDown: boolean): DealtCard => {
    const next = draw(deck)
    deck = next.shoe
    return { ...next.card, seq: seq++, faceDown }
  }
  const p1 = take(false)
  const d1 = take(true)
  const p2 = take(false)
  const d2 = take(true)
  const board = Array.from({ length: 5 }, () => take(true))
  return {
    ...state,
    deck,
    phase: 'preflop',
    player: [p1, p2],
    dealer: [d1, d2],
    board,
    revealed: 0,
    raisedOn: null,
    raise: 0,
    result: null,
    resolutions: [],
    lastBets: { ante: state.bets.ante, trips: state.bets.trips },
    seq: state.seq + 1,
  }
}

const RAISE: Partial<Record<UthDecision, number>> = { bet4: 4, bet3: 3, bet2: 2, bet1: 1 }

/** What the player may do now, given the street and the rack. */
export function legalDecisions(state: UthState): UthDecision[] {
  const afford = (m: number) => state.bankroll >= state.bets.ante * m
  switch (state.phase) {
    case 'preflop':
      return (['check', 'bet3', 'bet4'] as const).filter((d) => d === 'check' || afford(RAISE[d]!))
    case 'flop':
      return (['check', 'bet2'] as const).filter((d) => d === 'check' || afford(2))
    case 'river':
      return (['fold', 'bet1'] as const).filter((d) => d === 'fold' || afford(1))
    default:
      return []
  }
}

function revealBoard(state: UthState, count: 3 | 5): UthState {
  return { ...state, revealed: count, board: state.board.map((c, i) => (i < count ? { ...c, faceDown: false } : c)) }
}

/** Check, raise or fold. A raise or a fold ends the player's part in the hand. */
export function decide(state: UthState, decision: UthDecision): UthState {
  if (!legalDecisions(state).includes(decision)) return state
  if (decision === 'check') {
    return state.phase === 'preflop' ? { ...revealBoard(state, 3), phase: 'flop' } : { ...revealBoard(state, 5), phase: 'river' }
  }
  if (decision === 'fold') return reveal({ ...state, raisedOn: null, raise: 0 }, true)
  const m = RAISE[decision]!
  const play = state.bets.ante * m
  const street = state.phase as 'preflop' | 'flop' | 'river'
  return reveal({ ...state, bets: { ...state.bets, play }, bankroll: cents(state.bankroll - play), raisedOn: street, raise: m }, false)
}

/** The rest of the board and the dealer's cards turn over, and the hands are read. */
function reveal(state: UthState, folded: boolean): UthState {
  const shown = revealBoard(state, 5)
  const dealer = state.dealer.map((c) => ({ ...c, faceDown: false }))
  const player = describe([...state.player, ...shown.board])
  const dealerHand = describe([...dealer, ...shown.board])
  const dealerQualifies = categoryOf(dealerHand.score) >= PAIR
  const outcome: UthResult['outcome'] = folded
    ? 'fold'
    : player.score > dealerHand.score
      ? 'win'
      : player.score < dealerHand.score
        ? 'lose'
        : 'tie'
  return {
    ...shown,
    dealer,
    phase: 'reveal',
    result: {
      playerScore: player.score,
      dealerScore: dealerHand.score,
      playerCategory: player.category,
      dealerCategory: dealerHand.category,
      playerName: player.name,
      dealerName: dealerHand.name,
      playerBest: player.best,
      dealerBest: dealerHand.best,
      outcome,
      dealerQualifies,
    },
  }
}

/** The settlement rules, one bet at a time. Exported for the tests and the rail. */
export function resolveBets(bets: UthBets, result: UthResult, tripsTable: TripsTableId): UthResolution[] {
  const out: UthResolution[] = []
  const win = (kind: UthResolution['kind'], stake: number, net: number, note: string) =>
    out.push({ kind, stake, net: cents(net), effect: 'win', note })
  const lose = (kind: UthResolution['kind'], stake: number, note: string) => out.push({ kind, stake, net: -stake, effect: 'lose', note })
  const push = (kind: UthResolution['kind'], stake: number, note: string) => out.push({ kind, stake, net: 0, effect: 'push', note })

  const { outcome, dealerQualifies, playerCategory } = result
  if (outcome === 'fold') {
    lose('ante', bets.ante, 'Folded')
    lose('blind', bets.blind, 'Folded')
  } else if (outcome === 'tie') {
    push('ante', bets.ante, 'Tie')
    push('blind', bets.blind, 'Tie')
    push('play', bets.play, 'Tie')
  } else if (outcome === 'win') {
    win('play', bets.play, bets.play, 'You win')
    if (dealerQualifies) win('ante', bets.ante, bets.ante, 'You win')
    else push('ante', bets.ante, 'Dealer does not open')
    const blind = BLIND_PAYS[playerCategory]
    if (blind !== undefined) win('blind', bets.blind, bets.blind * blind, `${CATEGORY_LABEL[playerCategory]} pays ${blind === 1.5 ? '3 to 2' : `${blind} to 1`}`)
    else push('blind', bets.blind, 'Less than a straight')
  } else {
    lose('play', bets.play, 'Dealer wins')
    if (dealerQualifies) lose('ante', bets.ante, 'Dealer wins')
    else push('ante', bets.ante, 'Dealer does not open')
    lose('blind', bets.blind, 'Dealer wins')
  }

  if (bets.trips > 0) {
    const pays = TRIPS_TABLES[tripsTable].pays[playerCategory]
    if (pays !== undefined) win('trips', bets.trips, bets.trips * pays, `${CATEGORY_LABEL[playerCategory]} pays ${pays} to 1`)
    else lose('trips', bets.trips, 'Less than three of a kind')
  }
  return out
}

/** Pay and take. Trips is paid on your hand alone — even one you folded. */
export function settle(state: UthState): UthState {
  if (state.phase !== 'reveal' || !state.result) return state
  const resolutions = resolveBets(state.bets, state.result, state.tripsTable)
  const returned = resolutions.reduce((sum, r) => sum + (r.effect === 'lose' ? 0 : r.stake + r.net), 0)
  return { ...state, phase: 'showdown', resolutions, bankroll: cents(state.bankroll + returned) }
}

export function nextHand(state: UthState): UthState {
  if (state.phase !== 'showdown') return state
  return {
    ...state,
    phase: 'betting',
    bets: { ...EMPTY_BETS },
    player: [],
    dealer: [],
    board: [],
    revealed: 0,
    raisedOn: null,
    raise: 0,
    result: null,
    resolutions: [],
  }
}

export function handNet(state: UthState): number {
  return cents(state.resolutions.reduce((sum, r) => sum + r.net, 0))
}

export function setTripsTable(state: UthState, tripsTable: TripsTableId): UthState {
  return state.phase === 'betting' || state.phase === 'showdown' ? { ...state, tripsTable } : state
}

/** The cards the player can see: their own, and whatever is face up on the board. */
export function visibleBoard(state: UthState): DealtCard[] {
  return state.board.slice(0, state.revealed)
}
