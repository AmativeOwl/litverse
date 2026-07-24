import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Default 5s is too tight for the WorldScene smoke test, which imports
    // the full three.js/R3F module graph — not a hang, just a genuinely
    // heavy import under jsdom. This budget was previously 15000ms (measured
    // ~4.5-4.8s cold at the time), but after the PBR-materials merge (real
    // shadows + a new procedural IBL environment computed at module scope)
    // that same smoke test was independently observed taking 14.5-16.7s
    // locally, i.e. flaky right at the old ceiling — bumped to give real
    // headroom rather than re-tuning to another number that's one slow CI
    // run away from flaking again.
    testTimeout: 30000,
    // Exclude nested worktree checkouts (.worktrees/*) — each has its own
    // full src/ + node_modules, and without this Vitest's default recursive
    // discovery picks up their test files too when run from the repo root.
    exclude: ['**/node_modules/**', '**/.worktrees/**', '**/dist/**'],
  },
})
