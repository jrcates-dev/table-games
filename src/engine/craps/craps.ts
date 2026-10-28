import { createRng, seedRng, type Seed } from '../rng'
import {
  ALL_NUMBERS,
  ARIA_ODDS_MULTIPLE,
  ATS_PAYS,
  buyVig,
  FIELD_PAYS,
  FIRE_PAYS,
  HARD_ODDS,
  increment,
  LAY_ODDS,
  layVig,
  pay,
  PLACE_ODDS,
  SMALL_NUMBERS,
  snap,
  spec,
  TALL_NUMBERS,
  TRUE_ODDS,
  type HardNumber,
} from './bets'
import {
  POINT_NUMBERS,
  type Bet,
  type BetKind,
  type CrapsLimits,
  type CrapsState,
  type DieFace,
  type PointNumber,
  type Resolution,
  type Roll,
  type RollLogEntry,
  type ShootState,
} from './types'

/**
 * The craps state machine.
 *
 * Every function here takes a state and returns a new one. Rolling is split in
 * two — `rollDice` draws the numbers, `settle` applies them — so the renderer
 * can spend as long as it likes tumbling the dice without the engine knowing
 * that time exists, exactly as the dealer's draw works in blackjack.
 */

export function betId(kind: BetKind, number?: number): string {
  return number === undefined ? kind : `${kind}-${number}`
}

export { POINT_NUMBERS }

export function isPointNumber(total: number): total is PointNumber {
  return (POINT_NUMBERS as readonly number[]).includes(total)
}

const EMPTY_SHOOT = (): ShootState => ({ firePoints: [], numbersHit: [], rolls: 0, log: [] })

export function createGame(bankroll: number, seed: Seed, limits: CrapsLimits): CrapsState {
  return {
    bankroll,
    point: null,
    bets: {},
    limits,
    rng: seedRng(seed),
    phase: 'betting',
    roll: null,
    resolutions: [],
    shoot: EMPTY_SHOOT(),
    shootNumber: 1,
    finishedShoot: null,
    seq: 0,
  }
}

/** Whether a bet is live for the roll about to happen. */
export function isWorking(bet: Bet, point: PointNumber | null): boolean {
  // A bet nobody can call off is in action whatever an old save says.
  if (!canToggleWorking(bet)) return true
  const mode = bet.working ?? 'auto'
  if (mode === 'off') return false
  if (mode === 'on') return true
  return point !== null || !spec(bet.kind).offOnComeOut
}

/**
 * Flat bets on the don't side. A dealer will take one down for you, but there
 * is no calling it off: while it is up, every roll counts against it.
 */
const ALWAYS_WORKING: ReadonlySet<BetKind> = new Set(['dontPass', 'dontCome', 'dontComePoint'])

/** Bets that the player is allowed to switch on and off. */
export function canToggleWorking(bet: Bet): boolean {
  const s = spec(bet.kind)
  return !s.contract && !s.oneRoll && !ALWAYS_WORKING.has(bet.kind)
}

/**
 * Bets the player can pull back off the felt.
 *
 * The line is a contract the moment a point exists — that is the trade for the
 * come-out's 7 and 11 having already been in your favour. The don't side can
 * come down whenever you like, because by then it is the favourite and the
 * house is happy to let you give up an edge.
 */
export function canRemove(bet: Bet, point: PointNumber | null): boolean {
  if (bet.kind === 'passLine') return point === null
  return !spec(bet.kind).contract
}

// ---------------------------------------------------------------------------
// Placing bets
// ---------------------------------------------------------------------------

export interface PlacementCheck {
  ok: boolean
  reason?: string
}

function lineBaseFor(state: CrapsState, kind: BetKind, number?: number): Bet | undefined {
  switch (kind) {
    case 'passOdds':
      return state.bets.passLine
    case 'dontPassOdds':
      return state.bets.dontPass
    case 'comeOdds':
      return state.bets[betId('comePoint', number)]
    case 'dontComeOdds':
      return state.bets[betId('dontComePoint', number)]
    default:
      return undefined
  }
}

/** The point an odds bet rides on: the table's, or the come bet's own. */
export function oddsPointFor(
  state: CrapsState,
  kind: BetKind,
  number?: number,
): PointNumber | null {
  if (kind === 'passOdds' || kind === 'dontPassOdds') return state.point
  if (kind === 'comeOdds' || kind === 'dontComeOdds') return (number as PointNumber) ?? null
  return null
}

/**
 * The table's ceiling on one spot, before anything already down.
 *
 * Odds are capped off the bet they ride behind. On the take side Aria's 3-4-5x
 * is a rule about the *payout*: whatever the point, the largest odds bet wins
 * exactly six times the line, which is why the multiple changes with the
 * number. The lay side mirrors it from the other end — the don't bettor may
 * *risk* up to six times the line on any point, which wins 3x against the 4,
 * 4x against the 5 and 5x against the 6.
 */
