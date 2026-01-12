import { supabase } from '../src/config/supabase'
import { syncGoogleSheets, getCache } from '../src/services/sheetsSync'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Create user accounts for ALL werknemers
 *
 * Dit zorgt ervoor dat:
 * - Elke werknemer kan inloggen
 * - Audit logs weten wie wat heeft gedaan
 * - Hard locks weten wie ze heeft aangemaakt
 */

async function createAllAccounts() {
  console.log('🚀 Creating user accounts for all werknemers...\n')

  // Haal werknemers op uit Google Sheets
  await syncGoogleSheets()
  const cache = getCache()

  console.log(`📊 Found ${cache.werknemers.length} werknemers\n`)

  // Tijdelijk wachtwoord voor iedereen
  const defaultPassword = 'selmore2026'
  const password_hash = await bcrypt.hash(defaultPassword, 10)

  for (const werknemer of cache.werknemers) {
    try {
      // Genereer email als die niet bestaat
      const email = werknemer.email ||
                    `${werknemer.naam.toLowerCase().replace(/\s+/g, '')}@selmore.com`

      // Check of user al bestaat
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('naam', werknemer.naam)
        .single()

      if (existingUser) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update({
            email,
            rol: werknemer.primaire_rol,
            werknemer_id: werknemer.werknemer_id,
            is_planner: werknemer.is_planner,
          })
          .eq('naam', werknemer.naam)

        if (error) {
          console.error(`❌ Error updating ${werknemer.naam}:`, error.message)
        } else {
          console.log(`🔄 ${werknemer.naam} → ${email} (updated)`)
        }
      } else {
        // Create new user
        const { error } = await supabase
          .from('users')
          .insert({
            email,
            naam: werknemer.naam,
            rol: werknemer.primaire_rol,
            werknemer_id: werknemer.werknemer_id,
            password_hash,
            is_planner: werknemer.is_planner,
          })

        if (error) {
          console.error(`❌ Error creating ${werknemer.naam}:`, error.message)
        } else {
          console.log(`✅ ${werknemer.naam} → ${email} (created)`)
        }
      }
    } catch (error: any) {
      console.error(`❌ Unexpected error for ${werknemer.naam}:`, error.message)
    }
  }

  console.log('\n✅ All user accounts created/updated!')
  console.log('\n📋 LOGIN INFO:')
  console.log('   Email: [naam]@selmore.com (bijv. jaimy@selmore.com)')
  console.log('   Wachtwoord: selmore2026')
  console.log('\n💡 Planners (is_planner=true):')

  const planners = cache.werknemers.filter(w => w.is_planner)
  planners.forEach(p => {
    const email = p.email || `${p.naam.toLowerCase()}@selmore.com`
    console.log(`   - ${p.naam} (${email})`)
  })

  process.exit(0)
}

createAllAccounts()
