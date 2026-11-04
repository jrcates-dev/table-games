import { create } from 'zustand'

/**
 * New builds, picked up without closing the app.
 *
 * The offline cache (pwa.ts) installs a new deploy beside the running one and
 * leaves it waiting, so a table in play is never swapped out. Left alone, the
 * waiting build only takes over once every window of the app has closed, and
 * an app on a phone's home screen is resumed far more often than it is closed:
 * a fix could sit unseen for days. So this watches for a waiting build, says
 * so in the lobby, and on a tap hands over to it and reloads.
 */

interface UpdateState {
  /** A newer build is downloaded and waiting to take over. */
  ready: boolean
  /** The tap has been made; the page reloads as soon as the new build is in. */
  applying: boolean
}

export const useUpdate = create<UpdateState>(() => ({ ready: false, applying: false }))

/** How long the app must have been out of sight before coming back looks for a new build. */
const RECHECK_AFTER = 10 * 60 * 1000

let registration: ServiceWorkerRegistration | null = null

/** Register the offline cache and keep an eye out for builds deployed after it. */
export function installUpdates(workerUrl: string) {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    // A failed registration just means no offline cache and no update pill.
    navigator.serviceWorker.register(workerUrl).then(watch, () => {})
  })
}

function watch(reg: ServiceWorkerRegistration) {
  registration = reg
  // With no controller this is the first visit, whose worker is the app itself, not an update.
  const isUpdate = () => navigator.serviceWorker.controller !== null

  // Downloaded on an earlier visit and still waiting.
  if (reg.waiting && isUpdate()) useUpdate.setState({ ready: true })

  reg.addEventListener('updatefound', () => {
    const incoming = reg.installing
    incoming?.addEventListener('statechange', () => {
      if (incoming.state === 'installed' && isUpdate()) useUpdate.setState({ ready: true })
    })
  })

  // The browser looks for a new worker when the page loads, but resuming an
  // installed app is not a page load. Coming back after a while looks again.
  let hiddenAt = 0
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }
    if (hiddenAt && Date.now() - hiddenAt >= RECHECK_AFTER) reg.update().catch(() => {})
  })
}

/** Hand over to the waiting build and reload onto it. */
export function applyUpdate() {
  if (useUpdate.getState().applying) return
  useUpdate.setState({ applying: true })
  const waiting = registration?.waiting
  if (!waiting) {
    window.location.reload()
    return
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
  waiting.postMessage({ type: 'skip-waiting' })
}
