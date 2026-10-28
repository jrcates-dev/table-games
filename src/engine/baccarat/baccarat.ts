import { cents } from '../edge'
import { createShoe, draw, needsShuffle, reshuffle } from '../cards'
import type { Seed } from '../rng'
import type { Card, DealtCard, ShoeState } from '../types'
import {
  BACCARAT_BETS,
  BACCARAT_DECKS,
  BACCARAT_ORDER,
  BACCARAT_PENETRATION,
  BANKER_COMMISSION,
  DRAGON_MARGIN_PAYS,
  PAIR_PAYS,
  TIE_PAYS,
} from './rules'
import { bankerDraws, cardPoints, handTotal, isNatural, playerDraws } from './tableau'
import type {
  BaccaratBetKind,
  BaccaratLimits,
  BaccaratResolution,
  BaccaratState,
  Coup,
  CoupCard,
  Side,
} from './types'

/**
 * A fresh shoe: shuffled, the first card turned up, and that many more burned
 * — a ten or a face card burns ten — exactly as the dealer does before the
 * first coup.
 */
function freshShoe(shoe: ShoeState): { shoe: ShoeState; burnCard: DealtCard; burned: number } {
  const first = draw(shoe)
  const value = cardPoints(first.card.rank) || 10
  let next = first.shoe
  for (let i = 0; i < value; i++) next = draw(next).shoe
  return { shoe: next, burnCard: { ...first.card, seq: 0, faceDown: false }, burned: value }
}

export function createGame(bankroll: number, seed: Seed, limits: BaccaratLimits): BaccaratState {
  const { shoe, burnCard, burned } = freshShoe(createShoe(BACCARAT_DECKS, BACCARAT_PENETRATION, seed))
  return {
    shoe,
    bankroll,
    bets: {},
    phase: 'betting',
    coup: null,
    resolutions: [],
    scores: [],
    lastBets: {},
    burnCard,
    burned,
    limits,
    seq: 0,
  }
}

export function totalOnFelt(state: BaccaratState): number {
  return Object.values(state.bets).reduce((sum, v) => sum + (v ?? 0), 0)
}

export function isSideBet(kind: BaccaratBetKind): boolean {
  return BACCARAT_BETS[kind].side || kind === 'tie'
}

export function minFor(state: BaccaratState, kind: BaccaratBetKind): number {
  return isSideBet(kind) ? state.limits.minSide : state.limits.minBet
}

export function maxFor(state: BaccaratState, kind: BaccaratBetKind): number {
  return isSideBet(kind) ? state.limits.maxSide : state.limits.maxBet
}

export interface Check {
  ok: boolean
  reason?: string
}

export function canPlace(state: BaccaratState, kind: BaccaratBetKind): Check {
  if (state.phase !== 'betting') return { ok: false, reason: 'No more bets — the cards are out' }
  const on = state.bets[kind] ?? 0
  if (on >= maxFor(state, kind)) return { ok: false, reason: `${BACCARAT_BETS[kind].title} is at the table maximum` }
  // Betting both sides is allowed by the rules and pointless by the maths: the
  // commission makes it a guaranteed loss. A real dealer would let you; so do we.
  return { ok: true }
}

/**
 * Add chips to a bet. A new bet arrives at no less than its minimum, and no
 * bet grows past the table maximum or the rack.
 */
export function placeBet(state: BaccaratState, kind: BaccaratBetKind, amount: number): BaccaratState {
  if (!canPlace(state, kind).ok || amount <= 0) return state
  const on = state.bets[kind] ?? 0
  const wanted = on === 0 ? Math.max(amount, minFor(state, kind)) : amount
  const add = Math.min(wanted, maxFor(state, kind) - on, Math.floor(state.bankroll))
  if (add <= 0 || (on === 0 && add < minFor(state, kind))) return state
  return { ...state, bets: { ...state.bets, [kind]: on + add }, bankroll: cents(state.bankroll - add) }
}

