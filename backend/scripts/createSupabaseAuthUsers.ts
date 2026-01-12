import { supabase } from '../src/config/supabase'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Create users in Supabase Auth
 *
 * Dit maakt de 4 planners aan in Supabase's auth systeem
 * zodat ze kunnen inloggen via Lovable's login form
 */

const planners = [
  { email: 'tom@selmore.com', password: 'selmore2026', naam: 'Tom' },
  { email: 'tess@selmore.com', password: 'selmore2026', naam: 'Tess' },
  { email: 'sarah@selmore.com', password: 'selmore2026', naam: 'Sarah' },
  { email: 'jaimy@selmore.com', password: 'selmore2026', naam: 'Jaimy' },
]

async function createAuthUsers() {
  console.log('🔐 Creating Supabase Auth users...\n')

  for (const planner of planners) {
    try {
      // Probeer user aan te maken in Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: planner.email,
        password: planner.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          naam: planner.naam,
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`⚠️  ${planner.naam} bestaat al in Supabase Auth`)
        } else {
          console.error(`❌ Error voor ${planner.naam}:`, error.message)
        }
      } else {
        console.log(`✅ ${planner.naam} aangemaakt in Supabase Auth (${planner.email})`)
      }
    } catch (error: any) {
      console.error(`❌ Unexpected error voor ${planner.naam}:`, error.message)
    }
  }

  console.log('\n✅ Klaar!')
  console.log('\n📋 LOGIN CREDENTIALS:')
  console.log('   Email: jaimy@selmore.com')
  console.log('   Wachtwoord: selmore2026')
  console.log('\n💡 Je kunt nu inloggen in Lovable!')

  process.exit(0)
}

createAuthUsers()
