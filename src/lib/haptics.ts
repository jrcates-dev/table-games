import { usePrefs } from '../prefs/prefsStore'

/**
 * A short buzz under the thumb, on the phones that can: Android browsers do,
 * iPhones do not, and the player can turn it off in Settings.
 */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** A light tick for a tap (a chip placed), a firmer one for a moment (a long-press, the dice landing). */
export function buzz(kind: 'tick' | 'thud' = 'tick') {
  if (!canVibrate() || !usePrefs.getState().haptics) return
  try {
    navigator.vibrate(kind === 'tick' ? 8 : 18)
  } catch {
    // Some browsers refuse without a recent tap; a missed buzz is harmless.
  }
}
