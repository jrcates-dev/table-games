/**
 * The wheels.
 *
 * A pocket is its number, with the American double zero written as 37 so that
 * every pocket is a plain integer. The orders are the real wheel heads read
 * clockwise from the zero, which is what the renderer spins and what puts the
 * ball in the right place among its neighbours.
 */

export type WheelType = 'double' | 'single'
export type Pocket = number

export const DOUBLE_ZERO: Pocket = 37

/** The American wheel: 0 and 00 opposite each other, numbers paired across. */
export const DOUBLE_ZERO_ORDER: readonly Pocket[] = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, DOUBLE_ZERO, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6,
  21, 33, 16, 4, 23, 35, 14, 2,
]

/** The European wheel, single zero. */
export const SINGLE_ZERO_ORDER: readonly Pocket[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
]

export const RED_NUMBERS: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export function wheelOrder(type: WheelType): readonly Pocket[] {
  return type === 'double' ? DOUBLE_ZERO_ORDER : SINGLE_ZERO_ORDER
}

export function pocketCount(type: WheelType): number {
  return type === 'double' ? 38 : 37
}

export function isZero(pocket: Pocket): boolean {
  return pocket === 0 || pocket === DOUBLE_ZERO
}

export function pocketColor(pocket: Pocket): 'red' | 'black' | 'green' {
  if (isZero(pocket)) return 'green'
  return RED_NUMBERS.has(pocket) ? 'red' : 'black'
}

export function pocketLabel(pocket: Pocket): string {
  return pocket === DOUBLE_ZERO ? '00' : String(pocket)
}

/** The pockets on this wheel, zeros first. */
export function pockets(type: WheelType): Pocket[] {
  const numbers = Array.from({ length: 37 }, (_, i) => i)
  return type === 'double' ? [0, DOUBLE_ZERO, ...numbers.slice(1)] : numbers
}
