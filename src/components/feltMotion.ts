import type { Easing } from 'motion/react'

/**
 * The moves of the things on a felt, cards and chip stacks, written as whole
 * transforms.
 *
 * Animated one property at a time (x, then z, then a turn), a card is moved by
 * script on every frame, and on a phone a single slow frame — the felt being
 * repainted, a sound being decoded — leaves it behind, so it skips to where it
 * lands. Written as one transform per layer, the browser runs the flight
 * itself, off the main thread, and it stays smooth whatever else is going on.
 * The pieces keep the order the per-property version composed them in.
 */

/** Where the card sits on the felt. */
export const cardAt = (x: number, y: number) => `translate(${x}px, ${y}px)`

/** Its height off the felt, its size, and its turn about the felt's normal. */
export const cardLift = (z: number, angle: number, scale = 1) => `translateZ(${z}px) scale(${scale}) rotateZ(${angle}deg)`

/** Face up (0) or down (180), tipped toward the viewer and lifted while it turns. */
export const cardTurn = (y: number, z = 0, x = 0) => `translateZ(${z}px) rotateX(${x}deg) rotateY(${y}deg)`

/** The shadow under it: spread while the card is high, turned with it. */
export const shadowAt = (scale: number, angle: number) => `scale(${scale}) rotate(${angle}deg)`

/** Part way from one angle to another, as far as the pitch's ease has carried it by the top of its arc. */
export const angleBetween = (from: number, to: number) => from + (to - from) * 0.78

/** A chip stack on the felt, at a size: 1 standing, smaller on its way out of the tray or into it. */
export const stackAt = ([x, y]: readonly [number, number], scale = 1) => `translate(${x}px, ${y}px) scale(${scale})`

const EASE_SLIDE: [number, number, number, number] = [0.25, 0.7, 0.3, 1]

/**
 * A stack's way to where it now belongs. Placed or paid, it slides from where
 * it came from, growing to full size if it came out of the tray; raked, it
 * slides to the tray and sinks into it, the sink starting `sinkAt` seconds in.
 */
export function stackMove(
  from: readonly [number, number],
  to: readonly [number, number],
  { grow, swept, delay, sinkAt }: { grow: boolean; swept: boolean; delay: number; sinkAt: number },
) {
  if (swept) {
    const duration = sinkAt + 0.22
    return {
      initial: { transform: stackAt(from) },
      animate: { transform: [stackAt(from), stackAt(to), stackAt(to, 0.01)] },
      transition: { duration, delay, times: [0, sinkAt / duration, 1], ease: [EASE_SLIDE, 'easeIn'] as Easing[] },
    }
  }
  return {
    initial: { transform: stackAt(from, grow ? 0.45 : 1) },
    animate: { transform: stackAt(to) },
    transition: { duration: 0.55, delay, ease: EASE_SLIDE },
  }
}
