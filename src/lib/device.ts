/**
 * A phone or a tablet: the main pointer is a finger. A laptop with a touch
 * screen still reports its trackpad, so it is not one.
 */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
}
