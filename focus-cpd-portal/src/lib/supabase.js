import { createClient } from '@supabase/supabase-js'
import { createDemoClient } from './demo'

// DEMO MODE (VITE_DEMO=1): in-browser mock with sample data, no Supabase
// project needed. Production builds use the real client. Strict "=== '1'"
// check (mirroring vite.config.js) so VITE_DEMO=0/false/off does NOT
// accidentally ship the fake portal — Vite exposes env vars as strings, so
// Boolean('false') would be true.
export const IS_DEMO = import.meta.env.VITE_DEMO === '1'

function makeRealClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check your .env file.')
  }
  return createClient(url, anonKey)
}

export const supabase = IS_DEMO ? createDemoClient() : makeRealClient()
