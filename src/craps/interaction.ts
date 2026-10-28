import { create } from 'zustand'
import * as craps from '../engine/craps/craps'
import type { Bet, BetKind, CrapsState } from '../engine/craps/types'
import { money } from '../lib/format'
import type { NumberMode } from '../store/crapsStore'
import { isOddsKind } from './betInfo'
import { anchorFor, type Spot } from './layout'

/**
 * What a click on a given spot actually bets.
 *
 * Two kinds of spot are deliberately polymorphic, because the real table is.
 * A box number takes a place, buy or lay bet depending on what you told the
 * dealer — or backs a come bet already sitting there with odds. And once a
 * point is up, the line itself takes odds: a player hands chips "behind the
 * line", and that is what a click there now means.
 */
export function resolveSpot(spot: Spot, game: CrapsState, mode: NumberMode): { kind: BetKind; number?: number } {
  if (spot.numberBox && spot.number !== undefined) {
    const n = spot.number
    if (mode !== 'odds') return { kind: mode, number: n }
    const behindDont = Boolean(game.bets[craps.betId('dontComePoint', n)])
    const behindCome = Boolean(game.bets[craps.betId('comePoint', n)])
    return { kind: behindDont && !behindCome ? 'dontComeOdds' : 'comeOdds', number: n }
  }
  if (game.point !== null && spot.kind === 'passLine' && game.bets.passLine) return { kind: 'passOdds' }
  if (game.point !== null && spot.kind === 'dontPass' && game.bets.dontPass) return { kind: 'dontPassOdds' }
  return { kind: spot.kind, number: spot.number }
}

function bounds(spot: Spot) {
  const s = spot.shape
  if (s.type === 'circle') return { x0: s.cx - s.r, y0: s.cy - s.r, x1: s.cx + s.r, y1: s.cy + s.r }
  return s.type === 'rect' ? s : s.bounds
}

/** The wagers physically sitting inside a given box. */
export function betsOn(spot: Spot, game: CrapsState): Bet[] {
  const b = bounds(spot)
  return Object.values(game.bets).filter((bet) => {
    const [x, y] = anchorFor(bet.kind, bet.number)
    return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1
  })
}

/**
 * What this spot will take, in one line.
 *
 * Only odds quote a maximum: everywhere else the ceiling is the posted table
 * maximum, which tells a player nothing they need. Odds are the exception
 * because their ceiling is derived — from the point and from the bet
 * underneath — and so genuinely unknowable from the felt.
 */
export function stakeHint(game: CrapsState, kind: BetKind, number: number | undefined): string {
  const existing = game.bets[craps.betId(kind, number)]
  const odds = isOddsKind(kind)
  const room = craps.maxFor(game, kind, number)
  if (existing) {
    if (!odds) return `${money(existing.amount)} up · click adds · right-click takes down`
    return room > 0 ? `${money(existing.amount)} up · ${money(room)} more allowed` : `${money(existing.amount)} up · that is full odds`
  }
  const min = craps.minFor(game, kind, number)
  if (!odds) return `Minimum ${money(min)}`
  const cap = craps.capFor(game, kind, number)
  return room < cap ? `Min ${money(min)} · Max ${money(cap)} — rack covers ${money(room)}` : `Min ${money(min)} · Max ${money(cap)}`
}

/** Hover state, outside React's render path so moving the pointer re-renders only the card. */
interface HoverStore {
  spot: Spot | null
  x: number
  y: number
  /** Opened by a long press: it stays up after the finger lifts, until the next tap. */
  pinned: boolean
  /** Offered on a pinned card: take the bet in the box down. */
  takeDown: (() => void) | null
  set(spot: Spot | null, x?: number, y?: number): void
  pin(spot: Spot, x: number, y: number, takeDown?: () => void): void
  move(x: number, y: number): void
}

export const useHover = create<HoverStore>((set) => ({
  spot: null,
  x: 0,
  y: 0,
  pinned: false,
  takeDown: null,
  set: (spot, x, y) => set((s) => ({ spot, x: x ?? s.x, y: y ?? s.y, pinned: false, takeDown: null })),
  pin: (spot, x, y, takeDown) => set({ spot, x, y, pinned: true, takeDown: takeDown ?? null }),
  move: (x, y) => set({ x, y }),
}))
