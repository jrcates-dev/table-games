/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { offlineCache } from './pwa.ts'

export default defineConfig({
  // GitHub Pages serves a project site under /<repo>/; a deploy can pass that
  // path in. Everything else serves from the root.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), offlineCache()],
  build: {
    // The craps dice ship three.js and a physics engine in their own chunk,
    // loaded only when a player sits down at craps. It is large by nature, not
    // by accident, so the warning threshold sits just above it.
    chunkSizeWarningLimit: 1_024,
  },
  preview: {
    // `npm run app` installs a local build from this server, and an installed
    // app belongs to its address for good: its offline cache and bankroll live
    // there. Vite's default 4173 is shared by every project's preview, whose
    // pages this app's service worker would then answer, so it keeps a port of
    // its own and refuses to drift to another.
    port: 4747,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