export function capFor(state: CrapsState, kind: BetKind, number?: number): number {
  const { limits } = state

  switch (kind) {
    case 'passOdds':
    case 'comeOdds': {
      const base = lineBaseFor(state, kind, number)
      const n = oddsPointFor(state, kind, number)
      if (!base || !n) return 0
      return base.amount * ARIA_ODDS_MULTIPLE[n]
    }
    case 'dontPassOdds':
    case 'dontComeOdds': {
      const base = lineBaseFor(state, kind, number)
      const n = oddsPointFor(state, kind, number)
      if (!base || !n) return 0
      // Lay up to six times the line, whatever the point.
      return base.amount * 6
    }
    case 'fire':
    case 'small':
    case 'tall':
    case 'all':
      return limits.maxSideBet
    case 'hard':
    case 'any7':
    case 'anyCraps':
    case 'ce':
    case 'horn':
    case 'world':
    case 'two':
    case 'three':
    case 'eleven':
    case 'twelve':
      return limits.maxProp
    default:
      return limits.maxBet
  }
}

/**
 * How much more this spot will take right now.
 *
 * The ceiling less whatever is already standing on it, and never more than the
 * rack can cover — which is the question placement asks. What the *limit* is,
 * which is the question a player reading the felt asks, is `capFor`.
 */
export function maxFor(state: CrapsState, kind: BetKind, number?: number): number {
  const existing = state.bets[betId(kind, number)]?.amount ?? 0
  return Math.max(0, Math.min(capFor(state, kind, number) - existing, state.bankroll))
}

/** Smallest stake the dealer will take on this spot. */
export function minFor(state: CrapsState, kind: BetKind, number?: number): number {
  const { limits } = state
  const step = (amount: number) => snap(amount + (increment(kind, number) - 1), kind, number)

  switch (kind) {
    case 'passOdds':
    case 'dontPassOdds':
    case 'comeOdds':
    case 'dontComeOdds':
      return increment(kind, number)
    case 'hard':
    case 'any7':
    case 'anyCraps':
    case 'ce':
    case 'horn':
    case 'world':
    case 'two':
    case 'three':
    case 'eleven':
    case 'twelve':
      return increment(kind, number)
    case 'fire':
    case 'small':
    case 'tall':
    case 'all':
      return 1
    case 'buy':
      // Buying in twenties is what makes the 5% commission land on a whole
      // dollar; below that the vig rounds against you every single time.
      return Math.max(step(limits.minBet), 20)
    case 'lay':
      // Lay enough that the win clears the table minimum.
      return number
        ? step(Math.ceil((limits.minBet * LAY_ODDS[number as PointNumber].den) / LAY_ODDS[number as PointNumber].num))
        : limits.minBet
    default:
      return step(limits.minBet)
  }
}

/** Odds ride behind another bet, so say plainly which one is not there. */
function missingBaseFor(kind: BetKind, number?: number): string {
  switch (kind) {
    case 'passOdds':
      return 'Take odds behind a pass line bet'
    case 'dontPassOdds':
      return 'Lay odds behind a don’t pass bet'
    case 'comeOdds':
      return `No come bet on the ${number} to back`
    default:
      return `No don’t come bet on the ${number} to back`
  }
}

export function canPlace(state: CrapsState, kind: BetKind, number?: number): PlacementCheck {
  if (state.phase !== 'betting') return { ok: false, reason: 'Dice are in the air' }
  const s = spec(kind)

  if (s.pointOnly && state.point === null) {
    return { ok: false, reason: 'Only once a point is established' }
  }
  if (kind === 'fire' && !(state.point === null && state.shoot.rolls === 0)) {
    return { ok: false, reason: 'Only before a new shooter’s first roll' }
  }
  if (
    (kind === 'small' || kind === 'tall' || kind === 'all') &&
    !(state.point === null && state.shoot.numbersHit.length === 0)
  ) {
    return { ok: false, reason: 'Only on a come-out, before any number is rolled' }
  }
  if ((kind === 'passLine' || kind === 'dontPass') && state.point !== null) {
    // You may put a line bet up mid-roll, but you would be giving away the
    // come-out's 7 and 11 — which is what the come box exists to avoid.
    return { ok: false, reason: 'Point is established — use the Come box' }
  }

  if (kind.endsWith('Odds') && lineBaseFor(state, kind, number) === undefined) {
    return { ok: false, reason: missingBaseFor(kind, number) }
  }

  // One kind of wager per box number: placing, buying and laying the same
  // number at once is either redundant or self-cancelling.
  if (kind === 'place' || kind === 'buy' || kind === 'lay') {
    const conflict = (['place', 'buy', 'lay'] as const).find(
      (other) => other !== kind && state.bets[betId(other, number)],
    )
    if (conflict) {
      return { ok: false, reason: `Take down your ${conflict} bet on the ${number} first` }
    }
    if (kind !== 'lay' && number === state.point && state.bets.passLine) {
      // Legal, and occasionally deliberate, so this is allowed — noted only.
    }
  }

  if (maxFor(state, kind, number) <= 0) {
    return { ok: false, reason: 'At the maximum for this bet' }
  }
  return { ok: true }
}

