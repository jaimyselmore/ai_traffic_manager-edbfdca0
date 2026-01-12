import { supabase } from '../src/config/supabase'
import dotenv from 'dotenv'

dotenv.config()

async function deleteOldEmails() {
  console.log('🗑️  Deleting users with old email format...\n')

  const oldEmails = [
    'jaimy@selmore.com',
    'tom@selmore.com',
    'tess@selmore.com',
    'sarah@selmore.com',
  ]

  for (const email of oldEmails) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('email', email)

    if (error) {
      console.error(`❌ Error deleting ${email}:`, error.message)
    } else {
      console.log(`🗑️  Deleted: ${email}`)
    }
  }

  console.log('\n✅ Old emails deleted!')
  console.log('\n📋 Remaining users:')

  const { data } = await supabase
    .from('users')
    .select('*')
    .order('naam')

  data?.forEach(user => {
    console.log(`   ✅ ${user.naam.padEnd(10)} → ${user.email}`)
  })

  console.log('\n💡 Login credentials:')
  console.log('   Email: jaimywals@selmore.com (of andere volledige email)')
  console.log('   Wachtwoord: selmore2026')

  process.exit(0)
}

deleteOldEmails()
