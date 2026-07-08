import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// DEMO_SINGLE=1 produces a build suitable for a single-file demo:
// relative base + all assets (incl. logos) inlined as data URLs.
const demoSingle = process.env.DEMO_SINGLE === '1'

export default defineConfig({
  plugins: [react()],
  base: demoSingle ? './' : '/',
  build: {
    assetsInlineLimit: demoSingle ? 100_000_000 : 4096,
  },
})
