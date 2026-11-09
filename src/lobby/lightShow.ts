/**
 * The marquee's light show.
 *
 * The bulbs round the sign are wired in six banks, bulb i on bank i % 6, the
 * way a real sign's chaser controller wires them. With six banks the board can
 * run every pattern a Vegas marquee does: a three-phase chase (banks 0 and 3,
 * then 1 and 4, then 2 and 5), odd against even, and the whole sign at once.
 * The bulb count is a multiple of six so each pattern runs seamlessly round
 * the corner where the loop closes.
 *
 * Only the six banks are animated, never a bulb on its own, and only their
 * opacity, so the browser's compositor runs the show without repainting.
 */

export const BANKS = 6

/** Bulbs per long side and per short side of the sign, corners included in the long sides. */
const ACROSS = 23
const DOWN = 6

/** Each bulb's place on the frame, in percent, clockwise from the top-left corner. */
export const BULBS: ReadonlyArray<{ x: number; y: number }> = (() => {
  const out: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= ACROSS; i++) out.push({ x: (i / ACROSS) * 100, y: 0 })
  for (let i = 1; i <= DOWN; i++) out.push({ x: 100, y: (i / (DOWN + 1)) * 100 })
  for (let i = ACROSS; i >= 0; i--) out.push({ x: (i / ACROSS) * 100, y: 100 })
  for (let i = DOWN; i >= 1; i--) out.push({ x: 0, y: (i / (DOWN + 1)) * 100 })
  return out
})()

/** One beat of the show: how long it lasts, and whether a bank is lit during it. */
interface Beat {
  ms: number
  lit: (bank: number) => boolean
}

const beats = (count: number, ms: number, lit: (bank: number, beat: number) => boolean): Beat[] =>
  Array.from({ length: count }, (_, beat) => ({ ms, lit: (bank: number) => lit(bank, beat) }))

/**
 * The program, about twelve seconds and then round again. Bulbs are numbered
 * clockwise, so lighting the next third on each beat runs the lights clockwise
 * round the frame, and the previous third runs them back.
 */
export const SHOW: readonly Beat[] = [
  // Chase clockwise.
  ...beats(27, 160, (bank, beat) => bank % 3 === beat % 3),
  // Odd against even.
  ...beats(8, 250, (bank, beat) => bank % 2 === beat % 2),
  // The whole sign flashes three times, then holds.
  ...beats(5, 230, (_, beat) => beat % 2 === 0),
  { ms: 1100, lit: () => true },
  // Chase back the other way.
  ...beats(21, 160, (bank, beat) => bank % 3 === (3 - (beat % 3)) % 3),
  // A dark beat before the chase sets off again.
  { ms: 220, lit: () => false },
]

export const SHOW_MS = SHOW.reduce((total, beat) => total + beat.ms, 0)

/** How bright an unlit lamp's layer sits: off, with a trace of a warm filament. */
export const UNLIT = 0.06

/**
 * One bank's part in the show as Web Animations keyframes: a keyframe each
 * time the bank switches, each held until the next (a lamp snaps on and off,
 * it does not fade).
 */
export function bankKeyframes(bank: number): Keyframe[] {
  const frames: Keyframe[] = []
  let at = 0
  let last: boolean | undefined
  for (const beat of SHOW) {
    const on = beat.lit(bank)
    if (on !== last) frames.push({ offset: at / SHOW_MS, opacity: on ? 1 : UNLIT, easing: 'steps(1, end)' })
    last = on
    at += beat.ms
  }
  frames.push({ offset: 1, opacity: last ? 1 : UNLIT })
  return frames
}