export function removeBet(state: BaccaratState, kind: BaccaratBetKind): BaccaratState {
  if (state.phase !== 'betting') return state
  const on = state.bets[kind]
  if (!on) return state
  const bets = { ...state.bets }
  delete bets[kind]
  return { ...state, bets, bankroll: cents(state.bankroll + on) }
}

export function clearBets(state: BaccaratState): BaccaratState {
  if (state.phase !== 'betting') return state
  return { ...state, bets: {}, bankroll: cents(state.bankroll + totalOnFelt(state)) }
}

/** Put the last coup's bets back down, if the rack still covers them. */
export function rebet(state: BaccaratState): BaccaratState {
  if (state.phase !== 'betting') return state
  const wanted = Object.values(state.lastBets).reduce((sum, v) => sum + (v ?? 0), 0)
  if (wanted === 0 || wanted > state.bankroll + totalOnFelt(state)) return state
  const cleared = clearBets(state)
  return { ...cleared, bets: { ...state.lastBets }, bankroll: cents(cleared.bankroll - wanted) }
}

export function canDeal(state: BaccaratState): Check {
  if (state.phase !== 'betting') return { ok: false, reason: 'The coup is already out' }
  const kinds = BACCARAT_ORDER.filter((k) => (state.bets[k] ?? 0) > 0)
  if (kinds.length === 0) return { ok: false, reason: 'Put a bet on Player, Banker or Tie' }
  for (const kind of kinds) {
    const min = minFor(state, kind)
    if ((state.bets[kind] ?? 0) < min) return { ok: false, reason: `${BACCARAT_BETS[kind].title} needs at least $${min}` }
  }
  return { ok: true }
}

/**
 * Deal the coup: two cards each, Player first, then whatever third cards the
 * tableau calls for. Nothing is paid yet — that is `settle`, once the renderer
 * has turned the cards over.
 */
export function deal(state: BaccaratState): BaccaratState {
  if (!canDeal(state).ok) return state
  let shoe = state.shoe
  let seq = 0
  const take = (side: Side, third = false): CoupCard => {
    const next = draw(shoe)
    shoe = next.shoe
    return { ...next.card, seq: seq++, faceDown: true, side, third }
  }

  const player = [take('player')]
  const banker = [take('banker')]
  player.push(take('player'))
  banker.push(take('banker'))

  const p2 = handTotal(player.map((c) => c.rank))
  const b2 = handTotal(banker.map((c) => c.rank))
  const natural = isNatural(p2) || isNatural(b2)

  if (!natural) {
    let playerThird: number | null = null
    if (playerDraws(p2)) {
      const card = take('player', true)
      player.push(card)
      playerThird = cardPoints(card.rank)
    }
    if (bankerDraws(b2, playerThird)) banker.push(take('banker', true))
  }

  return { ...state, shoe, coup: coupOf(player, banker, natural), phase: 'dealt', resolutions: [], seq: state.seq + 1 }
}

function coupOf(player: CoupCard[], banker: CoupCard[], natural: boolean): Coup {
  const playerTotal = handTotal(player.map((c) => c.rank))
  const bankerTotal = handTotal(banker.map((c) => c.rank))
  return {
    player,
    banker,
    playerTotal,
    bankerTotal,
    winner: playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie',
    natural,
    playerPair: player[0].rank === player[1].rank,
    bankerPair: banker[0].rank === banker[1].rank,
  }
}

