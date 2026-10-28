import { installAudioUnlock } from './context'

export { play, diceHit, type Voice, type PlayOptions } from './sfx'
export { isAudioRunning, onAudioUnlocked } from './context'

let installed = false

/** Wire the table's sound. Safe to call more than once. */
export function installAudio() {
  if (installed) return
  installed = true
  installAudioUnlock()
}
