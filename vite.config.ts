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
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
