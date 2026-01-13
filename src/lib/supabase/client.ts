import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Probeer verschillende environment variable namen (Lovable, Vite, hardcoded fallback)
const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  'https://mrouohttlvirnvmdmwqj.supabase.co' // Fallback

const supabaseAnonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3VvaHR0bHZpcm52bWRtd3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MDQ4MDcsImV4cCI6MjA4MTk4MDgwN30.AUNv4x2lREN2AgUhyBN6mYjZGbad3m-B-8ZWrEsNNk0' // Fallback

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
