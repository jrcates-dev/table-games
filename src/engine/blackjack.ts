import { createShoe, draw, isTen, needsShuffle, reshuffle, sameSplitValue } from './cards'
import { evaluate, isDealerNatural, isNatural } from './hand'
import type { Seed } from './rng'
import type {
  DealtCard,
  GameState,
  PlayerAction,
  PlayerHand,
  RuleSet,
  ShoeState,
} from './types'

/**
 * The blackjack state machine.
 *
 * Every exported function is pure: it takes a `GameState` and returns a new
 * one. Nothing here schedules timers or touches the DOM — the renderer decides
 * how long a deal animation takes and calls `finishDealing` / `dealerStep` when
 * it is ready for the next logical step. That split is what keeps the rules
 * honest while still allowing a slow, weighty, casino-paced presentation.
 */

let handCounter = 0
function nextHandId(): string {
  return `hand-${++handCounter}`
}

function emptyRound(): GameState['round'] {
  return {
    phase: 'betting',
    hands: [],
    activeHandIndex: 0,
    dealer: [],
    insuranceBet: 0,
    insuranceSettled: false,
    insuranceOutcome: undefined,
    seq: 0,
    wagered: 0,
  }
}

export function createGame(rules: RuleSet, bankroll: number, seed: Seed): GameState {
  return {
    rules,
    shoe: createShoe(rules.decks, rules.penetration, seed),
    bankroll,
    round: emptyRound(),
    pendingBet: 0,
  }
}

/** Pull one card from the shoe and stamp it with its deal order. */
function take(
  state: GameState,
  faceDown = false,
): { card: DealtCard; shoe: ShoeState; seq: number } {
  const { card, shoe } = draw(state.shoe)
  const seq = state.round.seq
  return { card: { ...card, seq, faceDown }, shoe, seq: seq + 1 }
}

// ---------------------------------------------------------------------------
// Betting
// ---------------------------------------------------------------------------

export function setBet(state: GameState, amount: number): GameState {
  if (state.round.phase !== 'betting') return state
  const clamped = Math.max(0, Math.min(amount, state.bankroll))
  return { ...state, pendingBet: clamped }
}

export function deal(state: GameState): GameState {
  if (state.round.phase !== 'betting') return state
  const bet = state.pendingBet
  if (bet <= 0 || bet > state.bankroll) return state

  let shoe = state.shoe
  let seq = 0
  const pull = (faceDown = false): DealtCard => {
    const result = draw(shoe)
    shoe = result.shoe
    const card: DealtCard = { ...result.card, seq, faceDown }
    seq += 1
    return card
  }

  // Dealt in casino order: player, dealer up, player, dealer hole.
  const p1 = pull()
  const d1 = pull()
  const p2 = pull()
  const d2 = pull(true)

  const hand: PlayerHand = {
    id: nextHandId(),
    cards: [p1, p2],
    bet,
    fromSplit: false,
    splitAces: false,
    doubled: false,
    surrendered: false,
    resolved: false,
  }

  return {
    ...state,
    shoe,
    bankroll: state.bankroll - bet,
    pendingBet: bet,
    round: {
      phase: 'dealing',
      hands: [hand],
      activeHandIndex: 0,
      dealer: [d1, d2],
      insuranceBet: 0,
      insuranceSettled: false,
      insuranceOutcome: undefined,
      seq,
      wagered: bet,
    },
  }
}

/**
 * Called by the renderer once the four opening cards have landed. Decides
 * between offering insurance, resolving an immediate natural, or handing
 * control to the player.
 */
export function finishDealing(state: GameState): GameState {
  if (state.round.phase !== 'dealing') return state
  const upcard = state.round.dealer[0]

  if (upcard.rank === 'A' && state.bankroll >= state.round.hands[0].bet / 2) {
    return { ...state, round: { ...state.round, phase: 'insurance' } }
  }

  return resolvePeek(state)
}

// ---------------------------------------------------------------------------
// Insurance
// ---------------------------------------------------------------------------

export function takeInsurance(state: GameState): GameState {
  if (state.round.phase !== 'insurance') return state
  const cost = state.round.hands[0].bet / 2
  if (state.bankroll < cost) return declineInsurance(state)
  return resolvePeek({
    ...state,
    bankroll: state.bankroll - cost,
    round: {
      ...state.round,
      insuranceBet: cost,
      wagered: state.round.wagered + cost,
    },
  })
}

export function declineInsurance(state: GameState): GameState {
  if (state.round.phase !== 'insurance') return state
  return resolvePeek(state)
}

