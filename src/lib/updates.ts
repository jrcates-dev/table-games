import { create } from 'zustand'

/**
 * New builds, picked up without closing the app.
 *
 * Every visit online opens the newest deploy (see pwa.ts), and a new deploy's
 * offline cache takes over as soon as it has downloaded. The page already
 * running stays on its own build, so a table in play is never swapped out:
 * when a newer build takes over while this page is open (the app resumed from
 * the home screen after a deploy, or a page that had to open from the cache),
 * this says so in the lobby, and a tap reloads onto it.
 */

interface UpdateState {
  /** A newer build than this page has downloaded and taken over. */
  ready: boolean
  /** The tap has been made; the page is reloading onto the new build. */
  applying: boolean
}

export const useUpdate = create<UpdateState>(() => ({ ready: false, applying: false }))

/** How long the app must have been out of sight before coming back looks for a new build. */
const RECHECK_AFTER = 10 * 60 * 1000

/** A table's chunk that failed to load reloads the page at most this often, so being offline cannot loop it. */
const RELOAD_AT_MOST_EVERY = 60 * 1000

/** The build this page was served from, stamped into it by pwa.ts. */
const PAGE_BUILD = document.querySelector<HTMLMetaElement>('meta[name="arena-build"]')?.content

/** Register the offline cache and keep an eye out for builds deployed after it. */
export function installUpdates(workerUrl: string) {
  if (!('serviceWorker' in navigator)) return
  const workers = navigator.serviceWorker

  // A worker taking over: the first visit's own, a build this page is already
  // on (it came from the network ahead of its worker), or a newer one.
  workers.addEventListener('controllerchange', () => {
    const worker = workers.controller
    if (!worker || !PAGE_BUILD) return
    void buildOf(worker).then((build) => {
      if (build && build !== PAGE_BUILD) useUpdate.setState({ ready: true })
    })
  })

  // A page left open across two deploys can find a table it has not opened yet
  // gone from both the cache and the site. Rather than leave the table blank,
  // reload onto the build now in place.
  window.addEventListener('vite:preloadError', (event) => {
    if (!mayReload()) return
    event.preventDefault()
    window.location.reload()
  })

  window.addEventListener('load', () => {
    // A failed registration just means no offline cache and no update pill.
    workers.register(workerUrl).then(watch, () => {})
  })
}

function watch(reg: ServiceWorkerRegistration) {
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

/** The build a worker serves, or null if it does not say. */
function buildOf(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => resolve(null), 3000)
    channel.port1.onmessage = (event) => {
      clearTimeout(timer)
      resolve(typeof event.data === 'string' ? event.data : null)
    }
    worker.postMessage({ type: 'build' }, [channel.port2])
  })
}

function mayReload(): boolean {
  const key = 'arena:reloaded-for-update'
  try {
    if (Date.now() - Number(sessionStorage.getItem(key)) < RELOAD_AT_MOST_EVERY) return false
    sessionStorage.setItem(key, String(Date.now()))
    return true
  } catch {
    return false
  }
}

/** Reload onto the new build, which every page load now opens. */
export function applyUpdate() {
  if (useUpdate.getState().applying) return
  useUpdate.setState({ applying: true })
  window.location.reload()
}
