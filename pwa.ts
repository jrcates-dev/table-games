import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

/**
 * Offline play for the installed app.
 *
 * After a production build, every file in the output — the page, each table's
 * chunk, the dice engine, fonts and icons — is listed in a generated `sw.js`,
 * which caches the lot on the first visit. From then on the app opens from the
 * cache with no network at all, so it starts at once from the home screen and
 * craps works offline even if it has never been opened.
 *
 * The cache is named for a hash of the build, so a new deploy installs beside
 * the old one and takes over the next time the app is opened from cold. A
 * running table is never swapped out from under the player mid-hand.
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
        // Every phone browser reads woff2, so the woff fallbacks never load.
        .filter((file) => file !== 'sw.js' && !file.endsWith('.woff'))
        .sort()
      const hash = createHash('sha256')
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)))
      writeFileSync(join(outDir, 'sw.js'), serviceWorker(hash.digest('hex').slice(0, 12), files))
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
function serviceWorker(version: string, files: string[]): string {
  return `// Generated at build time by pwa.ts. Do not edit.
const CACHE = 'arena-${version}'
const FILES = ${JSON.stringify(files)}
const SHELL = new URL('index.html', self.location).href

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('arena-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Some hosts send Vary: Origin, and a module script carries an Origin header
// that the install request did not, so a strict match would miss every file.
const MATCH = { ignoreVary: true }

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(caches.match(SHELL, MATCH).then((cached) => cached ?? fetch(request)))
    return
  }
  event.respondWith(caches.match(request, MATCH).then((cached) => cached ?? fetch(request)))
})
`
}
