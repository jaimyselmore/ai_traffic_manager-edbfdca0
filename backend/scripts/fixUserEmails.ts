import { supabase } from '../src/config/supabase'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Fix user emails in Supabase
 * Update the 4 planners with correct emails
 */

async function fixEmails() {
  console.log('🔧 Fixing user emails in Supabase...\n')

  const users = [
    { naam: 'Tom', email: 'tom@selmore.com' },
    { naam: 'Tess', email: 'tess@selmore.com' },
    { naam: 'Sarah', email: 'sarah@selmore.com' },
    { naam: 'Jaimy', email: 'jaimy@selmore.com' },
  ]

  for (const user of users) {
    const { error } = await supabase
      .from('users')
      .update({ email: user.email })
      .eq('naam', user.naam)

    if (error) {
      console.error(`❌ Error updating ${user.naam}:`, error.message)
    } else {
      console.log(`✅ ${user.naam} → ${user.email}`)
    }
  }

  console.log('\n✅ All emails fixed!')
  console.log('\nJe kunt nu inloggen met:')
  console.log('  Email: jaimy@selmore.com')
  console.log('  Wachtwoord: selmore2026')

  process.exit(0)
}

fixEmails()