/**
 * The dealer's peek. With `dealerPeek` on, a natural is discovered before the
 * player commits any further chips, which is what makes doubling and splitting
 * against a ten safe.
 */
function resolvePeek(state: GameState): GameState {
  const { rules, round } = state
  const upcard = round.dealer[0]
  const dealerHasNatural = isDealerNatural(round.dealer)
  const peekable = upcard.rank === 'A' || isTen(upcard.rank)

  if (rules.dealerPeek && peekable && dealerHasNatural) {
    return settle(revealHole({ ...state, round: { ...round, insuranceSettled: true } }))
  }

  const withInsuranceResolved: GameState = {
    ...state,
    round: {
      ...round,
      insuranceSettled: true,
      insuranceOutcome: round.insuranceBet > 0 ? 'lose' : undefined,
    },
  }

  // A player natural ends the round immediately — there is nothing to decide.
  if (isNatural(withInsuranceResolved.round.hands[0])) {
    return settle(revealHole(withInsuranceResolved))
  }

  return beginHand(
    { ...withInsuranceResolved, round: { ...withInsuranceResolved.round, phase: 'playerTurn' } },
    0,
  )
}

function revealHole(state: GameState): GameState {
  return {
    ...state,
    round: {
      ...state.round,
      dealer: state.round.dealer.map((card) => ({ ...card, faceDown: false })),
    },
  }
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

function activeHand(state: GameState): PlayerHand | undefined {
  return state.round.hands[state.round.activeHandIndex]
}

function replaceHand(state: GameState, index: number, hand: PlayerHand): GameState {
  const hands = state.round.hands.slice()
  hands[index] = hand
  return { ...state, round: { ...state.round, hands } }
}

function canDoubleTotal(rules: RuleSet, hand: PlayerHand): boolean {
  const value = evaluate(hand.cards)
  if (rules.doubleOn === 'any') return true
  if (value.soft) return false
  if (rules.doubleOn === '9-11') return value.total >= 9 && value.total <= 11
  return value.total >= 10 && value.total <= 11
}

export function availableActions(state: GameState): PlayerAction[] {
  const { rules, round } = state
  if (round.phase === 'insurance') return ['insurance', 'declineInsurance']
  if (round.phase !== 'playerTurn') return []

  const hand = activeHand(state)
  if (!hand || hand.resolved) return []

  const value = evaluate(hand.cards)
  const frozenSplitAces = hand.splitAces && !rules.hitSplitAces
  const actions: PlayerAction[] = []

  if (!frozenSplitAces && value.total < 21) actions.push('hit')
  actions.push('stand')

  const isFirstDecision = hand.cards.length === 2
  const doubleAllowed =
    isFirstDecision &&
    !frozenSplitAces &&
    state.bankroll >= hand.bet &&
    canDoubleTotal(rules, hand) &&
    (!hand.fromSplit || rules.doubleAfterSplit)
  if (doubleAllowed) actions.push('double')

  const acePair = hand.cards.length === 2 && hand.cards[0].rank === 'A' && hand.cards[1].rank === 'A'
  const splitAllowed =
    isFirstDecision &&
    sameSplitValue(hand.cards[0].rank, hand.cards[1].rank) &&
    round.hands.length < rules.maxSplitHands &&
    state.bankroll >= hand.bet &&
    (!hand.splitAces || rules.resplitAces) &&
    (!acePair || !hand.fromSplit || rules.resplitAces)
  if (splitAllowed) actions.push('split')

  const surrenderAllowed =
    rules.surrender !== 'none' &&
    isFirstDecision &&
    round.hands.length === 1 &&
    !hand.fromSplit
  if (surrenderAllowed) actions.push('surrender')

  return actions
}

export function hit(state: GameState): GameState {
  if (!availableActions(state).includes('hit')) return state
  const index = state.round.activeHandIndex
  const hand = state.round.hands[index]
  const { card, shoe, seq } = take(state)
  const updated: PlayerHand = { ...hand, cards: [...hand.cards, card] }
  const value = evaluate(updated.cards)

  let next = replaceHand({ ...state, shoe, round: { ...state.round, seq } }, index, updated)

  // Busting or reaching 21 ends the hand — there is no legal follow-up.
  if (value.busted || value.total === 21) {
    next = replaceHand(next, index, { ...updated, resolved: true })
    return advance(next)
  }
  return next
}

export function stand(state: GameState): GameState {
  if (!availableActions(state).includes('stand')) return state
  const index = state.round.activeHandIndex
  const next = replaceHand(state, index, { ...state.round.hands[index], resolved: true })
  return advance(next)
}

export function double(state: GameState): GameState {
  if (!availableActions(state).includes('double')) return state
  const index = state.round.activeHandIndex
  const hand = state.round.hands[index]
  const { card, shoe, seq } = take(state)

  const updated: PlayerHand = {
    ...hand,
    cards: [...hand.cards, card],
    bet: hand.bet * 2,
    doubled: true,
    resolved: true,
  }

  const next = replaceHand(
    {
      ...state,
      shoe,
      bankroll: state.bankroll - hand.bet,
      round: { ...state.round, seq, wagered: state.round.wagered + hand.bet },
    },
    index,
    updated,
  )
  return advance(next)
}

export function split(state: GameState): GameState {
  if (!availableActions(state).includes('split')) return state
  const index = state.round.activeHandIndex
  const hand = state.round.hands[index]
  const isAces = hand.cards[0].rank === 'A'

  // The original hand keeps its first card and immediately draws a replacement;
  // the new box waits for its second card until play reaches it, exactly as a
  // live dealer would handle it.
  const { card, shoe, seq } = take(state)

  const left: PlayerHand = {
    ...hand,
    cards: [hand.cards[0], card],
    fromSplit: true,
    splitAces: isAces,
  }
  const right: PlayerHand = {
    id: nextHandId(),
    cards: [hand.cards[1]],
    bet: hand.bet,
    fromSplit: true,
    splitAces: isAces,
    doubled: false,
    surrendered: false,
    resolved: false,
  }

  const hands = state.round.hands.slice()
  hands[index] = left
  hands.splice(index + 1, 0, right)

  const next: GameState = {
    ...state,
    shoe,
    bankroll: state.bankroll - hand.bet,
    round: {
      ...state.round,
      hands,
      seq,
      wagered: state.round.wagered + hand.bet,
    },
  }

  return beginHand(next, index)
}

export function surrender(state: GameState): GameState {
  if (!availableActions(state).includes('surrender')) return state
  const index = state.round.activeHandIndex
  const next = replaceHand(state, index, {
    ...state.round.hands[index],
    surrendered: true,
    resolved: true,
  })
  return advance(next)
}

/**
 * Prepare `index` for play: deal its second card if it is a fresh split box,
 * then auto-resolve if the rules leave the player no decision (split aces that
 * cannot be re-split, or a two-card 21).
 */
function beginHand(state: GameState, index: number): GameState {
  let next: GameState = { ...state, round: { ...state.round, activeHandIndex: index } }
  let hand = next.round.hands[index]
  if (!hand) return advance(next)

  if (hand.cards.length === 1) {
    const { card, shoe, seq } = take(next)
    hand = { ...hand, cards: [...hand.cards, card] }
    next = replaceHand({ ...next, shoe, round: { ...next.round, seq } }, index, hand)
  }

  const value = evaluate(hand.cards)
  // A split ace that catches another ace still has a decision when the table
  // allows re-splitting aces and there is room (and money) for another box.
  const canResplit =
    hand.cards.every((card) => card.rank === 'A') &&
    next.rules.resplitAces &&
    next.round.hands.length < next.rules.maxSplitHands &&
    next.bankroll >= hand.bet
  const frozenSplitAces = hand.splitAces && !next.rules.hitSplitAces && !canResplit
  if (frozenSplitAces || value.total === 21 || value.busted) {
    next = replaceHand(next, index, { ...hand, resolved: true })
    return advance(next)
  }

  return next
}

/** Move to the next unresolved box, or hand the shoe to the dealer. */
function advance(state: GameState): GameState {
  const nextIndex = state.round.hands.findIndex((hand) => !hand.resolved)
  if (nextIndex === -1) {
    return revealHole({ ...state, round: { ...state.round, phase: 'dealerTurn' } })
  }
  if (nextIndex === state.round.activeHandIndex) {
    return { ...state, round: { ...state.round, activeHandIndex: nextIndex } }
  }
  return beginHand(state, nextIndex)
}

// ---------------------------------------------------------------------------
// Dealer
// ---------------------------------------------------------------------------

export function dealerMustHit(cards: readonly DealtCard[], rules: RuleSet): boolean {
  const value = evaluate(cards)
  if (value.total < 17) return true
  return rules.dealerHitsSoft17 && value.total === 17 && value.soft
}

/**
 * True when at least one player hand can still be beaten. If every box busted
 * or surrendered the dealer turns the hole card over and the round is done —
 * they do not draw for a hand that cannot win anything.
 */
function hasLiveHand(state: GameState): boolean {
  return state.round.hands.some(
    (hand) => !hand.surrendered && !evaluate(hand.cards).busted,
  )
}

/**
 * Advance the dealer by exactly one card so the renderer can pace the draw.
 * Returns an unchanged phase until the dealer is finished, then settles.
 */
export function dealerStep(state: GameState): GameState {
  if (state.round.phase !== 'dealerTurn') return state

  if (!hasLiveHand(state) || !dealerMustHit(state.round.dealer, state.rules)) {
    return settle(state)
  }

  const { card, shoe, seq } = take(state)
  return {
    ...state,
    shoe,
    round: { ...state.round, dealer: [...state.round.dealer, card], seq },
  }
}

/** True when `dealerStep` still has a card to draw. */
export function dealerHasMoreToDraw(state: GameState): boolean {
  return (
    state.round.phase === 'dealerTurn' &&
    hasLiveHand(state) &&
    dealerMustHit(state.round.dealer, state.rules)
  )
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

export function settle(state: GameState): GameState {
  const { rules, round } = state
  const dealerValue = evaluate(round.dealer)
  const dealerNatural = isDealerNatural(round.dealer)

  let returned = 0
  const hands = round.hands.map<PlayerHand>((hand) => {
    if (hand.surrendered) {
      returned += hand.bet / 2
      return { ...hand, outcome: 'surrender', payout: hand.bet / 2 }
    }

    const value = evaluate(hand.cards)
    const playerNatural = isNatural(hand)

    if (dealerNatural) {
      if (playerNatural) {
        returned += hand.bet
        return { ...hand, outcome: 'push', payout: hand.bet }
      }
      return { ...hand, outcome: 'dealerBlackjack', payout: 0 }
    }

    if (value.busted) return { ...hand, outcome: 'bust', payout: 0 }

    if (playerNatural) {
      const payout = hand.bet + hand.bet * rules.blackjackPayout
      returned += payout
      return { ...hand, outcome: 'blackjack', payout }
    }

    if (dealerValue.busted || value.total > dealerValue.total) {
      returned += hand.bet * 2
      return { ...hand, outcome: 'win', payout: hand.bet * 2 }
    }
    if (value.total === dealerValue.total) {
      returned += hand.bet
      return { ...hand, outcome: 'push', payout: hand.bet }
    }
    return { ...hand, outcome: 'lose', payout: 0 }
  })

  let insuranceOutcome = round.insuranceOutcome
  if (round.insuranceBet > 0) {
    if (dealerNatural) {
      returned += round.insuranceBet + round.insuranceBet * rules.insurancePayout
      insuranceOutcome = 'win'
    } else {
      insuranceOutcome = 'lose'
    }
  }

  return {
    ...state,
    bankroll: state.bankroll + returned,
    round: {
      ...round,
      phase: 'roundOver',
      hands,
      dealer: round.dealer.map((card) => ({ ...card, faceDown: false })),
      insuranceOutcome,
      insuranceSettled: true,
    },
  }
}

/** Net chips won or lost across the round, ignoring returned wagers. */
export function roundNet(state: GameState): number {
  const staked = state.round.hands.reduce((sum, h) => sum + h.bet, 0) + state.round.insuranceBet
  const returned =
    state.round.hands.reduce((sum, h) => sum + (h.payout ?? 0), 0) +
    (state.round.insuranceOutcome === 'win'
      ? state.round.insuranceBet + state.round.insuranceBet * state.rules.insurancePayout
      : 0)
  return returned - staked
}

/**
 * Shuffle up before the cut card, at the player's request. Only with the felt
 * clear: once a round is dealt, its cards still belong to this shoe.
 */
export function shuffleUp(state: GameState): GameState {
  if (state.round.phase !== 'betting') return state
  return { ...state, shoe: reshuffle(state.shoe, state.rules.penetration) }
}

export function nextRound(state: GameState): GameState {
  if (state.round.phase !== 'roundOver') return state
  const shoe = needsShuffle(state.shoe)
    ? reshuffle(state.shoe, state.rules.penetration)
    : state.shoe
  const lastBet = state.round.hands[0]?.doubled
    ? state.round.hands[0].bet / 2
    : (state.round.hands[0]?.bet ?? state.pendingBet)
  return {
    ...state,
    shoe,
    round: emptyRound(),
    pendingBet: Math.min(lastBet, state.bankroll),
  }
}