/**
 * Put chips down.
 *
 * The stake is snapped to an increment the dealer can actually pay, and the
 * remainder goes straight back to the rack rather than quietly evaporating —
 * a $5 chip on the six becomes $0 and a warning, not a bet that pays $5 on $5.
 */
export function placeBet(
  state: CrapsState,
  kind: BetKind,
  amount: number,
  number?: number,
): CrapsState {
  const check = canPlace(state, kind, number)
  if (!check.ok) return state

  const id = betId(kind, number)
  const existing = state.bets[id]
  const cap = maxFor(state, kind, number)
  const wanted = Math.min(amount, cap, state.bankroll)
  const total = snap((existing?.amount ?? 0) + wanted, kind, number)
  const added = total - (existing?.amount ?? 0)
  if (added <= 0) return state

  // Buy bets hand over the commission at the window.
  const vig = kind === 'buy' ? buyVig(total) - (existing?.vigPaid ?? 0) : 0
  if (added + vig > state.bankroll) return state

  return {
    ...state,
    bankroll: state.bankroll - added - vig,
    commission: (state.commission ?? 0) + vig,
    bets: {
      ...state.bets,
      [id]: {
        id,
        kind,
        amount: total,
        number,
        working: existing?.working,
        vigPaid: kind === 'buy' ? buyVig(total) : existing?.vigPaid,
      },
    },
  }
}

/** The odds bet riding behind a given bet, if the pairing exists. */
const ODDS_BEHIND: Partial<Record<BetKind, BetKind>> = {
  passLine: 'passOdds',
  dontPass: 'dontPassOdds',
  comePoint: 'comeOdds',
  dontComePoint: 'dontComeOdds',
}

export function removeBet(state: CrapsState, id: string): CrapsState {
  const bet = state.bets[id]
  if (!bet || state.phase !== 'betting') return state
  if (!canRemove(bet, state.point)) return state

  const bets = { ...state.bets }
  const taken = [bet]

  // Odds cannot stand on their own, so pulling the flat bet pulls them too.
  const oddsKind = ODDS_BEHIND[bet.kind]
  if (oddsKind) {
    const odds = bets[betId(oddsKind, bet.number)]
    if (odds) taken.push(odds)
  }

  // Commission already handed over on a buy is not refunded — the house has
  // earned it whether or not the bet ever gets a roll.
  for (const t of taken) delete bets[t.id]
  const refund = taken.reduce((sum, t) => sum + t.amount, 0)

  return { ...state, bankroll: state.bankroll + refund, bets }
}

export function setWorking(state: CrapsState, id: string, mode: Bet['working']): CrapsState {
  const bet = state.bets[id]
  if (!bet || state.phase !== 'betting' || !canToggleWorking(bet)) return state
  return { ...state, bets: { ...state.bets, [id]: { ...bet, working: mode } } }
}

/**
 * Flip a bet between working and off for the coming roll, as the ON/OFF button
 * does. Flipping it back to what the dealer would assume anyway clears the call
 * rather than recording the opposite one: come odds called on for a come-out
 * and then off again must not stay off through the whole point that follows.
 */
export function toggleWorking(state: CrapsState, id: string): CrapsState {
  const bet = state.bets[id]
  if (!bet) return state
  const wanted = !isWorking(bet, state.point)
  const byDefault = isWorking({ ...bet, working: 'auto' }, state.point)
  return setWorking(state, id, wanted === byDefault ? 'auto' : wanted ? 'on' : 'off')
}

/**
 * Every odds bet that currently has room behind a flat bet you already have.
 *
 * One definition, used both to decide whether the Max odds control does
 * anything and to decide what it does. Asking those two questions separately is
 * how the button ended up lit for the pass side and dead for the don't side
 * while the action itself handled both perfectly well.
 */
export function oddsTargets(state: CrapsState): Array<{ kind: BetKind; number?: number }> {
  const candidates: Array<{ kind: BetKind; number?: number }> = [
    { kind: 'passOdds' },
    { kind: 'dontPassOdds' },
    ...POINT_NUMBERS.flatMap((n) => [
      { kind: 'comeOdds' as BetKind, number: n },
      { kind: 'dontComeOdds' as BetKind, number: n },
    ]),
  ]
  return candidates.filter(
    (c) => maxFor(state, c.kind, c.number) > 0 && canPlace(state, c.kind, c.number).ok,
  )
}

