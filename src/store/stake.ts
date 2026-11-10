/**
 * What a player is allowed to sit down with.
 *
 * Every table lets you choose the bankroll you buy back in for, and all need
 * the same guard rails, so the bounds live in one place rather than being
 * agreed on six times. The floor is a real constraint — a bankroll under the table minimum is
 * a seat you cannot bet from — while the ceiling exists only to keep a stray
 * keystroke from turning the rack into scientific notation.
 */
export const MIN_STARTING_BANKROLL = 100
export const MAX_STARTING_BANKROLL = 10_000_000

export function clampStartingBankroll(value: number): number {
  if (!Number.isFinite(value)) return MIN_STARTING_BANKROLL
  return Math.min(MAX_STARTING_BANKROLL, Math.max(MIN_STARTING_BANKROLL, Math.round(value)))
}
