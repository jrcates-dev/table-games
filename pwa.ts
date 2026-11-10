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
 * the old one and waits. It takes over the next time the app is opened from
 * cold, or sooner when the player taps the lobby's "new version" pill, which
 * asks the waiting worker to step in (see src/lib/updates.ts). A running table
 * is never swapped out from under the player mid-hand.
 */
export function offlineCache(): Plugin {
  let config: ResolvedConfig
  /** Chunks only an account ever loads: the Supabase client (see src/store/supabase.ts). */
  const cloudOnly = new Set<string>()
  return {
    name: 'arena:offline-cache',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    generateBundle(_options, bundle) {
      cloudOnly.clear()
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        // The client and what it brings with it, and nothing of the app's own.
        const vendor = chunk.moduleIds.every((id) => id.includes('node_modules'))
        if (vendor && chunk.moduleIds.some((id) => id.includes('@supabase/supabase-js'))) cloudOnly.add(chunk.fileName)
      }
    },
    closeBundle() {
      const outDir = config.build.outDir
      const files = listFiles(outDir)
        .map((file) => relative(outDir, file).split(sep).join('/'))
        // What the app never asks for is left to the network. Every phone
        // browser reads woff2, so the woff fallbacks never load, and the app is
        // in English, so nor do the Cyrillic, Greek and Vietnamese cuts of each
        // font; the link-preview image and robots.txt are fetched by chat apps
        // and crawlers; and the Supabase client loads only for a build with
        // credentials, and is no use offline even then.
        .filter(
          (file) =>
            file !== 'sw.js' &&
            file !== 'robots.txt' &&
            !file.endsWith('.woff') &&
            !/-(cyrillic|cyrillic-ext|greek|greek-ext|vietnamese)-/.test(file) &&
            !file.startsWith('og-image.') &&
            !cloudOnly.has(file),
        )
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

// The lobby's "new version" pill: take over now rather than at the next cold
// start. The page reloads itself onto this build once it has.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'skip-waiting') self.skipWaiting()
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