/** Pull every bet that is legally removable. */
export function clearBets(state: CrapsState): CrapsState {
  return Object.keys(state.bets).reduce((acc, id) => removeBet(acc, id), state)
}

export function totalAtRisk(state: CrapsState): number {
  return Object.values(state.bets).reduce((sum, bet) => sum + bet.amount, 0)
}

/**
 * Where the money actually went on one roll.
 *
 * Craps separates two things every other game keeps together: whether a bet won
 * and whether its chips came back. A winning pass line is paid and its stake
 * stays on the felt. A winning come bet is paid and comes down. A bet that was
 * turned off is returned rather than lost. So the roll's profit and the change
 * in the rack are routinely different numbers, and a player watching only one
 * of them is left short of an explanation.
 *
 * Both are reported. `net` is what the roll was worth; `bankroll` is what the
 * rack saw — and the test alongside this asserts the second really does equal
 * the bankroll movement the settler produced, so the panel built on it cannot
 * drift into telling a story the ledger does not support.
 */
export interface RollLedger {
  /** Winnings credited. Stakes are not included. */
  paid: number
  /** Stakes the house took. */
  taken: number
  /** Stakes handed back: winners coming down, and bets that were not working. */
  returned: number
  /** Profit and loss — `paid` less `taken`. */
  net: number
  /** Change in the rack — `paid` plus `returned`. */
  bankroll: number
}

export function summariseRoll(resolutions: readonly Resolution[]): RollLedger {
  let paid = 0
  let taken = 0
  let returned = 0

  for (const r of resolutions) {
    if (r.effect === 'win') paid += r.net
    if (r.effect === 'lose') taken += -r.net
    // Anything that left the felt without being taken was handed back, whether
    // it won and came down or was never in action to begin with.
    if (r.effect !== 'lose' && r.remaining === 0) returned += r.stake
  }

  return { paid, taken, returned, net: paid - taken, bankroll: paid + returned }
}

// ---------------------------------------------------------------------------
// Rolling
// ---------------------------------------------------------------------------

/**
 * Whether the shooter may throw.
 *
 * Every casino requires the shooter to have a line bet before handing over the
 * dice, and it is a rule worth surfacing rather than quietly working around.
 */
export function canRoll(state: CrapsState): PlacementCheck {
  if (state.phase !== 'betting') return { ok: false, reason: 'Dice are in the air' }
  if (!state.bets.passLine && !state.bets.dontPass) {
    return { ok: false, reason: 'The shooter must have a line bet' }
  }
  // A stake the dealer cannot pay correctly is a stake the dealer will not
  // take. Building a bet up chip by chip is allowed; throwing with one is not.
  const short = underMinimum(state)
  if (short) {
    return {
      ok: false,
      reason: `${spec(short.bet.kind).title}${short.bet.number ? ` ${short.bet.number}` : ''} needs at least $${short.min}`,
    }
  }
  return { ok: true }
}

/** The first bet on the felt that is below what the dealer will accept. */
export function underMinimum(state: CrapsState): { bet: Bet; min: number } | null {
  for (const bet of Object.values(state.bets)) {
    const min = minFor(state, bet.kind, bet.number)
    if (bet.amount < min) return { bet, min }
  }
  return null
}

function makeRoll(a: DieFace, b: DieFace): Roll {
  const total = a + b
  return { a, b, total, hard: a === b && (total === 4 || total === 6 || total === 8 || total === 10) }
}

/**
 * Throw the dice.
 *
 * Two independent draws, which is what makes the distribution correct: drawing
 * a total from 2 to 12 directly would make a 7 as likely as a 2, and craps is
 * *entirely* a game about that not being true.
 *
 * The generator's state is carried forward past those draws, so the whole
 * session is one continuous stream and replays exactly from its opening seed.
 */
export function rollDice(state: CrapsState): CrapsState {
  if (!canRoll(state).ok) return state

  const rng = createRng(state.rng)
  const a = (rng.below(6) + 1) as DieFace
  const b = (rng.below(6) + 1) as DieFace

  return {
    ...state,
    rng: rng.state(),
    phase: 'rolling',
    roll: makeRoll(a, b),
    resolutions: [],
    finishedShoot: null,
    seq: state.seq + 1,
  }
}

/**
 * Force a specific roll. Used by the tests, and by the next-roll projection —
 * which is why it deliberately does not touch the generator.
 */
export function rollExactly(state: CrapsState, a: DieFace, b: DieFace): CrapsState {
  return { ...state, phase: 'rolling', roll: makeRoll(a, b), resolutions: [], seq: state.seq + 1 }
}

