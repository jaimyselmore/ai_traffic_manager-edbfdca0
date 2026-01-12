/**
 * Script om alle tabellen in Supabase te tonen
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function listTables() {
  console.log('\n📊 Alle tabellen in Supabase:\n')

  // Query to get all tables from information_schema
  const { data, error } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
    })
    .catch(async () => {
      // Fallback: just try common table names
      const tables = [
        'users', 'klanten', 'projecten', 'project_fases', 'taken',
        'meetings', 'verlof_aanvragen', 'wijzigingsverzoeken',
        'notificaties', 'audit_log', 'werknemers', 'rolprofielen', 'disciplines'
      ]

      console.log('Probeer direct tabellen te lezen...\n')

      for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1)
        if (!error) {
          console.log(`  ✅ ${table}`)
        }
      }

      return { data: null, error: null }
    })

  if (error) {
    console.error('Error:', error)
  }
}

listTables()
  .then(() => {
    console.log('\n✅ Klaar!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
