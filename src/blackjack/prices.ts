import { currentDecisionEvs, type Decision, type DecisionEvs } from '../engine/ev'
import type { GameState } from '../engine/types'

/**
 * What the coach's price list reads from: the figures for the decision on the
 * felt, the hover-card ids of the dock's action buttons, and how a share of
 * the bet is written. Kept apart from the card itself so the dock and the
 * challenge can use them without importing the component.
 */

const PREFIX = 'bj:'

/** The hover-card id for one of the dock's action buttons. */
export function actionTipId(action: Decision): string {
  return `${PREFIX}${action}`
}

/** The action a hover-card id stands for, if it is one of ours. */
export function tipAction(id: string | null): Decision | null {
  return id?.startsWith(PREFIX) ? (id.slice(PREFIX.length) as Decision) : null
}

let last: { game: GameState; evs: DecisionEvs | null } | null = null

/**
 * The figures for the decision on the felt, worked out once per decision. The
 * hover card and the coach's challenge both read them, and moving the pointer
 * must not redo the arithmetic.
 */
export function decisionEvsFor(game: GameState): DecisionEvs | null {
  if (last?.game !== game) last = { game, evs: currentDecisionEvs(game) }
  return last.evs
}

/** A share of the bet, signed, with a second decimal under one percent: "+3.4%", "−0.34%". */
export function betShare(value: number, signed = true): string {
  const abs = Math.abs(value * 100)
  const text = abs.toFixed(abs < 1 ? 2 : 1)
  if (!signed || Number(text) === 0) return `${text}%`
  return `${value > 0 ? '+' : '−'}${text}%`
}
