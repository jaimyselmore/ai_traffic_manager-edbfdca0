import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Laad environment variabelen uit .env bestand
dotenv.config()

// Haal Supabase credentials uit environment variables
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

// Check of de credentials aanwezig zijn
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'SUPABASE_URL en SUPABASE_SERVICE_KEY moeten ingesteld zijn in .env bestand'
  )
}

// Maak Supabase client met SERVICE ROLE key
// Dit geeft volledige toegang (bypass Row Level Security)
// Gebruik alleen op backend, NOOIT op frontend!
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

console.log('✅ Supabase client geïnitialiseerd')