interface Ledger {
  bets: Record<string, Bet>
  bankroll: number
  resolutions: Resolution[]
}

function label(bet: Bet): string {
  const s = spec(bet.kind)
  return bet.number === undefined ? s.title : `${s.title} ${bet.number}`
}

/**
 * Apply the roll.
 *
 * The three ways a bet can end are deliberately distinct, because they move
 * different amounts of money: a place bet is *paid and left standing*, a line
 * bet on a point is *paid and returned*, and a bet called off is *returned
 * untouched* — which is exactly why come odds being off on the come-out is
 * worth knowing.
 */
export function settle(state: CrapsState): CrapsState {
  const roll = state.roll
  if (state.phase !== 'rolling' || !roll) return state

  const total = roll.total
  const wasComeOut = state.point === null
  const ledger: Ledger = { bets: { ...state.bets }, bankroll: state.bankroll, resolutions: [] }

  const push = (bet: Bet, effect: Resolution['effect'], net: number, remaining: number, detail: string) => {
    ledger.resolutions.push({
      betId: bet.id,
      label: label(bet),
      effect,
      net,
      stake: bet.amount,
      remaining,
      detail,
    })
  }
  /** Paid, and the stake stays on the felt to win again. */
  const payAndLeave = (bet: Bet, winnings: number, detail: string) => {
    ledger.bankroll += winnings
    push(bet, 'win', winnings, bet.amount, detail)
  }
  /** Paid, and the whole thing comes back to the rack. */
  const payAndReturn = (bet: Bet, winnings: number, detail: string) => {
    ledger.bankroll += winnings + bet.amount
    delete ledger.bets[bet.id]
    push(bet, 'win', winnings, 0, detail)
  }
  const lose = (bet: Bet, detail: string) => {
    delete ledger.bets[bet.id]
    push(bet, 'lose', -bet.amount, 0, detail)
  }
  /** Returned untouched — a stand-off, or a bet that was not working. */
  const returnBet = (bet: Bet, detail: string) => {
    ledger.bankroll += bet.amount
    delete ledger.bets[bet.id]
    push(bet, 'push', 0, 0, detail)
  }

  // Commission handed over at the window since the last roll. It left the rack
  // when the bet went down, so it moves no chips here; it is reported with this
  // roll so the roll's net, the history and the statistics all count it.
  const commission = state.commission ?? 0
  if (commission > 0) {
    ledger.resolutions.push({
      betId: 'commission',
      label: 'Commission',
      effect: 'lose',
      net: -commission,
      stake: commission,
      remaining: 0,
      detail: '5% paid to buy',
    })
  }

  /** The felt as it was when the dice left the shooter's hand. */
  const prior = (kind: BetKind, number?: number) => state.bets[betId(kind, number)]
  /** The felt as it stands part-way through settling. */
  const of = (kind: BetKind, number?: number) => ledger.bets[betId(kind, number)]
  const working = (bet: Bet) => isWorking(bet, state.point)

  // --- One-roll centre bets and the field -----------------------------------
  for (const bet of Object.values(state.bets)) {
    const unit = (n: number) => bet.amount / n

    switch (bet.kind) {
      case 'field': {
        const mult = FIELD_PAYS[total]
        if (mult) payAndLeave(bet, bet.amount * mult, `${total} pays ${mult}:1`)
        else lose(bet, `${total} is not a field number`)
        break
      }
      case 'any7':
        if (total === 7) payAndLeave(bet, bet.amount * 4, 'seven')
        else lose(bet, `${total}, not a seven`)
        break
      case 'anyCraps':
        if (total === 2 || total === 3 || total === 12) payAndLeave(bet, bet.amount * 7, `craps ${total}`)
        else lose(bet, `${total} is not craps`)
        break
      case 'ce':
        if (total === 2 || total === 3 || total === 12) payAndLeave(bet, bet.amount * 3, `craps ${total}`)
        else if (total === 11) payAndLeave(bet, bet.amount * 7, 'yo eleven')
        else lose(bet, `${total} misses both halves`)
        break
      case 'horn':
        if (total === 2 || total === 12) payAndLeave(bet, unit(4) * 27, `${total} — 30:1 on a quarter, three quarters lost`)
        else if (total === 3 || total === 11) payAndLeave(bet, unit(4) * 12, `${total} — 15:1 on a quarter, three quarters lost`)
        else lose(bet, `${total} is not a horn number`)
        break
      case 'world':
        if (total === 2 || total === 12) payAndLeave(bet, unit(5) * 26, `${total} — 30:1 on a fifth`)
        else if (total === 3 || total === 11) payAndLeave(bet, unit(5) * 11, `${total} — 15:1 on a fifth`)
        else if (total === 7) push(bet, 'push', 0, bet.amount, 'seven — the fifth on the 7 pays what the rest lose')
        else lose(bet, `${total} is not a world number`)
        break
      case 'two':
        if (total === 2) payAndLeave(bet, bet.amount * 30, 'snake eyes')
        else lose(bet, `${total}, not a 2`)
        break
      case 'three':
        if (total === 3) payAndLeave(bet, bet.amount * 15, 'ace deuce')
        else lose(bet, `${total}, not a 3`)
        break
      case 'eleven':
        if (total === 11) payAndLeave(bet, bet.amount * 15, 'yo')
        else lose(bet, `${total}, not an 11`)
        break
      case 'twelve':
        if (total === 12) payAndLeave(bet, bet.amount * 30, 'boxcars')
        else lose(bet, `${total}, not a 12`)
        break
      default:
        break
    }
  }

  // --- Hardways -------------------------------------------------------------
  for (const bet of Object.values(state.bets)) {
    if (bet.kind !== 'hard' || !bet.number) continue
    if (!working(bet)) continue
    if (total === bet.number) {
      if (roll.a === roll.b) {
        payAndLeave(bet, pay(bet.amount, HARD_ODDS[bet.number as HardNumber]), `${roll.a} and ${roll.b}`)
      } else {
        lose(bet, `${bet.number} the easy way (${roll.a}-${roll.b})`)
      }
    } else if (total === 7) {
      lose(bet, 'seven')
    }
  }

  // --- Place, buy and lay ---------------------------------------------------
  for (const bet of Object.values(state.bets)) {
    if (bet.kind !== 'place' && bet.kind !== 'buy' && bet.kind !== 'lay') continue
    const n = bet.number as PointNumber
    const live = working(bet)

    if (bet.kind === 'lay') {
      if (total === 7) {
        const gross = pay(bet.amount, LAY_ODDS[n])
        if (!live) {
          push(bet, 'push', 0, bet.amount, 'not working')
          continue
        }
        // Commission on a lay is taken out of the win, so it only ever costs
        // you when you are collecting.
        payAndLeave(bet, gross - layVig(bet.amount, n), `seven before the ${n}, less 5% on the win`)
      } else if (total === n) {
        if (live) lose(bet, `${n} came first`)
        else push(bet, 'push', 0, bet.amount, 'not working')
      }
      continue
    }

    if (total === n) {
      if (!live) {
        push(bet, 'push', 0, bet.amount, 'not working on the come-out')
        continue
      }
      if (bet.kind === 'buy') {
        // The 5% is paid per decision: up front for the first, then out of
        // each win to keep the bet working, as a dealer takes it.
        const vig = buyVig(bet.amount)
        payAndLeave(bet, pay(bet.amount, TRUE_ODDS[n]) - vig, `${n} rolled, less $${vig} to keep it working`)
      } else {
        payAndLeave(bet, pay(bet.amount, PLACE_ODDS[n]), `${n} rolled`)
      }
    } else if (total === 7) {
      if (live) lose(bet, 'seven')
      // Off means neither won nor lost: it stays on the felt for the next point.
      else push(bet, 'push', 0, bet.amount, 'off on the come-out — stays up')
    }
  }

  // --- Travelled come bets and their odds -----------------------------------
  //
  // These must resolve *before* the come box travels, or a come bet that moves
  // to the 5 on a roll of 5 gets paid by the very roll that put it there.
  for (const n of POINT_NUMBERS) {
    const come = prior('comePoint', n)
    const odds = prior('comeOdds', n)

    if (come) {
      if (total === n) {
        payAndReturn(come, come.amount, `${n} before the seven`)
        if (odds) {
          // Off works both ways: odds that could not lose to a 7 cannot win either.
          if (isWorking(odds, state.point)) payAndReturn(odds, pay(odds.amount, TRUE_ODDS[n]), `true odds on the ${n}`)
          else returnBet(odds, 'odds were off — returned with the come bet')
        }
      } else if (total === 7) {
        lose(come, 'seven')
        // Odds that were not working come back rather than being taken. This is
        // the whole reason come odds sit off on a come-out roll.
        if (odds) {
          if (isWorking(odds, state.point)) lose(odds, 'seven')
          else returnBet(odds, 'odds were off — returned, not lost')
        }
      }
    }

    const dontCome = prior('dontComePoint', n)
    const dontOdds = prior('dontComeOdds', n)
    if (dontCome) {
      if (total === 7) {
        payAndReturn(dontCome, dontCome.amount, `seven before the ${n}`)
        if (dontOdds) {
          if (working(dontOdds)) payAndReturn(dontOdds, pay(dontOdds.amount, LAY_ODDS[n]), `laid odds on the ${n}`)
          else returnBet(dontOdds, 'odds were off — returned with the don’t come bet')
        }
      } else if (total === n) {
        lose(dontCome, `${n} came first`)
        if (dontOdds) {
          if (working(dontOdds)) lose(dontOdds, `${n} came first`)
          else returnBet(dontOdds, 'odds were off — returned, not lost')
        }
      }
    }
  }

  // --- The come and don't come boxes ---------------------------------------
  const comeBet = of('come')
  if (comeBet) {
    if (total === 7 || total === 11) payAndReturn(comeBet, comeBet.amount, `${total} on the come`)
    else if (total === 2 || total === 3 || total === 12) lose(comeBet, `craps ${total} on the come`)
    else {
      delete ledger.bets[comeBet.id]
      const id = betId('comePoint', total)
      const merged = ledger.bets[id]
      ledger.bets[id] = {
        id,
        kind: 'comePoint',
        amount: (merged?.amount ?? 0) + comeBet.amount,
        number: total,
      }
      push(comeBet, 'move', 0, comeBet.amount, `travels to the ${total}`)
    }
  }

  const dontComeBet = of('dontCome')
  if (dontComeBet) {
    if (total === 2 || total === 3) payAndReturn(dontComeBet, dontComeBet.amount, `craps ${total}`)
    else if (total === 12) returnBet(dontComeBet, 'twelve is barred — a stand-off')
    else if (total === 7 || total === 11) lose(dontComeBet, `${total} on the come`)
    else {
      delete ledger.bets[dontComeBet.id]
      const id = betId('dontComePoint', total)
      const merged = ledger.bets[id]
      ledger.bets[id] = {
        id,
        kind: 'dontComePoint',
        amount: (merged?.amount ?? 0) + dontComeBet.amount,
        number: total,
      }
      push(dontComeBet, 'move', 0, dontComeBet.amount, `travels behind the ${total}`)
    }
  }

  // --- The line -------------------------------------------------------------
  const passLine = prior('passLine')
  const dontPass = prior('dontPass')
  const passOdds = prior('passOdds')
  const dontPassOdds = prior('dontPassOdds')

  if (wasComeOut) {
    if (total === 7 || total === 11) {
      if (passLine) payAndLeave(passLine, passLine.amount, `natural ${total}`)
      if (dontPass) lose(dontPass, `natural ${total}`)
    } else if (total === 2 || total === 3) {
      if (passLine) lose(passLine, `craps ${total}`)
      if (dontPass) payAndLeave(dontPass, dontPass.amount, `craps ${total}`)
    } else if (total === 12) {
      if (passLine) lose(passLine, 'craps twelve')
      // Barring the twelve is the entire house edge on the don't side.
      if (dontPass) push(dontPass, 'push', 0, dontPass.amount, 'twelve is barred — a stand-off')
    } else if (passLine || dontPass) {
      const bet = passLine ?? dontPass!
      push(bet, 'point', 0, bet.amount, `the point is ${total}`)
    }
  } else {
    const point = state.point as PointNumber
    // Line odds called off sit the decision out like come odds do: handed back
    // whichever way it goes, since the next roll is a come-out they cannot ride.
    if (total === point) {
      if (passLine) payAndLeave(passLine, passLine.amount, `point ${point} made`)
      if (passOdds) {
        if (working(passOdds)) payAndReturn(passOdds, pay(passOdds.amount, TRUE_ODDS[point]), `true odds on the ${point}`)
        else returnBet(passOdds, 'odds were off — returned with the line win')
      }
      if (dontPass) lose(dontPass, `point ${point} made`)
      if (dontPassOdds) {
        if (working(dontPassOdds)) lose(dontPassOdds, `point ${point} made`)
        else returnBet(dontPassOdds, 'odds were off — returned, not lost')
      }
    } else if (total === 7) {
      if (passLine) lose(passLine, 'seven out')
      if (passOdds) {
        if (working(passOdds)) lose(passOdds, 'seven out')
        else returnBet(passOdds, 'odds were off — returned, not lost')
      }
      if (dontPass) payAndLeave(dontPass, dontPass.amount, 'seven out')
      if (dontPassOdds) {
        if (working(dontPassOdds)) payAndReturn(dontPassOdds, pay(dontPassOdds.amount, LAY_ODDS[point]), `laid odds on the ${point}`)
        else returnBet(dontPassOdds, 'odds were off — returned with the don’t pass win')
      }
    }
  }

  // --- Shoot bookkeeping ----------------------------------------------------
  const shoot: ShootState = {
    ...state.shoot,
    firePoints: [...state.shoot.firePoints],
    numbersHit: [...state.shoot.numbersHit],
    log: [...state.shoot.log],
    rolls: state.shoot.rolls + 1,
  }

  let point = state.point
  let note: RollLogEntry['note']

  if (wasComeOut) {
    if (isPointNumber(total)) {
      point = total
      note = 'pointSet'
    } else if (total === 7 || total === 11) {
      note = 'natural'
    } else {
      note = 'craps'
    }
  } else if (total === state.point) {
    point = null
    note = 'pointMade'
    if (!shoot.firePoints.includes(state.point as PointNumber)) {
      shoot.firePoints.push(state.point as PointNumber)
    }
  } else if (total === 7) {
    point = null
    note = 'sevenOut'
  }

  // All / Tall / Small track every roll of the shoot, come-out included, and a
  // seven of any kind wipes the board.
  if (total !== 7 && !shoot.numbersHit.includes(total)) shoot.numbersHit.push(total)

  for (const bet of Object.values(state.bets)) {
    if (bet.kind !== 'small' && bet.kind !== 'tall' && bet.kind !== 'all') continue
    if (total === 7) {
      lose(bet, 'seven')
      continue
    }
    const set = bet.kind === 'small' ? SMALL_NUMBERS : bet.kind === 'tall' ? TALL_NUMBERS : ALL_NUMBERS
    if (set.every((n) => shoot.numbersHit.includes(n))) {
      payAndReturn(bet, pay(bet.amount, ATS_PAYS[bet.kind]), `all of ${set.join(', ')} before a seven`)
    }
  }
  if (total === 7) shoot.numbersHit = []

  const fire = of('fire')
  if (fire) {
    const made = shoot.firePoints.length
    if (note === 'sevenOut') {
      if (made >= 4) {
        payAndReturn(fire, pay(fire.amount, FIRE_PAYS[Math.min(6, made)]), `${made} different points made`)
      } else {
        lose(fire, made === 0 ? 'no points made' : `only ${made} point${made === 1 ? '' : 's'} made`)
      }
    } else if (made === 6) {
      // Six is the ceiling; there is nothing left to wait for.
      payAndReturn(fire, pay(fire.amount, FIRE_PAYS[6]), 'all six points made')
    }
  }

  const net = ledger.resolutions.reduce((sum, r) => sum + r.net, 0)
  shoot.log.push({ a: roll.a, b: roll.b, total, point: state.point, net, note })

  const sevenedOut = note === 'sevenOut'

  return {
    ...state,
    bankroll: ledger.bankroll,
    bets: ledger.bets,
    commission: 0,
    point: point as PointNumber | null,
    phase: 'betting',
    resolutions: ledger.resolutions,
    // A seven-out hands the dice on. The shoot's own record — its points, its
    // All/Tall/Small progress, its log — dies with it; the store lifts the
    // finished shoot into history first, which is why `settle` stays pure and
    // never stamps a clock.
    shoot: sevenedOut ? EMPTY_SHOOT() : shoot,
    shootNumber: sevenedOut ? state.shootNumber + 1 : state.shootNumber,
    /** The completed shoot, handed out exactly once, on the roll that ended it. */
    finishedShoot: sevenedOut ? shoot : null,
  }
}

