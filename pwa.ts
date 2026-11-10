import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

/**
 * Offline play for the installed app, and the newest build on every visit.
 *
 * After a production build, every file in the output — the page, each table's
 * chunk, the dice engine, fonts and icons — is listed in a generated `sw.js`,
 * which caches the lot on the first visit, so the app opens and craps plays
 * with no network at all, even at a table that has never been opened.
 *
 * Opening the app asks the network for the page first and falls back to the
 * cached one when offline or slow to answer, so a visit online always starts
 * the latest deploy: in a browser tab, which a phone's browser keeps open for
 * weeks and never closes, as much as from the home screen. A new deploy's
 * cache is named for a hash of the build, downloads beside the old one and
 * takes over as soon as it is complete. The page already running keeps its own
 * build, with the cache of the build before kept to load its tables from, and
 * the lobby offers to reload onto the new one between hands (see
 * src/lib/updates.ts). A running table is never swapped out mid-hand.
 */
export function offlineCache(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'arena:offline-cache',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    closeBundle() {
      const outDir = config.build.outDir
      const files = listFiles(outDir)
        .map((file) => relative(outDir, file).split(sep).join('/'))
        // What the app never asks for is left to the network. Every phone
        // browser reads woff2, so the woff fallbacks never load, and the app is
        // in English, so nor do the Cyrillic, Greek and Vietnamese cuts of each
        // font; and the link-preview image and robots.txt are fetched by chat
        // apps and crawlers.
        .filter(
          (file) =>
            file !== 'sw.js' &&
            file !== 'robots.txt' &&
            !file.endsWith('.woff') &&
            !/-(cyrillic|cyrillic-ext|greek|greek-ext|vietnamese)-/.test(file) &&
            !file.startsWith('og-image.'),
        )
        .sort()
      const hash = createHash('sha256')
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)))
      const build = hash.digest('hex').slice(0, 12)
      writeFileSync(join(outDir, 'sw.js'), serviceWorker(build, files))
      // The page carries its build too, so that when a newer worker takes over
      // a page already open, the page can tell it is now behind.
      const page = join(outDir, 'index.html')
      writeFileSync(page, readFileSync(page, 'utf8').replace('</head>', `  <meta name="arena-build" content="${build}" />\n  </head>`))
    },
  }
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

/**
 * Paths are relative to the worker, which sits at the root of the build, so
 * the same worker runs at `/` or under a GitHub Pages repo path.
 */
function serviceWorker(build: string, files: string[]): string {
  return `// Generated at build time by pwa.ts. Do not edit.
const BUILD = '${build}'
const CACHE = 'arena-' + BUILD
const FILES = ${JSON.stringify(files)}
const SHELL = new URL('index.html', self.location).href
// How long opening the app waits on the network before it opens from the cache.
const NETWORK_WAIT = 3000

// Some hosts send Vary: Origin, and a module script carries an Origin header
// that the install request did not, so a strict match would miss every file.
const MATCH = { ignoreVary: true }

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Each file is checked with the server rather than taken from the
      // browser's own cache, which GitHub Pages lets it keep for ten minutes
      // and could still hold the page from the deploy before.
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'no-cache' }))))
      // No waiting for every window to close: a page already open keeps its
      // own build (see activate), and the next one opened gets this one.
      .then(
        () => self.skipWaiting(),
        (error) => caches.delete(CACHE).then(() => Promise.reject(error)),
      ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        // Keys come back oldest first. The newest of the older caches is the
        // build this one replaces, and a page still running it loads the
        // tables it has not opened yet from there, so it stays until the next
        // deploy takes over.
        const older = keys.filter((key) => key.startsWith('arena-') && key !== CACHE)
        return Promise.all(older.slice(0, -1).map((key) => caches.delete(key)))
      })
      .then(() => self.clients.claim()),
  )
})

// A page asks which build has taken over, to know whether it is now behind.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'build') event.ports[0]?.postMessage(BUILD)
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(request.mode === 'navigate' ? openPage() : fromCache(request).then((cached) => cached ?? fetch(request)))
})

// This build's copy first, then the build before's, for a page still running it.
async function fromCache(request) {
  const cache = await caches.open(CACHE)
  return (await cache.match(request, MATCH)) ?? (await caches.match(request, MATCH))
}

// The newest page from the network when it answers in time, so a visit always
// starts the latest deploy, and this build's cached page when it does not.
async function openPage() {
  const fresh = fetch(SHELL, { cache: 'no-cache' }).then(
    (response) => (response.ok && !response.redirected ? response : null),
    () => null,
  )
  const late = new Promise((resolve) => setTimeout(resolve, NETWORK_WAIT, null))
  const first = await Promise.race([fresh, late])
  if (first) return first
  const cached = await caches.open(CACHE).then((cache) => cache.match(SHELL, MATCH))
  return cached ?? (await fresh) ?? Response.error()
}
`
}
