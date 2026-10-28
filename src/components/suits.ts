import type { Suit } from '../engine/types'

/**
 * Suit symbols as paths in a 100×100 box, centred on 50,50.
 *
 * Drawn rather than taken from a font: font suit glyphs vary wildly between
 * platforms — some are emoji, some are thin outlines — and a card has to look
 * the same on every machine.
 */

const circle = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`

export const SUIT_PATH: Record<Suit, string> = {
  H: 'M50 90 C 44 82, 6 58, 6 32 C 6 16, 18 6, 31 6 C 40 6, 47 12, 50 20 C 53 12, 60 6, 69 6 C 82 6, 94 16, 94 32 C 94 58, 56 82, 50 90 Z',
  D: 'M50 3 C 58 20, 72 37, 86 50 C 72 63, 58 80, 50 97 C 42 80, 28 63, 14 50 C 28 37, 42 20, 50 3 Z',
  S: [
    'M50 4 C 56 14, 92 36, 92 60 C 92 74, 81 82, 69 82 C 61 82, 55 78, 52 72',
    'C 53 82, 58 90, 66 95 L 34 95 C 42 90, 47 82, 48 72',
    'C 45 78, 39 82, 31 82 C 19 82, 8 74, 8 60 C 8 36, 44 14, 50 4 Z',
  ].join(' '),
  C: [
    circle(50, 27, 19),
    circle(27, 57, 19),
    circle(73, 57, 19),
    circle(50, 50, 10),
    'M50 55 C 51 74, 57 88, 66 95 L 34 95 C 43 88, 49 74, 50 55 Z',
  ].join(' '),
}

export const SUIT_NAME: Record<Suit, string> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
}

export function isRed(suit: Suit): boolean {
  return suit === 'H' || suit === 'D'
}

export const RED_INK = '#c01a33'
export const BLACK_INK = '#17161f'

export function suitInk(suit: Suit): string {
  return isRed(suit) ? RED_INK : BLACK_INK
}

/** Plain-text glyph, for history rows and anywhere a path is overkill. */
export const SUIT_GLYPH: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