// ---------------------------------------------------------------------------
// Teaching: what happens next
// ---------------------------------------------------------------------------

export interface TotalOutcome {
  total: number
  /** Net across every standing bet if this total is rolled the easy way. */
  net: number
  /** Net if it comes as a pair, where that differs. */
  hardNet: number | null
  ways: number
}

/**
 * Net result of every possible next roll, against the bets currently up.
 *
 * This is the single most useful thing you can show a new player: it turns a
 * felt covered in chips into eleven numbers, four of which are green. It is
 * computed by actually running the settler, so it can never disagree with what
 * the table then pays.
 */
export function nextRollOutcomes(state: CrapsState): TotalOutcome[] {
  const netFor = (a: DieFace, b: DieFace) => {
    // Commission already handed over is spent whatever rolls, so it is no
    // part of what any one total would do.
    const settled = settle(rollExactly({ ...state, phase: 'betting', commission: 0 }, a, b))
    return settled.resolutions.reduce((sum, r) => sum + r.net, 0)
  }

  const combos: Record<number, Array<[DieFace, DieFace]>> = {}
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      const t = a + b
      ;(combos[t] ??= []).push([a as DieFace, b as DieFace])
    }
  }

  return Object.keys(combos)
    .map(Number)
    .sort((x, y) => x - y)
    .map((total) => {
      const pairs = combos[total]
      const easy = pairs.find(([a, b]) => a !== b) ?? pairs[0]
      const hardPair = pairs.find(([a, b]) => a === b)
      const easyNet = netFor(easy[0], easy[1])
      const hardNet = hardPair ? netFor(hardPair[0], hardPair[1]) : null
      return {
        total,
        net: easyNet,
        hardNet: hardNet !== null && hardNet !== easyNet ? hardNet : null,
        ways: pairs.length,
      }
    })
}
