import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Probeer eerst Lovable's ingebouwde Supabase variabelen, dan fallback naar VITE_ prefix
const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL en Anon Key zijn verplicht! Check Lovable Connectors of .env.local')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
