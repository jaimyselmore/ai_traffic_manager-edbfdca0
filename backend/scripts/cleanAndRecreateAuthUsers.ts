import { supabase } from '../src/config/supabase'
import { syncGoogleSheets, getCache } from '../src/services/sheetsSync'
import dotenv from 'dotenv'

dotenv.config()

/**
 * CLEAN UP oude auth users en maak nieuwe aan met correcte emails
 */

async function cleanAndRecreate() {
  console.log('🧹 Cleaning up oude auth users...\n')

  // Stap 1: Haal alle auth users op
  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('❌ Error listing users:', listError.message)
    process.exit(1)
  }

  console.log(`Found ${authUsers.users.length} existing auth users\n`)

  // Stap 2: Verwijder alle oude users
  for (const user of authUsers.users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) {
      console.error(`❌ Error deleting ${user.email}:`, error.message)
    } else {
      console.log(`🗑️  Deleted: ${user.email}`)
    }
  }

  console.log('\n✅ All oude users deleted!\n')

  // Stap 3: Haal correcte emails op uit Google Sheets
  await syncGoogleSheets()
  const cache = getCache()

  const planners = cache.werknemers.filter(w => w.is_planner && w.email)
  console.log(`\n🔐 Creating ${planners.length} new auth users with correct emails...\n`)

  const password = 'selmore2026'

  // Stap 4: Maak nieuwe users aan
  for (const planner of planners) {
    try {
      const { error } = await supabase.auth.admin.createUser({
        email: planner.email!,
        password,
        email_confirm: true,
        user_metadata: {
          naam: planner.naam,
          rol: planner.primaire_rol,
          werknemer_id: planner.werknemer_id,
        },
      })

      if (error) {
        console.error(`❌ ${planner.naam}: ${error.message}`)
      } else {
        console.log(`✅ ${planner.naam} → ${planner.email}`)

        // Update ook de users tabel
        await supabase
          .from('users')
          .update({ email: planner.email })
          .eq('naam', planner.naam)
      }
    } catch (error: any) {
      console.error(`❌ ${planner.naam}:`, error.message)
    }
  }

  console.log('\n🎉 DONE!')
  console.log('\n📋 LOGIN CREDENTIALS:')
  planners.forEach(p => {
    console.log(`   ${p.naam.padEnd(10)} → ${p.email}`)
  })
  console.log(`\n   Wachtwoord voor iedereen: ${password}`)
  console.log('\n✅ Probeer nu in te loggen in Lovable!')

  process.exit(0)
}

cleanAndRecreate()