/** What a coup does to one bet. Exported for the rail and the tests. */
export function resolveBet(kind: BaccaratBetKind, stake: number, coup: Coup): BaccaratResolution {
  const win = (net: number, note: string): BaccaratResolution => ({ kind, stake, net: cents(net), effect: 'win', note })
  const lose = (note: string): BaccaratResolution => ({ kind, stake, net: -stake, effect: 'lose', note })
  const push = (note: string): BaccaratResolution => ({ kind, stake, net: 0, effect: 'push', note })
  const score = `${coup.playerTotal}–${coup.bankerTotal}`

  switch (kind) {
    case 'player':
      if (coup.winner === 'player') return win(stake, `Player wins ${score}`)
      if (coup.winner === 'tie') return push(`Tie ${score} — Player bets push`)
      return lose(`Banker wins ${score}`)
    case 'banker':
      if (coup.winner === 'banker') return win(stake * (1 - BANKER_COMMISSION), `Banker wins ${coup.bankerTotal}–${coup.playerTotal}, less 5%`)
      if (coup.winner === 'tie') return push(`Tie ${score} — Banker bets push`)
      return lose(`Player wins ${score}`)
    case 'tie':
      return coup.winner === 'tie' ? win(stake * TIE_PAYS, `Tie on ${coup.playerTotal}`) : lose(`No tie, ${score}`)
    case 'playerPair':
      return coup.playerPair ? win(stake * PAIR_PAYS, `Player pairs ${coup.player[0].rank}s`) : lose('Player’s first two cards are not a pair')
    case 'bankerPair':
      return coup.bankerPair ? win(stake * PAIR_PAYS, `Banker pairs ${coup.banker[0].rank}s`) : lose('Banker’s first two cards are not a pair')
    case 'dragonPlayer':
    case 'dragonBanker': {
      const side: Side = kind === 'dragonPlayer' ? 'player' : 'banker'
      const name = side === 'player' ? 'Player' : 'Banker'
      if (coup.winner === 'tie') return coup.natural ? push('Natural tie — the Dragon pushes') : lose('A tie after drawing')
      if (coup.winner !== side) return lose(`${name} loses`)
      if (coup.natural) return win(stake, `${name} wins with a natural`)
      const margin = Math.abs(coup.playerTotal - coup.bankerTotal)
      const pays = DRAGON_MARGIN_PAYS[margin] ?? 0
      return pays > 0 ? win(stake * pays, `${name} wins by ${margin} — pays ${pays} to 1`) : lose(`${name} wins by only ${margin}`)
    }
  }
}

/** Pay and take. Winners and pushes go back to the rack with their stakes. */
export function settle(state: BaccaratState): BaccaratState {
  const coup = state.coup
  if (state.phase !== 'dealt' || !coup) return state
  const resolutions = BACCARAT_ORDER.filter((k) => (state.bets[k] ?? 0) > 0).map((k) => resolveBet(k, state.bets[k]!, coup))
  const returned = resolutions.reduce((sum, r) => sum + (r.effect === 'lose' ? 0 : r.stake + r.net), 0)
  return {
    ...state,
    phase: 'settled',
    bankroll: cents(state.bankroll + returned),
    resolutions,
    lastBets: { ...state.bets },
    scores: [
      ...state.scores,
      {
        winner: coup.winner,
        playerTotal: coup.playerTotal,
        bankerTotal: coup.bankerTotal,
        natural: coup.natural,
        playerPair: coup.playerPair,
        bankerPair: coup.bankerPair,
      },
    ],
  }
}

/**
 * Clear the felt for the next coup. Once the cut card has come out the shoe is
 * retired and a new one shuffled, burned and started on a clean scoreboard.
 */
export function nextCoup(state: BaccaratState): BaccaratState {
  if (state.phase !== 'settled') return state
  const base: BaccaratState = { ...state, phase: 'betting', bets: {}, coup: null, resolutions: [] }
  if (!needsShuffle(state.shoe)) return base
  return newShoe(base)
}

export function newShoe(state: BaccaratState): BaccaratState {
  const { shoe, burnCard, burned } = freshShoe(reshuffle(state.shoe, BACCARAT_PENETRATION))
  return { ...state, shoe, burnCard, burned, scores: [] }
}

/** Net result of the coup just settled. */
export function coupNet(state: BaccaratState): number {
  return cents(state.resolutions.reduce((sum, r) => sum + r.net, 0))
}

/** Every card the player has seen this shoe: the burn card and everything dealt. */
export function seenCards(state: BaccaratState): Card[] {
  const start = state.burned + 1
  const seen = state.shoe.cards.slice(start, state.shoe.pos)
  return state.burnCard ? [state.burnCard, ...seen] : seen
}

/** Cards left before the cut card, roughly — what a player can see in the shoe. */
export function cardsToCut(state: BaccaratState): number {
  return Math.max(0, state.shoe.cutIndex - state.shoe.pos)
}
