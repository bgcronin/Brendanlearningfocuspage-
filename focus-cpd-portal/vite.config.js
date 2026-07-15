import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// DEMO_SINGLE=1 produces a build suitable for a single-file demo:
// relative base + all assets (incl. logos) inlined as data URLs.
const demoSingle = process.env.DEMO_SINGLE === '1'

// VITE_NOINDEX=1 injects <meta name="robots" content="noindex"> for
// previews/staging. Production builds are indexable by default — the
// public /verify page is advertised in every certificate email, so an
// unconditional noindex (the old behaviour) would have hidden it from
// search engines forever.
const noindex = process.env.VITE_NOINDEX === '1'
const robotsPlugin = {
  name: 'robots-noindex',
  transformIndexHtml(html) {
    return noindex ? html.replace('</title>', '</title>\n    <meta name="robots" content="noindex" />') : html
  },
}

export default defineConfig({
  plugins: [react(), robotsPlugin],
  base: demoSingle ? './' : '/',
  build: {
    assetsInlineLimit: demoSingle ? 100_000_000 : 4096,
  },
})
