import { cents } from '../edge'
import { createRng, seedRng, shuffle, type Seed } from '../rng'
import { FORTUNE_LABEL, FORTUNE_PAYS, fortuneHand } from './fortune'
import { DECK_SIZE, handName, isPaiGow, JOKER, namedCategory, pairRank, QUEEN, rankOf, suitOf, topRank } from './hands'
import { houseWay } from './houseWay'
import { COMMISSION, DEFAULT_PAIGOW_RULES, type PaiGowLimits, type PaiGowRules } from './rules'
import { setHand, type SetHand } from './split'
import type { PaiGowBets, PaiGowCard, PaiGowResolution, PaiGowResult, PaiGowState, SetRead } from './types'

/**
 * Pai Gow Poker, one hand at a time.
 *
 * Both hands are dealt from a freshly shuffled 53-card deck the moment the bet
 * goes in. The player's seven are sorted, highest first, so a set is a choice
 * of two indices into them. The dealer's seven stay face down until the
 * player's set is down; then they are turned, set the house way, and the two
 * hands are read high against high and low against low.
 */

const EMPTY_BETS: PaiGowBets = { wager: 0, fortune: 0 }

export function createGame(bankroll: number, seed: Seed, limits: PaiGowLimits, rules: PaiGowRules = DEFAULT_PAIGOW_RULES): PaiGowState {
  return {
    rng: seedRng(seed),
    bankroll,
    bets: { ...EMPTY_BETS },
    phase: 'betting',
    player: [],
    dealer: [],
    result: null,
    resolutions: [],
    lastBets: { ...EMPTY_BETS },
    rules,
    limits,
    seq: 0,
  }
}

export function totalOnFelt(state: PaiGowState): number {
  return state.bets.wager + state.bets.fortune
}

export interface Check {
  ok: boolean
  reason?: string
}

function open(state: PaiGowState): PaiGowState {
  return state.phase === 'showdown' ? nextHand(state) : state
}

export function placeWager(state: PaiGowState, amount: number): PaiGowState {
  const s = open(state)
  if (s.phase !== 'betting' || amount <= 0) return state
  const on = s.bets.wager
  const wanted = on === 0 ? Math.max(amount, s.limits.minBet) : amount
  const add = Math.min(wanted, s.limits.maxBet - on, Math.floor(s.bankroll))
  if (add <= 0 || (on === 0 && add < s.limits.minBet)) return state
  return { ...s, bets: { ...s.bets, wager: on + add }, bankroll: cents(s.bankroll - add) }
}

export function placeFortune(state: PaiGowState, amount: number): PaiGowState {
  const s = open(state)
  if (s.phase !== 'betting' || amount <= 0) return state
  const on = s.bets.fortune
  const wanted = on === 0 ? Math.max(amount, s.limits.minFortune) : amount
  const add = Math.min(wanted, s.limits.maxFortune - on, Math.floor(s.bankroll))
  if (add <= 0 || (on === 0 && add < s.limits.minFortune)) return state
  return { ...s, bets: { ...s.bets, fortune: on + add }, bankroll: cents(s.bankroll - add) }
}

export function removeBet(state: PaiGowState, kind: keyof PaiGowBets): PaiGowState {
  if (state.phase !== 'betting' || state.bets[kind] === 0) return state
  return { ...state, bets: { ...state.bets, [kind]: 0 }, bankroll: cents(state.bankroll + state.bets[kind]) }
}

export function clearBets(state: PaiGowState): PaiGowState {
  if (state.phase !== 'betting') return state
  return { ...state, bets: { ...EMPTY_BETS }, bankroll: cents(state.bankroll + totalOnFelt(state)) }
}

/** The last hand's bets again. */
export function rebet(state: PaiGowState): PaiGowState {
  const s = clearBets(open(state))
  if (s.phase !== 'betting') return state
  const { wager, fortune } = s.lastBets
  if (wager === 0 || wager + fortune > s.bankroll) return state
  return { ...s, bets: { wager, fortune }, bankroll: cents(s.bankroll - wager - fortune) }
}

export function canDeal(state: PaiGowState): Check {
  if (state.phase !== 'betting') return { ok: false, reason: 'The hand is already out' }
  if (state.bets.wager < state.limits.minBet) return { ok: false, reason: `The bet needs at least $${state.limits.minBet}` }
  return { ok: true }
}

function toCard(code: number, seq: number, faceDown: boolean): PaiGowCard {
  const joker = code === JOKER
  return { id: joker ? 'JK' : `${rankOf(code)}${suitOf(code)}`, code, joker, rank: rankOf(code), suit: suitOf(code), seq, faceDown }
}

/** Highest first, the joker leading; suits break ties so the order never changes. */
export function sortCodes(codes: number[]): number[] {
  return [...codes].sort((a, b) => pairRank(b) - pairRank(a) || Number(b === JOKER) - Number(a === JOKER) || b - a)
}

/** Deal from a deck stacked in exactly this order (the tests use it): player's first card, dealer's, and so on. */
export function dealFrom(state: PaiGowState, order: number[]): PaiGowState {
  if (!canDeal(state).ok) return state
  const seqOf = new Map(order.slice(0, 14).map((code, i) => [code, i]))
  const playerCodes = sortCodes(order.filter((_, i) => i < 14 && i % 2 === 0))
  const dealerCodes = sortCodes(order.filter((_, i) => i < 14 && i % 2 === 1))
  return {
    ...state,
    phase: 'setting',
    player: playerCodes.map((c) => toCard(c, seqOf.get(c)!, false)),
    dealer: dealerCodes.map((c) => toCard(c, seqOf.get(c)!, true)),
    result: null,
    resolutions: [],
    lastBets: { ...state.bets },
    seq: state.seq + 1,
  }
}

