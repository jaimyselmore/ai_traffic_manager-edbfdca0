import { supabase } from '../src/config/supabase'
import { syncGoogleSheets, getCache } from '../src/services/sheetsSync'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Create Supabase Auth users with REAL emails from Google Sheet
 */

async function createRealAuthUsers() {
  console.log('🔐 Creating Supabase Auth users with real emails...\n')

  // Haal werknemers op uit Google Sheets
  await syncGoogleSheets()
  const cache = getCache()

  // Filter alleen de planners MET email
  const planners = cache.werknemers.filter(w => w.is_planner && w.email)

  console.log(`Found ${planners.length} planners with email:\n`)

  const password = 'selmore2026'

  for (const planner of planners) {
    try {
      // Probeer user aan te maken in Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: planner.email!,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          naam: planner.naam,
          rol: planner.primaire_rol,
          werknemer_id: planner.werknemer_id,
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`⚠️  ${planner.naam} bestaat al (${planner.email})`)

          // Update de oude users tabel ook
          await supabase
            .from('users')
            .update({ email: planner.email })
            .eq('naam', planner.naam)
        } else {
          console.error(`❌ Error voor ${planner.naam}:`, error.message)
        }
      } else {
        console.log(`✅ ${planner.naam} → ${planner.email}`)

        // Update de oude users tabel ook
        await supabase
          .from('users')
          .update({ email: planner.email })
          .eq('naam', planner.naam)
      }
    } catch (error: any) {
      console.error(`❌ Unexpected error voor ${planner.naam}:`, error.message)
    }
  }

  console.log('\n✅ Klaar!')
  console.log('\n📋 LOGIN CREDENTIALS:')
  planners.forEach(p => {
    console.log(`   ${p.naam}: ${p.email}`)
  })
  console.log(`   Wachtwoord: ${password}`)
  console.log('\n💡 Probeer nu in te loggen in Lovable!')

  process.exit(0)
}

createRealAuthUsers()
