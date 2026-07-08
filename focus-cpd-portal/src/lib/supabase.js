import { createClient } from '@supabase/supabase-js'
import { createDemoClient } from './demo'

// DEMO MODE (VITE_DEMO=1): in-browser mock with sample data, no Supabase
// project needed. Production builds use the real client.
export const IS_DEMO = Boolean(import.meta.env.VITE_DEMO)

function makeRealClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check your .env file.')
  }
  return createClient(url, anonKey)
}

export const supabase = IS_DEMO ? createDemoClient() : makeRealClient()