export function deal(state: PaiGowState): PaiGowState {
  if (!canDeal(state).ok) return state
  const rng = createRng(state.rng)
  const deck = shuffle(
    Array.from({ length: DECK_SIZE }, (_, i) => i),
    rng,
  )
  return { ...dealFrom(state, deck), rng: rng.state() }
}

export const playerCodes = (state: PaiGowState) => state.player.map((c) => c.code)
export const dealerCodes = (state: PaiGowState) => state.dealer.map((c) => c.code)

function read(set: SetHand): SetRead {
  return {
    low: set.low,
    lowScore: set.lowScore,
    highScore: set.highScore,
    lowName: handName(set.lowScore, 2),
    highName: handName(set.highScore, 5),
    highCategory: namedCategory(set.highScore),
  }
}

/** The player sets their hand: these two in the low hand. A foul is allowed, and loses. */
export function setPlayerHand(state: PaiGowState, low: readonly number[]): PaiGowState {
  if (state.phase !== 'setting' || low.length !== 2 || low[0] === low[1]) return state
  if (low.some((i) => i < 0 || i > 6)) return state
  const mine = setHand(playerCodes(state), low, state.rules)
  const theirs = houseWay(dealerCodes(state), state.rules)
  const dealer = state.dealer.map((c) => ({ ...c, faceDown: false }))
  const versus = (p: number, d: number): 'win' | 'lose' | 'copy' => (p > d ? 'win' : p === d ? 'copy' : 'lose')
  const foul = !mine.legal
  const high = versus(mine.highScore, theirs.set.highScore)
  const lowResult = versus(mine.lowScore, theirs.set.lowScore)
  const won = high === 'win' && lowResult === 'win'
  const lost = high !== 'win' && lowResult !== 'win'
  const queenHighPush = state.rules.commissionFree && won && !foul && isPaiGow(theirs.set.highScore) && topRank(theirs.set.highScore) === QUEEN
  const outcome: PaiGowResult['outcome'] = foul ? 'foul' : won ? (queenHighPush ? 'push' : 'win') : lost ? 'lose' : 'push'
  return {
    ...state,
    dealer,
    phase: 'reveal',
    result: {
      player: read(mine),
      dealer: read(theirs.set),
      dealerRule: theirs.rule.id,
      foul,
      high,
      low: lowResult,
      outcome,
      queenHighPush,
      fortune: fortuneHand(playerCodes(state)),
    },
  }
}

/** The settlement, one bet at a time. Exported for the tests and the rail. */
export function resolveBets(bets: PaiGowBets, result: PaiGowResult, rules: PaiGowRules): PaiGowResolution[] {
  const out: PaiGowResolution[] = []
  const { wager, fortune } = bets
  switch (result.outcome) {
    case 'foul':
      out.push({ kind: 'wager', stake: wager, net: -wager, effect: 'lose', note: 'Foul — the low hand outranks the high' })
      break
    case 'win': {
      const net = rules.commissionFree ? wager : cents(wager * (1 - COMMISSION))
      out.push({ kind: 'wager', stake: wager, net, effect: 'win', note: rules.commissionFree ? 'Both hands win' : 'Both hands win · 5% commission' })
      break
    }
    case 'push':
      out.push({
        kind: 'wager',
        stake: wager,
        net: 0,
        effect: 'push',
        note: result.queenHighPush ? 'Dealer’s queen-high pai gow pushes the win' : 'One hand each',
      })
      break
    case 'lose':
      out.push({ kind: 'wager', stake: wager, net: -wager, effect: 'lose', note: result.high === 'copy' || result.low === 'copy' ? 'Dealer wins — copies go to the house' : 'Dealer wins both' })
      break
  }
  if (fortune > 0) {
    const hand = result.fortune
    if (hand) out.push({ kind: 'fortune', stake: fortune, net: fortune * FORTUNE_PAYS[hand], effect: 'win', note: `${FORTUNE_LABEL[hand]} pays ${FORTUNE_PAYS[hand].toLocaleString()} to 1` })
    else out.push({ kind: 'fortune', stake: fortune, net: -fortune, effect: 'lose', note: 'Less than a straight' })
  }
  return out
}

/** Pay and take. Fortune is paid on the seven cards alone — even a fouled hand. */
export function settle(state: PaiGowState): PaiGowState {
  if (state.phase !== 'reveal' || !state.result) return state
  const resolutions = resolveBets(state.bets, state.result, state.rules)
  const returned = resolutions.reduce((sum, r) => sum + (r.effect === 'lose' ? 0 : r.stake + r.net), 0)
  return { ...state, phase: 'showdown', resolutions, bankroll: cents(state.bankroll + returned) }
}

export function nextHand(state: PaiGowState): PaiGowState {
  if (state.phase !== 'showdown') return state
  return { ...state, phase: 'betting', bets: { ...EMPTY_BETS }, player: [], dealer: [], result: null, resolutions: [] }
}

export function handNet(state: PaiGowState): number {
  return cents(state.resolutions.reduce((sum, r) => sum + r.net, 0))
}

/** House rules change only between hands. */
export function setRules(state: PaiGowState, patch: Partial<PaiGowRules>): PaiGowState {
  return state.phase === 'betting' || state.phase === 'showdown' ? { ...state, rules: { ...state.rules, ...patch } } : state
}
