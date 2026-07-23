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
    // the full three.js/R3F module graph (~4.5-4.8s cold) — not a hang, just
    // a genuinely heavy import under jsdom.
    testTimeout: 15000,
    // Exclude nested worktree checkouts (.worktrees/*) — each has its own
    // full src/ + node_modules, and without this Vitest's default recursive
    // discovery picks up their test files too when run from the repo root.
    exclude: ['**/node_modules/**', '**/.worktrees/**', '**/dist/**'],
  },
})
